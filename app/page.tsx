import Link from "next/link"

export default function Home() {
    return (
        <main className="flex min-h-svh flex-col items-center justify-center px-4">
            {/* Hero */}
            <div className="text-center">
                {/* Logo / Title */}
                <div className="mb-4 text-6xl">📸</div>
                <h1 className="mb-3 text-4xl font-black tracking-tight">
                    <span className="gradient-text">4コマメーカー</span>
                </h1>
                <p className="mx-auto mb-8 max-w-md text-base leading-relaxed text-text-muted">
                    YouTubeの名シーンをキャプチャして
                    <br />
                    4コマ漫画風の画像を作ろう！
                </p>

                {/* CTA */}
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

            {/* Footer */}
            <footer className="mt-20 pb-8 text-center text-xs text-text-muted">
                Made with 💜
            </footer>
        </main>
    )
}
