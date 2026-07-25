import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[520px] min-h-screen bg-card flex flex-col shadow-sm">
        <main className="flex-1 pb-16">{children}</main>
        <footer className="px-5 py-4 text-center text-[11px] text-muted-foreground">
          PrepaidPay device financing ·{" "}
          <Link to="/admin" className="underline underline-offset-2">
            Staff console
          </Link>
        </footer>
      </div>
    </div>
  );
}

export function AppHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-border">
      <h1 className="text-base font-semibold">{title}</h1>
      <div className="text-muted-foreground">{right}</div>
    </header>
  );
}
