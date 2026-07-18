import { createFileRoute } from "@tanstack/react-router";
import { useStore, type Profile } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Upload, RotateCcw } from "lucide-react";
import { useRef } from "react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · GloriousFinance" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { state, dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof Profile>(k: K, v: Profile[K]) =>
    dispatch({ type: "profile:update", payload: { [k]: v } as Partial<Profile> });

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `gloriousfinance-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  };

  const importData = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        dispatch({ type: "hydrate", payload: JSON.parse(reader.result as string) });
        toast.success("Data imported");
      } catch { toast.error("Invalid file"); }
    };
    reader.readAsText(f);
  };

  const reset = () => {
    if (!confirm("Reset all data to demo defaults? This cannot be undone.")) return;
    dispatch({ type: "reset" });
    toast.success("Reset complete");
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Profile, data controls and workspace preferences." />
      <div className="grid gap-6 p-6 md:grid-cols-2 md:p-10">
        <Card className="card-luxe p-6">
          <h3 className="font-display text-lg font-semibold">Profile</h3>
          <p className="text-xs text-muted-foreground">How your workspace is personalised.</p>
          <div className="mt-4 space-y-3">
            <div><Label>Full name</Label><Input value={state.profile.name} onChange={(e) => update("name", e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={state.profile.email} onChange={(e) => update("email", e.target.value)} /></div>
            <div><Label>User type</Label>
              <Select value={state.profile.userType} onValueChange={(v) => update("userType", v as Profile["userType"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="business">Business Owner</SelectItem>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                  <SelectItem value="family">Family Account</SelectItem>
                  <SelectItem value="hni">High Net Worth</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Currency</Label><Input value="Indian Rupee (₹)" disabled /></div>
          </div>
        </Card>

        <Card className="card-luxe p-6">
          <h3 className="font-display text-lg font-semibold">Data</h3>
          <p className="text-xs text-muted-foreground">Your data lives locally in this browser. Export it any time.</p>
          <div className="mt-4 space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={exportData}><Download className="mr-2 h-4 w-4" />Export backup (JSON)</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />Import backup
            </Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
            <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />Reset to demo data</Button>
          </div>
        </Card>

        <Card className="card-luxe p-6 md:col-span-2">
          <h3 className="font-display text-lg font-semibold">About this template</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            GloriousFinance is a premium personal finance operating system template. Every module — accounts, transactions, budgets, investments, loans, bills and goals — supports full add, edit and delete. Data persists locally in your browser so anyone can fork this template and use it immediately, with no backend setup required. Wire in Lovable Cloud later to enable multi-user auth and cloud sync.
          </p>
        </Card>
      </div>
    </div>
  );
}
