import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { GuyForm } from "@/components/guy-form"
import { GuyHome } from "@/components/guy-home"
import {
  deleteGuy,
  getGuy,
  updateGuy,
  type Guy,
  type GuyInput,
} from "@/lib/guys"

export function ContactPage() {
  return <ContactEditor />
}

function ContactEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [guy, setGuy] = useState<Guy | null>(null)
  const [missing, setMissing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(
    location.state &&
      typeof location.state === "object" &&
      "importError" in location.state &&
      typeof location.state.importError === "string"
      ? location.state.importError
      : null
  )

  useEffect(() => {
    if (!id) {
      return
    }
    let cancelled = false
    getGuy(id)
      .then((row) => {
        if (!cancelled) {
          setGuy(row)
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return
        }
        const message =
          caught instanceof Error ? caught.message : "Could not load"
        if (message === "Not found") {
          setMissing(true)
          return
        }
        setLoadError(message)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (missing || !id) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Missing
        </h1>
        <p className="text-base text-muted-foreground">No guy with that id.</p>
        <div>
          <Button variant="outline" render={<Link to="/contacts" />}>
            Contacts
          </Button>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {loadError}
      </p>
    )
  }

  if (!guy) {
    return <p className="text-sm text-muted-foreground">Loading</p>
  }

  async function onSubmit(value: GuyInput) {
    if (!id) {
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const next = await updateGuy(id, value)
      setGuy(next)
      setSubmitting(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save")
      setSubmitting(false)
    }
  }

  async function onDelete() {
    if (!id || !guy) {
      return
    }
    if (!window.confirm(`Delete ${guy.name}? Messages go with them.`)) {
      return
    }
    setDeleting(true)
    setError(null)
    try {
      await deleteGuy(id)
      navigate("/contacts", { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete")
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex max-w-xl flex-col gap-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">
            {guy.name}
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Edit who they are, train them from a skills repo, or write them.
          </p>
        </div>
        <Button variant="outline" render={<Link to={`/messages/${guy.id}`} />}>
          Message
        </Button>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Name, plastic, face, backstory.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <GuyForm
            key={guy.id}
            initial={guy}
            submitting={submitting}
            error={error}
            submitLabel="Save"
            onSubmit={onSubmit}
          />
          <Button
            type="button"
            variant="destructive"
            disabled={deleting || submitting}
            onClick={onDelete}
          >
            {deleting ? "Deleting" : "Delete"}
          </Button>
        </CardContent>
      </Card>
      <GuyHome
        guyId={guy.id}
        importError={importError}
        onGuy={setGuy}
        onImportError={setImportError}
      />
    </div>
  )
}
