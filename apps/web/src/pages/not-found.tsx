import { Link } from "react-router"

import { Button } from "@workspace/ui/components/button"

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <p className="kicker">404</p>
      <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-6xl">
        This coordinate is empty
      </h1>
      <p className="max-w-md text-base leading-relaxed text-muted-foreground">
        That path is not a page on Jack AI.
      </p>
      <div>
        <Button variant="outline" render={<Link to="/" />}>
          Home
        </Button>
      </div>
    </div>
  )
}
