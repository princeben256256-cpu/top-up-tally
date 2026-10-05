import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — PrepaidPay" },
      {
        name: "description",
        content: "Set a new password for your PrepaidPay staff account.",
      },
      { property: "og:title", content: "Choose a new password — PrepaidPay" },
      {
        property: "og:description",
        content: "Set a new password for your PrepaidPay staff account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The reset link lands here with #...&type=recovery — confirm a real
    // recovery session before showing the form, and make sure the old
    // session can't sneak through as a "reset" that never happened.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        toast.error("This reset link has expired. Request a new one.");
        navigate({ to: "/auth", replace: true });
        return;
      }
      const hash = window.location.hash || "";
      const isRecovery =
        hash.includes("type=recovery") ||
        Boolean(data.session.user && data.session.user.app_metadata?.provider === "recover");
      if (!isRecovery) {
        toast.error("Open the new-password link from your email to continue.");
        navigate({ to: "/auth", replace: true });
        return;
      }
      setReady(true);
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password changed. You are signed in.");
      navigate({ to: "/admin", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready
            ? "Type your new password twice."
            : "Checking your reset link…"}
        </p>

        {ready && (
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              required
              minLength={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
              required
              minLength={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
