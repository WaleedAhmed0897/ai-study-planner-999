import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---- helpers ----
async function callAI(messages: Array<{ role: string; content: string }>, opts?: { json?: boolean }) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const body: Record<string, unknown> = {
    model: "google/gemini-3.5-flash",
    messages,
  };
  if (opts?.json) body.response_format = { type: "json_object" };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("AI is busy right now. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    const t = await res.text();
    throw new Error(`AI request failed: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  return content;
}

// ---- Assistant chat ----
export const sendAssistantMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ threadId: z.string().uuid(), message: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // verify thread ownership
    const { data: thread } = await supabase
      .from("ai_threads")
      .select("id, title")
      .eq("id", data.threadId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");

    // insert user message
    await supabase.from("ai_messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "user",
      content: data.message,
    });

    // load history
    const { data: history } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });

    const messages = [
      {
        role: "system",
        content:
          "You are an expert AI Study Assistant. You help students learn: answer questions clearly, explain difficult topics with analogies, summarize text, generate study notes, simplify concepts, and give practical study tips. Use markdown, be concise but thorough. When helpful, use bullet points, examples, and step-by-step explanations.",
      },
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
    ];

    const reply = await callAI(messages);

    await supabase.from("ai_messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "assistant",
      content: reply,
    });

    // Title generation for first exchange
    if (thread.title === "New chat") {
      const title =
        data.message.length > 60 ? data.message.slice(0, 57).trim() + "…" : data.message;
      await supabase.from("ai_threads").update({ title }).eq("id", data.threadId);
    } else {
      await supabase
        .from("ai_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", data.threadId);
    }

    return { reply };
  });

// ---- Notes generation ----
export const generateNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ topic: z.string().min(2).max(300) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const raw = await callAI(
      [
        {
          role: "system",
          content:
            'You generate study notes. Reply ONLY as strict JSON matching this shape: {"detailed": string (markdown, 300-600 words), "short": string (markdown summary, ~120 words), "bullets": string (markdown bulleted list of 8-14 key points), "key_concepts": string (markdown list of 5-10 key terms with 1-line definitions)}. No extra prose.',
        },
        { role: "user", content: `Topic: ${data.topic}` },
      ],
      { json: true },
    );

    let parsed: { detailed: string; short: string; bullets: string; key_concepts: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { detailed: raw, short: "", bullets: "", key_concepts: "" };
    }

    const { data: row, error } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        topic: data.topic,
        detailed: parsed.detailed ?? "",
        short: parsed.short ?? "",
        bullets: parsed.bullets ?? "",
        key_concepts: parsed.key_concepts ?? "",
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

// ---- Quiz generation ----
export type QuizQuestion = {
  type: "mcq" | "tf" | "short";
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
};

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        topic: z.string().min(2).max(300),
        count: z.number().int().min(3).max(15).default(8),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const raw = await callAI(
      [
        {
          role: "system",
          content:
            'You generate quizzes. Reply ONLY as strict JSON: {"questions":[ {"type":"mcq"|"tf"|"short","question":string,"options":string[] (4 options for mcq, ["True","False"] for tf, omit for short),"answer":string (exact matching option text, or "True"/"False", or short-answer text),"explanation":string} ] }. Mix types: ~50% mcq, ~30% tf, ~20% short. Questions must be factual and about the given topic.',
        },
        { role: "user", content: `Topic: ${data.topic}. Generate ${data.count} questions.` },
      ],
      { json: true },
    );

    let parsed: { questions: QuizQuestion[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { questions: [] };
    }

    const { data: row, error } = await supabase
      .from("quizzes")
      .insert({
        user_id: userId,
        topic: data.topic,
        questions: parsed.questions ?? [],
        total: parsed.questions?.length ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const submitQuizScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ quizId: z.string().uuid(), score: z.number().int().min(0) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("quizzes")
      .update({ score: data.score, completed_at: new Date().toISOString() })
      .eq("id", data.quizId);
    if (error) throw error;
    return { ok: true };
  });
