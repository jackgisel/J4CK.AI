import { useRef } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import type { Run } from "@/lib/cards"

const PROSE =
  "flex flex-col gap-3 text-sm [&_a]:underline [&_a]:underline-offset-2 [&_h1]:text-base [&_h1]:font-medium [&_h2]:text-base [&_h2]:font-medium [&_h3]:font-medium [&_li]:ml-4 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:text-xs [&_table]:w-full [&_table]:text-xs [&_td]:border-t [&_td]:p-1.5 [&_td]:align-top [&_th]:p-1.5 [&_th]:text-left [&_ul]:list-disc"

export function RunResult({ run, title }: { run: Run; title: string }) {
  const finished = run.status === "finished"
  // Focus would otherwise land on the sources and open the sheet at the bottom.
  const body = useRef<HTMLDivElement>(null)

  return (
    <Sheet>
      <SheetTrigger
        render={<Button size="sm" type="button" variant="outline" />}
      >
        {finished ? "Read result" : "Read notes so far"}
      </SheetTrigger>
      <SheetContent
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
        initialFocus={body}
      >
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none"
          ref={body}
          tabIndex={-1}
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {finished
                ? `${run.sources.length} sources`
                : "This run stopped early, so this is unfinished."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-6 px-4 pb-6">
            <div className={PROSE}>
              <Markdown remarkPlugins={[remarkGfm]}>{run.result}</Markdown>
            </div>
            {run.sources.length > 0 ? (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium">
                  Sources
                </summary>
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
                  {run.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        className="underline underline-offset-2"
                        href={source.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
