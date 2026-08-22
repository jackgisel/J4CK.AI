import { useState } from "react"
import { useNavigate } from "react-router"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { GuyForm } from "@/components/guy-form"
import { createGuy, type GuyInput } from "@/lib/guys"

export function NewContactPage() {
  return <NewContactForm />
}

function NewContactForm() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(value: GuyInput) {
    setSubmitting(true)
    setError(null)
    try {
      const guy = await createGuy(value)
      navigate(`/contacts/${guy.id}`, { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save")
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>New guy</CardTitle>
          <CardDescription>
            A name, a brick head, and the story they live by.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GuyForm
            submitting={submitting}
            error={error}
            submitLabel="Create"
            onSubmit={onSubmit}
          />
        </CardContent>
      </Card>
    </div>
  )
}
