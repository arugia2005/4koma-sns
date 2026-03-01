"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Link from "next/link"
import { extractVideoId } from "@/lib/youtube"

type LayoutType = "grid_2x1" | "grid_1x2" | "grid_2x2" | "vertical_4"

const LAYOUT_OPTIONS: { id: LayoutType; label: string; count: number; icon: string }[] = [
    { id: "grid_1x2", label: "横2枚", count: 2, icon: "◻◻" },
    { id: "grid_2x1", label: "縦2枚", count: 2, icon: "◻\n◻" },
    { id: "grid_2x2", label: "グリッド", count: 4, icon: "◻◻\n◻◻" },
    { id: "vertical_4", label: "4コマ", count: 4, icon: "◻\n◻\n◻\n◻" },
]

declare global {
    interface Window {
        YT: {
            Player: new (
                elementId: string,
                options: {
                    videoId: string
                    playerVars?: Record<string, unknown>
                    events?: Record<string, (event: { target: YTPlayer }) => void>
                }
            ) => YTPlayer
        }
        onYouTubeIframeAPIReady: () => void
    }
}

interface YTPlayer {
    getCurrentTime: () => number
    pauseVideo: () => void
    playVideo: () => void
    destroy: () => void
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
}

export default function CreatePage() {
    const [url, setUrl] = useState("")
    const [videoId, setVideoId] = useState<string | null>(null)
    const [captures, setCaptures] = useState<{ dataUrl: string; time: number }[]>([])
    const [layout, setLayout] = useState<LayoutType>("grid_2x2")
    const [caption, setCaption] = useState("")
    const [step, setStep] = useState<"url" | "capture" | "layout" | "preview">("url")
    const [isCapturing, setIsCapturing] = useState(false)
    const [captureError, setCaptureError] = useState<string | null>(null)
    const [apiReady, setApiReady] = useState(false)
    const playerRef = useRef<YTPlayer | null>(null)
    const previewRef = useRef<HTMLDivElement>(null)

    const requiredCount = LAYOUT_OPTIONS.find((l) => l.id === layout)?.count ?? 4

    // YouTube IFrame API
    useEffect(() => {
        if (typeof window !== "undefined" && !window.YT) {
            const tag = document.createElement("script")
            tag.src = "https://www.youtube.com/iframe_api"
            document.head.appendChild(tag)
            window.onYouTubeIframeAPIReady = () => setApiReady(true)
        } else if (window.YT) {
            setApiReady(true)
        }
    }, [])

    useEffect(() => {
        if (!videoId || !apiReady) return
        if (playerRef.current) {
            playerRef.current.destroy()
            playerRef.current = null
        }
        const timer = setTimeout(() => {
            try {
                playerRef.current = new window.YT.Player("yt-player", {
                    videoId,
                    playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
                })
            } catch (e) {
                console.error("Player error:", e)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [videoId, apiReady])

    const handleUrlSubmit = useCallback(() => {
        const id = extractVideoId(url)
        if (id) {
            setVideoId(id)
            setCaptures([])
            setCaptureError(null)
            setStep("capture")
        }
    }, [url])

    // サーバーサイドでフレームをキャプチャ
    const handleCapture = useCallback(async () => {
        if (!videoId || !playerRef.current || captures.length >= 4 || isCapturing) return

        setIsCapturing(true)
        setCaptureError(null)

        try {
            const currentTime = playerRef.current.getCurrentTime()
            playerRef.current.pauseVideo()

            // API Route にリクエスト
            const res = await fetch("/api/capture", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ videoId, timestamp: currentTime }),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: "Unknown error" }))
                throw new Error(err.error || `HTTP ${res.status}`)
            }

            // レスポンスをBlob→DataURLに変換
            const blob = await res.blob()
            const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.readAsDataURL(blob)
            })

            setCaptures((prev) => [...prev, { dataUrl, time: currentTime }])
        } catch (e) {
            console.error("Capture error:", e)
            setCaptureError(e instanceof Error ? e.message : "キャプチャに失敗しました")
        } finally {
            setIsCapturing(false)
        }
    }, [videoId, captures, isCapturing])

    const removeCapture = useCallback((index: number) => {
        setCaptures((prev) => prev.filter((_, i) => i !== index))
    }, [])

    const handleDownload = useCallback(async () => {
        if (!previewRef.current) return
        try {
            const html2canvas = (await import("html2canvas")).default
            const canvas = await html2canvas(previewRef.current, {
                backgroundColor: "#0a0a0a",
                scale: 2,
                useCORS: true,
            })
            const link = document.createElement("a")
            link.download = `4koma-${Date.now()}.png`
            link.href = canvas.toDataURL("image/png")
            link.click()
        } catch (e) {
            console.error("Download error:", e)
        }
    }, [])

    const getGridClass = () => {
        switch (layout) {
            case "grid_1x2": return "grid-cols-2 grid-rows-1"
            case "grid_2x1": return "grid-cols-1 grid-rows-2"
            case "grid_2x2": return "grid-cols-2 grid-rows-2"
            case "vertical_4": return "grid-cols-1 grid-rows-4"
        }
    }

    return (
        <main className="mx-auto min-h-svh max-w-lg pb-8">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg/95 px-4 py-3 backdrop-blur-sm">
                <Link href="/" className="text-text-muted transition-colors hover:text-text">
                    ← 戻る
                </Link>
                <h1 className="text-sm font-bold">
                    <span className="gradient-text">4コマメーカー</span>
                </h1>
                <div className="w-10" />
            </header>

            <div className="space-y-6 p-4">
                {/* Step 1: URL Input */}
                <section className="card-gradient p-5">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">1</span>
                        YouTube URL
                    </h2>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="https://youtube.com/watch?v=..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                            className="flex-1 rounded-xl bg-bg-input px-4 py-2.5 text-sm text-text placeholder-text-muted outline-none ring-1 ring-border transition-all focus:ring-accent"
                        />
                        <button onClick={handleUrlSubmit} disabled={!url} className="btn-glow px-4 py-2.5 text-sm disabled:opacity-40 disabled:shadow-none">
                            読込
                        </button>
                    </div>
                </section>

                {/* Step 2: Video + Capture */}
                {videoId && (
                    <section className="card-gradient p-5">
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">2</span>
                            シーンをキャプチャ
                            <span className="ml-auto text-xs text-text-muted">
                                {captures.length}/{requiredCount}
                            </span>
                        </h2>

                        <div className="relative mb-4 aspect-video overflow-hidden rounded-xl bg-black">
                            <div id="yt-player" className="absolute inset-0 h-full w-full" />
                        </div>

                        <div className="flex flex-col items-center gap-2">
                            <button
                                onClick={handleCapture}
                                disabled={captures.length >= requiredCount || isCapturing}
                                className="capture-btn flex h-16 w-16 items-center justify-center rounded-full bg-danger text-2xl text-white transition-all hover:scale-105 disabled:opacity-30 disabled:shadow-none"
                                style={{ animationPlayState: captures.length >= requiredCount || isCapturing ? "paused" : "running" }}
                            >
                                {isCapturing ? "⏳" : "📸"}
                            </button>
                            <p className="text-xs text-text-muted">
                                {isCapturing ? "フレームを取得中..." : "好きなシーンで一時停止してキャプチャ！"}
                            </p>
                            {captureError && (
                                <p className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs text-danger">
                                    {captureError}
                                </p>
                            )}
                        </div>

                        {captures.length > 0 && (
                            <div className="mt-4 grid grid-cols-2 gap-2">
                                {captures.map((cap, i) => (
                                    <div key={i} className="group relative aspect-video overflow-hidden rounded-lg">
                                        <img src={cap.dataUrl} alt={`Capture ${i + 1}`} className="h-full w-full object-cover" />
                                        <button
                                            onClick={() => removeCapture(i)}
                                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                                        >
                                            ✕
                                        </button>
                                        <span className="absolute bottom-1 left-1 flex h-5 items-center rounded-full bg-accent px-2 text-[10px] font-bold text-white">
                                            #{i + 1}
                                        </span>
                                        <span className="absolute bottom-1 right-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                                            {formatTime(cap.time)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {captures.length >= 2 && (
                            <button onClick={() => setStep("layout")} className="btn-glow mt-4 w-full py-2.5 text-sm">
                                レイアウトを選ぶ →
                            </button>
                        )}
                    </section>
                )}

                {/* Step 3: Layout */}
                {(step === "layout" || step === "preview") && captures.length >= 2 && (
                    <section className="card-gradient p-5">
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">3</span>
                            レイアウト選択
                        </h2>
                        <div className="grid grid-cols-4 gap-2">
                            {LAYOUT_OPTIONS.filter((l) => l.count <= captures.length).map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => { setLayout(opt.id); setStep("preview") }}
                                    className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all ${layout === opt.id ? "border-accent bg-accent/10" : "border-border bg-bg-card hover:border-accent/50"}`}
                                >
                                    <span className="whitespace-pre text-xs leading-tight text-text-muted">{opt.icon}</span>
                                    <span className="text-[11px] font-semibold text-text">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* Step 4: Preview */}
                {(step === "preview" || step === "layout") && captures.length >= 2 && (
                    <section className="card-gradient p-5">
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">4</span>
                            プレビュー＆保存
                        </h2>

                        <textarea
                            placeholder="一言コメント (100文字以内)"
                            maxLength={100}
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            className="mb-4 w-full resize-none rounded-xl bg-bg-input px-4 py-3 text-sm text-text placeholder-text-muted outline-none ring-1 ring-border transition-all focus:ring-accent"
                            rows={2}
                        />

                        <div ref={previewRef} className="overflow-hidden rounded-xl bg-bg p-3">
                            <div className={`grid gap-1 ${getGridClass()}`}>
                                {captures.slice(0, requiredCount).map((cap, i) => (
                                    <div key={i} className="aspect-video overflow-hidden rounded-lg">
                                        <img src={cap.dataUrl} alt={`Frame ${i + 1}`} className="h-full w-full object-cover" />
                                    </div>
                                ))}
                            </div>
                            {caption && (
                                <p className="mt-2 text-center text-sm font-semibold text-text">{caption}</p>
                            )}
                        </div>

                        <div className="mt-4 flex gap-3">
                            <button onClick={handleDownload} className="btn-glow flex-1 py-2.5 text-sm">
                                💾 画像を保存
                            </button>
                            <button
                                onClick={() => { setStep("url"); setVideoId(null); setCaptures([]); setCaption(""); setUrl("") }}
                                className="btn-secondary text-sm"
                            >
                                🔄 やり直す
                            </button>
                        </div>
                    </section>
                )}
            </div>
        </main>
    )
}
