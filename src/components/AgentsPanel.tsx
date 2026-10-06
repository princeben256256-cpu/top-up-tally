import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import { listAgents, createAgent, removeAgent } from "@/lib/agents.functions";

export function AgentsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAgents);
  const createFn = useServerFn(createAgent);
  const removeFn = useServerFn(removeAgent);
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: () => listFn({}) });

  const add = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: () => {
      toast.success(`Agent added. Give them: ${form.email} + the password`);
      setForm({ full_name: "", email: "", password: "" });
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Agent removed");
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <details className="mt-4 rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer font-display text-sm font-semibold">
        Sales agents ({agents.length})
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Only you can add agents. Pick a password for them and tell them in person.
      </p>
      <form
        className="mt-3 grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        {(
          [
            ["full_name", "Agent name", "text"],
            ["email", "Agent email", "email"],
            ["password", "Password (8+ characters)", "text"],
          ] as const
        ).map(([k, ph, t]) => (
          <input
            key={k}
            required
            type={t}
            placeholder={ph}
            value={form[k]}
            onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
        ))}
        <button
          disabled={add.isPending}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <UserPlus className="h-4 w-4" /> {add.isPending ? "Adding…" : "Add agent"}
        </button>
      </form>
      <div className="mt-3 divide-y divide-border">
        {agents.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{a.name || "Agent"}</p>
              <p className="truncate text-xs text-muted-foreground">{a.email}</p>
            </div>
            <button
              onClick={() => confirm(`Remove ${a.email}?`) && del.mutate(a.id)}
              className="rounded-md p-2 text-destructive hover:bg-destructive/10"
              aria-label="Remove agent"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}
