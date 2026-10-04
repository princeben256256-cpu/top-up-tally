import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[520px] min-h-screen bg-card flex flex-col shadow-xl shadow-navy/5">
        <header className="bg-navy-deep px-5 pt-6 pb-5 text-primary-foreground">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand">
              <ShieldCheck className="h-4.5 w-4.5 text-brand-foreground" />
            </span>
            <div>
              <p className="font-display text-base font-semibold leading-none tracking-tight text-white">
                PrepaidPay
              </p>
              <p className="mt-0.5 text-[11px] text-white/60">Device financing, paid as you go</p>
            </div>
          </div>
        </header>
        <main className="flex-1 pb-16">{children}</main>
        <footer className="border-t border-border px-5 py-4 text-center text-[11px] text-muted-foreground">
          PrepaidPay device financing ·{" "}
          <Link to="/admin" className="font-medium text-brand underline underline-offset-2">
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
