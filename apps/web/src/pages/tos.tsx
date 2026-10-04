import { LegalHeading, LegalPage } from "@/components/legal-page"

export function TosPage() {
  return (
    <LegalPage title="Terms of use" updated="October 4, 2026">
      <p>
        Jack AI at j4ck.ai is a personal studio run by Jack Gisel. By using it,
        you agree to these terms.
      </p>
      <LegalHeading>Accounts</LegalHeading>
      <p>
        You sign in with a magic link sent to your email. Requesting a link
        creates an account if one does not already exist for that address. You
        are responsible for access to that inbox.
      </p>
      <LegalHeading>Acceptable use</LegalHeading>
      <p>
        Do not probe, overload, or break the site. Do not use it to send
        unsolicited mail or to impersonate anyone else. I can close an account
        or block access if this is abused.
      </p>
      <LegalHeading>Availability</LegalHeading>
      <p>
        The site is provided as is. Features can change or go down without
        notice. I am not liable for lost data, lost access, or anything you do
        with the service.
      </p>
      <LegalHeading>Contact</LegalHeading>
      <p>
        Questions about these terms: email Jack at the address on this site, or
        write to the operator of j4ck.ai.
      </p>
    </LegalPage>
  )
}
