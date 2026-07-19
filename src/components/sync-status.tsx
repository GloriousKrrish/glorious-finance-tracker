import { useStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

export function SyncStatusIndicator() {
  const { syncStatus } = useStore();

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1 text-[11px] font-medium border border-border/40 select-none">
      {syncStatus === "saved" && (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-muted-foreground">All changes saved</span>
        </>
      )}
      {syncStatus === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="text-muted-foreground">Saving...</span>
        </>
      )}
      {syncStatus === "offline" && (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
          <span className="text-warning-foreground">Offline</span>
        </>
      )}
      {syncStatus === "failed" && (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
          <span className="text-destructive font-semibold">Save failed (retrying)</span>
        </>
      )}
    </div>
  );
}
