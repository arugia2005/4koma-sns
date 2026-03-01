import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import { tmpdir } from "os"
import { join } from "path"
import { readFile, unlink } from "fs/promises"
import ytdl from "@distube/ytdl-core"
import ffmpegPath from "ffmpeg-static"

const execFileAsync = promisify(execFile)

export async function POST(request: NextRequest) {
    try {
        const { videoId, timestamp } = await request.json()

        if (!videoId || timestamp === undefined) {
            return NextResponse.json(
                { error: "videoId and timestamp are required" },
                { status: 400 }
            )
        }

        if (!ffmpegPath) {
            return NextResponse.json(
                { error: "ffmpeg not available" },
                { status: 500 }
            )
        }

        // ytdl-core で動画の直接URLを取得
        const info = await ytdl.getInfo(videoId)
        const format = ytdl.chooseFormat(info.formats, {
            quality: "highest",
            filter: (f) => f.hasVideo && f.hasAudio,
        })

        if (!format || !format.url) {
            // fallback: video-only format
            const videoOnly = ytdl.chooseFormat(info.formats, {
                quality: "highestvideo",
                filter: "videoonly",
            })
            if (!videoOnly || !videoOnly.url) {
                return NextResponse.json(
                    { error: "No suitable format found" },
                    { status: 500 }
                )
            }
            format.url = videoOnly.url
        }

        const videoUrl = format.url

        // ffmpeg で指定秒数のフレームを抽出
        const outputPath = join(tmpdir(), `frame-${Date.now()}.jpg`)

        await execFileAsync(ffmpegPath, [
            "-ss", String(timestamp),
            "-i", videoUrl,
            "-frames:v", "1",
            "-q:v", "2",
            "-y",
            outputPath,
        ], { timeout: 15000 })

        // フレーム画像を読み込んで返す
        const frameBuffer = await readFile(outputPath)

        // 一時ファイルを削除
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
            { error: `Frame capture failed: ${message}` },
            { status: 500 }
        )
    }
}
