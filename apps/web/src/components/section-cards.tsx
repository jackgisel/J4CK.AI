import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

const cardClass = "@container/card rounded-none bg-card shadow-none ring-0"

export function SectionCards({
  guys,
  active,
  waiting,
  quiet,
}: {
  guys: number
  active: number
  waiting: number
  quiet: number
}) {
  return (
    <div className="grid grid-cols-1 gap-px bg-border px-0 lg:mx-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className={cardClass}>
        <CardHeader>
          <CardDescription>Guys</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {guys}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">People you invented</div>
          <div className="text-muted-foreground">
            Name, a brick head, a backstory
          </div>
        </CardFooter>
      </Card>
      <Card className={cardClass}>
        <CardHeader>
          <CardDescription>In a thread</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {active}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">At least one message</div>
          <div className="text-muted-foreground">Someone has written</div>
        </CardFooter>
      </Card>
      <Card className={cardClass}>
        <CardHeader>
          <CardDescription>Waiting on them</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {waiting}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">Last line was yours</div>
          <div className="text-muted-foreground">
            They have not answered yet
          </div>
        </CardFooter>
      </Card>
      <Card className={cardClass}>
        <CardHeader>
          <CardDescription>Not written yet</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {quiet}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">Still unused</div>
          <div className="text-muted-foreground">
            Make a guy, then write them
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
