import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import { tmpdir } from "os"
import { join } from "path"
import { readFile, unlink } from "fs/promises"
import ffmpegPath from "ffmpeg-static"

const execFileAsync = promisify(execFile)

// Vercel Pro なら30秒まで延長可能
export const maxDuration = 30

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

        // youtubei.js で動画の直接 URL を取得（Innertube API 使用）
        const { Innertube } = await import("youtubei.js")
        const yt = await Innertube.create({
            generate_session_locally: true,
        })

        const info = await yt.getBasicInfo(videoId)
        const formats = info.streaming_data?.formats
        const adaptiveFormats = info.streaming_data?.adaptive_formats

        // video+audio format を優先、なければ adaptive の video-only
        let videoUrl: string | null = null

        if (formats && formats.length > 0) {
            const format = formats[0]
            videoUrl = format.decipher(yt.session.player)
        }

        if (!videoUrl && adaptiveFormats) {
            const videoFormat = adaptiveFormats.find(
                (f) => f.has_video && f.quality_label
            )
            if (videoFormat) {
                videoUrl = videoFormat.decipher(yt.session.player)
            }
        }

        if (!videoUrl) {
            return NextResponse.json(
                { error: "動画の URL を取得できませんでした" },
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
