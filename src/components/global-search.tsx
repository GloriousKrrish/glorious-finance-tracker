import * as React from "react";
import { useStore } from "@/lib/store";
import { SearchEngine, type SearchResultItem } from "@/lib/enterprise/search";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  Command,
  Wallet,
  ArrowRight,
  FileText,
  TrendingUp,
  Target,
  Receipt,
  Landmark,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const TYPE_ICONS: Record<string, any> = {
  account: Wallet,
  transaction: ArrowRight,
  document: FileText,
  investment: TrendingUp,
  goal: Target,
  bill: Receipt,
  loan: Landmark
};

export function GlobalSearch() {
  const { state, activeWorkspaceId } = useStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResultItem[]>([]);

  // Listen for Cmd+K / Ctrl+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const items = SearchEngine.query(state, query, activeWorkspaceId);
    setResults(items);
  }, [query, state, activeWorkspaceId]);

  const handleItemClick = (url: string) => {
    navigate({ to: url });
    setIsOpen(false);
    setQuery("");
  };

  return (
    <>
      {/* Search Input Trigger */}
      <div className="relative w-40 md:w-60">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search workspace... (Ctrl+K)"
          onClick={() => setIsOpen(true)}
          readOnly
          className="h-8.5 w-full cursor-pointer rounded-md border border-border/40 bg-background/50 pl-8 pr-12 text-xs text-muted-foreground outline-none transition-all hover:bg-muted/30 focus:border-primary/50"
        />
        <kbd className="pointer-events-none absolute right-2 top-2.5 hidden h-4 select-none items-center gap-0.5 rounded border border-border/60 bg-muted px-1.5 font-mono text-[8px] font-medium text-muted-foreground md:flex">
          <span className="text-[7px]">⌘</span>K
        </kbd>
      </div>

      {/* Global Search Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-md">
          <DialogHeader className="p-4 border-b border-border/40 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              <DialogTitle className="text-sm font-semibold tracking-tight">Unified Workspace Search</DialogTitle>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </DialogHeader>

          <div className="p-3">
            <Input
              autoFocus
              placeholder="Type to search accounts, transactions, documents, loans, budgets..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="h-10 text-xs border-border/50 bg-background/40"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
            {results.map(item => {
              const ItemIcon = TYPE_ICONS[item.type] || Search;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleItemClick(item.url)}
                  className="flex items-center justify-between rounded-md p-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="rounded bg-primary/10 p-1.5 text-primary">
                      <ItemIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-semibold text-foreground">{item.title}</span>
                      <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {item.amount !== undefined && (
                      <span className="text-xs font-bold text-foreground">
                        ₹{item.amount.toLocaleString("en-IN")}
                      </span>
                    )}
                    {item.date && (
                      <span className="block text-[9px] text-muted-foreground font-medium">{item.date}</span>
                    )}
                  </div>
                </div>
              );
            })}

            {query.trim() && results.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No matching results found in active workspace.
              </div>
            )}

            {!query.trim() && (
              <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5">
                <Command className="h-5 w-5 text-muted-foreground/50" />
                <span>Search accounts, transactions, vault documents, and wealth budgets instantly.</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
