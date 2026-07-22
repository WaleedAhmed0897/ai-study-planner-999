import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateQuiz, submitQuizScore, type QuizQuestion } from "@/lib/ai.functions";
import { PageContainer, PageHeader, EmptyState } from "@/components/ui-primitives";
import { Brain, Sparkles, Loader2, CheckCircle2, XCircle, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quiz")({
  head: () => ({
    meta: [
      { title: "AI Quiz Generator — Scholar" },
      { name: "description", content: "Generate custom quizzes on any topic." },
    ],
  }),
  component: QuizPage,
});

function QuizPage() {
  const qc = useQueryClient();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const [activeId, setActiveId] = useState<string | null>(null);
  const gen = useServerFn(generateQuiz);
  const submit = useServerFn(submitQuizScore);

  const { data: quizzes } = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("quizzes")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => gen({ data: { topic, count } }),
    onSuccess: (row: any) => {
      toast.success("Quiz ready");
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      setActiveId(row.id);
      setTopic("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const active = quizzes?.find((q) => q.id === activeId);

  async function remove(id: string) {
    if (!confirm("Delete this quiz?")) return;
    await supabase.from("quizzes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["quizzes"] });
    if (activeId === id) setActiveId(null);
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="AI Quiz"
        title="Quiz generator"
        description="Generate MCQ, True/False, and short-answer questions on any topic."
      />

      <div className="card-elevated p-5 mb-8">
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic — e.g. Cell biology"
            className="rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="rounded-xl border border-input bg-background px-3 py-3 text-sm"
          >
            {[5, 8, 10, 12, 15].map((n) => (
              <option key={n} value={n}>{n} questions</option>
            ))}
          </select>
          <button
            onClick={() => topic.trim() && mut.mutate()}
            disabled={mut.isPending || !topic.trim()}
            className="rounded-xl gradient-warm text-primary-foreground px-5 py-3 text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            {mut.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate</>
            )}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <h2 className="font-display text-lg mb-3">Recent quizzes</h2>
          {(!quizzes || quizzes.length === 0) && (
            <p className="text-sm text-muted-foreground">No quizzes yet.</p>
          )}
          <ul className="space-y-2">
            {quizzes?.map((q) => (
              <li key={q.id} className={`flex items-center gap-2 rounded-xl border p-3 transition ${
                activeId === q.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
              }`}>
                <button className="flex-1 text-left" onClick={() => setActiveId(q.id)}>
                  <p className="text-sm font-medium truncate">{q.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    {q.total} q · {q.score != null ? `${Math.round((q.score / q.total) * 100)}%` : "Not taken"}
                  </p>
                </button>
                <button
                  onClick={() => remove(q.id)}
                  className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {!active ? (
            <EmptyState
              icon={Brain}
              title="Ready to test yourself?"
              description="Generate a quiz or pick one from your list."
            />
          ) : (
            <QuizRunner
              key={active.id}
              quiz={active}
              onFinish={async (score) => {
                await submit({ data: { quizId: active.id, score } });
                qc.invalidateQueries({ queryKey: ["quizzes"] });
                qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
              }}
            />
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function QuizRunner({
  quiz,
  onFinish,
}: {
  quiz: any;
  onFinish: (score: number) => Promise<void>;
}) {
  const questions = quiz.questions as QuizQuestion[];
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = useMemo(() => {
    let s = 0;
    questions.forEach((q, i) => {
      const a = (answers[i] ?? "").trim().toLowerCase();
      if (!a) return;
      if (q.type === "short") {
        if (a === q.answer.trim().toLowerCase()) s++;
      } else {
        if (a === q.answer.trim().toLowerCase()) s++;
      }
    });
    return s;
  }, [answers, questions]);

  async function handleSubmit() {
    setSubmitted(true);
    await onFinish(score);
    toast.success(`Scored ${score}/${questions.length}`);
  }

  function reset() {
    setAnswers({});
    setSubmitted(false);
  }

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl">{quiz.topic}</h2>
          <p className="text-xs text-muted-foreground">{questions.length} questions</p>
        </div>
        {submitted && (
          <div className="text-right">
            <p className="font-display text-3xl text-primary">
              {score}/{questions.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {Math.round((score / questions.length) * 100)}% correct
            </p>
          </div>
        )}
      </div>
      <div className="space-y-6">
        {questions.map((q, i) => {
          const val = answers[i] ?? "";
          const correct = q.answer.trim().toLowerCase() === val.trim().toLowerCase();
          return (
            <div key={i} className="rounded-2xl border border-border p-4">
              <p className="font-medium">
                <span className="text-primary">Q{i + 1}.</span> {q.question}
              </p>
              <div className="mt-3 space-y-2">
                {q.type === "mcq" &&
                  q.options?.map((opt) => (
                    <label
                      key={opt}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm cursor-pointer transition ${
                        val === opt
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent/50"
                      } ${
                        submitted && opt === q.answer
                          ? "!border-success !bg-success/10"
                          : submitted && val === opt && opt !== q.answer
                            ? "!border-destructive !bg-destructive/10"
                            : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${i}`}
                        checked={val === opt}
                        disabled={submitted}
                        onChange={() => setAnswers({ ...answers, [i]: opt })}
                        className="accent-primary"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                {q.type === "tf" && (
                  <div className="flex gap-2">
                    {["True", "False"].map((opt) => (
                      <button
                        key={opt}
                        disabled={submitted}
                        onClick={() => setAnswers({ ...answers, [i]: opt })}
                        className={`flex-1 rounded-xl border px-3 py-2 text-sm transition ${
                          val === opt
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent/50"
                        } ${
                          submitted && opt === q.answer
                            ? "!border-success !bg-success/10"
                            : submitted && val === opt && opt !== q.answer
                              ? "!border-destructive !bg-destructive/10"
                              : ""
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === "short" && (
                  <input
                    disabled={submitted}
                    value={val}
                    onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Your answer"
                  />
                )}
              </div>
              {submitted && (
                <div className="mt-3 text-sm flex gap-2 items-start">
                  {correct ? (
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                  )}
                  <div>
                    <p>
                      <span className="font-medium">Answer:</span> {q.answer}
                    </p>
                    {q.explanation && (
                      <p className="text-muted-foreground mt-1">{q.explanation}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex gap-2">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            className="rounded-xl gradient-warm text-primary-foreground px-5 py-3 text-sm font-semibold"
          >
            Submit quiz
          </button>
        ) : (
          <button
            onClick={reset}
            className="rounded-xl border border-input px-5 py-3 text-sm font-medium flex items-center gap-2 hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        )}
      </div>
    </div>
  );
}
