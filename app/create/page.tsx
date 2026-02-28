"use client"

import { useState, useRef, useCallback } from "react"
import Link from "next/link"
import { extractVideoId, getThumbnailUrl } from "@/lib/youtube"

type LayoutType = "grid_2x1" | "grid_1x2" | "grid_2x2" | "vertical_4"

const LAYOUT_OPTIONS: { id: LayoutType; label: string; count: number; icon: string }[] = [
    { id: "grid_1x2", label: "横2枚", count: 2, icon: "◻◻" },
    { id: "grid_2x1", label: "縦2枚", count: 2, icon: "◻\n◻" },
    { id: "grid_2x2", label: "グリッド", count: 4, icon: "◻◻\n◻◻" },
    { id: "vertical_4", label: "4コマ", count: 4, icon: "◻\n◻\n◻\n◻" },
]

export default function CreatePage() {
    const [url, setUrl] = useState("")
    const [videoId, setVideoId] = useState<string | null>(null)
    const [captures, setCaptures] = useState<string[]>([])
    const [layout, setLayout] = useState<LayoutType>("grid_2x2")
    const [caption, setCaption] = useState("")
    const [step, setStep] = useState<"url" | "capture" | "layout" | "preview">("url")
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const previewRef = useRef<HTMLDivElement>(null)

    const requiredCount = LAYOUT_OPTIONS.find((l) => l.id === layout)?.count ?? 4

    // YouTube URL 処理
    const handleUrlSubmit = useCallback(() => {
        const id = extractVideoId(url)
        if (id) {
            setVideoId(id)
            setCaptures([])
            setStep("capture")
        }
    }, [url])

    // サムネイルキャプチャ（YouTube CORS制限回避のため、サムネイルAPIを使用）
    const handleCapture = useCallback(() => {
        if (!videoId || captures.length >= 4) return
        // サムネイルの異なるバリエーションを生成
        const qualities = ["maxresdefault", "hqdefault", "default", "sddefault"] as const
        const qualityIndex = captures.length % qualities.length
        const thumbUrl = getThumbnailUrl(videoId, qualities[qualityIndex] as "default" | "hqdefault" | "maxresdefault")

        setCaptures((prev) => [...prev, thumbUrl])
    }, [videoId, captures])

    // キャプチャ削除
    const removeCapture = useCallback((index: number) => {
        setCaptures((prev) => prev.filter((_, i) => i !== index))
    }, [])

    // プレビュー画像ダウンロード
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

    // レイアウトに合わせた画像描画
    const getGridClass = () => {
        switch (layout) {
            case "grid_1x2":
                return "grid-cols-2 grid-rows-1"
            case "grid_2x1":
                return "grid-cols-1 grid-rows-2"
            case "grid_2x2":
                return "grid-cols-2 grid-rows-2"
            case "vertical_4":
                return "grid-cols-1 grid-rows-4"
        }
    }

    return (
        <main className="mx-auto min-h-svh max-w-lg pb-8">
            {/* Header */}
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
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                            1
                        </span>
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
                        <button
                            onClick={handleUrlSubmit}
                            disabled={!url}
                            className="btn-glow px-4 py-2.5 text-sm disabled:opacity-40 disabled:shadow-none"
                        >
                            読込
                        </button>
                    </div>
                </section>

                {/* Step 2: Video + Capture */}
                {videoId && (
                    <section className="card-gradient p-5">
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                                2
                            </span>
                            シーンをキャプチャ
                            <span className="ml-auto text-xs text-text-muted">
                                {captures.length}/{requiredCount}
                            </span>
                        </h2>

                        {/* YouTube Player */}
                        <div className="relative mb-4 aspect-video overflow-hidden rounded-xl bg-black">
                            <iframe
                                src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
                                className="absolute inset-0 h-full w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>

                        {/* Capture button */}
                        <div className="flex justify-center">
                            <button
                                onClick={handleCapture}
                                disabled={captures.length >= requiredCount}
                                className="capture-btn flex h-16 w-16 items-center justify-center rounded-full bg-danger text-2xl text-white transition-all hover:scale-105 disabled:opacity-30 disabled:shadow-none"
                                style={{ animationPlayState: captures.length >= requiredCount ? "paused" : "running" }}
                            >
                                📸
                            </button>
                        </div>
                        <p className="mt-2 text-center text-xs text-text-muted">
                            ※ YouTubeのサムネイル画像を使用します
                        </p>

                        {/* Captured thumbnails */}
                        {captures.length > 0 && (
                            <div className="mt-4 grid grid-cols-4 gap-2">
                                {captures.map((src, i) => (
                                    <div key={i} className="group relative aspect-video overflow-hidden rounded-lg">
                                        <img src={src} alt={`Capture ${i + 1}`} className="h-full w-full object-cover" />
                                        <button
                                            onClick={() => removeCapture(i)}
                                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                                        >
                                            ✕
                                        </button>
                                        <span className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                                            {i + 1}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {captures.length >= 2 && (
                            <button
                                onClick={() => setStep("layout")}
                                className="btn-glow mt-4 w-full py-2.5 text-sm"
                            >
                                レイアウトを選ぶ →
                            </button>
                        )}
                    </section>
                )}

                {/* Step 3: Layout */}
                {step === "layout" && captures.length >= 2 && (
                    <section className="card-gradient p-5">
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                                3
                            </span>
                            レイアウト選択
                        </h2>
                        <div className="grid grid-cols-4 gap-2">
                            {LAYOUT_OPTIONS.filter((l) => l.count <= captures.length).map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => {
                                        setLayout(opt.id)
                                        setStep("preview")
                                    }}
                                    className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all ${layout === opt.id
                                            ? "border-accent bg-accent/10"
                                            : "border-border bg-bg-card hover:border-accent/50"
                                        }`}
                                >
                                    <span className="whitespace-pre text-xs leading-tight text-text-muted">
                                        {opt.icon}
                                    </span>
                                    <span className="text-[11px] font-semibold text-text">
                                        {opt.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* Step 4: Preview */}
                {(step === "preview" || step === "layout") && captures.length >= 2 && (
                    <section className="card-gradient p-5">
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                                4
                            </span>
                            プレビュー＆保存
                        </h2>

                        {/* Caption */}
                        <textarea
                            placeholder="一言コメント (100文字以内)"
                            maxLength={100}
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            className="mb-4 w-full resize-none rounded-xl bg-bg-input px-4 py-3 text-sm text-text placeholder-text-muted outline-none ring-1 ring-border transition-all focus:ring-accent"
                            rows={2}
                        />

                        {/* Preview card */}
                        <div
                            ref={previewRef}
                            className="overflow-hidden rounded-xl bg-bg p-3"
                        >
                            <div className={`grid gap-1 ${getGridClass()}`}>
                                {captures.slice(0, requiredCount).map((src, i) => (
                                    <div key={i} className="aspect-video overflow-hidden rounded-lg">
                                        <img
                                            src={src}
                                            alt={`Frame ${i + 1}`}
                                            className="h-full w-full object-cover"
                                            crossOrigin="anonymous"
                                        />
                                    </div>
                                ))}
                            </div>
                            {caption && (
                                <p className="mt-2 text-center text-sm font-semibold text-text">
                                    {caption}
                                </p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="mt-4 flex gap-3">
                            <button onClick={handleDownload} className="btn-glow flex-1 py-2.5 text-sm">
                                💾 画像を保存
                            </button>
                            <button
                                onClick={() => {
                                    setStep("url")
                                    setVideoId(null)
                                    setCaptures([])
                                    setCaption("")
                                    setUrl("")
                                }}
                                className="btn-secondary text-sm"
                            >
                                🔄 やり直す
                            </button>
                        </div>
                    </section>
                )}
            </div>

            <canvas ref={canvasRef} className="hidden" />
        </main>
    )
}
