import { LoaderCircleIcon, Trash2Icon } from "lucide-react"

import { RunResult } from "@/components/run-result"
import { Button } from "@workspace/ui/components/button"
import {
  type Card as BoardCardData,
  type CardStatus,
  formatDuration,
  formatUsd,
  modelName,
  type Run,
} from "@/lib/cards"

export function BoardCard({
  card,
  onMove,
  onDelete,
}: {
  card: BoardCardData
  onMove: (card: BoardCardData, status: CardStatus) => void
  onDelete: (card: BoardCardData) => void
}) {
  const draggable = card.status === "idea"
  const working = card.status === "researching" || card.status === "running"

  return (
    <article
      className={`flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      draggable={draggable}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", card.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-pretty">{card.title}</h3>
        {working ? (
          <LoaderCircleIcon
            aria-label="Agents are working"
            className="size-4 shrink-0 animate-spin text-muted-foreground"
          />
        ) : (
          <Button
            aria-label={`Delete ${card.title}`}
            className="-mt-1 -mr-1 shrink-0"
            onClick={() => onDelete(card)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <Trash2Icon />
          </Button>
        )}
      </div>

      {card.error ? (
        <p className="text-xs text-destructive" role="alert">
          {card.error}
        </p>
      ) : null}

      {card.status === "idea" ? (
        <Button
          onClick={() => onMove(card, "researching")}
          size="sm"
          type="button"
          variant="outline"
        >
          Research
        </Button>
      ) : null}

      {card.status === "running" ? <Progress card={card} /> : null}
      {card.run && card.status !== "running" ? (
        <RunReport card={card} run={card.run} />
      ) : null}

      {card.plan && card.estimate && card.status !== "done" ? (
        <Proposal card={card} onMove={onMove} />
      ) : null}
    </article>
  )
}

function Proposal({
  card,
  onMove,
}: {
  card: BoardCardData
  onMove: (card: BoardCardData, status: CardStatus) => void
}) {
  const { plan, estimate } = card
  if (!plan || !estimate) {
    return null
  }

  return (
    <div className="flex flex-col gap-3">
      {card.status === "approval" ? (
        <p className="text-muted-foreground">{plan.summary}</p>
      ) : null}
      <details className="text-xs">
        <summary className="cursor-pointer font-medium">
          {plan.steps.length} steps
        </summary>
        <ol className="mt-2 flex list-decimal flex-col gap-2 pl-4">
          {plan.steps.map((step) => (
            <li key={step.title}>
              <span className="font-medium">{step.title}.</span> {step.detail}
            </li>
          ))}
        </ol>
        {plan.unknowns.length > 0 ? (
          <>
            <p className="mt-3 font-medium">Open questions</p>
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
              {plan.unknowns.map((unknown) => (
                <li key={unknown}>{unknown}</li>
              ))}
            </ul>
          </>
        ) : null}
      </details>

      <table className="w-full text-xs tabular-nums">
        <caption className="pb-1 text-left text-muted-foreground">
          Estimated cost to run
        </caption>
        <tbody>
          {estimate.models.map((model) => (
            <tr className="border-t" key={model.id}>
              <th className="py-1 pr-2 text-left font-normal" scope="row">
                {modelName(model.id)}
              </th>
              <td className="py-1 text-right whitespace-nowrap">
                {formatUsd(model.lowUsd)} to {formatUsd(model.highUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">
        {estimate.inputTokens.toLocaleString()} in,{" "}
        {estimate.outputTokens.toLocaleString()} out. Research cost{" "}
        {formatUsd(card.spentUsd)}.
      </p>

      {card.status === "approval" || card.status === "approved" ? (
        <p className="text-xs text-muted-foreground">
          Runs on {modelName(card.runLimit.model)} and stops at{" "}
          {formatUsd(card.runLimit.budgetUsd)}. This estimate leaves out web
          searches and the pages they add, so a run can cost far more.
        </p>
      ) : null}

      {card.status === "approval" ? (
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => onMove(card, "running")}
            size="sm"
            type="button"
          >
            Approve and run
          </Button>
          <Button
            onClick={() => onMove(card, "idea")}
            size="sm"
            type="button"
            variant="outline"
          >
            Send back
          </Button>
        </div>
      ) : null}

      {card.status === "approved" ? (
        <Button onClick={() => onMove(card, "running")} size="sm" type="button">
          {card.run ? "Run again" : "Run"}
        </Button>
      ) : null}
    </div>
  )
}

function Progress({ card }: { card: BoardCardData }) {
  const { run, runLimit } = card
  if (!run) {
    return <p className="text-xs text-muted-foreground">Starting</p>
  }

  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      Step {Math.min(run.stepsDone + 1, run.stepCount)} of {run.stepCount}.{" "}
      {formatUsd(run.costUsd)} of {formatUsd(runLimit.budgetUsd)} spent.
    </p>
  )
}

function RunReport({ card, run }: { card: BoardCardData; run: Run }) {
  const tokenUsd = run.costUsd - run.searchUsd

  return (
    <div className="flex flex-col gap-3">
      <table className="w-full text-xs tabular-nums">
        <caption className="pb-1 text-left text-muted-foreground">
          {run.status === "finished" ? "Finished" : "Stopped"} in{" "}
          {formatDuration(run.startedAt, run.finishedAt ?? run.startedAt)} on{" "}
          {modelName(run.model)}
        </caption>
        <tbody>
          <RunRow label="Tokens" value={formatUsd(tokenUsd)} />
          <RunRow label="Web search" value={formatUsd(run.searchUsd)} />
          <RunRow label="This run" value={formatUsd(run.costUsd)} />
          {run.estimateUsd === null ? null : (
            <RunRow label="Estimated" value={formatUsd(run.estimateUsd)} />
          )}
          <RunRow
            label="Whole card"
            value={formatUsd(card.spentUsd + card.runSpentUsd)}
          />
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground tabular-nums">
        {run.turns} turns, {run.retries} retries.{" "}
        {run.inputTokens.toLocaleString()} in (
        {run.cachedTokens.toLocaleString()} cached),{" "}
        {run.outputTokens.toLocaleString()} out (
        {run.reasoningTokens.toLocaleString()} reasoning).
      </p>
      {run.result ? <RunResult run={run} title={card.title} /> : null}
    </div>
  )
}

function RunRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t">
      <th className="py-1 pr-2 text-left font-normal" scope="row">
        {label}
      </th>
      <td className="py-1 text-right whitespace-nowrap">{value}</td>
    </tr>
  )
}
