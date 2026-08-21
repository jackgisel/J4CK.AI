import { Route, Routes } from "react-router"

import { SiteShell } from "@/components/site-shell"
import { DashboardPage } from "@/pages/dashboard"
import { LandingPage } from "@/pages/landing"
import { LoginPage } from "@/pages/login"
import { NotFoundPage } from "@/pages/not-found"
import { PrivacyPage } from "@/pages/privacy"
import { TosPage } from "@/pages/tos"

export function App() {
  return (
    <Routes>
      <Route element={<SiteShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tos" element={<TosPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
