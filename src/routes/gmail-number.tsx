import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { googleAccountInfo } from "@/lib/reset-protection";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function read() {
    const { data, error } = await supabase.auth.getUser();
    if (error && data.user) setError("Could not verify your Google account. Please try again.");
    const verified = googleAccountInfo(data.user?.identities);
    setInfo(verified);
    if (data.user?.identities?.some((i) => i.provider === "google") && !verified) {
      setError("Google did not return a valid account number. Reset protection must stay off.");
    }
  }
  useEffect(() => {
    void read();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { setTimeout(() => void read(), 0); });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function google() {
    setBusy(true);
    setError("");
    try {
      const r = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/gmail-number`,
        extraParams: { prompt: "select_account" },
      });
      if (r.error) throw new Error("Google sign-in failed. Please try again.");
      if (!r.redirected) await read();
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="font-display text-xl font-semibold">Shop Gmail number</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with the shop Gmail. Google will show its number here.
        </p>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        {info ? (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">{info.email}</p>
            <p className="mt-1 break-all rounded-lg bg-muted p-3 font-mono text-lg font-semibold">{info.id}</p>
            <Button
              onClick={() => navigator.clipboard.writeText(info.id).then(() => toast.success("Copied")).catch(() => toast.error("Could not copy. Select the number above."))}
              className="mt-3 w-full"
            >
              Copy number
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const { error } = await supabase.auth.signOut();
                if (error) return toast.error("Could not sign out. Please try again.");
                window.location.href = "/auth";
              }}
              className="mt-2 h-auto w-full whitespace-normal"
            >
              Sign out, then sign in as admin to paste it
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">This number identifies the signed-in account. It does not prove that a reset phone will accept it. Keep protection off until a spare-phone test passes.</p>
          </div>
        ) : (
          <Button onClick={google} disabled={busy} className="mt-4 w-full">
            {busy ? "Signing in…" : "Sign in with Google"}
          </Button>
        )}
      </div>
    </div>
  );
}
