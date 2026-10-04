import type { ReactNode } from "react"

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <article className="mx-auto flex w-full max-w-prose flex-col gap-6 py-4 text-sm leading-relaxed md:py-8">
      <p className="kicker">Jack AI</p>
      <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
        {title}
      </h1>
      <p className="text-muted-foreground">Last updated {updated}.</p>
      {children}
    </article>
  )
}

export function LegalHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-heading text-lg font-semibold tracking-wider uppercase">
      {children}
    </h2>
  )
}
