import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Wallet, Bell, Menu } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const path = location.pathname;

  const tabs = [
    { to: "/", label: "Home", icon: Home },
    { to: "/payments", label: "Payments", icon: Wallet },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ] as const;

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[440px] min-h-screen bg-card flex flex-col relative shadow-sm">
        <main className="flex-1 pb-28">{children}</main>

        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-card border-t border-border">
          <div className="grid grid-cols-4 px-2 pt-2 pb-3">
            {tabs.map((t) => {
              const active = path === t.to;
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`flex flex-col items-center gap-1 py-1 text-[11px] ${
                    active ? "text-brand font-medium" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                  {t.label}
                </Link>
              );
            })}
            <button className="flex flex-col items-center gap-1 py-1 text-[11px] text-muted-foreground">
              <Menu className="h-5 w-5" strokeWidth={1.8} />
              More
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}

export function AppHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-border">
      <div className="w-6" />
      <h1 className="text-base font-semibold">{title}</h1>
      <div className="w-6 text-muted-foreground">{right}</div>
    </header>
  );
}
