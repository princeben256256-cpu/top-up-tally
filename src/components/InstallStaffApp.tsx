import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Download, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallStaffApp() {
  const { pathname } = useLocation();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const checkInstalled = () => setInstalled(media.matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    checkInstalled();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      setHelpOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    media.addEventListener("change", checkInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      media.removeEventListener("change", checkInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) {
      setHelpOpen(true);
      return;
    }
    setBusy(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } catch {
      setPrompt(null);
      setHelpOpen(true);
    } finally {
      setBusy(false);
    }
  }

  const staffPage = pathname === "/" || pathname === "/auth" || pathname.startsWith("/admin");
  if (installed || !staffPage) return null;

  return (
    <>
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-5 shrink-0 text-primary" />
            <span>MULIKA staff app</span>
          </div>
          <Button onClick={install} disabled={busy} className="shrink-0">
            <Download /> {busy ? "Please wait…" : "Install MULIKA"}
          </Button>
        </div>
      </div>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install MULIKA</DialogTitle>
            <DialogDescription>
              {ios
                ? "In Safari, tap Share, then Add to Home Screen and Add."
                : "In Chrome, tap the three dots ⋮, then Add to Home screen or Install app, and confirm."}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">If this page is inside another app, open it in {ios ? "Safari" : "Chrome"} first.</p>
          <Button asChild variant="outline"><a href="https://top-up-tally.lovable.app/admin">Open MULIKA staff console</a></Button>
        </DialogContent>
      </Dialog>
    </>
  );
}