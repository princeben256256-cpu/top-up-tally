import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, CheckCircle2, Loader2, XCircle, Eraser } from "lucide-react";
import { toast } from "sonner";
import { registerCustomer, verifyIdPhoto } from "@/lib/kyc.functions";

export const Route = createFileRoute("/_authenticated/admin/register/$id")({
  head: () => ({
    meta: [
      { title: "Register customer — PrepaidPay staff console" },
      { name: "description", content: "Full customer enrolment with ID scans, guarantor and signature." },
      { property: "og:title", content: "Register customer — PrepaidPay" },
      { property: "og:description", content: "Full customer enrolment with ID scans, guarantor and signature." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

/** Shrink a camera photo to a ~1280px JPEG data URL so uploads stay small. */
async function toDataUrl(file: File, max = 1280): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

type Check = { state: "idle" | "checking" | "ok" | "bad"; reason?: string; nin?: string | null; name?: string | null };

const input =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring";

function RegisterPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useServerFn(registerCustomer);
  const verify = useServerFn(verifyIdPhoto);

  const [f, setF] = useState({
    full_name: "",
    nin: "",
    primary_phone: "",
    alt_phone: "",
    address: "",
    occupation: "",
    guarantor_name: "",
    guarantor_nin: "",
    guarantor_phone: "",
    guarantor_relationship: "",
    guarantor_address: "",
    deposit_paid: "",
  });
  const [imgs, setImgs] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [signature, setSignature] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function onPhoto(key: string, file: File | undefined, side?: "front" | "back") {
    if (!file) return;
    const url = await toDataUrl(file);
    setImgs((p) => ({ ...p, [key]: url }));
    if (!side) return;
    setChecks((p) => ({ ...p, [key]: { state: "checking" } }));
    try {
      const r = await verify({ data: { image: url, side } });
      setChecks((p) => ({ ...p, [key]: { state: r.ok ? "ok" : "bad", reason: r.reason, nin: r.nin, name: r.name } }));
      if (r.ok && side === "front" && r.nin) {
        if (key === "id_front") setF((x) => ({ ...x, nin: x.nin || r.nin!, full_name: x.full_name || r.name || "" }));
        if (key === "guarantor_id_front")
          setF((x) => ({ ...x, guarantor_nin: x.guarantor_nin || r.nin!, guarantor_name: x.guarantor_name || r.name || "" }));
      }
    } catch (e) {
      setChecks((p) => ({ ...p, [key]: { state: "bad", reason: (e as Error).message } }));
    }
  }

  const idKeys = ["id_front", "id_back", "guarantor_id_front", "guarantor_id_back"];
  const allImgs = ["customer_photo", ...idKeys.slice(0, 2), "guarantor_photo", ...idKeys.slice(2)];
  const ready =
    allImgs.every((k) => imgs[k]) && idKeys.every((k) => checks[k]?.state === "ok") && !!signature && agree;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return toast.error("Finish all photos, ID checks, signature and agreement first");
    setBusy(true);
    try {
      await submit({
        data: {
          device_id: id,
          ...f,
          deposit_paid: Number(f.deposit_paid || 0),
          images: {
            customer_photo: imgs.customer_photo,
            id_front: imgs.id_front,
            id_back: imgs.id_back,
            guarantor_photo: imgs.guarantor_photo,
            guarantor_id_front: imgs.guarantor_id_front,
            guarantor_id_back: imgs.guarantor_id_back,
            signature,
          },
        },
      });
      toast.success("Customer registered. Now take their first payment for days.");
      qc.invalidateQueries({ queryKey: ["device", id] });
      qc.invalidateQueries({ queryKey: ["devices"] });
      navigate({ to: "/admin/$id", params: { id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary px-5 py-5 text-primary-foreground">
        <Link to="/admin/$id" params={{ id }} className="inline-flex items-center gap-1 text-xs opacity-80">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to phone
        </Link>
        <h1 className="mt-2 font-display text-xl font-semibold">Customer enrolment</h1>
        <p className="text-xs opacity-80">Only original Ugandan National ID cards are accepted.</p>
      </header>

      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4 px-5 py-6">
        <Section n={1} title="Customer photo & ID">
          <PhotoField label="Customer face photo" capture="user" img={imgs.customer_photo} onFile={(fl) => onPhoto("customer_photo", fl)} />
          <div className="grid grid-cols-2 gap-2">
            <PhotoField label="ID front" img={imgs.id_front} check={checks.id_front} onFile={(fl) => onPhoto("id_front", fl, "front")} />
            <PhotoField label="ID back" img={imgs.id_back} check={checks.id_back} onFile={(fl) => onPhoto("id_back", fl, "back")} />
          </div>
        </Section>

        <Section n={2} title="Customer details">
          <Field label="Full name (as on ID)"><input required className={input} value={f.full_name} onChange={set("full_name")} /></Field>
          <Field label="NIN (National ID number)"><input required className={`${input} uppercase`} value={f.nin} onChange={set("nin")} placeholder="CM0000000000AB" /></Field>
          <Field label="Main phone — registered on this ID (becomes the account number)">
            <input required type="tel" className={input} value={f.primary_phone} onChange={set("primary_phone")} placeholder="0772123456" />
          </Field>
          <Field label="Second phone number"><input required type="tel" className={input} value={f.alt_phone} onChange={set("alt_phone")} placeholder="0701123456" /></Field>
          <Field label="Home address / village"><input required className={input} value={f.address} onChange={set("address")} /></Field>
          <Field label="Occupation"><input className={input} value={f.occupation} onChange={set("occupation")} /></Field>
        </Section>

        <Section n={3} title="Guarantor">
          <PhotoField label="Guarantor face photo" capture="user" img={imgs.guarantor_photo} onFile={(fl) => onPhoto("guarantor_photo", fl)} />
          <div className="grid grid-cols-2 gap-2">
            <PhotoField label="Guarantor ID front" img={imgs.guarantor_id_front} check={checks.guarantor_id_front} onFile={(fl) => onPhoto("guarantor_id_front", fl, "front")} />
            <PhotoField label="Guarantor ID back" img={imgs.guarantor_id_back} check={checks.guarantor_id_back} onFile={(fl) => onPhoto("guarantor_id_back", fl, "back")} />
          </div>
          <Field label="Guarantor full name"><input required className={input} value={f.guarantor_name} onChange={set("guarantor_name")} /></Field>
          <Field label="Guarantor NIN"><input required className={`${input} uppercase`} value={f.guarantor_nin} onChange={set("guarantor_nin")} /></Field>
          <Field label="Guarantor phone"><input required type="tel" className={input} value={f.guarantor_phone} onChange={set("guarantor_phone")} /></Field>
          <Field label="Relationship to customer"><input required className={input} value={f.guarantor_relationship} onChange={set("guarantor_relationship")} placeholder="Brother, employer…" /></Field>
          <Field label="Guarantor address"><input required className={input} value={f.guarantor_address} onChange={set("guarantor_address")} /></Field>
        </Section>

        <Section n={4} title="Deposit">
          <Field label="Deposit paid (UGX) — reduces the balance, does not buy days">
            <input required type="number" min={0} className={input} value={f.deposit_paid} onChange={set("deposit_paid")} />
          </Field>
          <p className="text-xs text-muted-foreground">After saving, record the customer's first payment for the days they want.</p>
        </Section>

        <Section n={5} title="Agreement & signature">
          <p className="text-xs text-muted-foreground">
            I agree this phone is payment-controlled. It locks when payments are late and stays protected until fully paid. My
            guarantor is responsible if I fail to pay.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> Customer agrees
          </label>
          <SignaturePad onChange={setSignature} />
        </Section>

        <button disabled={busy || !ready} className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "Checking IDs and saving…" : "Register customer"}
        </button>
      </form>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="font-display text-sm font-semibold">
        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function PhotoField({ label, img, check, onFile, capture = "environment" }: { label: string; img?: string; check?: Check; onFile: (f?: File) => void; capture?: "user" | "environment" }) {
  return (
    <label className="block cursor-pointer rounded-lg border-2 border-dashed border-border p-2 text-center">
      <input type="file" accept="image/*" capture={capture} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      {img ? (
        <img src={img} alt={label} className="mx-auto max-h-36 rounded object-contain" />
      ) : (
        <div className="flex h-24 flex-col items-center justify-center text-muted-foreground">
          <Camera className="h-6 w-6" />
        </div>
      )}
      <p className="mt-1 text-xs font-medium">{label}</p>
      {check?.state === "checking" && <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Checking card…</p>}
      {check?.state === "ok" && <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-success"><CheckCircle2 className="h-3 w-3" /> Original ID</p>}
      {check?.state === "bad" && <p className="mt-1 flex items-start justify-center gap-1 text-[11px] text-destructive"><XCircle className="mt-0.5 h-3 w-3 shrink-0" /> {check.reason} Tap to retake.</p>}
    </label>
  );
}

function SignaturePad({ onChange }: { onChange: (url: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    c.width = r.width * 2;
    c.height = r.height * 2;
    const ctx = c.getContext("2d")!;
    ctx.scale(2, 2);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f1b3d";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, r.width, r.height);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div>
      <canvas
        ref={ref}
        className="h-40 w-full touch-none rounded-lg border border-input bg-card"
        onPointerDown={(e) => {
          drawing.current = true;
          const ctx = ref.current!.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(...pos(e));
          ref.current!.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = ref.current!.getContext("2d")!;
          ctx.lineTo(...pos(e));
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
          if (dirty.current) onChange(ref.current!.toDataURL("image/png"));
        }}
      />
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>Customer signs above with a finger</span>
        <button
          type="button"
          className="inline-flex items-center gap-1"
          onClick={() => {
            const c = ref.current!;
            const ctx = c.getContext("2d")!;
            ctx.fillRect(0, 0, c.width, c.height);
            dirty.current = false;
            onChange("");
          }}
        >
          <Eraser className="h-3 w-3" /> Clear
        </button>
      </div>
    </div>
  );
}
