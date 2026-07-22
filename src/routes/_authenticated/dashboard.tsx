import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, StatCard } from "@/components/ui-primitives";
import {
  BookOpen,
  Timer,
  CheckCircle2,
  ListChecks,
  Trophy,
  Flame,
  GraduationCap,
  Sparkles,
  Brain,
  Layers,
  NotebookPen,
  CalendarClock,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Scholar" },
      { name: "description", content: "Your study stats, streak, and next tasks at a glance." },
    ],
  }),
  component: Dashboard,
});

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function Dashboard() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const today = startOfDay().toISOString().slice(0, 10);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      const weekStr = startOfDay(weekAgo).toISOString().slice(0, 10);

      const [sessions, tasks, quizzes, subjects] = await Promise.all([
        supabase
          .from("study_sessions")
          .select("minutes, session_date, subject_id")
          .eq("user_id", uid)
          .gte("session_date", weekStr),
        supabase.from("planner_tasks").select("*").eq("user_id", uid),
        supabase.from("quizzes").select("score, total").eq("user_id", uid).not("score", "is", null),
        supabase.from("subjects").select("id, name").eq("user_id", uid),
      ]);

      const sess = sessions.data ?? [];
      const todayMin = sess
        .filter((s) => s.session_date === today)
        .reduce((a, b) => a + (b.minutes ?? 0), 0);
      const weekMin = sess.reduce((a, b) => a + (b.minutes ?? 0), 0);

      // build 7-day series
      const days: { date: string; label: string; minutes: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = startOfDay(d).toISOString().slice(0, 10);
        const label = d.toLocaleDateString(undefined, { weekday: "short" });
        const mins = sess
          .filter((s) => s.session_date === ds)
          .reduce((a, b) => a + (b.minutes ?? 0), 0);
        days.push({ date: ds, label, minutes: mins });
      }

      // streak (consecutive days including today with any minutes)
      let streak = 0;
      for (let i = 0; i < 60; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = startOfDay(d).toISOString().slice(0, 10);
        const any = sess.find((s) => s.session_date === ds && (s.minutes ?? 0) > 0);
        if (any) streak++;
        else break;
      }

      const tk = tasks.data ?? [];
      const completed = tk.filter((t) => t.completed).length;
      const upcoming = tk.filter((t) => !t.completed).length;

      const qs = quizzes.data ?? [];
      const avgQuiz =
        qs.length > 0
          ? Math.round(
              (qs.reduce((a, q) => a + (q.score ?? 0) / Math.max(1, q.total ?? 1), 0) / qs.length) *
                100,
            )
          : 0;

      return {
        todayMin,
        weekMin,
        completed,
        upcoming,
        avgQuiz,
        subjectCount: (subjects.data ?? []).length,
        streak,
        days,
        upcomingTasks: tk
          .filter((t) => !t.completed)
          .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
          .slice(0, 5),
      };
    },
  });

  const s = stats;
  const hours = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
  const weekGoal = 600; // 10h/week
  const weekPct = s ? Math.min(100, Math.round((s.weekMin / weekGoal) * 100)) : 0;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.`}
        description="Here's how your study week is shaping up."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Timer}
          label="Study today"
          value={s ? hours(s.todayMin) : "—"}
          hint="Keep the momentum"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed tasks"
          value={s?.completed ?? 0}
          accent="success"
        />
        <StatCard
          icon={ListChecks}
          label="Upcoming tasks"
          value={s?.upcoming ?? 0}
          accent="warning"
        />
        <StatCard
          icon={Trophy}
          label="Avg quiz score"
          value={`${s?.avgQuiz ?? 0}%`}
          accent="primary"
        />
        <StatCard
          icon={Flame}
          label="Daily streak"
          value={`${s?.streak ?? 0}d`}
          accent="destructive"
        />
        <StatCard
          icon={GraduationCap}
          label="Subjects"
          value={s?.subjectCount ?? 0}
        />
        <div className="card-elevated p-5 sm:col-span-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Weekly progress</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="font-display text-3xl">{s ? hours(s.weekMin) : "—"}</p>
            <p className="text-sm text-muted-foreground">/ 10h goal</p>
          </div>
          <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full gradient-warm transition-all"
              style={{ width: `${weekPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{weekPct}% of weekly goal</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="card-elevated p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-xl">Study minutes · last 7 days</h2>
              <p className="text-xs text-muted-foreground">Daily focused time</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={s?.days ?? []}>
                <defs>
                  <linearGradient id="fillWarm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  stroke="var(--color-primary)"
                  fill="url(#fillWarm)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated p-6">
          <h2 className="font-display text-xl mb-4">Upcoming tasks</h2>
          {(!s || s.upcomingTasks.length === 0) && (
            <p className="text-sm text-muted-foreground">
              No tasks yet. Head to the <Link className="text-primary hover:underline" to="/planner">Planner</Link>.
            </p>
          )}
          <ul className="space-y-3">
            {s?.upcomingTasks.map((t) => (
              <li key={t.id} className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.due_date
                      ? new Date(t.due_date).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : "No due date"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/assistant", label: "Ask AI Tutor", icon: Sparkles },
          { to: "/notes", label: "Generate Notes", icon: NotebookPen },
          { to: "/quiz", label: "Take a Quiz", icon: Brain },
          { to: "/flashcards", label: "Review Cards", icon: Layers },
        ].map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="card-elevated card-elevated-hover p-5 flex items-center gap-3 group"
          >
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center group-hover:gradient-warm group-hover:text-primary-foreground transition">
              <Icon className="h-5 w-5" />
            </div>
            <span className="font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
