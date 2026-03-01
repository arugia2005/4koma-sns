"use client"

import Link from "next/link"
import { useSession, signIn, signOut } from "next-auth/react"

export default function Home() {
    const { data: session, status } = useSession()

    return (
        <main className="flex min-h-svh flex-col items-center justify-center px-4">
            {/* Auth button - top right */}
            <div className="fixed right-4 top-4 z-20">
                {status === "loading" ? (
                    <div className="h-9 w-24 animate-pulse rounded-full bg-bg-card" />
                ) : session?.user ? (
                    <div className="flex items-center gap-3">
                        {session.user.image && (
                            <img
                                src={session.user.image}
                                alt=""
                                className="h-8 w-8 rounded-full ring-2 ring-accent"
                            />
                        )}
                        <span className="hidden text-sm font-semibold text-text sm:inline">
                            {session.user.name}
                        </span>
                        <button
                            onClick={() => signOut()}
                            className="rounded-full bg-bg-card px-3 py-1.5 text-xs font-medium text-text-muted ring-1 ring-border transition-colors hover:text-text"
                        >
                            ログアウト
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => signIn("google")}
                        className="flex items-center gap-2 rounded-full bg-bg-card px-4 py-2 text-sm font-semibold text-text ring-1 ring-border transition-all hover:ring-accent"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l3.56-2.77.01-.53z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Googleでログイン
                    </button>
                )}
            </div>

            {/* Hero */}
            <div className="text-center">
                <div className="mb-4 text-6xl">📸</div>
                <h1 className="mb-3 text-4xl font-black tracking-tight">
                    <span className="gradient-text">4コマメーカー</span>
                </h1>
                <p className="mx-auto mb-8 max-w-md text-base leading-relaxed text-text-muted">
                    YouTubeの名シーンをキャプチャして
                    <br />
                    4コマ漫画風の画像を作ろう！
                </p>

                <Link href="/create">
                    <button className="btn-glow text-lg">
                        🎬 つくってみる
                    </button>
                </Link>
            </div>

            {/* How it works */}
            <div className="mt-20 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                    { icon: "🔗", title: "URLを貼る", desc: "YouTube動画のURLをペースト" },
                    { icon: "📸", title: "シーンを撮る", desc: "好きな瞬間でキャプチャ" },
                    {
                        icon: "🖼️",
                        title: "4コマにする",
                        desc: "レイアウトを選んで完成！",
                    },
                ].map((step, i) => (
                    <div key={i} className="card-gradient p-5 text-center">
                        <div className="mb-2 text-3xl">{step.icon}</div>
                        <h3 className="mb-1 text-sm font-bold text-text">{step.title}</h3>
                        <p className="text-xs text-text-muted">{step.desc}</p>
                    </div>
                ))}
            </div>

            <footer className="mt-20 pb-8 text-center text-xs text-text-muted">
                Made with 💜
            </footer>
        </main>
    )
}
