import { useRef, useState } from "react"

import { Input } from "@workspace/ui/components/input"

export function InlineInput({
  label,
  placeholder,
  initial,
  onSubmit,
  onCancel,
}: {
  label: string
  placeholder?: string
  initial: string
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const done = useRef(false)

  function finish(commit: boolean) {
    if (done.current) {
      return
    }
    done.current = true
    const next = value.trim()
    if (commit && next) {
      onSubmit(next)
    } else {
      onCancel()
    }
  }

  return (
    <Input
      autoFocus
      aria-label={label}
      placeholder={placeholder}
      className="h-9 flex-1"
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          finish(true)
        } else if (event.key === "Escape") {
          finish(false)
        }
      }}
    />
  )
}
