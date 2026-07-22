import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/ui-primitives";
import {
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
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Target,
  CalendarClock,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComponentType } from "react";

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

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

type Accent = "primary" | "success" | "destructive" | "warning" | "info";
const accentTone: Record<Accent, { bg: string; text: string; ring: string }> = {
  primary: { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/20" },
  success: { bg: "bg-success/10", text: "text-success", ring: "ring-success/20" },
  destructive: { bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/20" },
  warning: { bg: "bg-warning/15", text: "text-warning-foreground", ring: "ring-warning/30" },
  info: { bg: "bg-[color-mix(in_oklab,var(--color-chart-4)_15%,transparent)]", text: "text-[color:var(--color-chart-4)]", ring: "ring-[color-mix(in_oklab,var(--color-chart-4)_25%,transparent)]" },
};

function PremiumStat({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  accent = "primary",
  delay = 0,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  accent?: Accent;
  delay?: number;
}) {
  const t = accentTone[accent];
  const TrendIcon = delta?.direction === "down" ? TrendingDown : TrendingUp;
  const trendClass =
    delta?.direction === "down"
      ? "text-destructive bg-destructive/10"
      : delta?.direction === "up"
        ? "text-success bg-success/10"
        : "text-muted-foreground bg-muted";
  return (
    <div
      className="card-elevated card-elevated-hover p-5 relative overflow-hidden count-up group"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        aria-hidden
        className={`absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl opacity-40 ${t.bg}`}
      />
      <div className="flex items-start justify-between relative">
        <div className={`h-11 w-11 rounded-2xl grid place-items-center ring-4 ${t.bg} ${t.text} ${t.ring} transition-transform group-hover:scale-110 group-hover:-rotate-3`}>
          <Icon className="h-5 w-5" />
        </div>
        {delta && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${trendClass}`}>
            <TrendIcon className="h-3 w-3" />
            {delta.value}
          </span>
        )}
      </div>
      <p className="mt-4 text-[11px] uppercase tracking-widest text-muted-foreground font-medium">{label}</p>
      <p className="mt-1 font-display text-3xl tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ProgressRing({ value, size = 140, stroke = 12 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <defs>
        <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-warning)" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="var(--color-muted)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="url(#ring-grad)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        fill="none"
        style={{ transition: "stroke-dashoffset 1s ease-out" }}
      />
    </svg>
  );
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
      const prevWeekAgo = new Date();
      prevWeekAgo.setDate(prevWeekAgo.getDate() - 13);
      const prevWeekStr = startOfDay(prevWeekAgo).toISOString().slice(0, 10);

      const [sessions, tasks, quizzes, subjects] = await Promise.all([
        supabase
          .from("study_sessions")
          .select("minutes, session_date, subject_id")
          .eq("user_id", uid)
          .gte("session_date", prevWeekStr),
        supabase.from("planner_tasks").select("*").eq("user_id", uid),
        supabase.from("quizzes").select("score, total").eq("user_id", uid).not("score", "is", null),
        supabase.from("subjects").select("id, name").eq("user_id", uid),
      ]);

      const sess = sessions.data ?? [];
      const thisWeekSess = sess.filter((s) => s.session_date >= weekStr);
      const prevWeekSess = sess.filter((s) => s.session_date >= prevWeekStr && s.session_date < weekStr);

      const todayMin = thisWeekSess
        .filter((s) => s.session_date === today)
        .reduce((a, b) => a + (b.minutes ?? 0), 0);
      const weekMin = thisWeekSess.reduce((a, b) => a + (b.minutes ?? 0), 0);
      const prevWeekMin = prevWeekSess.reduce((a, b) => a + (b.minutes ?? 0), 0);
      const weekDeltaPct = prevWeekMin === 0 ? (weekMin > 0 ? 100 : 0) : Math.round(((weekMin - prevWeekMin) / prevWeekMin) * 100);

      const days: { date: string; label: string; minutes: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = startOfDay(d).toISOString().slice(0, 10);
        const label = d.toLocaleDateString(undefined, { weekday: "short" });
        const mins = thisWeekSess
          .filter((s) => s.session_date === ds)
          .reduce((a, b) => a + (b.minutes ?? 0), 0);
        days.push({ date: ds, label, minutes: mins });
      }

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
      const totalTasks = tk.length;
      const taskPct = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

      const qs = quizzes.data ?? [];
      const avgQuiz =
        qs.length > 0
          ? Math.round(
              (qs.reduce((a, q) => a + (q.score ?? 0) / Math.max(1, q.total ?? 1), 0) / qs.length) *
                100,
            )
          : 0;

      const subj = subjects.data ?? [];
      const subjectData = subj
        .map((sub) => ({
          name: sub.name,
          minutes: thisWeekSess
            .filter((x) => x.subject_id === sub.id)
            .reduce((a, b) => a + (b.minutes ?? 0), 0),
        }))
        .filter((x) => x.minutes > 0);

      return {
        todayMin,
        weekMin,
        weekDeltaPct,
        completed,
        upcoming,
        taskPct,
        avgQuiz,
        subjectCount: subj.length,
        streak,
        days,
        subjectData,
        quizzesTaken: qs.length,
        upcomingTasks: tk
          .filter((t) => !t.completed)
          .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
          .slice(0, 5),
      };
    },
  });

  const s = stats;
  const hours = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
  const weekGoal = 600;
  const weekPct = s ? Math.min(100, Math.round((s.weekMin / weekGoal) * 100)) : 0;

  return (
    <PageContainer>
      {/* Hero */}
      <div className="relative overflow-hidden card-elevated p-6 sm:p-8 mb-8 count-up">
        <div
          aria-hidden
          className="absolute inset-0 gradient-parchment opacity-70"
        />
        <div
          aria-hidden
          className="absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-30 gradient-warm float-slow"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary font-medium mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Overview
            </p>
            <h1 className="font-display text-3xl sm:text-4xl">
              Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Here's how your study week is shaping up. Keep the streak alive and hit that weekly goal.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/planner"
                className="inline-flex items-center gap-2 rounded-full gradient-warm text-primary-foreground px-4 py-2 text-sm font-medium shadow-sm hover:opacity-90 transition"
              >
                <CalendarClock className="h-4 w-4" /> Plan today
              </Link>
              <Link
                to="/assistant"
                className="inline-flex items-center gap-2 rounded-full bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium hover:bg-accent transition"
              >
                <Sparkles className="h-4 w-4" /> Ask AI tutor
              </Link>
            </div>
          </div>

          <div className="relative grid place-items-center">
            <ProgressRing value={weekPct} />
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="font-display text-2xl tabular-nums">{weekPct}%</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Weekly goal</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PremiumStat
          icon={Timer}
          label="Study today"
          value={s ? hours(s.todayMin) : "—"}
          hint="Keep the momentum"
          accent="primary"
          delay={0}
        />
        <PremiumStat
          icon={Flame}
          label="Daily streak"
          value={`${s?.streak ?? 0}d`}
          hint={s && s.streak > 0 ? "You're on fire" : "Start today"}
          accent="destructive"
          delay={60}
        />
        <PremiumStat
          icon={Trophy}
          label="Avg quiz score"
          value={`${s?.avgQuiz ?? 0}%`}
          hint={`${s?.quizzesTaken ?? 0} quizzes taken`}
          accent="warning"
          delay={120}
        />
        <PremiumStat
          icon={GraduationCap}
          label="Subjects"
          value={s?.subjectCount ?? 0}
          hint="Tracked areas"
          accent="info"
          delay={180}
        />
      </div>

      {/* Weekly goal + task progress */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card-elevated p-6 lg:col-span-2 count-up" style={{ animationDelay: "220ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Weekly progress</p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="font-display text-3xl tabular-nums">{s ? hours(s.weekMin) : "—"}</p>
                <p className="text-sm text-muted-foreground">/ 10h goal</p>
              </div>
            </div>
            {s && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                  s.weekDeltaPct >= 0 ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
                }`}
              >
                {s.weekDeltaPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(s.weekDeltaPct)}% vs last week
              </span>
            )}
          </div>
          <div className="mt-4 h-3 rounded-full bg-muted overflow-hidden relative">
            <div
              className="h-full shimmer-bar rounded-full transition-all duration-700"
              style={{ width: `${weekPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{weekPct}% complete</span>
            <span>{Math.max(0, 600 - (s?.weekMin ?? 0))} min remaining</span>
          </div>
        </div>

        <div className="card-elevated p-6 count-up" style={{ animationDelay: "260ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Task completion</p>
              <p className="mt-1 font-display text-3xl tabular-nums">{s?.taskPct ?? 0}%</p>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-success/10 text-success grid place-items-center">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-success transition-all duration-700 rounded-full"
              style={{ width: `${s?.taskPct ?? 0}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> {s?.completed ?? 0} done
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5" /> {s?.upcoming ?? 0} left
            </span>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card-elevated p-6 lg:col-span-2 count-up" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-xl">Study minutes · last 7 days</h2>
              <p className="text-xs text-muted-foreground">Daily focused time</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
              <ArrowUpRight className="h-3.5 w-3.5" /> Trend
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={s?.days ?? []} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillWarm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ stroke: "var(--color-primary)", strokeOpacity: 0.2, strokeWidth: 2 }}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    boxShadow: "var(--shadow-elevated)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  stroke="var(--color-primary)"
                  fill="url(#fillWarm)"
                  strokeWidth={2.5}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--color-card)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated p-6 count-up" style={{ animationDelay: "340ms" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-xl">Time by subject</h2>
              <p className="text-xs text-muted-foreground">This week</p>
            </div>
          </div>
          <div className="h-64">
            {(s?.subjectData?.length ?? 0) === 0 ? (
              <div className="h-full grid place-items-center text-center">
                <div>
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                    <Layers className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">Log study sessions to see subject balance.</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={s?.subjectData}
                    dataKey="minutes"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={86}
                    paddingAngle={3}
                    stroke="var(--color-card)"
                    strokeWidth={2}
                  >
                    {s?.subjectData?.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      boxShadow: "var(--shadow-elevated)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {(s?.subjectData?.length ?? 0) > 0 && (
            <ul className="mt-3 space-y-1.5">
              {s?.subjectData.slice(0, 4).map((sd, i) => (
                <li key={sd.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="truncate">{sd.name}</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">{hours(sd.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Upcoming + mini bar chart */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card-elevated p-6 lg:col-span-2 count-up" style={{ animationDelay: "380ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl">Focus rhythm</h2>
            <span className="text-xs text-muted-foreground">Minutes per day</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s?.days ?? []} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="barWarm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" />
                    <stop offset="100%" stopColor="var(--color-warning)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "color-mix(in oklab, var(--color-primary) 8%, transparent)" }}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    boxShadow: "var(--shadow-elevated)",
                  }}
                />
                <Bar dataKey="minutes" fill="url(#barWarm)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated p-6 count-up" style={{ animationDelay: "420ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl">Upcoming tasks</h2>
            <Link to="/planner" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {(!s || s.upcomingTasks.length === 0) && (
            <div className="text-center py-6">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                <ListChecks className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                No tasks yet. Head to the{" "}
                <Link className="text-primary hover:underline" to="/planner">
                  Planner
                </Link>
                .
              </p>
            </div>
          )}
          <ul className="space-y-2">
            {s?.upcomingTasks.map((t, i) => (
              <li
                key={t.id}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-accent/50 transition count-up"
                style={{ animationDelay: `${460 + i * 40}ms` }}
              >
                <div className="mt-1 h-2.5 w-2.5 rounded-full gradient-warm ring-4 ring-primary/10 shrink-0" />
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

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="font-display text-xl mb-4">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/assistant", label: "Ask AI Tutor", desc: "Explain any topic", icon: Sparkles },
            { to: "/notes", label: "Generate Notes", desc: "From any subject", icon: NotebookPen },
            { to: "/quiz", label: "Take a Quiz", desc: "Test your recall", icon: Brain },
            { to: "/flashcards", label: "Review Cards", desc: "Spaced repetition", icon: Layers },
          ].map(({ to, label, desc, icon: Icon }, i) => (
            <Link
              key={to}
              to={to}
              className="card-elevated card-elevated-hover p-5 flex items-center gap-4 group count-up relative overflow-hidden"
              style={{ animationDelay: `${500 + i * 60}ms` }}
            >
              <div
                aria-hidden
                className="absolute -right-6 -bottom-6 h-20 w-20 rounded-full blur-2xl bg-primary/10 opacity-0 group-hover:opacity-100 transition"
              />
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary grid place-items-center transition group-hover:gradient-warm group-hover:text-primary-foreground group-hover:scale-110">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground truncate">{desc}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
