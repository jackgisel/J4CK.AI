import { useEffect, useRef, useState, type ChangeEvent } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  createHomeSkill,
  deleteHomeFile,
  downloadHomeFile,
  importGuyRepo,
  listHome,
  readGuyOrigin,
  readHomeFile,
  uploadHomeFile,
  writeHomeFile,
  type Guy,
  type GuyOrigin,
  type HomeFile,
  type HomeListing,
} from "@/lib/guys"

const FILES_ROOT = "files"

export function GuyHome({
  guyId,
  importError,
  onGuy,
  onImportError,
}: {
  guyId: string
  importError?: string | null
  onGuy?: (guy: Guy) => void
  onImportError?: (error: string | null) => void
}) {
  const [revision, setRevision] = useState(0)

  return (
    <div className="flex flex-col gap-8">
      <RepoTrainer
        guyId={guyId}
        importError={importError ?? null}
        onGuy={onGuy}
        onImportError={onImportError}
        onImported={() => setRevision((value) => value + 1)}
      />
      <Cabinet key={`cabinet-${revision}`} guyId={guyId} />
      <SkillsEditor key={`skills-${revision}`} guyId={guyId} />
      <HooksEditor key={`hooks-${revision}`} guyId={guyId} />
    </div>
  )
}

function RepoTrainer({
  guyId,
  importError,
  onGuy,
  onImportError,
  onImported,
}: {
  guyId: string
  importError: string | null
  onGuy?: (guy: Guy) => void
  onImportError?: (error: string | null) => void
  onImported?: () => void
}) {
  const [origin, setOrigin] = useState<GuyOrigin | null>(null)
  const [repoUrl, setRepoUrl] = useState("")
  const [repoToken, setRepoToken] = useState("")
  const [error, setError] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const shownError = error === undefined ? importError : error

  useEffect(() => {
    let cancelled = false
    readGuyOrigin(guyId)
      .then((next) => {
        if (cancelled || !next) {
          return
        }
        setOrigin(next)
        setRepoUrl((current) => current || next.url)
      })
      .catch(() => {
        // origin is optional
      })
    return () => {
      cancelled = true
    }
  }, [guyId])

  async function train() {
    setBusy(true)
    setError(null)
    onImportError?.(null)
    try {
      const result = await importGuyRepo(guyId, {
        repoUrl,
        repoToken: repoToken.trim() || undefined,
      })
      setOrigin({
        url: result.imported.url,
        owner: result.imported.owner,
        repo: result.imported.repo,
        ref: result.imported.ref,
        sha: result.imported.sha,
        importedAt: result.imported.importedAt,
        skills: result.imported.skills,
        files: result.imported.imported.filter((row) =>
          row.path.startsWith("files/")
        ).length,
        skipped: result.imported.skipped.length,
      })
      setRepoToken("")
      onGuy?.(result.guy)
      onImported?.()
      setBusy(false)
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Could not import"
      setError(message)
      onImportError?.(message)
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Train from a repo</CardTitle>
        <CardDescription>
          Point at a GitHub repo of Cursor skills and files. Same layout you
          already use locally:{" "}
          <span className="font-mono text-xs">.cursor/skills</span>,{" "}
          <span className="font-mono text-xs">skills/*/SKILL.md</span>, and the
          working files. They copy into this guy&apos;s home.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {origin ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Trained from{" "}
            <a
              href={origin.url}
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground"
              target="_blank"
              rel="noreferrer"
            >
              {origin.owner}/{origin.repo}
            </a>{" "}
            @{origin.ref}. {origin.skills.length} skill
            {origin.skills.length === 1 ? "" : "s"}, {origin.files} file
            {origin.files === 1 ? "" : "s"}
            {origin.skipped ? `, ${origin.skipped} skipped` : ""}. Import again
            to refresh.
          </p>
        ) : null}
        {shownError ? (
          <p className="text-sm text-destructive" role="alert">
            {shownError}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="repo-url">GitHub URL</Label>
          <Input
            id="repo-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://github.com/you/books"
            value={repoUrl}
            onChange={(event) => setRepoUrl(event.currentTarget.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="repo-token">Token for private repos</Label>
          <Input
            id="repo-token"
            type="password"
            autoComplete="off"
            placeholder="Not stored"
            value={repoToken}
            onChange={(event) => setRepoToken(event.currentTarget.value)}
          />
        </div>
        <div>
          <Button
            type="button"
            disabled={busy || !repoUrl.trim()}
            onClick={() => void train()}
          >
            {busy ? "Training" : origin ? "Import again" : "Train"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Cabinet({ guyId }: { guyId: string }) {
  const [folder, setFolder] = useState(FILES_ROOT)
  const [listing, setListing] = useState<HomeListing | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [file, setFile] = useState<HomeFile | null>(null)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function refresh(path = folder) {
    const next = await listHome(guyId, path)
    setListing(next)
    setFolder(next.path || FILES_ROOT)
  }

  useEffect(() => {
    let cancelled = false
    listHome(guyId, FILES_ROOT)
      .then((next) => {
        if (!cancelled) {
          setListing(next)
          setFolder(next.path || FILES_ROOT)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load files"
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [guyId])

  async function openDir(path: string) {
    setError(null)
    setSelected(null)
    setFile(null)
    try {
      await refresh(path)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not open folder"
      )
    }
  }

  async function openFile(path: string) {
    setError(null)
    setBusy(true)
    try {
      const next = await readHomeFile(guyId, path)
      setSelected(path)
      setFile(next)
      setDraft(next.binary ? "" : next.content)
      setBusy(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read file")
      setBusy(false)
    }
  }

  async function save() {
    if (!selected || !file || file.binary) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await writeHomeFile(guyId, selected, draft)
      setFile({ ...file, content: draft, size: draft.length })
      await refresh()
      setBusy(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save")
      setBusy(false)
    }
  }

  async function remove(path: string) {
    if (!window.confirm(`Delete ${path}?`)) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await deleteHomeFile(guyId, path)
      if (selected === path) {
        setSelected(null)
        setFile(null)
      }
      await refresh()
      setBusy(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete")
      setBusy(false)
    }
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (!chosen) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await uploadHomeFile(guyId, folder, chosen)
      await refresh()
      setBusy(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload")
      setBusy(false)
    }
  }

  const parent = parentFolder(folder)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cabinet</CardTitle>
        <CardDescription>
          Books, receipts, notes. Upload from this machine. Prefer csv or
          markdown this round.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs text-muted-foreground">
            {folder || FILES_ROOT}
          </p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              onChange={onUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              Upload
            </Button>
          </div>
        </div>
        <ul className="flex flex-col border-y border-border">
          {parent ? (
            <li className="border-b border-border last:border-b-0">
              <button
                type="button"
                className="w-full px-0 py-3 text-left text-sm hover:bg-muted/40"
                onClick={() => openDir(parent)}
              >
                ../
              </button>
            </li>
          ) : null}
          {(listing?.dirs ?? []).map((dir) => (
            <li key={dir} className="border-b border-border last:border-b-0">
              <button
                type="button"
                className="w-full px-0 py-3 text-left text-sm hover:bg-muted/40"
                onClick={() => openDir(dir.replace(/\/$/, ""))}
              >
                {leaf(dir)}/
              </button>
            </li>
          ))}
          {(listing?.files ?? []).map((row) => (
            <li
              key={row.path}
              className="flex items-center justify-between gap-3 border-b border-border last:border-b-0"
            >
              <button
                type="button"
                className={`min-w-0 flex-1 py-3 text-left text-sm hover:bg-muted/40 ${
                  selected === row.path ? "text-foreground" : ""
                }`}
                onClick={() => openFile(row.path)}
              >
                {leaf(row.path)}
                <span className="ml-2 text-xs text-muted-foreground">
                  {formatSize(row.size)}
                </span>
              </button>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => downloadHomeFile(guyId, row.path)}
                >
                  Get
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={busy}
                  onClick={() => remove(row.path)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
          {listing &&
          listing.dirs.length === 0 &&
          listing.files.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">
              Empty folder.
            </li>
          ) : null}
        </ul>
        {file && selected ? (
          file.binary ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {leaf(selected)} is stored ({file.type}, {formatSize(file.size)}).
              Download it. Spreadsheets and PDFs are not parsed yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <Label htmlFor="cabinet-file">{leaf(selected)}</Label>
              <Textarea
                id="cabinet-file"
                className="min-h-48 font-mono"
                value={draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
              />
              <div>
                <Button type="button" disabled={busy} onClick={save}>
                  {busy ? "Saving" : "Save"}
                </Button>
              </div>
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  )
}

function SkillsEditor({ guyId }: { guyId: string }) {
  const [skills, setSkills] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const listing = await listHome(guyId, "skills")
    const names = listing.dirs.map((dir) => leaf(dir.replace(/\/$/, "")))
    setSkills(names)
    return names
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const listing = await listHome(guyId, "skills")
        const names = listing.dirs.map((dir) => leaf(dir.replace(/\/$/, "")))
        if (cancelled) {
          return
        }
        setSkills(names)
        const first = names[0]
        if (!first) {
          return
        }
        const file = await readHomeFile(guyId, `skills/${first}/SKILL.md`)
        if (cancelled || file.binary) {
          return
        }
        setSelected(first)
        setDraft(file.content)
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load skills"
          )
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [guyId])

  async function openSkill(skill: string) {
    setError(null)
    setBusy(true)
    try {
      const file = await readHomeFile(guyId, `skills/${skill}/SKILL.md`)
      setSelected(skill)
      setDraft(file.binary ? "" : file.content)
      setBusy(false)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not read skill"
      )
      setBusy(false)
    }
  }

  async function save() {
    if (!selected) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await writeHomeFile(guyId, `skills/${selected}/SKILL.md`, draft)
      setBusy(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save")
      setBusy(false)
    }
  }

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const created = await createHomeSkill(guyId, name)
      setName("")
      await refresh()
      await openSkill(created.name)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create")
      setBusy(false)
    }
  }

  async function remove(skill: string) {
    if (!window.confirm(`Delete skill ${skill}?`)) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await deleteHomeFile(guyId, `skills/${skill}/SKILL.md`)
      const names = await refresh()
      if (selected === skill) {
        const next = names[0]
        if (next) {
          await openSkill(next)
        } else {
          setSelected(null)
          setDraft("")
          setBusy(false)
        }
      } else {
        setBusy(false)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete")
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills</CardTitle>
        <CardDescription>
          Playbooks at skills/*/SKILL.md. Train from a GitHub repo or edit in
          place.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <ul className="flex flex-col border-y border-border">
          {skills.map((skill) => (
            <li
              key={skill}
              className="flex items-center justify-between gap-3 border-b border-border last:border-b-0"
            >
              <button
                type="button"
                className={`flex-1 py-3 text-left text-sm tracking-widest uppercase ${
                  selected === skill
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
                onClick={() => openSkill(skill)}
              >
                {skill}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={busy}
                onClick={() => remove(skill)}
              >
                Delete
              </Button>
            </li>
          ))}
          {skills.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">
              No skills yet.
            </li>
          ) : null}
        </ul>
        {selected ? (
          <div className="flex flex-col gap-3">
            <Label htmlFor="skill-file">{selected}/SKILL.md</Label>
            <Textarea
              id="skill-file"
              className="min-h-48 font-mono"
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
            />
            <div>
              <Button type="button" disabled={busy} onClick={save}>
                {busy ? "Saving" : "Save"}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Label htmlFor="skill-name">New skill</Label>
            <Input
              id="skill-name"
              value={name}
              placeholder="receipts"
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !name.trim()}
            onClick={create}
          >
            Create
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function HooksEditor({ guyId }: { guyId: string }) {
  const [onMessage, setOnMessage] = useState("")
  const [onIdle, setOnIdle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      readHomeFile(guyId, "hooks/on-message.md"),
      readHomeFile(guyId, "hooks/on-idle.md"),
    ])
      .then(([messageHook, idleHook]) => {
        if (cancelled) {
          return
        }
        setOnMessage(messageHook.binary ? "" : messageHook.content)
        setOnIdle(idleHook.binary ? "" : idleHook.content)
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load hooks"
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [guyId])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await writeHomeFile(guyId, "hooks/on-message.md", onMessage)
      await writeHomeFile(guyId, "hooks/on-idle.md", onIdle)
      setBusy(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save")
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hooks</CardTitle>
        <CardDescription>
          on-message runs each turn. on-idle fires after the thread goes quiet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="hook-message">on-message.md</Label>
          <Textarea
            id="hook-message"
            className="min-h-32 font-mono"
            value={onMessage}
            onChange={(event) => setOnMessage(event.currentTarget.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hook-idle">on-idle.md</Label>
          <Textarea
            id="hook-idle"
            className="min-h-32 font-mono"
            value={onIdle}
            onChange={(event) => setOnIdle(event.currentTarget.value)}
          />
        </div>
        <div>
          <Button type="button" disabled={busy} onClick={save}>
            {busy ? "Saving" : "Save hooks"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function parentFolder(path: string) {
  const trimmed = path.replace(/\/+$/, "")
  if (!trimmed || trimmed === FILES_ROOT) {
    return null
  }
  const parts = trimmed.split("/")
  parts.pop()
  const parent = parts.join("/")
  return parent || FILES_ROOT
}

function leaf(path: string) {
  const trimmed = path.replace(/\/+$/, "")
  return trimmed.split("/").pop() ?? trimmed
}

function formatSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  return `${Math.round(bytes / 1024)} KB`
}
