import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import { tmpdir } from "os"
import { join } from "path"
import { readFile, unlink } from "fs/promises"
import ytdl from "@distube/ytdl-core"
import ffmpegPath from "ffmpeg-static"

const execFileAsync = promisify(execFile)

/**
 * YouTube cookies を環境変数から読み込み、ytdl-core agent を作成
 * YOUTUBE_COOKIES 環境変数に Netscape 形式の cookie を設定すると
 * bot 検出を回避できます。
 */
function createYtdlOptions() {
    const cookieStr = process.env.YOUTUBE_COOKIES
    if (cookieStr) {
        try {
            // Netscape cookie 形式をパースして agent を作成
            const cookies = cookieStr
                .split("\n")
                .filter((line) => !line.startsWith("#") && line.trim())
                .map((line) => {
                    const parts = line.split("\t")
                    if (parts.length >= 7) {
                        return {
                            name: parts[5],
                            value: parts[6],
                            domain: parts[0],
                            path: parts[2],
                        }
                    }
                    return null
                })
                .filter(Boolean) as Array<{
                    name: string
                    value: string
                    domain: string
                    path: string
                }>

            if (cookies.length > 0) {
                const agent = ytdl.createAgent(cookies)
                return { agent }
            }
        } catch (e) {
            console.warn("Cookie parse error:", e)
        }
    }

    // cookie なしの場合 - requestOptions でモバイル UA を使用
    return {
        requestOptions: {
            headers: {
                "User-Agent":
                    "com.google.android.youtube/19.09.37 (Linux; U; Android 14) gzip",
            },
        },
    }
}

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

        const ytdlOpts = createYtdlOptions()

        // ytdl-core で動画の直接 URL を取得
        const info = await ytdl.getInfo(videoId, ytdlOpts)

        // video+audio format を優先、なければ video only
        let format = ytdl.chooseFormat(info.formats, {
            quality: "highest",
            filter: (f) => f.hasVideo && f.hasAudio,
        })

        if (!format?.url) {
            format = ytdl.chooseFormat(info.formats, {
                quality: "highestvideo",
                filter: "videoonly",
            })
        }

        if (!format?.url) {
            return NextResponse.json(
                { error: "No suitable video format found" },
                { status: 500 }
            )
        }

        // ffmpeg で指定秒数のフレームを抽出
        const outputPath = join(tmpdir(), `frame-${Date.now()}.jpg`)

        await execFileAsync(
            ffmpegPath,
            [
                "-ss", String(timestamp),
                "-i", format.url,
                "-frames:v", "1",
                "-q:v", "2",
                "-y",
                outputPath,
            ],
            { timeout: 20000 }
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

        // bot 検出エラーの場合、cookie 設定を案内
        if (message.includes("Sign in") || message.includes("bot")) {
            return NextResponse.json(
                {
                    error: "YouTube bot検出エラー。YOUTUBE_COOKIES 環境変数を設定してください",
                    needsCookies: true,
                },
                { status: 403 }
            )
        }

        return NextResponse.json(
            { error: `Frame capture failed: ${message}` },
            { status: 500 }
        )
    }
}
