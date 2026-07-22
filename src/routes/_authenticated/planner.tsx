import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, EmptyState } from "@/components/ui-primitives";
import { CalendarClock, Plus, Trash2, GraduationCap, Timer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: [
      { title: "Study Planner — Scholar" },
      { name: "description", content: "Plan subjects, tasks, and daily study goals." },
    ],
  }),
  component: Planner,
});

type View = "daily" | "weekly" | "monthly";

function Planner() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("weekly");
  const [subjectName, setSubjectName] = useState("");
  const [task, setTask] = useState({ title: "", subject_id: "", due_date: "", duration_minutes: 30 });

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subjects")
        .select("*")
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("planner_tasks")
        .select("*")
        .order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const addSubject = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("subjects").insert({
        user_id: u.user!.id,
        name: subjectName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubjectName("");
      qc.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addTask = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("planner_tasks").insert({
        user_id: u.user!.id,
        title: task.title,
        subject_id: task.subject_id || null,
        due_date: task.due_date || null,
        duration_minutes: task.duration_minutes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTask({ title: "", subject_id: "", due_date: "", duration_minutes: 30 });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function toggleTask(id: string, completed: boolean, duration: number) {
    await supabase
      .from("planner_tasks")
      .update({
        completed: !completed,
        completed_at: !completed ? new Date().toISOString() : null,
      })
      .eq("id", id);

    // when marking complete, log a study session
    if (!completed) {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("study_sessions").insert({
        user_id: u.user!.id,
        minutes: duration,
        session_date: new Date().toISOString().slice(0, 10),
      });
    }
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  async function removeTask(id: string) {
    await supabase.from("planner_tasks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  async function removeSubject(id: string) {
    if (!confirm("Delete subject?")) return;
    await supabase.from("subjects").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["subjects"] });
  }

  const grouped = groupTasksByRange(tasks ?? [], view);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Planner"
        title="Study planner"
        description="Add subjects, schedule tasks, and set daily study goals."
        action={
          <div className="flex gap-1 rounded-xl border border-border p-1 bg-background">
            {(["daily", "weekly", "monthly"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
                  view === v ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {grouped.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nothing planned yet"
              description="Add a task on the right to see it here."
            />
          ) : (
            <div className="space-y-6">
              {grouped.map(({ label, items }) => (
                <div key={label}>
                  <h3 className="font-display text-lg mb-3">{label}</h3>
                  <ul className="space-y-2">
                    {items.map((t) => {
                      const subj = subjects?.find((s) => s.id === t.subject_id);
                      return (
                        <li
                          key={t.id}
                          className={`card-elevated p-4 flex items-start gap-3 ${
                            t.completed ? "opacity-60" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={t.completed}
                            onChange={() => toggleTask(t.id, t.completed, t.duration_minutes ?? 30)}
                            className="mt-1 h-5 w-5 accent-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-medium ${
                                t.completed ? "line-through" : ""
                              }`}
                            >
                              {t.title}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {subj && (
                                <span className="inline-flex items-center gap-1">
                                  <GraduationCap className="h-3 w-3" /> {subj.name}
                                </span>
                              )}
                              {t.due_date && (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarClock className="h-3 w-3" />
                                  {new Date(t.due_date).toLocaleDateString(undefined, {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Timer className="h-3 w-3" /> {t.duration_minutes}m
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeTask(t.id)}
                            className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card-elevated p-5">
            <h2 className="font-display text-lg mb-3">Add subject</h2>
            <div className="flex gap-2">
              <input
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="e.g. Calculus II"
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={() => subjectName.trim() && addSubject.mutate()}
                className="rounded-xl gradient-warm text-primary-foreground px-3 py-2 text-sm font-semibold"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {subjects?.map((s) => (
                <li
                  key={s.id}
                  className="group inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs"
                >
                  {s.name}
                  <button
                    onClick={() => removeSubject(s.id)}
                    className="opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-elevated p-5">
            <h2 className="font-display text-lg mb-3">New task</h2>
            <div className="space-y-3">
              <input
                value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
                placeholder="Task title"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
              <select
                value={task.subject_id}
                onChange={(e) => setTask({ ...task, subject_id: e.target.value })}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">No subject</option>
                {subjects?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={task.due_date}
                  onChange={(e) => setTask({ ...task, due_date: e.target.value })}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={task.duration_minutes}
                  onChange={(e) =>
                    setTask({ ...task, duration_minutes: Number(e.target.value) })
                  }
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Minutes"
                />
              </div>
              <button
                disabled={!task.title.trim() || addTask.isPending}
                onClick={() => addTask.mutate()}
                className="w-full rounded-xl gradient-warm text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                Add task
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function groupTasksByRange(tasks: any[], view: View) {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);

  const filtered = tasks.filter((t) => {
    if (!t.due_date && view === "monthly") return true;
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    if (view === "daily") return d.toDateString() === today.toDateString();
    if (view === "weekly") return d >= today && d <= in7;
    return d >= today && d <= in30;
  });

  const undated = filtered.filter((t) => !t.due_date);
  const dated = filtered.filter((t) => !!t.due_date);

  const groups = new Map<string, any[]>();
  for (const t of dated) {
    const key = new Date(t.due_date).toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const result = Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  if (undated.length) result.push({ label: "No due date", items: undated });
  return result;
}
