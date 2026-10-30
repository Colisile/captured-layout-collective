import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, ListChecks, BookOpenText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workwise — Emails, tasks and research, done with AI" },
      { name: "description", content: "One workspace to write professional emails, plan your week and research any topic with AI." },
      { property: "og:title", content: "Workwise — Emails, tasks and research, done with AI" },
      { property: "og:description", content: "One workspace to write professional emails, plan your week and research any topic with AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const modules = [
  { icon: Mail, title: "Smart Email Generator", text: "Compose, rewrite, reply and fix grammar in the tone you choose — subject line included." },
  { icon: ListChecks, title: "AI Task Planner", text: "Turn notes into prioritised tasks, break down big projects and get a schedule for the week." },
  { icon: BookOpenText, title: "AI Research Assistant", text: "Ask a question or drop in a document and get a structured report with findings and sources." },
];

function Index() {
  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-bold">Workwise<span className="text-accent">.</span></span>
        <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <p className="mb-4 inline-block rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">Your AI workplace assistant</p>
        <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.05] md:text-7xl">
          Less admin.<br />More <span className="text-primary underline decoration-accent decoration-8 underline-offset-8">real work</span>.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Write emails, organise your day and research faster — all in one calm workspace.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg"><Link to="/auth">Get started <ArrowRight /></Link></Button>
        </div>
        <div className="mt-20 grid gap-5 md:grid-cols-3">
          {modules.map((m) => (
            <div key={m.title} className="rounded-2xl border bg-card p-6 shadow-soft">
              <div className="mb-4 grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground"><m.icon className="size-5" /></div>
              <h3 className="text-lg font-bold">{m.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{m.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
