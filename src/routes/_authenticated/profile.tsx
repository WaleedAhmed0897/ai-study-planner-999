import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/ui-primitives";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Scholar" },
      { name: "description", content: "Your Scholar profile settings." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    education_level: "",
    learning_goal: "",
    avatar_url: "",
  });

  const { data: profile, isLoading } = useQuery({
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

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        email: profile.email ?? "",
        education_level: profile.education_level ?? "",
        learning_goal: profile.learning_goal ?? "",
        avatar_url: profile.avatar_url ?? "",
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          education_level: form.education_level,
          learning_goal: form.learning_goal,
          avatar_url: form.avatar_url || null,
        })
        .eq("id", u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["profile-mini"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description="Update your personal info, education level, and learning goals."
      />
      <div className="max-w-2xl">
        <div className="card-elevated p-6">
          <div className="flex items-center gap-4 mb-6">
            {form.avatar_url ? (
              <img
                src={form.avatar_url}
                alt=""
                className="h-16 w-16 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/15 text-primary grid place-items-center">
                <User className="h-7 w-7" />
              </div>
            )}
            <div>
              <p className="font-display text-xl">{form.full_name || "Student"}</p>
              <p className="text-sm text-muted-foreground">{form.email}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Email">
              <input value={form.email} disabled className="input opacity-70" />
            </Field>
            <Field label="Education level">
              <select
                value={form.education_level}
                onChange={(e) => setForm({ ...form, education_level: e.target.value })}
                className="input"
              >
                <option value="">Select…</option>
                {[
                  "High school",
                  "Undergraduate",
                  "Graduate",
                  "PhD",
                  "Professional",
                  "Self-learner",
                ].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Avatar URL (optional)">
              <input
                value={form.avatar_url}
                onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                className="input"
                placeholder="https://…"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Learning goal">
                <textarea
                  rows={3}
                  value={form.learning_goal}
                  onChange={(e) => setForm({ ...form, learning_goal: e.target.value })}
                  className="input"
                  placeholder="e.g. Ace my final exams in June and build a strong foundation in mathematics."
                />
              </Field>
            </div>
          </div>

          <button
            disabled={save.isPending || isLoading}
            onClick={() => save.mutate()}
            className="mt-6 rounded-xl gradient-warm text-primary-foreground px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--color-input);
          background: var(--color-background);
          padding: 0.6rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus { box-shadow: 0 0 0 2px var(--color-ring); }
      `}</style>
    </PageContainer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
