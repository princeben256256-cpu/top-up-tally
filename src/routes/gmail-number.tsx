import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/gmail-number")({
  head: () => ({
    meta: [
      { title: "Shop Gmail number — MULIKA" },
      { name: "description", content: "Find the Google account number used by the MULIKA reset lock." },
      { property: "og:title", content: "Shop Gmail number — MULIKA" },
      { property: "og:description", content: "Find the Google account number used by the MULIKA reset lock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GmailNumber,
});

function GmailNumber() {
  const [info, setInfo] = useState<{ email: string; id: string } | null>(null);

  async function read() {
    const { data } = await supabase.auth.getUser();
    const g = data.user?.identities?.find((i) => i.provider === "google");
    const id = String((g?.identity_data as any)?.sub ?? (g as any)?.id ?? "");
    setInfo(g ? { email: String((g.identity_data as any)?.email ?? ""), id } : null);
  }
  useEffect(() => {
    read();
  }, []);

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/gmail-number`,
      extraParams: { prompt: "select_account" },
    });
    if (r.error) return toast.error("Google sign-in failed");
    if (!r.redirected) read();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <h1 className="font-display text-xl font-semibold">Shop Gmail number</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with the shop Gmail. Google will show its number here.
        </p>
        {info ? (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">{info.email}</p>
            <p className="mt-1 break-all rounded-lg bg-muted p-3 font-mono text-lg font-semibold">{info.id}</p>
            <button
              onClick={() => navigator.clipboard.writeText(info.id).then(() => toast.success("Copied"))}
              className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground"
            >
              Copy number
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
              className="mt-2 w-full rounded-lg border border-border py-2 text-sm font-semibold"
            >
              Sign out, then sign in as admin to paste it
            </button>
          </div>
        ) : (
          <button onClick={google} className="mt-4 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground">
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );
}
