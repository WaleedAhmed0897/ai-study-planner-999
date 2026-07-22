import { type ReactNode, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Sparkles,
  NotebookPen,
  Brain,
  Layers,
  CalendarClock,
  LineChart,
  User,
  Settings,
  BookOpenText,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assistant", label: "AI Assistant", icon: Sparkles },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/quiz", label: "Quiz", icon: Brain },
  { to: "/flashcards", label: "Flashcards", icon: Layers },
  { to: "/planner", label: "Planner", icon: CalendarClock },
  { to: "/progress", label: "Progress", icon: LineChart },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex w-full">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <SidebarBody onNavigate={() => setOpen(false)} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-sidebar border-r border-sidebar-border flex flex-col">
            <SidebarBody onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-border bg-background/80 backdrop-blur">
          <button
            onClick={() => setOpen(true)}
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-warm grid place-items-center text-primary-foreground">
              <BookOpenText className="h-4 w-4" />
            </div>
            <span className="font-display text-lg">Scholar</span>
          </div>
          <div className="w-9" />
        </header>
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile-mini"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();
      return data ?? { full_name: u.user.email, email: u.user.email, avatar_url: null };
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2" onClick={onNavigate}>
          <div className="h-9 w-9 rounded-xl gradient-warm grid place-items-center text-primary-foreground shadow-md">
            <BookOpenText className="h-4 w-4" />
          </div>
          <span className="font-display text-lg">Scholar</span>
        </Link>
        <button
          className="lg:hidden h-8 w-8 grid place-items-center rounded-md hover:bg-accent"
          onClick={onNavigate}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="px-3 flex-1 space-y-1 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
              {label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <div className="h-9 w-9 rounded-full bg-primary/15 text-primary grid place-items-center font-semibold">
            {(profile?.full_name || profile?.email || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.full_name || "Student"}</p>
            <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/10 hover:text-destructive transition"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background/60 backdrop-blur mt-8">
      <div className="max-w-6xl mx-auto px-6 py-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-lg gradient-warm grid place-items-center text-primary-foreground">
              <BookOpenText className="h-3.5 w-3.5" />
            </div>
            <span className="font-display text-base">Scholar</span>
          </div>
          <p className="text-xs text-muted-foreground">
            An AI-powered study companion for students who want to learn deeply and calmly.
          </p>
        </div>
        <FooterCol title="Product" links={[["About", "#"], ["Contact", "#"]]} />
        <FooterCol title="Legal" links={[["Privacy Policy", "#"], ["Terms of Service", "#"]]} />
        <div>
          <p className="font-medium mb-2">Stay focused</p>
          <p className="text-xs text-muted-foreground">
            "The beautiful thing about learning is that no one can take it away from you."
          </p>
        </div>
      </div>
      <div className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Scholar Study · Built with care.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-medium mb-2">{title}</p>
      <ul className="space-y-1.5">
        {links.map(([l, h]) => (
          <li key={l}>
            <a href={h} className="text-muted-foreground hover:text-foreground transition">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
