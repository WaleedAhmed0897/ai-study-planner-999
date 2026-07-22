import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, EmptyState } from "@/components/ui-primitives";
import { Sparkles, Plus, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistant/")({
  component: AssistantIndex,
});

function AssistantIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: threads } = useQuery({
    queryKey: ["threads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_threads")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  async function newThread() {
    setCreating(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("ai_threads")
      .insert({ user_id: u.user!.id, title: "New chat" })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/assistant/$threadId", params: { threadId: data.id } });
  }

  useEffect(() => {
    // no auto-create; let the user click
  }, []);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="AI Tutor"
        title="AI Study Assistant"
        description="Ask questions, get explanations, summaries, notes, and study tips."
        action={
          <button
            onClick={newThread}
            disabled={creating}
            className="rounded-xl gradient-warm text-primary-foreground px-4 py-2.5 text-sm font-semibold shadow-md hover:opacity-95 flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> New chat
          </button>
        }
      />

      {(!threads || threads.length === 0) ? (
        <EmptyState
          icon={Sparkles}
          title="Start your first conversation"
          description="Ask the AI tutor anything — from calculus proofs to essay outlines."
          action={
            <button
              onClick={newThread}
              disabled={creating}
              className="rounded-xl gradient-warm text-primary-foreground px-4 py-2.5 text-sm font-semibold"
            >
              Start chatting
            </button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() =>
                navigate({ to: "/assistant/$threadId", params: { threadId: t.id } })
              }
              className="card-elevated card-elevated-hover text-left p-5 flex items-center gap-4"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.updated_at).toLocaleString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
