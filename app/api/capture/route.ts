import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import { tmpdir } from "os"
import { join } from "path"
import { readFile, unlink } from "fs/promises"
import ffmpegPath from "ffmpeg-static"

const execFileAsync = promisify(execFile)

export const maxDuration = 30

/**
 * 方法1: YouTube Innertube API (Android クライアント偽装)
 * YouTube内部APIに直接リクエスト。ライブラリ不要。
 */
async function getUrlFromInnertube(videoId: string): Promise<string | null> {
    const clients = [
        {
            name: "ANDROID",
            version: "19.09.37",
            ua: "com.google.android.youtube/19.09.37 (Linux; U; Android 14) gzip",
            body: {
                context: {
                    client: { clientName: "ANDROID", clientVersion: "19.09.37", androidSdkVersion: 34 }
                },
                videoId,
            }
        },
        {
            name: "IOS",
            version: "19.09.3",
            ua: "com.google.ios.youtube/19.09.3 (iPhone16,2; U; CPU iOS 17_4 like Mac OS X;)",
            body: {
                context: {
                    client: { clientName: "IOS", clientVersion: "19.09.3", deviceModel: "iPhone16,2" }
                },
                videoId,
            }
        },
    ]

    for (const client of clients) {
        try {
            const res = await fetch(
                "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "User-Agent": client.ua,
                    },
                    body: JSON.stringify(client.body),
                    signal: AbortSignal.timeout(8000),
                }
            )
            if (!res.ok) continue
            const data = await res.json()

            // formats（video+audio）を優先
            const formats = data?.streamingData?.formats
            if (formats?.length) {
                const fmt = formats.find((f: { url?: string }) => f.url)
                if (fmt?.url) return fmt.url
            }

            // adaptiveFormats（video-only）
            const adaptive = data?.streamingData?.adaptiveFormats
            if (adaptive?.length) {
                const vid = adaptive.find(
                    (f: { url?: string; mimeType?: string }) => f.url && f.mimeType?.startsWith("video/")
                )
                if (vid?.url) return vid.url
            }
        } catch {
            continue
        }
    }
    return null
}

/**
 * 方法2: Piped API (YouTube代替フロントエンドのAPI)
 */
async function getUrlFromPiped(videoId: string): Promise<string | null> {
    const instances = [
        "https://pipedapi.kavin.rocks",
        "https://pipedapi.in.projectsegfau.lt",
        "https://api.piped.privacydev.net",
        "https://pipedapi.adminforge.de",
    ]

    for (const base of instances) {
        try {
            const res = await fetch(`${base}/streams/${videoId}`, {
                signal: AbortSignal.timeout(8000),
            })
            if (!res.ok) continue
            const data = await res.json()

            // videoStreams
            const streams = data.videoStreams as Array<{
                url: string; quality: string; videoOnly: boolean
            }> | undefined

            if (streams?.length) {
                const mixed = streams.filter((s) => !s.videoOnly)
                const pool = mixed.length > 0 ? mixed : streams
                const pick = pool.find((s) => s.quality === "720p")
                    ?? pool.find((s) => s.quality === "480p")
                    ?? pool[0]
                if (pick?.url) return pick.url
            }
        } catch {
            continue
        }
    }
    return null
}

/**
 * 方法3: Invidious API
 */
async function getUrlFromInvidious(videoId: string): Promise<string | null> {
    const instances = [
        "https://invidious.fdn.fr",
        "https://inv.nadeko.net",
        "https://invidious.nerdvpn.de",
        "https://inv.tux.pizza",
    ]

    for (const base of instances) {
        try {
            const res = await fetch(
                `${base}/api/v1/videos/${videoId}?fields=formatStreams,adaptiveFormats`,
                { signal: AbortSignal.timeout(8000) }
            )
            if (!res.ok) continue
            const data = await res.json()

            const fmts = data.formatStreams as Array<{ url: string }> | undefined
            if (fmts?.length) return fmts[0].url

            const adaptive = data.adaptiveFormats as Array<{
                url: string; type: string
            }> | undefined
            if (adaptive?.length) {
                const vid = adaptive.find((f) => f.type?.startsWith("video/"))
                if (vid?.url) return vid.url
            }
        } catch {
            continue
        }
    }
    return null
}

export async function POST(request: NextRequest) {
    try {
        const { videoId, timestamp } = await request.json()

        if (!videoId || timestamp === undefined) {
            return NextResponse.json({ error: "videoId と timestamp を指定してください" }, { status: 400 })
        }

        if (!ffmpegPath) {
            return NextResponse.json({ error: "ffmpeg が利用できません" }, { status: 500 })
        }

        // 3つの方法を順番に試す
        const methods = [
            { name: "Innertube", fn: () => getUrlFromInnertube(videoId) },
            { name: "Piped", fn: () => getUrlFromPiped(videoId) },
            { name: "Invidious", fn: () => getUrlFromInvidious(videoId) },
        ]

        let videoUrl: string | null = null
        const errors: string[] = []

        for (const method of methods) {
            try {
                videoUrl = await method.fn()
                if (videoUrl) {
                    console.log(`Got video URL via ${method.name}`)
                    break
                }
                errors.push(`${method.name}: URL not found`)
            } catch (e) {
                errors.push(`${method.name}: ${e instanceof Error ? e.message : "error"}`)
            }
        }

        if (!videoUrl) {
            console.error("All methods failed:", errors.join(", "))
            return NextResponse.json(
                { error: `動画URL取得に全て失敗しました: ${errors.join("; ")}` },
                { status: 500 }
            )
        }

        // ffmpeg でフレーム抽出
        const outputPath = join(tmpdir(), `frame-${Date.now()}.jpg`)

        await execFileAsync(
            ffmpegPath,
            ["-ss", String(timestamp), "-i", videoUrl, "-frames:v", "1", "-q:v", "2", "-y", outputPath],
            { timeout: 25000 }
        )

        const frameBuffer = await readFile(outputPath)
        await unlink(outputPath).catch(() => { })

        return new NextResponse(frameBuffer, {
            headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" },
        })
    } catch (error) {
        console.error("Frame capture error:", error)
        const msg = error instanceof Error ? error.message : "Unknown error"
        return NextResponse.json({ error: `フレーム取得失敗: ${msg}` }, { status: 500 })
    }
}
