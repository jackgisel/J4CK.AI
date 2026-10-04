import { api } from "@/lib/api"

export type Task = {
  id: string
  title: string
  done: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export async function listTasks() {
  const data = await api<{ tasks: Task[] }>("/api/tasks")
  return data.tasks
}

export async function createTask(title: string) {
  const data = await api<{ task: Task }>("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ title }),
  })
  return data.task
}

export async function updateTask(
  id: string,
  input: Partial<Pick<Task, "title" | "done">>
) {
  const data = await api<{ task: Task }>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return data.task
}

export async function deleteTask(id: string) {
  await api<void>(`/api/tasks/${id}`, { method: "DELETE" })
}
