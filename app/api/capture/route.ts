import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import { tmpdir } from "os"
import { join } from "path"
import { readFile, unlink } from "fs/promises"
import ffmpegPath from "ffmpeg-static"

const execFileAsync = promisify(execFile)

export const maxDuration = 30

// Piped / Invidious インスタンス（複数用意してフォールバック）
const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://api.piped.projectsegfau.lt",
]

const INVIDIOUS_INSTANCES = [
    "https://inv.tux.pizza",
    "https://invidious.nerdvpn.de",
    "https://vid.puffyan.us",
]

/**
 * Piped API から動画の直接URLを取得
 */
async function getVideoUrlFromPiped(videoId: string): Promise<string | null> {
    for (const instance of PIPED_INSTANCES) {
        try {
            const res = await fetch(`${instance}/streams/${videoId}`, {
                signal: AbortSignal.timeout(8000),
            })
            if (!res.ok) continue

            const data = await res.json()
            // videoStreams から適切な品質を選択（720p > 480p > any）
            const streams = data.videoStreams as Array<{
                url: string
                quality: string
                mimeType: string
                videoOnly: boolean
            }> | undefined

            if (!streams || streams.length === 0) continue

            // video+audio を含むストリームを優先
            const mixed = streams.filter((s) => !s.videoOnly)
            if (mixed.length > 0) {
                const preferred = mixed.find((s) => s.quality === "720p")
                    ?? mixed.find((s) => s.quality === "480p")
                    ?? mixed[0]
                return preferred.url
            }

            // video-only でもOK
            const preferred = streams.find((s) => s.quality === "720p")
                ?? streams.find((s) => s.quality === "480p")
                ?? streams[0]
            return preferred.url
        } catch {
            continue
        }
    }
    return null
}

/**
 * Invidious API から動画の直接URLを取得（フォールバック）
 */
async function getVideoUrlFromInvidious(videoId: string): Promise<string | null> {
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const res = await fetch(`${instance}/api/v1/videos/${videoId}?fields=formatStreams,adaptiveFormats`, {
                signal: AbortSignal.timeout(8000),
            })
            if (!res.ok) continue

            const data = await res.json()

            // formatStreams（video+audio）を優先
            const formatStreams = data.formatStreams as Array<{
                url: string
                quality: string
                type: string
            }> | undefined

            if (formatStreams && formatStreams.length > 0) {
                const preferred = formatStreams.find((s) => s.quality === "720p")
                    ?? formatStreams.find((s) => s.quality === "480p")
                    ?? formatStreams[0]
                return preferred.url
            }

            // adaptiveFormats（video-only）
            const adaptive = data.adaptiveFormats as Array<{
                url: string
                type: string
                qualityLabel: string
            }> | undefined

            if (adaptive && adaptive.length > 0) {
                const videoFormats = adaptive.filter((f) => f.type?.startsWith("video/"))
                if (videoFormats.length > 0) {
                    return videoFormats[0].url
                }
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
            return NextResponse.json(
                { error: "videoId と timestamp を指定してください" },
                { status: 400 }
            )
        }

        if (!ffmpegPath) {
            return NextResponse.json(
                { error: "ffmpeg が利用できません" },
                { status: 500 }
            )
        }

        // Piped API で動画URLを取得 → 失敗したら Invidious にフォールバック
        let videoUrl = await getVideoUrlFromPiped(videoId)

        if (!videoUrl) {
            videoUrl = await getVideoUrlFromInvidious(videoId)
        }

        if (!videoUrl) {
            return NextResponse.json(
                { error: "動画の取得に失敗しました。別の動画を試してください。" },
                { status: 500 }
            )
        }

        // ffmpeg で指定秒数のフレームを抽出
        const outputPath = join(tmpdir(), `frame-${Date.now()}.jpg`)

        await execFileAsync(
            ffmpegPath,
            [
                "-ss", String(timestamp),
                "-i", videoUrl,
                "-frames:v", "1",
                "-q:v", "2",
                "-y",
                outputPath,
            ],
            { timeout: 25000 }
        )

        const frameBuffer = await readFile(outputPath)
        await unlink(outputPath).catch(() => { })

        return new NextResponse(frameBuffer, {
            headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "public, max-age=3600",
            },
        })
    } catch (error) {
        console.error("Frame capture error:", error)
        const message = error instanceof Error ? error.message : "Unknown error"

        return NextResponse.json(
            { error: `フレーム取得失敗: ${message}` },
            { status: 500 }
        )
    }
}
