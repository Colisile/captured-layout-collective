import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function run<T>(fn: () => Promise<T>): Promise<T> {
  const { AiError } = await import("./ai.server");
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AiError) throw new Error(e.message);
    throw e;
  }
}

/* ---------------- Email ---------------- */
const emailInput = z.object({
  mode: z.enum(["compose", "rewrite", "reply", "grammar"]),
  tone: z.enum(["formal", "friendly", "persuasive", "professional"]),
  text: z.string().min(1).max(8000),
  context: z.string().max(4000).optional().default(""),
});

export const generateEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => emailInput.parse(d))
  .handler(async ({ data }) =>
    run(async () => {
      const { generateStructured } = await import("./ai.server");
      const task = {
        compose: "Write a complete new email from the user's short description or keywords.",
        rewrite: "Rewrite and improve the user's existing email: clearer, more effective, same intent.",
        reply: "Write a reply to the received email the user pasted. Address its points.",
        grammar: "Correct grammar, spelling and sentence structure of the user's email. Keep wording and meaning as close as possible.",
      }[data.mode];
      return generateStructured(
        z.object({ subject: z.string(), body: z.string(), notes: z.string() }),
        `You are an expert workplace communications writer. ${task} Tone: ${data.tone}. The body must include an appropriate greeting and closing with a sign-off placeholder like [Your Name] unless a name is given. Use plain text with blank lines between paragraphs. 'notes' is one short sentence on what you changed or emphasised.`,
        `${data.context ? `Extra context: ${data.context}\n\n` : ""}${data.mode === "reply" ? "Received email" : "Input"}:\n${data.text}`,
      );
    }),
  );

/* ---------------- Tasks ---------------- */
const taskSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  due_date: z.string().nullable(),
});

export const planTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ text: z.string().min(1).max(4000), mode: z.enum(["list", "breakdown"]), today: z.string() }).parse(d),
  )
  .handler(async ({ data }) =>
    run(async () => {
      const { generateStructured } = await import("./ai.server");
      const out = await generateStructured(
        z.object({ tasks: z.array(taskSchema) }),
        `You are a workplace productivity planner. Today is ${data.today}. ${
          data.mode === "breakdown"
            ? "Break the user's large project into 4-10 smaller, concrete, manageable tasks in a sensible order."
            : "Turn the user's instructions into a clear list of actionable tasks (1-10)."
        } Assign realistic priorities and due dates (YYYY-MM-DD, on/after today) when inferable, else null. Titles are short and start with a verb.`,
        data.text,
      );
      return out.tasks.slice(0, 12);
    }),
  );

export const recommendSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ today: z.string() }).parse(d))
  .handler(async ({ data, context }) =>
    run(async () => {
      const { data: tasks } = await context.supabase
        .from("tasks")
        .select("title,priority,status,due_date,completed_at")
        .order("created_at", { ascending: false })
        .limit(150);
      const { generateStructured } = await import("./ai.server");
      return generateStructured(
        z.object({
          summary: z.string(),
          today_focus: z.array(z.string()),
          schedule: z.array(z.object({ day: z.string(), items: z.array(z.string()) })),
          tips: z.array(z.string()),
        }),
        `You are a productivity coach. Today is ${data.today}. Given the user's tasks, write: 'summary' — a 2-3 sentence daily & weekly productivity summary (what got completed this week, what's at risk/overdue). 'today_focus' — up to 5 task titles to do today. 'schedule' — a recommended plan for the next 5 working days based on deadlines and priority (day label like 'Mon 2 Nov'). 'tips' — 2-3 short actionable tips. Only use tasks that exist.`,
        JSON.stringify(tasks ?? []),
      );
    }),
  );

/* ---------------- Research ---------------- */
export const researchSchema = z.object({
  title: z.string(),
  summary: z.string(),
  key_findings: z.array(z.object({ heading: z.string(), detail: z.string() })),
  sections: z.array(z.object({ heading: z.string(), content: z.string() })),
  conclusion: z.string(),
  references: z.array(z.object({ title: z.string(), url: z.string().nullable(), note: z.string() })),
  follow_up_questions: z.array(z.string()),
  related_topics: z.array(z.string()),
});
export type ResearchReport = z.infer<typeof researchSchema>;

export const runResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        topic: z.string().max(1000).default(""),
        document: z.string().max(60000).default(""),
        depth: z.enum(["brief", "detailed"]),
      })
      .refine((v) => v.topic.trim() || v.document.trim(), "Enter a topic or add a document")
      .parse(d),
  )
  .handler(async ({ data }) =>
    run(async () => {
      const { generateStructured } = await import("./ai.server");
      const hasDoc = data.document.trim().length > 0;
      return generateStructured(
        researchSchema,
        `You are a careful research assistant for professionals. ${
          hasDoc
            ? "Summarize and analyse the provided document; ground findings in it. If a question is given, answer it from the document."
            : "Research the user's topic or question from your knowledge."
        } Produce a structured report: ${data.depth === "brief" ? "3-4 key findings, 2 sections" : "5-7 key findings, 3-5 thorough sections"}. References: only list well-known, real sources you are confident exist (official sites, major publications, standards bodies) with their canonical URL; if unsure of a URL set it to null. Never invent citations. If a document was provided, include it as a reference with url null. Give 3-5 follow-up questions and 3-6 related topics.`,
        `${data.topic ? `Topic / question: ${data.topic}\n\n` : ""}${hasDoc ? `Document:\n"""\n${data.document}\n"""` : ""}`,
      );
    }),
  );
