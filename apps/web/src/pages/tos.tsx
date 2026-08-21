export function TosPage() {
  return (
    <article className="flex max-w-prose flex-col gap-6 text-sm leading-relaxed">
      <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">
        Terms of use
      </h1>
      <p className="text-muted-foreground">Last updated August 21, 2026.</p>
      <p>
        j4ck.ai is a personal site run by Jack Gisel. By using it, you agree to
        these terms.
      </p>
      <h2 className="font-heading text-lg font-semibold tracking-wider uppercase">
        Accounts
      </h2>
      <p>
        You sign in with a magic link sent to your email. Requesting a link
        creates an account if one does not already exist for that address. You
        are responsible for access to that inbox.
      </p>
      <h2 className="font-heading text-lg font-semibold tracking-wider uppercase">
        Acceptable use
      </h2>
      <p>
        Do not probe, overload, or break the site. Do not use it to send
        unsolicited mail or to impersonate anyone else. I can close an account
        or block access if this is abused.
      </p>
      <h2 className="font-heading text-lg font-semibold tracking-wider uppercase">
        Availability
      </h2>
      <p>
        The site is provided as is. Features can change or go down without
        notice. I am not liable for lost data, lost access, or anything you do
        with the service.
      </p>
      <h2 className="font-heading text-lg font-semibold tracking-wider uppercase">
        Contact
      </h2>
      <p>
        Questions about these terms: email Jack at the address on this site, or
        write to the operator of j4ck.ai.
      </p>
    </article>
  )
}
