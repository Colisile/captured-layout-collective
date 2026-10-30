import { describe, it, expect } from "vitest";
import { sortTasks, taskStats, type Task } from "@/lib/tasks";

const base = { description: null, completed_at: null, created_at: "2026-10-01T00:00:00Z" };
const t = (o: Partial<Task> & { id: string }): Task => ({ title: o.id, priority: "medium", status: "pending", due_date: null, ...base, ...o });

describe("tasks", () => {
  it("sorts high before low on the same due date", () => {
    const out = sortTasks([t({ id: "a", priority: "low", due_date: "2026-11-01" }), t({ id: "b", priority: "high", due_date: "2026-11-01" })]);
    expect(out.map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("puts completed tasks last", () => {
    const out = sortTasks([t({ id: "done", status: "completed", due_date: "2026-01-01" }), t({ id: "open" })]);
    expect(out.map((x) => x.id)).toEqual(["open", "done"]);
  });
  it("counts open tasks past due as overdue", () => {
    const now = new Date(2026, 9, 30, 12);
    const s = taskStats([t({ id: "a", due_date: "2026-10-29" }), t({ id: "b", due_date: "2026-10-29", status: "completed" }), t({ id: "c", due_date: "2026-10-30" })], now);
    expect(s.overdue).toBe(1);
    expect(s.dueToday).toBe(1);
  });
});
