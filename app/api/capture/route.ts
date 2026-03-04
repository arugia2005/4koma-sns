import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import { tmpdir } from "os"
import { join } from "path"
import { readFile, unlink } from "fs/promises"
import ffmpegPath from "ffmpeg-static"

const execFileAsync = promisify(execFile)

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

        // youtubei.js で動画情報を取得
        const { Innertube } = await import("youtubei.js")
        const yt = await Innertube.create({
            generate_session_locally: true,
            retrieve_player: true,
        })

        // getInfo で完全な情報を取得（getBasicInfo だとストリーミングデータが欠けることがある）
        const info = await yt.getInfo(videoId)

        if (!info.streaming_data) {
            return NextResponse.json(
                { error: "ストリーミングデータを取得できませんでした" },
                { status: 500 }
            )
        }

        // URL を取得: formats → adaptive_formats の順に試す
        let videoUrl: string | null = null

        // 1. 通常フォーマット（video+audio）を試す
        const formats = info.streaming_data.formats
        if (formats && formats.length > 0) {
            for (const fmt of formats) {
                try {
                    // url が直接ある場合
                    if (fmt.url) {
                        videoUrl = fmt.url
                        break
                    }
                    // decipher が必要な場合
                    const deciphered = fmt.decipher(yt.session.player)
                    if (deciphered) {
                        videoUrl = deciphered
                        break
                    }
                } catch {
                    continue
                }
            }
        }

        // 2. アダプティブフォーマット（video-only）を試す
        if (!videoUrl) {
            const adaptive = info.streaming_data.adaptive_formats
            if (adaptive && adaptive.length > 0) {
                // video を含むフォーマットをフィルター
                const videoFormats = adaptive.filter((f) => f.has_video)
                for (const fmt of videoFormats) {
                    try {
                        if (fmt.url) {
                            videoUrl = fmt.url
                            break
                        }
                        const deciphered = fmt.decipher(yt.session.player)
                        if (deciphered) {
                            videoUrl = deciphered
                            break
                        }
                    } catch {
                        continue
                    }
                }
            }
        }

        if (!videoUrl) {
            console.error("No video URL found. Formats:", JSON.stringify({
                formatsCount: info.streaming_data.formats?.length ?? 0,
                adaptiveCount: info.streaming_data.adaptive_formats?.length ?? 0,
            }))
            return NextResponse.json(
                { error: "動画の URL を取得できませんでした。この動画は制限されている可能性があります。" },
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

        if (message.includes("Sign in") || message.includes("bot")) {
            return NextResponse.json(
                { error: "YouTubeのアクセス制限に引っかかりました。別の動画を試してみてください。" },
                { status: 403 }
            )
        }

        return NextResponse.json(
            { error: `フレーム取得失敗: ${message}` },
            { status: 500 }
        )
    }
}
