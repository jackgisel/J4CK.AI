import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"

import { Toaster } from "@workspace/ui/components/sonner"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import "@workspace/ui/globals.css"
import { App } from "./App.tsx"
import { ThemeProvider, useTheme } from "@/components/theme-provider.tsx"

function ThemedToaster() {
  const { theme } = useTheme()
  return <Toaster theme={theme} />
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <ThemedToaster />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
