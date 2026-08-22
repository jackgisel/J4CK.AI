import { useState, type FormEvent } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { GUY_COLORS, type GuyInput } from "@/lib/guys"

export function GuyForm({
  initial,
  submitting,
  error,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<GuyInput>
  submitting: boolean
  error: string | null
  submitLabel: string
  onSubmit: (value: GuyInput) => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [color, setColor] = useState(initial?.color ?? GUY_COLORS[0])
  const [backstory, setBackstory] = useState(initial?.backstory ?? "")

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({ name, color, backstory })
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="guy-name">Name</Label>
        <Input
          id="guy-name"
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label id="guy-color">Color</Label>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-labelledby="guy-color"
        >
          {GUY_COLORS.map((swatch) => {
            const selected = color.toLowerCase() === swatch
            return (
              <button
                key={swatch}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={swatch}
                className={`size-8 border transition-shadow ${
                  selected
                    ? "border-foreground ring-2 ring-ring/40"
                    : "border-transparent hover:border-foreground/40"
                }`}
                style={{ backgroundColor: swatch }}
                onClick={() => setColor(swatch)}
              />
            )
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="guy-backstory">Backstory</Label>
        <Textarea
          id="guy-backstory"
          name="backstory"
          rows={8}
          value={backstory}
          onChange={(event) => setBackstory(event.currentTarget.value)}
          placeholder="Who they are. This is the system prompt."
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving" : submitLabel}
      </Button>
    </form>
  )
}
