import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, ExternalLink, FileUp, Loader2, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { runResearch, type ResearchReport } from "@/lib/ai.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({
    meta: [
      { title: "AI Research Assistant — Workwise" },
      { name: "description", content: "Research topics and summarise documents into structured reports." },
      { property: "og:title", content: "AI Research Assistant — Workwise" },
      { property: "og:description", content: "Research topics and summarise documents into structured reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResearchPage,
});

function reportToText(r: ResearchReport) {
  return [
    r.title, "", "Summary", r.summary, "", "Key findings",
    ...r.key_findings.map((f) => `• ${f.heading}: ${f.detail}`), "",
    ...r.sections.flatMap((s) => [s.heading, s.content, ""]),
    "Conclusion", r.conclusion, "", "References",
    ...r.references.map((x) => `- ${x.title}${x.url ? ` (${x.url})` : ""}`),
  ].join("\n");
}

function ResearchPage() {
  const [topic, setTopic] = useState("");
  const [doc, setDoc] = useState<{ name: string; text: string } | null>(null);
  const [pasted, setPasted] = useState("");
  const [depth, setDepth] = useState<"brief" | "detailed">("detailed");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const research = useServerFn(runResearch);
  const qc = useQueryClient();
  const history = useQuery({
    queryKey: ["research"],
    queryFn: async () => (await supabase.from("research_reports").select("id,topic,report,created_at").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!/\.(txt|md|csv|json|html?)$/i.test(f.name) && !f.type.startsWith("text/")) {
      return toast.error("Upload a text file (.txt, .md, .csv). For PDFs or Word, paste the text instead.");
    }
    const text = await f.text();
    setDoc({ name: f.name, text: text.slice(0, 60000) });
    if (text.length > 60000) toast.message("Long document — using the first 60,000 characters.");
  }

  async function run(q?: string) {
    const t = q ?? topic;
    if (q) setTopic(q);
    const document = [doc?.text, pasted].filter(Boolean).join("\n\n").slice(0, 60000);
    if (!t.trim() && !document.trim()) return toast.error("Enter a topic or add a document.");
    setBusy(true);
    try {
      const r = await research({ data: { topic: t, document, depth } });
      setReport(r);
      await supabase.from("research_reports").insert({ topic: t || doc?.name || "Document summary", report: r });
      qc.invalidateQueries({ queryKey: ["research"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="AI Research Assistant" subtitle="Ask a question or summarise a document into a clear report." />
      <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
        <div className="space-y-1.5">
          <Label>Research topic or question</Label>
          <Textarea rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. What are the benefits and risks of a 4-day work week for SMEs?" />
        </div>
        <div className="space-y-1.5">
          <Label>Text to summarise (optional)</Label>
          <Textarea rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste an article, report or notes…" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary">
            <FileUp className="size-4" /> Upload document
            <input type="file" className="hidden" accept=".txt,.md,.csv,.json,.html,text/*" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {doc && <Badge variant="secondary" className="gap-1">{doc.name}<button onClick={() => setDoc(null)} aria-label="Remove"><X className="size-3" /></button></Badge>}
          <div className="ml-auto flex gap-1 rounded-lg bg-muted p-1">
            {(["brief", "detailed"] as const).map((d) => (
              <Button key={d} size="sm" variant={depth === d ? "default" : "ghost"} onClick={() => setDepth(d)} className="capitalize">{d}</Button>
            ))}
          </div>
          <Button onClick={() => run()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Search />} Research</Button>
        </div>
      </section>

      {busy && !report && <p className="mt-6 text-sm text-muted-foreground">Researching… this can take up to a minute.</p>}

      {report && (
        <article className="mt-8 rounded-2xl border bg-card p-6 shadow-soft md:p-10">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-2xl font-bold md:text-3xl">{report.title}</h2>
            <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(reportToText(report)); toast.success("Copied"); }}><Copy /> Copy</Button>
          </div>
          <p className="mt-4 text-lg leading-relaxed">{report.summary}</p>
          <h3 className="mt-8 text-lg font-bold">Key findings</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {report.key_findings.map((f, i) => (
              <div key={i} className="rounded-xl border-l-4 border-accent bg-secondary/50 p-4">
                <div className="font-semibold">{f.heading}</div>
                <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
              </div>
            ))}
          </div>
          {report.sections.map((s, i) => (
            <section key={i} className="mt-8">
              <h3 className="text-lg font-bold">{s.heading}</h3>
              <p className="mt-2 whitespace-pre-line leading-relaxed">{s.content}</p>
            </section>
          ))}
          <h3 className="mt-8 text-lg font-bold">Conclusion</h3>
          <p className="mt-2 leading-relaxed">{report.conclusion}</p>
          {report.references.length > 0 && (
            <>
              <h3 className="mt-8 text-lg font-bold">References</h3>
              <p className="text-xs text-muted-foreground">AI-suggested sources — verify before citing.</p>
              <ul className="mt-2 space-y-1 text-sm">
                {report.references.map((r, i) => (
                  <li key={i}>
                    {r.url && /^https?:\/\//.test(r.url) ? (
                      <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{r.title} <ExternalLink className="size-3" /></a>
                    ) : <span className="font-medium">{r.title}</span>}
                    {r.note && <span className="text-muted-foreground"> — {r.note}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-bold">Further questions</h3>
              <ul className="mt-2 space-y-1">
                {report.follow_up_questions.map((q, i) => (
                  <li key={i}><button className="text-left text-sm text-primary hover:underline" onClick={() => run(q)}>{q}</button></li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-bold">Related topics</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {report.related_topics.map((t, i) => <Badge key={i} variant="outline" className="cursor-pointer" onClick={() => run(t)}>{t}</Badge>)}
              </div>
            </div>
          </div>
        </article>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Past reports</h2>
        {history.data?.length ? (
          <div className="space-y-2">
            {history.data.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-xl border bg-card p-3">
                <button className="truncate text-left hover:text-primary" onClick={() => { setReport(h.report as unknown as ResearchReport); window.scrollTo({ top: 300, behavior: "smooth" }); }}>{h.topic}</button>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleDateString()}
                  <button aria-label="Delete" onClick={async () => { await supabase.from("research_reports").delete().eq("id", h.id); qc.invalidateQueries({ queryKey: ["research"] }); }} className="hover:text-destructive"><Trash2 className="size-4" /></button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No reports yet.</p>}
      </section>
    </div>
  );
}
