import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/ui-primitives";
import { Bell, Moon, Sun, LogOut, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Scholar" },
      { name: "description", content: "Theme, notifications, and account settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [notif, setNotif] = useState(true);

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

  useEffect(() => {
    try {
      const t = (localStorage.getItem("scholar-theme") as "light" | "dark") || "light";
      setTheme(t);
      document.documentElement.classList.toggle("dark", t === "dark");
    } catch {}
  }, []);

  useEffect(() => {
    if (profile) setNotif(profile.notifications_enabled ?? true);
  }, [profile]);

  function applyTheme(t: "light" | "dark") {
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
    try {
      localStorage.setItem("scholar-theme", t);
    } catch {}
  }

  const saveNotif = useMutation({
    mutationFn: async (v: boolean) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update({ notifications_enabled: v })
        .eq("id", u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function deleteAccount() {
    if (!confirm("Permanently delete your account and all data? This cannot be undone.")) return;
    toast.error("Account deletion must be requested from support in this build.");
  }

  return (
    <PageContainer>
      <PageHeader eyebrow="Settings" title="Preferences" description="Customize Scholar." />
      <div className="max-w-2xl grid gap-6">
        <div className="card-elevated p-6">
          <h2 className="font-display text-xl mb-4">Appearance</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => applyTheme("light")}
              className={`rounded-2xl border p-4 text-left transition ${
                theme === "light" ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
              }`}
            >
              <Sun className="h-5 w-5 text-primary" />
              <p className="mt-2 font-medium">Light</p>
              <p className="text-xs text-muted-foreground">Warm parchment theme</p>
            </button>
            <button
              onClick={() => applyTheme("dark")}
              className={`rounded-2xl border p-4 text-left transition ${
                theme === "dark" ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
              }`}
            >
              <Moon className="h-5 w-5 text-primary" />
              <p className="mt-2 font-medium">Dark</p>
              <p className="text-xs text-muted-foreground">Cozy evening study</p>
            </button>
          </div>
        </div>

        <div className="card-elevated p-6">
          <h2 className="font-display text-xl mb-4">Notifications</h2>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Study reminders</p>
                <p className="text-xs text-muted-foreground">
                  Get gentle nudges for daily goals.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notif}
              onChange={(e) => {
                setNotif(e.target.checked);
                saveNotif.mutate(e.target.checked);
              }}
              className="h-5 w-9 accent-primary"
            />
          </label>
        </div>

        <div className="card-elevated p-6">
          <h2 className="font-display text-xl mb-4">Account</h2>
          <div className="grid gap-2">
            <button
              onClick={signOut}
              className="w-full rounded-xl border border-input px-4 py-2.5 text-sm font-medium flex items-center gap-2 hover:bg-accent"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
            <button
              onClick={deleteAccount}
              className="w-full rounded-xl border border-destructive/40 text-destructive px-4 py-2.5 text-sm font-medium flex items-center gap-2 hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Delete account
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
