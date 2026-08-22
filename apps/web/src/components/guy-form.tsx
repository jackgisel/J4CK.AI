import { useState, type FormEvent, type ReactNode } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { GuyMark } from "@/components/guy-mark"
import {
  AVATAR_EYES,
  AVATAR_FACIAL_HAIR,
  AVATAR_HATS,
  asAvatarEyes,
  asAvatarFacialHair,
  asAvatarHat,
  type AvatarEyes,
  type AvatarFacialHair,
  type AvatarHat,
} from "@/lib/avatar"
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
  const [avatarEyes, setAvatarEyes] = useState<AvatarEyes>(
    asAvatarEyes(initial?.avatarEyes)
  )
  const [avatarFacialHair, setAvatarFacialHair] = useState<AvatarFacialHair>(
    asAvatarFacialHair(initial?.avatarFacialHair)
  )
  const [avatarHat, setAvatarHat] = useState<AvatarHat>(
    asAvatarHat(initial?.avatarHat)
  )
  const [backstory, setBackstory] = useState(initial?.backstory ?? "")

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({
      name,
      color,
      backstory,
      avatarEyes,
      avatarFacialHair,
      avatarHat,
    })
  }

  const preview = { color, avatarEyes, avatarFacialHair, avatarHat }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <div className="flex flex-col items-center gap-2 py-2">
        <GuyMark {...preview} className="size-24" />
        <p className="text-[0.625rem] font-semibold tracking-widest text-muted-foreground uppercase">
          Head
        </p>
      </div>
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
        <Label id="guy-color">Plastic</Label>
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
      <TraitRow
        label="Eyes"
        value={avatarEyes}
        options={AVATAR_EYES}
        onChange={setAvatarEyes}
        render={(option) => (
          <GuyMark {...preview} avatarEyes={option} className="size-9" />
        )}
      />
      <TraitRow
        label="Hair"
        value={avatarFacialHair}
        options={AVATAR_FACIAL_HAIR}
        onChange={setAvatarFacialHair}
        render={(option) => (
          <GuyMark {...preview} avatarFacialHair={option} className="size-9" />
        )}
      />
      <TraitRow
        label="Hat"
        value={avatarHat}
        options={AVATAR_HATS}
        onChange={setAvatarHat}
        render={(option) => (
          <GuyMark {...preview} avatarHat={option} className="size-9" />
        )}
      />
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

function TraitRow<T extends string>({
  label,
  value,
  options,
  onChange,
  render,
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  render: (option: T) => ReactNode
}) {
  const labelId = `guy-${label.toLowerCase()}`

  return (
    <div className="flex flex-col gap-2">
      <Label id={labelId}>{label}</Label>
      <div
        className="flex flex-wrap gap-1"
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {options.map((option) => {
          const selected = value === option
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option}
              className={`border p-0.5 ${
                selected
                  ? "border-foreground ring-2 ring-ring/40"
                  : "border-transparent hover:border-foreground/40"
              }`}
              onClick={() => onChange(option)}
            >
              {render(option)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
