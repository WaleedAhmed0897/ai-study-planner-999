import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, EmptyState } from "@/components/ui-primitives";
import { Layers, Plus, RotateCw, CheckCircle2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/flashcards")({
  head: () => ({
    meta: [
      { title: "Flashcards — Scholar" },
      { name: "description", content: "Create, review, and master flashcards." },
    ],
  }),
  component: Flashcards,
});

function Flashcards() {
  const qc = useQueryClient();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [subject, setSubject] = useState("");
  const [reviewIdx, setReviewIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState<"all" | "unlearned">("unlearned");

  const { data: cards } = useQuery({
    queryKey: ["flashcards"],
    queryFn: async () => {
      const { data } = await supabase
        .from("flashcards")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("flashcards").insert({
        user_id: u.user!.id,
        front,
        back,
        subject: subject || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Card added");
      setFront("");
      setBack("");
      qc.invalidateQueries({ queryKey: ["flashcards"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const list = (cards ?? []).filter((c) => (mode === "unlearned" ? !c.learned : true));
  const current = list[reviewIdx];
  const total = list.length;
  const learned = (cards ?? []).filter((c) => c.learned).length;

  async function markLearned(id: string, value: boolean) {
    await supabase.from("flashcards").update({ learned: value }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["flashcards"] });
  }

  async function remove(id: string) {
    await supabase.from("flashcards").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["flashcards"] });
  }

  function next() {
    setFlipped(false);
    setReviewIdx((i) => (total > 0 ? (i + 1) % total : 0));
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Study cards"
        title="Flashcards"
        description="Create cards, flip through them, and track what you've mastered."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Review */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1 rounded-xl border border-border p-1 bg-background">
              {(["unlearned", "all"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setReviewIdx(0);
                    setFlipped(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
                    mode === m ? "bg-primary text-primary-foreground" : ""
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {learned}/{cards?.length ?? 0} learned
            </p>
          </div>

          {!current ? (
            <EmptyState
              icon={Layers}
              title={mode === "unlearned" ? "All caught up!" : "No flashcards yet"}
              description="Create a card on the right to start reviewing."
            />
          ) : (
            <div>
              <div
                onClick={() => setFlipped((f) => !f)}
                className="card-elevated p-10 min-h-[280px] flex items-center justify-center text-center cursor-pointer select-none"
              >
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {flipped ? "Answer" : "Question"}
                    {current.subject && ` · ${current.subject}`}
                  </p>
                  <p className="mt-4 font-display text-2xl">
                    {flipped ? current.back : current.front}
                  </p>
                  <p className="mt-6 text-xs text-muted-foreground">Click card to flip</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => {
                    markLearned(current.id, !current.learned);
                    next();
                  }}
                  className="flex-1 rounded-xl gradient-warm text-primary-foreground px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {current.learned ? "Mark as new" : "Mark learned"}
                </button>
                <button
                  onClick={next}
                  className="rounded-xl border border-input px-4 py-2.5 text-sm font-medium flex items-center gap-2 hover:bg-accent"
                >
                  <RotateCw className="h-4 w-4" /> Next
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground text-center">
                {reviewIdx + 1} of {total}
              </p>
            </div>
          )}

          {(cards?.length ?? 0) > 0 && (
            <div className="mt-8">
              <h3 className="font-display text-lg mb-3">All cards</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {cards?.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-border p-3 flex items-start justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.front}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.back}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {c.learned && (
                        <span className="text-[10px] uppercase text-success">learned</span>
                      )}
                      <button
                        onClick={() => remove(c.id)}
                        className="h-7 w-7 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Create */}
        <div className="card-elevated p-5 h-fit">
          <h2 className="font-display text-lg mb-3">Create card</h2>
          <div className="space-y-3">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (optional)"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="Front (question)"
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="Back (answer)"
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              disabled={!front.trim() || !back.trim() || create.isPending}
              onClick={() => create.mutate()}
              className="w-full rounded-xl gradient-warm text-primary-foreground px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add card
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
