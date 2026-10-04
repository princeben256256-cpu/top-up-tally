import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PrepaidPay — Customer & Staff consoles" },
      {
        name: "description",
        content:
          "PrepaidPay device financing. Customers check their balance and pay by mobile money; dealers and agents manage financed phones.",
      },
      { property: "og:title", content: "PrepaidPay — Customer & Staff consoles" },
      {
        property: "og:description",
        content: "Customers check balances and pay. Dealers and agents manage financed phones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Doors,
});

function Doors() {
  const [staffEmail, setStaffEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) setStaffEmail(data.session.user.email);
    });
  }, []);

  return (
    <AppShell>
      <section className="px-5 pt-7 pb-3">
        <h1 className="font-display text-2xl font-semibold leading-tight">Choose your console</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Two separate areas — each opens straight to its own dashboard.
        </p>
      </section>

      <div className="space-y-3 px-5 pt-3">
        <Link
          to="/pay"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition active:scale-[0.99] hover:border-ring"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-navy">
            <Smartphone className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-base font-semibold">I'm a customer</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Check your balance, see your due date and pay by mobile money.
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
        </Link>

        <Link
          to="/admin"
          className="group flex items-center gap-4 rounded-2xl bg-navy-deep p-5 transition active:scale-[0.99]"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-base font-semibold text-white">I'm staff</span>
            <span className="mt-0.5 block text-xs text-white/65">
              {staffEmail
                ? `Signed in as ${staffEmail} — open the console.`
                : "Dealers and agents: register phones, record payments, control locks."}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-white/60 transition group-hover:translate-x-0.5" />
        </Link>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 px-5 text-center text-[11px] text-muted-foreground">
        <UserRound className="h-3 w-3" />
        No account needed to check a device. Staff sign in with their email.
      </p>
    </AppShell>
  );
}
