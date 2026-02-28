/**
 * YouTube URL からビデオ ID を抽出
 * 対応形式:
 *   - https://www.youtube.com/watch?v=XXXXXXXXXXX
 *   - https://youtu.be/XXXXXXXXXXX
 *   - https://youtube.com/shorts/XXXXXXXXXXX
 */
export function extractVideoId(url: string): string | null {
    try {
        const u = new URL(url)
        if (u.hostname.includes("youtu.be")) {
            return u.pathname.slice(1) || null
        }
        if (u.hostname.includes("youtube.com")) {
            if (u.pathname.startsWith("/shorts/")) {
                return u.pathname.replace("/shorts/", "") || null
            }
            return u.searchParams.get("v")
        }
    } catch {
        // invalid URL
    }
    return null
}

/**
 * YouTube の埋め込み URL を生成
 */
export function getEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""
        }`
}

/**
 * YouTube のサムネイル URL を取得
 */
export function getThumbnailUrl(
    videoId: string,
    quality: "default" | "hqdefault" | "maxresdefault" = "hqdefault"
): string {
    return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`
}
