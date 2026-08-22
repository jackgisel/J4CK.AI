/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

const ThreadTitleContext = createContext<{
  title: string | null
  setTitle: (title: string | null) => void
} | null>(null)

export function ThreadTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null)
  const value = useMemo(() => ({ title, setTitle }), [title])

  return (
    <ThreadTitleContext.Provider value={value}>
      {children}
    </ThreadTitleContext.Provider>
  )
}

export function useThreadTitle() {
  return useContext(ThreadTitleContext)?.title ?? null
}

export function useSetThreadTitle() {
  const context = useContext(ThreadTitleContext)
  if (!context) {
    throw new Error("useSetThreadTitle must be used within ThreadTitleProvider")
  }
  return context.setTitle
}
