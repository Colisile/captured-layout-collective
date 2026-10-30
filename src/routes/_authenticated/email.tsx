import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Loader2, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateEmail } from "@/lib/ai.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/email")({
  head: () => ({
    meta: [
      { title: "Smart Email Generator — Workwise" },
      { name: "description", content: "Compose, rewrite, reply to and proofread emails with AI." },
      { property: "og:title", content: "Smart Email Generator — Workwise" },
      { property: "og:description", content: "Compose, rewrite, reply to and proofread emails with AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmailPage,
});

type Mode = "compose" | "rewrite" | "reply" | "grammar";
type Tone = "formal" | "friendly" | "persuasive" | "professional";
const placeholders: Record<Mode, string> = {
  compose: "e.g. Ask the finance team for Q3 budget figures by Friday, mention the board meeting",
  rewrite: "Paste the email you want improved…",
  reply: "Paste the email you received…",
  grammar: "Paste the email to proofread…",
};

function EmailPage() {
  const [mode, setMode] = useState<Mode>("compose");
  const [tone, setTone] = useState<Tone>("professional");
  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const gen = useServerFn(generateEmail);
  const qc = useQueryClient();
  const history = useQuery({
    queryKey: ["emails"],
    queryFn: async () => (await supabase.from("emails").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  async function run() {
    if (!text.trim()) return toast.error("Add a description or email first.");
    setBusy(true);
    try {
      const r = await gen({ data: { mode, tone, text, context } });
      setSubject(r.subject);
      setBody(r.body);
      setNotes(r.notes);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const { error } = await supabase.from("emails").insert({ mode, tone, prompt: text, subject, body });
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["emails"] });
    qc.invalidateQueries({ queryKey: ["counts"] });
  }

  async function remove(id: string) {
    await supabase.from("emails").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["emails"] });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Smart Email Generator" subtitle="Describe it, pick a tone, get a ready-to-send email." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="compose">Compose</TabsTrigger>
              <TabsTrigger value="rewrite">Improve</TabsTrigger>
              <TabsTrigger value="reply">Reply</TabsTrigger>
              <TabsTrigger value="grammar">Grammar</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-1.5">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["professional", "formal", "friendly", "persuasive"] as const).map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{mode === "compose" ? "What should the email say?" : mode === "reply" ? "Received email" : "Your email"}</Label>
            <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholders[mode]} />
          </div>
          <div className="space-y-1.5">
            <Label>Extra context (optional)</Label>
            <Input value={context} onChange={(e) => setContext(e.target.value)} placeholder="Recipient, your name, key points…" />
          </div>
          <Button onClick={run} disabled={busy} className="w-full">
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate
          </Button>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Your subject line appears here" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Your email appears here — edit freely." />
          </div>
          {notes && <p className="text-sm text-muted-foreground">{notes}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!body} onClick={() => { navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); toast.success("Copied"); }}><Copy /> Copy</Button>
            <Button variant="secondary" disabled={!body || busy} onClick={run}><RefreshCw /> Regenerate</Button>
            <Button variant="outline" disabled={!body} onClick={save}><Save /> Save</Button>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Saved emails</h2>
        {history.data?.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {history.data.map((e) => (
              <div key={e.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <button className="text-left font-semibold hover:text-primary" onClick={() => { setSubject(e.subject); setBody(e.body); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{e.subject}</button>
                  <button onClick={() => remove(e.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete"><Trash2 className="size-4" /></button>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.body}</p>
                <p className="mt-2 text-xs capitalize text-muted-foreground">{e.tone} · {new Date(e.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing saved yet.</p>
        )}
      </section>
    </div>
  );
}
