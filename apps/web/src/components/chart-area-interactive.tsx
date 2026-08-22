import { useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import type { GuyDayStat } from "@/lib/guys"

const chartConfig = {
  sent: {
    label: "Sent",
    color: "var(--chart-1)",
  },
  received: {
    label: "Received",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive({ series }: { series: GuyDayStat[] }) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = useState<string | null>(null)
  const resolvedRange = timeRange ?? (isMobile ? "7d" : "90d")

  const days = resolvedRange === "7d" ? 7 : resolvedRange === "30d" ? 30 : 90
  const filteredData = series.slice(-days)
  const total = filteredData.reduce(
    (sum, row) => sum + row.sent + row.received,
    0
  )

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Messages</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {total === 0
              ? "No messages in this range"
              : rangeLabel(resolvedRange, true)}
          </span>
          <span className="@[540px]/card:hidden">
            {total === 0 ? "None yet" : rangeLabel(resolvedRange, false)}
          </span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={resolvedRange ? [resolvedRange] : []}
            onValueChange={(value) => {
              setTimeRange(value[0] ?? "90d")
            }}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={resolvedRange}
            onValueChange={(value) => {
              if (value !== null) {
                setTimeRange(value)
              }
            }}
          >
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a range"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillSent" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-sent)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-sent)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillReceived" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-received)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-received)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(`${value}T00:00:00`)
                return date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(`${value}T00:00:00`).toLocaleDateString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                      }
                    )
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="received"
              type="natural"
              fill="url(#fillReceived)"
              stroke="var(--color-received)"
              stackId="a"
            />
            <Area
              dataKey="sent"
              type="natural"
              fill="url(#fillSent)"
              stroke="var(--color-sent)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function rangeLabel(timeRange: string, long: boolean) {
  if (timeRange === "7d") {
    return long ? "Sent and received in the last 7 days" : "Last 7 days"
  }
  if (timeRange === "30d") {
    return long ? "Sent and received in the last 30 days" : "Last 30 days"
  }
  return long ? "Sent and received in the last 3 months" : "Last 3 months"
}
