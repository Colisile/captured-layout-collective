import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Loader2, Pencil, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { planTasks, recommendSchedule } from "@/lib/ai.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABEL, sortTasks, taskStats, toISODate, type Priority, type Status, type Task } from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "AI Task Planner — Workwise" },
      { name: "description", content: "Create, prioritise and schedule your tasks with AI." },
      { property: "og:title", content: "AI Task Planner — Workwise" },
      { property: "og:description", content: "Create, prioritise and schedule your tasks with AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

type Draft = { title: string; description: string; priority: Priority; due_date: string | null };
const emptyDraft: Draft = { title: "", description: "", priority: "medium", due_date: null };
type Plan = Awaited<ReturnType<typeof recommendSchedule>>;

function TasksPage() {
  const qc = useQueryClient();
  const plan = useServerFn(planTasks);
  const schedule = useServerFn(recommendSchedule);
  const tasks = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => ((await supabase.from("tasks").select("*")).data ?? []) as Task[],
  });
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState<"list" | "breakdown" | null>(null);
  const [suggested, setSuggested] = useState<(Draft & { keep: boolean })[]>([]);
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [planResult, setPlanResult] = useState<Plan | null>(null);
  const [planBusy, setPlanBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });
  const list = sortTasks(tasks.data ?? []).filter((t) => filter === "all" || t.status === filter);
  const s = taskStats(tasks.data ?? []);

  async function runAi(mode: "list" | "breakdown") {
    if (!aiText.trim()) return toast.error("Describe your tasks or project first.");
    setAiBusy(mode);
    try {
      const r = await plan({ data: { text: aiText, mode, today: toISODate(new Date()) } });
      setSuggested(r.map((t) => ({ ...t, keep: true })));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBusy(null);
    }
  }

  async function addSuggested() {
    const rows = suggested.filter((t) => t.keep).map(({ keep: _k, ...t }) => t);
    if (!rows.length) return;
    const { error } = await supabase.from("tasks").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Added ${rows.length} tasks`);
    setSuggested([]);
    setAiText("");
    refresh();
  }

  async function saveEdit() {
    if (!editing?.draft.title.trim()) return toast.error("Title is required");
    const d = { ...editing.draft, due_date: editing.draft.due_date || null };
    const { error } = editing.id
      ? await supabase.from("tasks").update(d).eq("id", editing.id)
      : await supabase.from("tasks").insert(d);
    if (error) return toast.error(error.message);
    setEditing(null);
    refresh();
  }

  async function setStatus(t: Task, status: Status) {
    await supabase.from("tasks").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null }).eq("id", t.id);
    refresh();
  }

  async function remove(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    refresh();
  }

  async function runSchedule() {
    setPlanBusy(true);
    try {
      setPlanResult(await schedule({ data: { today: new Date().toDateString() } }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPlanBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="AI Task Planner"
        subtitle={`${s.pending + s.inProgress} open · ${s.overdue} overdue · ${s.completedToday} done today`}
        actions={<Button onClick={() => setEditing({ draft: emptyDraft })}><Plus /> New task</Button>}
      />

      <section className="rounded-2xl border bg-card p-6 shadow-soft">
        <Label>Tell the AI what you need to get done</Label>
        <Textarea className="mt-2" rows={3} value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="e.g. Prepare the client pitch next Thursday, review 3 contracts, book travel for the Durban conference" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => runAi("list")} disabled={!!aiBusy}>{aiBusy === "list" ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate task list</Button>
          <Button variant="secondary" onClick={() => runAi("breakdown")} disabled={!!aiBusy}>{aiBusy === "breakdown" ? <Loader2 className="animate-spin" /> : <Wand2 />} Break down project</Button>
        </div>
        {suggested.length > 0 && (
          <div className="mt-5 space-y-2">
            {suggested.map((t, i) => (
              <label key={i} className="flex items-start gap-3 rounded-lg border bg-background p-3">
                <Checkbox checked={t.keep} onCheckedChange={(v) => setSuggested((p) => p.map((x, j) => (j === i ? { ...x, keep: !!v } : x)))} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-sm text-muted-foreground">{t.description}</div>
                </div>
                <PriorityBadge p={t.priority} />
                {t.due_date && <span className="text-xs text-muted-foreground">{t.due_date}</span>}
              </label>
            ))}
            <div className="flex gap-2 pt-1">
              <Button onClick={addSuggested}>Add selected</Button>
              <Button variant="ghost" onClick={() => setSuggested([])}>Discard</Button>
            </div>
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap gap-2">
            {(["all", "pending", "in_progress", "completed"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : STATUS_LABEL[f]}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            {list.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No tasks here yet.</p>}
            {list.map((t) => {
              const overdue = t.status !== "completed" && t.due_date && t.due_date < toISODate(new Date());
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
                  <Checkbox checked={t.status === "completed"} onCheckedChange={(v) => setStatus(t, v ? "completed" : "pending")} />
                  <div className="min-w-0 flex-1">
                    <div className={`font-medium ${t.status === "completed" ? "text-muted-foreground line-through" : ""}`}>{t.title}</div>
                    {t.description && <div className="truncate text-sm text-muted-foreground">{t.description}</div>}
                  </div>
                  <PriorityBadge p={t.priority} />
                  {t.due_date && <span className={`text-xs ${overdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{t.due_date}</span>}
                  <Select value={t.status} onValueChange={(v) => setStatus(t, v as Status)}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as Status[]).map((st) => <SelectItem key={st} value={st}>{STATUS_LABEL[st]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button aria-label="Edit" className="text-muted-foreground hover:text-foreground" onClick={() => setEditing({ id: t.id, draft: { title: t.title, description: t.description ?? "", priority: t.priority, due_date: t.due_date } })}><Pencil className="size-4" /></button>
                  <button aria-label="Delete" className="text-muted-foreground hover:text-destructive" onClick={() => remove(t.id)}><Trash2 className="size-4" /></button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="h-fit rounded-2xl border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Schedule & summary</h2>
            <CalendarDays className="size-5 text-primary" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Get a daily & weekly summary and a recommended plan.</p>
          <Button className="mt-4 w-full" variant="secondary" onClick={runSchedule} disabled={planBusy}>
            {planBusy ? <Loader2 className="animate-spin" /> : <Sparkles />} Recommend my schedule
          </Button>
          {planResult && (
            <div className="mt-5 space-y-4 text-sm">
              <p>{planResult.summary}</p>
              {planResult.today_focus.length > 0 && (
                <div><h3 className="mb-1 font-semibold">Focus today</h3><ul className="list-disc space-y-0.5 pl-5">{planResult.today_focus.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
              )}
              {planResult.schedule.map((d, i) => (
                <div key={i}><h3 className="font-semibold">{d.day}</h3><ul className="list-disc pl-5 text-muted-foreground">{d.items.map((x, j) => <li key={j}>{x}</li>)}</ul></div>
              ))}
              {planResult.tips.length > 0 && <div className="rounded-lg bg-secondary p-3">{planResult.tips.map((x, i) => <p key={i}>💡 {x}</p>)}</div>}
            </div>
          )}
        </section>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Title</Label><Input value={editing.draft.title} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, title: e.target.value } })} /></div>
              <div className="space-y-1.5"><Label>Description</Label><Textarea value={editing.draft.description} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, description: e.target.value } })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={editing.draft.priority} onValueChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, priority: v as Priority } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={editing.draft.due_date ?? ""} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, due_date: e.target.value } })} /></div>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={saveEdit}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PriorityBadge({ p }: { p: Priority }) {
  const cls = p === "high" ? "bg-destructive text-destructive-foreground" : p === "medium" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground";
  return <Badge className={`capitalize ${cls}`}>{p}</Badge>;
}
