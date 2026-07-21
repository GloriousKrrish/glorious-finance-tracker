import * as React from "react";
import { useStore } from "@/lib/store";
import { WorkspaceEngine, type Workspace } from "@/lib/enterprise/workspace";
import {
  Building,
  Home,
  HeartHandshake,
  Laptop,
  Users,
  User,
  ChevronsUpDown,
  Plus,
  Check,
  Sparkles
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const WORKSPACE_ICONS: Record<string, any> = {
  personal: User,
  family: Users,
  business: Building,
  rental: Home,
  parents: HeartHandshake,
  side_hustle: Laptop,
  custom: Sparkles
};

export function WorkspaceSwitcher() {
  const { activeWorkspaceId, dispatch } = useStore();
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newType, setNewType] = React.useState<Workspace["type"]>("custom");
  const [newDesc, setNewDesc] = React.useState("");

  const refreshWorkspaces = React.useCallback(() => {
    setWorkspaces(WorkspaceEngine.getWorkspaces());
  }, []);

  React.useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const activeWs = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0] || {
    id: "personal",
    name: "Personal Finance",
    type: "personal",
    description: "Default workspace"
  };

  const IconComponent = WORKSPACE_ICONS[activeWs.type] || Sparkles;

  const handleSwitch = (id: string) => {
    dispatch({
      type: "profile:update",
      payload: { activeWorkspaceId: id }
    });
    toast.success(`Switched to workspace: ${workspaces.find(w => w.id === id)?.name || id}`);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Workspace name is required");
      return;
    }
    const created = WorkspaceEngine.addWorkspace(newName, newType, newDesc);
    toast.success(`Created workspace: ${created.name}`);
    refreshWorkspaces();
    setIsCreateOpen(false);
    setNewName("");
    setNewDesc("");
    // Automatically switch to it
    handleSwitch(created.id);
  };

  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex h-8 items-center gap-2 border-border/50 bg-background/50 px-3 font-medium shadow-none hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <IconComponent className="h-4 w-4 text-primary" />
            <span className="max-w-[120px] truncate text-xs">{activeWs.name}</span>
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px] border-border/60 bg-background/95 backdrop-blur-md">
          <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Switch Workspaces
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/40" />
          {workspaces.map(ws => {
            const WsIcon = WORKSPACE_ICONS[ws.type] || Sparkles;
            const isSelected = ws.id === activeWorkspaceId;
            return (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => handleSwitch(ws.id)}
                className="flex items-center justify-between py-2 text-xs font-medium cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <WsIcon className={`h-3.5 w-3.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex flex-col">
                    <span className={isSelected ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}>
                      {ws.name}
                    </span>
                    <span className="text-[9px] text-muted-foreground/75 font-normal max-w-[150px] truncate">
                      {ws.description}
                    </span>
                  </div>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator className="bg-border/40" />
          <DropdownMenuItem
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 py-2 text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md border-border/60 bg-background/95 backdrop-blur-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="font-display font-semibold tracking-tight text-lg text-foreground">
                Create New Workspace
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Segment your finances into clean, isolated containers. All transactions, accounts, and reports will remain fully partitioned.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="ws-name" className="text-xs font-semibold">Workspace Name</Label>
                <Input
                  id="ws-name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Vacation Cabin Rental"
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ws-type" className="text-xs font-semibold">Workspace Type</Label>
                <select
                  id="ws-type"
                  value={newType}
                  onChange={e => setNewType(e.target.value as Workspace["type"])}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="personal">Personal Finance</option>
                  <option value="family">Family Joint Finance</option>
                  <option value="business">Business Operations</option>
                  <option value="rental">Rental Property Management</option>
                  <option value="parents">Parents Financial Care</option>
                  <option value="side_hustle">Side Hustle / Consulting</option>
                  <option value="custom">Custom Entity</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ws-desc" className="text-xs font-semibold">Description</Label>
                <Input
                  id="ws-desc"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="e.g. Tracking income and repairs"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)} className="text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="text-xs h-8">
                Create & Switch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
