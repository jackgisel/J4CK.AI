import { Link } from "react-router"

import { Button } from "@workspace/ui/components/button"
import { HeroField } from "@/components/hero-field"
import { SystemStatus } from "@/components/system-status"
import { useSystemStatus } from "@/hooks/use-system-status"
import { authClient } from "@/lib/auth-client"

const capabilities = [
  {
    label: "Agents",
    copy: "Invent people. Give them a face, a cabinet, a job.",
  },
  {
    label: "Workflows",
    copy: "Boards, loops, and models working in concert.",
  },
  {
    label: "Studio",
    copy: "Prompt a picture. Keep the thread. Run locally.",
  },
  {
    label: "Field kit",
    copy: "A Mac CLI that keeps their files in sync.",
  },
]

export function LandingPage() {
  const { data: session, isPending } = authClient.useSession()
  const status = useSystemStatus()
  const signedIn = Boolean(session)

  return (
    <div className="flex flex-1 flex-col justify-center gap-16">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
        <div className="flex max-w-xl min-w-0 flex-col gap-6">
          <p className="kicker">The future of agent autonomy</p>
          <h1 className="font-heading text-5xl leading-[0.95] font-semibold tracking-tight md:text-7xl">
            Welcome to
            <span className="block">Jack AI</span>
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
            A private studio for agents you invent. They remember, they write
            back, and they work on your terms.
          </p>
          <div>
            {isPending ? (
              <Button disabled>Enter</Button>
            ) : (
              <Button render={<Link to={signedIn ? "/dashboard" : "/login"} />}>
                {signedIn ? "Open studio" : "Enter"}
              </Button>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <HeroField className="hidden sm:block" />
        </div>
      </div>

      <ul className="grid gap-8 border-t border-border pt-10 sm:grid-cols-2 lg:grid-cols-4">
        {capabilities.map((item) => (
          <li key={item.label} className="flex flex-col gap-2">
            <p className="kicker text-foreground">{item.label}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {item.copy}
            </p>
          </li>
        ))}
      </ul>

      <SystemStatus {...status} />
    </div>
  )
}
