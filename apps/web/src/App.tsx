import { Route, Routes } from "react-router"

import { AppShell } from "@/components/app-shell"
import { SiteShell } from "@/components/site-shell"
import { CliPage } from "@/pages/cli"
import { ContactPage } from "@/pages/contact"
import { NewContactPage } from "@/pages/contact-new"
import { ContactsPage } from "@/pages/contacts"
import { DashboardPage } from "@/pages/dashboard"
import { LandingPage } from "@/pages/landing"
import { LoginPage } from "@/pages/login"
import { MessagesPage } from "@/pages/messages"
import { NotFoundPage } from "@/pages/not-found"
import { PrivacyPage } from "@/pages/privacy"
import { ThreadPage } from "@/pages/thread"
import { TosPage } from "@/pages/tos"
import { WorkflowEditorPage } from "@/pages/workflow-editor"
import { WorkflowRunPage } from "@/pages/workflow-run"
import { WorkflowsPage } from "@/pages/workflows"

export function App() {
  return (
    <Routes>
      <Route element={<SiteShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/tos" element={<TosPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Route>
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/contacts/new" element={<NewContactPage />} />
        <Route path="/contacts/:id" element={<ContactPage />} />
        <Route path="/cli" element={<CliPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:id" element={<ThreadPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/workflows/:id" element={<WorkflowEditorPage />} />
        <Route path="/workflows/:id/runs/:runId" element={<WorkflowRunPage />} />
      </Route>
      <Route element={<SiteShell />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
