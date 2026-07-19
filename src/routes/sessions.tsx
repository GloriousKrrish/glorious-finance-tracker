import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/sessions")({
  head: () => ({ meta: [{ title: "Devices & Sessions · GloriousFinance" }] }),
  component: SessionsPage,
});

interface DeviceRow { id: string; device_label: string | null; user_agent: string | null; last_seen: string; created_at: string; }

function SessionsPage() {
  const { user, role } = useAuth();
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!user) return;
    supabase.from("device_sessions").select("*").eq("user_id", user.id).order("last_seen", { ascending: false })
      .then(({ data }) => setRows((data as DeviceRow[]) ?? []));
  };

  useEffect(load, [user?.id]);

  const revokeOthers = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("All other device sessions signed out");
  };

  const remove = async (id: string) => {
    await supabase.from("device_sessions").delete().eq("id", id);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Devices & Sessions"
        subtitle="Every sign-in creates an audit entry. Revoke sessions on other devices with one click."
        actions={
          <Button variant="outline" onClick={revokeOthers} disabled={busy}>
            <LogOut className="mr-2 h-4 w-4" />Sign out other devices
          </Button>
        }
      />
      <div className="grid gap-6 p-6 md:p-10">
        <Card className="card-luxe p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Account</div>
              <div className="mt-1 font-display text-lg">{user?.email}</div>
            </div>
            <div className="rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-gold">
              Role · {role ?? "user"}
            </div>
          </div>
        </Card>

        <Card className="card-luxe overflow-hidden">
          <div className="border-b border-border/60 px-6 py-4">
            <h3 className="font-display text-lg font-semibold">Recent sign-ins</h3>
            <p className="text-xs text-muted-foreground">JWT refresh happens automatically. Revoke other devices to force re-authentication.</p>
          </div>
          <div className="divide-y divide-border/60">
            {rows.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No device records yet.</div>}
            {rows.map(r => (
              <div key={r.id} className="flex items-center gap-4 px-6 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5">
                  <Monitor className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{r.device_label ?? "Unknown device"}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.user_agent}</div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>Last seen</div>
                  <div className="font-medium text-foreground">{formatDate(r.last_seen)}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
