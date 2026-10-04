import { Navigate, Route, Routes } from "react-router"

import { AppShell } from "@/components/app-shell"
import { PublicChrome, SiteShell } from "@/components/site-shell"
import { authClient } from "@/lib/auth-client"
import { ListsPage } from "@/pages/lists"
import { LoginPage } from "@/pages/login"
import { NotFoundPage } from "@/pages/not-found"
import { PrivacyPage } from "@/pages/privacy"
import { TasksPage } from "@/pages/tasks"
import { TosPage } from "@/pages/tos"

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route element={<SiteShell />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/tos" element={<TosPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Route>
      <Route element={<AppShell />}>
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/lists" element={<ListsPage />} />
      </Route>
      <Route element={<SiteShell />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

function RootRedirect() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <PublicChrome>
        <p className="flex flex-1 items-center text-sm text-muted-foreground">
          Loading…
        </p>
      </PublicChrome>
    )
  }

  return <Navigate to={session ? "/tasks" : "/login"} replace />
}
