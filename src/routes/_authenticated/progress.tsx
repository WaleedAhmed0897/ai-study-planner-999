import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader, StatCard } from "@/components/ui-primitives";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Timer, CheckCircle2, Trophy, Flame } from "lucide-react";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Progress — Scholar" },
      { name: "description", content: "Weekly and monthly study performance." },
    ],
  }),
  component: ProgressPage,
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

function ProgressPage() {
  const { data } = useQuery({
    queryKey: ["progress-full"],
    queryFn: async () => {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 29);
      const cutoff = startOfDay(monthAgo).toISOString().slice(0, 10);

      const [sess, quizzes, subjects, tasks] = await Promise.all([
        supabase
          .from("study_sessions")
          .select("minutes, session_date, subject_id")
          .gte("session_date", cutoff),
        supabase
          .from("quizzes")
          .select("score, total, completed_at")
          .not("score", "is", null)
          .order("completed_at", { ascending: true }),
        supabase.from("subjects").select("id, name"),
        supabase.from("planner_tasks").select("completed"),
      ]);

      const s = sess.data ?? [];
      const totalMin = s.reduce((a, b) => a + (b.minutes ?? 0), 0);
      const daily: { label: string; minutes: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = startOfDay(d).toISOString().slice(0, 10);
        daily.push({
          label: d.getDate().toString(),
          minutes: s
            .filter((x) => x.session_date === ds)
            .reduce((a, b) => a + (b.minutes ?? 0), 0),
        });
      }

      const weekly: { label: string; minutes: number }[] = [];
      for (let i = 3; i >= 0; i--) {
        const end = new Date();
        end.setDate(end.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        const label = `W${4 - i}`;
        const mins = s
          .filter((x) => {
            const d = new Date(x.session_date);
            return d >= start && d <= end;
          })
          .reduce((a, b) => a + (b.minutes ?? 0), 0);
        weekly.push({ label, minutes: mins });
      }

      const subj = subjects.data ?? [];
      const subjectData = subj.map((sub) => ({
        name: sub.name,
        minutes: s
          .filter((x) => x.subject_id === sub.id)
          .reduce((a, b) => a + (b.minutes ?? 0), 0),
      })).filter((x) => x.minutes > 0);

      const q = quizzes.data ?? [];
      const quizSeries = q.map((qz, i) => ({
        label: `#${i + 1}`,
        score: Math.round(((qz.score ?? 0) / Math.max(1, qz.total ?? 1)) * 100),
      }));

      const avgQuiz =
        q.length > 0
          ? Math.round(quizSeries.reduce((a, b) => a + b.score, 0) / q.length)
          : 0;
      const tk = tasks.data ?? [];
      const completed = tk.filter((t) => t.completed).length;

      // Streak
      let streak = 0;
      for (let i = 0; i < 60; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = startOfDay(d).toISOString().slice(0, 10);
        if (s.find((x) => x.session_date === ds && (x.minutes ?? 0) > 0)) streak++;
        else break;
      }

      return { totalMin, daily, weekly, subjectData, quizSeries, avgQuiz, completed, streak };
    },
  });

  const hours = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Analytics"
        title="Progress tracking"
        description="Last 30 days of study activity, quiz performance, and subject balance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Timer} label="Total study" value={data ? hours(data.totalMin) : "—"} />
        <StatCard icon={Trophy} label="Avg quiz score" value={`${data?.avgQuiz ?? 0}%`} accent="primary" />
        <StatCard icon={CheckCircle2} label="Tasks completed" value={data?.completed ?? 0} accent="success" />
        <StatCard icon={Flame} label="Current streak" value={`${data?.streak ?? 0}d`} accent="destructive" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card-elevated p-6">
          <h2 className="font-display text-xl mb-4">Daily study · 30 days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="minutes" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated p-6">
          <h2 className="font-display text-xl mb-4">Weekly performance</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.weekly ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="minutes" fill="var(--color-success)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated p-6">
          <h2 className="font-display text-xl mb-4">Quiz score trend</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.quizSeries ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated p-6">
          <h2 className="font-display text-xl mb-4">Time by subject</h2>
          <div className="h-64">
            {(data?.subjectData?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground grid place-items-center h-full">
                No subject activity yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.subjectData}
                    dataKey="minutes"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data?.subjectData?.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
