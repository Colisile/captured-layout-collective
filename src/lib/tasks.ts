export type Priority = "high" | "medium" | "low";
export type Status = "pending" | "in_progress" | "completed";
export type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: Status;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
};

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
export const STATUS_LABEL: Record<Status, string> = { pending: "Pending", in_progress: "In Progress", completed: "Completed" };

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Open tasks first, then by due date (no date last), then by priority. */
export function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if ((a.status === "completed") !== (b.status === "completed")) return a.status === "completed" ? 1 : -1;
    const ad = a.due_date ?? "9999", bd = b.due_date ?? "9999";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  });
}

export function taskStats(tasks: Task[], now = new Date()) {
  const today = toISODate(now);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const weekAhead = toISODate(new Date(now.getTime() + 7 * 86400000));
  const open = tasks.filter((t) => t.status !== "completed");
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    overdue: open.filter((t) => t.due_date && t.due_date < today).length,
    dueToday: open.filter((t) => t.due_date === today).length,
    dueThisWeek: open.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekAhead).length,
    completedToday: tasks.filter((t) => t.completed_at && toISODate(new Date(t.completed_at)) === today).length,
    completedThisWeek: tasks.filter((t) => t.completed_at && new Date(t.completed_at) >= weekAgo).length,
  };
}
