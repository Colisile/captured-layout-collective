import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import type { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";
const RUN_HEADER = "X-Lovable-AIG-Run-ID";

export class AiError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

/** Stream a structured-output call through Lovable AI and return the parsed object. */
export async function generateStructured<T extends z.ZodTypeAny>(
  schema: T,
  instructions: string,
  prompt: string,
): Promise<z.infer<T>> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new AiError("AI is not configured.", 401);

  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set(RUN_HEADER, runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get(RUN_HEADER) ?? undefined;
      if (!res.ok) {
        let msg = `AI request failed (${res.status}).`;
        try {
          const j = (await res.clone().json()) as { message?: string; error?: { message?: string } };
          msg = j.message ?? j.error?.message ?? msg;
        } catch {}
        if (res.status === 429) msg = "Too many requests right now — please wait a moment and try again.";
        if (res.status === 402) msg = msg || "AI credits are used up for this workspace.";
        throw new AiError(msg, res.status);
      }
      return res;
    },
  });

  let streamError: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    prompt,
    output: Output.object({ schema }),
    maxRetries: 0,
    onError: ({ error }) => {
      streamError = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  try {
    return (await result.output) as z.infer<T>;
  } catch (e) {
    const err = streamError ?? e;
    if (err instanceof AiError) throw err;
    const cause = (err as { cause?: unknown })?.cause;
    if (cause instanceof AiError) throw cause;
    if (NoObjectGeneratedError.isInstance(e)) throw new AiError("The AI returned an unexpected answer. Please try again.");
    console.error("AI error", err);
    throw new AiError(err instanceof Error ? err.message : "AI request failed.");
  }
}
