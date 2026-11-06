import "@fontsource/russo-one"
import { Link } from "react-router"

import astronaut from "@/assets/ascii-astronaut.webp"
import "./landing.css"

const EMAIL = "jack@jackpacklabs.com"

const SEGMENTS = [
  ...Array<string>(3).fill("bg-brand-lime"),
  ...Array<string>(3).fill("bg-brand-teal"),
  ...Array<string>(3).fill("bg-brand-blue"),
  ...Array<string>(3).fill("bg-brand-pink"),
]

export function LandingPage() {
  return (
    <div className="landing">
      <img alt="" aria-hidden className="landing-astronaut" src={astronaut} />
      <div aria-hidden className="landing-backdrop" />
      <main className="flex flex-1 flex-col items-center justify-center gap-8 py-12 sm:gap-10">
        <h1 aria-label="j4ck.ai" className="wordmark">
          <span aria-hidden className="wordmark-depth">
            j4ck.ai
          </span>
          <span aria-hidden className="wordmark-face">
            j4ck.ai
          </span>
          <span aria-hidden className="wordmark-glint">
            j4ck.ai
          </span>
        </h1>
        <div aria-hidden className="landing-bars">
          {SEGMENTS.map((color, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the bars never reorder
            <span className={color} key={index} />
          ))}
        </div>
        <p className="landing-link max-w-xl text-center text-sm tracking-wide text-neutral-200 sm:text-base">
          How cheap and how long can open-weight models run?
        </p>
        <a
          className="landing-link text-sm tracking-wide text-neutral-300 sm:text-base"
          href={`mailto:${EMAIL}`}
        >
          {EMAIL}
        </a>
      </main>
      <footer className="landing-link flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pb-6 text-center text-xs tracking-wide text-neutral-400 sm:pb-8">
        <span>© {new Date().getFullYear()} j4ck.ai</span>
        <Link className="landing-link" to="/tos">
          Terms
        </Link>
        <Link className="landing-link" to="/privacy">
          Privacy
        </Link>
      </footer>
      <div aria-hidden className="landing-rail">
        {SEGMENTS.map((color, index) => (
          <span
            className={color}
            // biome-ignore lint/suspicious/noArrayIndexKey: the bars never reorder
            key={index}
            style={{ animationDelay: `${150 + index * 45}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
