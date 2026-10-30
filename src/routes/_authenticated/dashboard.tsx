import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, ListChecks, BookOpenText, AlertTriangle, CheckCircle2, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { sortTasks, taskStats, type Task } from "@/lib/tasks";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Workwise" },
      { name: "description", content: "Your personal productivity overview." },
      { property: "og:title", content: "Dashboard — Workwise" },
      { property: "og:description", content: "Your personal productivity overview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").maybeSingle()).data,
  });
  const tasks = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => ((await supabase.from("tasks").select("*")).data ?? []) as Task[],
  });
  const counts = useQuery({
    queryKey: ["counts"],
    queryFn: async () => {
      const [e, r] = await Promise.all([
        supabase.from("emails").select("id", { count: "exact", head: true }),
        supabase.from("research_reports").select("id", { count: "exact", head: true }),
      ]);
      return { emails: e.count ?? 0, research: r.count ?? 0 };
    },
  });
  const list = tasks.data ?? [];
  const s = taskStats(list);
  const upcoming = sortTasks(list).filter((t) => t.status !== "completed").slice(0, 5);
  const name = profile.data?.full_name || user?.email?.split("@")[0];
  const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Hello, ${name ?? "there"}`} subtitle="Here's where things stand today." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={CalendarClock} label="Due today" value={s.dueToday} />
        <Stat icon={AlertTriangle} label="Overdue" value={s.overdue} tone="text-destructive" />
        <Stat icon={CheckCircle2} label="Done this week" value={s.completedThisWeek} tone="text-success" />
        <Stat icon={ListChecks} label="Completion" value={`${pct}%`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border bg-card p-6 shadow-soft lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Up next</h2>
            <Link to="/tasks" className="text-sm text-primary hover:underline">All tasks</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open tasks. <Link to="/tasks" className="text-primary underline">Plan your day</Link>.</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="truncate">{t.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {t.due_date}
                    <Badge variant={t.priority === "high" ? "destructive" : "secondary"} className="capitalize">{t.priority}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-3">
          <Quick to="/email" icon={Mail} title="Write an email" meta={`${counts.data?.emails ?? 0} saved`} />
          <Quick to="/tasks" icon={ListChecks} title="Plan tasks" meta={`${s.pending + s.inProgress} open`} />
          <Quick to="/research" icon={BookOpenText} title="Research a topic" meta={`${counts.data?.research ?? 0} reports`} />
        </section>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone = "text-primary" }: { icon: typeof Mail; label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <Icon className={`size-5 ${tone}`} />
      <div className="mt-3 font-display text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function Quick({ to, icon: Icon, title, meta }: { to: "/email" | "/tasks" | "/research"; icon: typeof Mail; title: string; meta: string }) {
  return (
    <Link to={to} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-soft transition-transform hover:-translate-y-0.5">
      <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-5" /></div>
      <div><div className="font-semibold">{title}</div><div className="text-xs text-muted-foreground">{meta}</div></div>
    </Link>
  );
}
