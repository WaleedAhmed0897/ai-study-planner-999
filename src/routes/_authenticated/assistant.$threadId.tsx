import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendAssistantMessage } from "@/lib/ai.functions";
import { PageContainer } from "@/components/ui-primitives";
import { ArrowLeft, Send, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistant/$threadId")({
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const send = useServerFn(sendAssistantMessage);

  const { data: thread } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_threads")
        .select("id, title")
        .eq("id", threadId)
        .maybeSingle();
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_messages")
        .select("id, role, content, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (message: string) => send({ data: { threadId, message } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", threadId] });
      qc.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mutation.isPending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, mutation.isPending]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const v = input.trim();
    if (!v || mutation.isPending) return;
    setInput("");
    // optimistic
    qc.setQueryData(["messages", threadId], (old: any[] = []) => [
      ...old,
      { id: `tmp-${Date.now()}`, role: "user", content: v, created_at: new Date().toISOString() },
    ]);
    mutation.mutate(v);
  }

  async function deleteThread() {
    if (!confirm("Delete this conversation?")) return;
    await supabase.from("ai_threads").delete().eq("id", threadId);
    qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/assistant" });
  }

  const suggestions = [
    "Explain the concept of Big-O notation with examples",
    "Summarize the causes of World War I",
    "Generate study tips for exam week",
    "Help me understand photosynthesis simply",
  ];

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-4">
        <Link
          to="/assistant"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All chats
        </Link>
        <button
          onClick={deleteThread}
          className="text-xs text-destructive hover:underline"
        >
          Delete
        </button>
      </div>
      <div className="card-elevated flex flex-col h-[calc(100vh-14rem)] overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl gradient-warm grid place-items-center text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="font-display text-lg leading-none">{thread?.title || "New chat"}</p>
            <p className="text-xs text-muted-foreground">AI Study Tutor</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
          {(!messages || messages.length === 0) && (
            <div className="text-center py-8">
              <div className="mx-auto h-14 w-14 rounded-2xl gradient-warm grid place-items-center text-primary-foreground">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-xl">Ask me anything about your studies</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                I can explain topics, summarize, generate notes, and give study tips.
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2 max-w-xl mx-auto">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left text-sm p-3 rounded-xl border border-border hover:bg-accent transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages?.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ))}
          {mutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pl-11">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </div>
          )}
        </div>

        <form onSubmit={submit} className="border-t border-border p-3 sm:p-4 bg-background/60">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Ask a question or paste text to summarize…"
              className="flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring max-h-48"
            />
            <button
              type="submit"
              disabled={!input.trim() || mutation.isPending}
              className="h-11 w-11 rounded-2xl gradient-warm text-primary-foreground grid place-items-center shadow-md disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`h-8 w-8 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${
          isUser
            ? "bg-secondary text-secondary-foreground"
            : "gradient-warm text-primary-foreground"
        }`}
      >
        {isUser ? "You" : "AI"}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
          isUser
            ? "bg-primary/10 text-foreground"
            : "bg-secondary/60 border border-border"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
