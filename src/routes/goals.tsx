import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, uid, type Goal } from "@/lib/store";
import { formatINR, formatDate, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AddButton, EditIconButton, DeleteIconButton, FormDialogHeader, FormFooter } from "@/components/crud";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Target } from "lucide-react";

export const Route = createFileRoute("/goals")({
  head: () => ({ meta: [{ title: "Goals · GloriousFinance" }] }),
  component: GoalsPage,
});

const empty = (): Goal => ({ id: uid(), name: "", target: 0, saved: 0, deadline: todayISO(), category: "Savings" });

function GoalForm({ initial, onSubmit, onCancel }: { initial: Goal; onSubmit: (g: Goal) => void; onCancel: () => void }) {
  const [g, setG] = useState<Goal>(initial);
  const set = <K extends keyof Goal>(k: K, v: Goal[K]) => setG(p => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!g.name || !g.target) return toast.error("Name and target required"); onSubmit(g); }} className="space-y-4">
      <FormDialogHeader title={initial.name ? "Edit goal" : "New goal"} />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Name</Label><Input value={g.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Emergency Fund" /></div>
        <div><Label>Category</Label><Input value={g.category} onChange={(e) => set("category", e.target.value)} /></div>
        <div><Label>Deadline</Label><Input type="date" value={g.deadline} onChange={(e) => set("deadline", e.target.value)} /></div>
        <div><Label>Target (₹)</Label><Input type="number" step="0.01" value={g.target || ""} onChange={(e) => set("target", parseFloat(e.target.value) || 0)} /></div>
        <div><Label>Saved (₹)</Label><Input type="number" step="0.01" value={g.saved || ""} onChange={(e) => set("saved", parseFloat(e.target.value) || 0)} /></div>
      </div>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function GoalsPage() {
  const { state, dispatch } = useStore();
  const [openAdd, setOpenAdd] = useState(false);
  const [addAmt, setAddAmt] = useState<Record<string, string>>({});

  const contribute = (g: Goal) => {
    const v = parseFloat(addAmt[g.id] || "0");
    if (!v) return;
    dispatch({ type: "goal:update", payload: { ...g, saved: g.saved + v } });
    setAddAmt(p => ({ ...p, [g.id]: "" }));
    toast.success(`Added ${formatINR(v)} to ${g.name}`);
  };

  return (
    <div>
      <PageHeader title="Goals" subtitle="Milestone-based savings — from an emergency fund to a dream home."
        action={<AddButton label="Add goal" open={openAdd} onOpenChange={setOpenAdd}>
          <GoalForm initial={empty()} onCancel={() => setOpenAdd(false)} onSubmit={(g) => { dispatch({ type: "goal:add", payload: g }); setOpenAdd(false); toast.success("Goal added"); }} />
        </AddButton>}
      />
      <div className="grid gap-4 p-6 md:grid-cols-2 md:p-10 lg:grid-cols-3">
        {state.goals.map(g => {
          const p = Math.min(100, (g.saved / g.target) * 100);
          const done = g.saved >= g.target;
          return (
            <Card key={g.id} className={`card-luxe p-6 ${done ? "ring-1 ring-success/40" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary"><Target className="h-5 w-5" /></div>
                  <div>
                    <div className="font-display text-lg font-semibold">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.category} · by {formatDate(g.deadline)}</div>
                  </div>
                </div>
                <div className="flex">
                  <EditIconButton>{(close) => <GoalForm initial={g} onCancel={close} onSubmit={(u) => { dispatch({ type: "goal:update", payload: u }); close(); toast.success("Updated"); }} />}</EditIconButton>
                  <DeleteIconButton itemLabel="goal" onConfirm={() => { dispatch({ type: "goal:remove", payload: g.id }); toast.success("Deleted"); }} />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="font-numeric text-2xl font-semibold">{formatINR(g.saved, { compact: true })}</div>
                <div className="text-xs text-muted-foreground">of {formatINR(g.target, { compact: true })}</div>
              </div>
              <Progress value={p} className={`mt-3 h-1.5 ${done ? "[&>div]:bg-success" : ""}`} />
              <div className="mt-2 text-xs text-muted-foreground">{p.toFixed(1)}% funded</div>
              <div className="mt-4 flex gap-2">
                <Input type="number" placeholder="Add contribution" value={addAmt[g.id] || ""} onChange={(e) => setAddAmt(p => ({ ...p, [g.id]: e.target.value }))} />
                <Button onClick={() => contribute(g)}>Add</Button>
              </div>
            </Card>
          );
        })}
        {state.goals.length === 0 && <Card className="card-luxe col-span-full p-12 text-center text-sm text-muted-foreground">Start your first financial goal</Card>}
      </div>
    </div>
  );
}
