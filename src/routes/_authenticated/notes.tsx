import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateNotes } from "@/lib/ai.functions";
import { PageContainer, PageHeader, EmptyState } from "@/components/ui-primitives";
import { NotebookPen, Sparkles, Loader2, FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "AI Notes Generator — Scholar" },
      { name: "description", content: "Generate detailed notes, summaries, and key concepts." },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const qc = useQueryClient();
  const [topic, setTopic] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const gen = useServerFn(generateNotes);

  const { data: notes } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (t: string) => gen({ data: { topic: t } }),
    onSuccess: (row: any) => {
      toast.success("Notes generated");
      qc.invalidateQueries({ queryKey: ["notes"] });
      setActive(row.id);
      setTopic("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const activeNote = notes?.find((n) => n.id === active);

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    await supabase.from("notes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notes"] });
    if (active === id) setActive(null);
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="AI Notes"
        title="Notes generator"
        description="Turn any topic into detailed notes, a quick summary, bullet points, and key concepts."
      />

      <div className="card-elevated p-5 mb-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Newton's Laws of Motion"
            className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter" && topic.trim()) mutation.mutate(topic.trim());
            }}
          />
          <button
            onClick={() => topic.trim() && mutation.mutate(topic.trim())}
            disabled={mutation.isPending || !topic.trim()}
            className="rounded-xl gradient-warm text-primary-foreground px-5 py-3 text-sm font-semibold shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <h2 className="font-display text-lg mb-3">Saved notes</h2>
          {(!notes || notes.length === 0) && (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
          <ul className="space-y-2">
            {notes?.map((n) => (
              <li key={n.id}>
                <div
                  className={`flex items-center gap-2 rounded-xl border p-3 transition ${
                    active === n.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/50"
                  }`}
                >
                  <button className="flex-1 text-left" onClick={() => setActive(n.id)}>
                    <p className="text-sm font-medium truncate">{n.topic}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString()}
                    </p>
                  </button>
                  <button
                    onClick={() => remove(n.id)}
                    className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          {!activeNote ? (
            <EmptyState
              icon={NotebookPen}
              title="Select a note or generate a new one"
              description="Your generated notes will show here with detailed, short, bullet, and key concept views."
            />
          ) : (
            <NoteView note={activeNote} />
          )}
        </div>
      </div>
    </PageContainer>
  );
}

const tabs = [
  { key: "detailed", label: "Detailed" },
  { key: "short", label: "Summary" },
  { key: "bullets", label: "Bullets" },
  { key: "key_concepts", label: "Key concepts" },
] as const;

function NoteView({ note }: { note: any }) {
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("detailed");
  return (
    <div className="card-elevated p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-2xl">{note.topic}</h2>
          <p className="text-xs text-muted-foreground">
            {new Date(note.created_at).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-border mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm rounded-t-lg ${
              tab === t.key
                ? "border-b-2 border-primary text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="prose prose-sm max-w-none whitespace-pre-wrap font-[var(--font-sans)] text-sm leading-relaxed">
        {note[tab] || <span className="text-muted-foreground">No content.</span>}
      </div>
    </div>
  );
}
