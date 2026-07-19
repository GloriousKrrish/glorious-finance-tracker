import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Circle, 
  Sparkles, 
  PlusCircle, 
  Target, 
  PieChart, 
  TrendingUp, 
  FileSpreadsheet,
  ArrowRight,
  X
} from "lucide-react";
import { toast } from "sonner";

export function ChecklistWidget() {
  const { state } = useStore();
  const navigate = useNavigate();
  const { accounts, transactions, budgets, goals, investments } = state;
  const [dismissed, setDismissed] = useState(false);
  const [simulatedImport, setSimulatedImport] = useState(false);

  // Load dismissed state from localStorage
  useEffect(() => {
    const isDismissed = localStorage.getItem("gf_checklist_dismissed") === "true";
    setDismissed(isDismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("gf_checklist_dismissed", "true");
    setDismissed(true);
  };

  const handleSimulateImport = () => {
    if (simulatedImport) return;
    toast.success("Bank statement imported successfully!", {
      description: "12 transactions were matched and categorized."
    });
    setSimulatedImport(true);
  };

  // Define checklist items and check status
  const checklistItems = [
    {
      id: "account",
      label: "Account Created",
      description: "Add your first bank, credit card, or cash wallet.",
      completed: accounts.length > 0,
      icon: PlusCircle,
      link: "/accounts"
    },
    {
      id: "import",
      label: "Import Bank Statement",
      description: "Upload transactions or simulate a statement sync.",
      completed: simulatedImport || transactions.length > 0,
      icon: FileSpreadsheet,
      action: handleSimulateImport
    },
    {
      id: "transaction",
      label: "Add First Transaction",
      description: "Record an income, expense, or transfer.",
      completed: transactions.length > 0,
      icon: PlusCircle,
      link: "/transactions"
    },
    {
      id: "budget",
      label: "Create Budget",
      description: "Set a spending limit for a category.",
      completed: budgets.length > 0,
      icon: PieChart,
      link: "/budgets"
    },
    {
      id: "goal",
      label: "Create Financial Goal",
      description: "Define a savings target with a deadline.",
      completed: goals.length > 0,
      icon: Target,
      link: "/goals"
    },
    {
      id: "investment",
      label: "Connect Investments",
      description: "Track stocks, mutual funds, or gold.",
      completed: investments.length > 0,
      icon: TrendingUp,
      link: "/investments"
    }
  ];

  const completedCount = checklistItems.filter(item => item.completed).length;
  const progressPercent = Math.round((completedCount / checklistItems.length) * 100);

  if (dismissed || progressPercent === 100) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="px-6 pt-6 md:px-10"
      >
        <Card className="card-luxe relative overflow-hidden border border-gold/20 bg-gradient-to-br from-card via-card to-ivory p-6">
          {/* Top Decorative Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-gold to-peach" />

          {/* Dismiss Button */}
          <button 
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
            aria-label="Dismiss checklist"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/10 text-gold">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground">Complete Your Workspace</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Set up your workspace with these basic steps to get accurate wealth reporting and AI insights.
              </p>

              {/* Progress Section */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-primary font-display">Setup Progress</span>
                  <span className="font-numeric text-gold">{progressPercent}%</span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-primary to-gold rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>

            {/* Checklist Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              {checklistItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 ${
                      item.completed 
                        ? "bg-success/5 border-success/15 text-muted-foreground" 
                        : "bg-background/40 hover:bg-background border-border/40 hover:border-gold/30 cursor-pointer"
                    }`}
                    whileHover={{ y: item.completed ? 0 : -2 }}
                    onClick={() => {
                      if (item.completed) return;
                      if (item.action) {
                        item.action();
                      } else if (item.link) {
                        navigate({ to: item.link });
                      }
                    }}
                  >
                    <div className="mt-0.5 shrink-0">
                      {item.completed ? (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-success"
                        >
                          <CheckCircle2 className="h-5 w-5 fill-success/10" />
                        </motion.div>
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/60" />
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <div className={`text-sm font-semibold ${item.completed ? "line-through text-muted-foreground/60" : "text-foreground"}`}>
                        {item.label}
                      </div>
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        {item.description}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
