export function PrivacyPage() {
  return (
    <article className="flex max-w-prose flex-col gap-6 text-sm leading-relaxed">
      <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">
        Privacy
      </h1>
      <p className="text-muted-foreground">Last updated August 21, 2026.</p>
      <p>
        This policy covers j4ck.ai, operated by Jack Gisel. It is a personal
        site, not a product company.
      </p>
      <h2 className="font-heading text-lg font-semibold tracking-wider uppercase">
        What I collect
      </h2>
      <p>
        When you sign in, I store your email address, a display name derived
        from it, and session data. Sessions include a token, expiry, and may
        include IP address and user agent. Magic link emails go to the address
        you submit.
      </p>
      <h2 className="font-heading text-lg font-semibold tracking-wider uppercase">
        Where it lives
      </h2>
      <p>
        Account and session records are stored in Cloudflare D1. Object storage,
        if used, is Cloudflare R2. The Worker that handles login runs on
        Cloudflare. Magic link emails are sent with Cloudflare Email Service.
      </p>
      <h2 className="font-heading text-lg font-semibold tracking-wider uppercase">
        Cookies
      </h2>
      <p>
        A session cookie is set after you click a magic link. It is used to keep
        you signed in. Theme preference is stored in your browser with
        localStorage.
      </p>
      <h2 className="font-heading text-lg font-semibold tracking-wider uppercase">
        Sharing
      </h2>
      <p>
        I do not sell account data. Cloudflare sees what it needs to run the
        site and send mail. I will share records if required by law.
      </p>
      <h2 className="font-heading text-lg font-semibold tracking-wider uppercase">
        Retention
      </h2>
      <p>
        Sessions expire. Account rows stay until you ask me to delete them.
        Email Jack and I will remove your user record and related sessions.
      </p>
    </article>
  )
}
