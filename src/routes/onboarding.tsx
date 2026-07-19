import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useStore, uid, type Account, type Goal } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  User, 
  Briefcase, 
  Users, 
  Coins, 
  TrendingUp, 
  Wallet, 
  Landmark, 
  CreditCard,
  Target,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  Home,
  Car,
  Plane,
  GraduationCap,
  ShieldCheck,
  Globe
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to GloriousFinance" }] }),
  component: OnboardingPage,
});

const STEPS = [
  { id: 1, name: "Welcome" },
  { id: 2, name: "Workspace" },
  { id: 3, name: "Currency" },
  { id: 4, name: "First Account" },
  { id: 5, name: "First Goal" },
  { id: 6, name: "Ready" }
];

function OnboardingPage() {
  const { user } = useAuth();
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  
  // Local states for onboarding steps
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState<"personal" | "business" | "freelancer">("personal");
  const [currency, setCurrency] = useState<"INR">("INR");
  
  // Step 4: First Account state
  const [accountType, setAccountType] = useState<"bank" | "cash" | "credit_card" | "investment">("bank");
  const [accountName, setAccountName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [accountNotes, setAccountNotes] = useState("");
  const [accountCreated, setAccountCreated] = useState<Account | null>(null);

  // Step 5: First Goal state
  const [goalCategory, setGoalCategory] = useState<string>("Emergency Fund");
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalCreated, setGoalCreated] = useState<Goal | null>(null);

  const [saving, setSaving] = useState(false);

  // Load from store if user resumed
  useEffect(() => {
    if (state.profile.onboardingStep) {
      setStep(state.profile.onboardingStep);
    }
    if (state.profile.userType) {
      // Map store userType to local selection
      const ut = state.profile.userType;
      if (ut === "personal" || ut === "business") {
        setUserType(ut);
      }
    }
  }, [state.profile.onboardingStep, state.profile.userType]);

  // Set default goal names when category changes
  useEffect(() => {
    if (!goalName || ["Emergency Fund", "House Fund", "Car Fund", "Europe Vacation", "MacBook Pro", "Wealth Building", "Custom Goal"].includes(goalName)) {
      if (goalCategory === "Emergency Fund") setGoalName("Emergency Fund");
      else if (goalCategory === "House") setGoalName("House Fund");
      else if (goalCategory === "Car") setGoalName("Car Fund");
      else if (goalCategory === "Vacation") setGoalName("Europe Vacation");
      else if (goalCategory === "Education") setGoalName("Higher Education");
      else if (goalCategory === "Wealth Creation") setGoalName("Wealth Building");
      else if (goalCategory === "Custom") setGoalName("Custom Goal");
    }
  }, [goalCategory]);

  const persistStep = async (nextStep: number, isCompleted = false) => {
    if (!user) return;
    setSaving(true);
    try {
      // 1. Dispatch local profile update
      dispatch({ 
        type: "profile:update", 
        payload: { 
          onboardingStep: nextStep, 
          onboardingCompleted: isCompleted,
          userType: userType as any,
          currency: currency
        } 
      });

      // 2. Direct Supabase write for reliability (bypassing debounce delay)
      await supabase.from("profiles").update({
        onboarding_completed: isCompleted,
        onboarding_step: nextStep,
        user_type: userType,
        currency: currency,
        full_name: state.profile.name
      }).eq("id", user.id);

    } catch (err) {
      console.error("Failed to persist onboarding state:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (step === 2) {
      await persistStep(3);
      setStep(3);
    } else if (step === 3) {
      // If account already exists from past attempts, we can skip first account step
      if (state.accounts.length > 0) {
        await persistStep(5);
        setStep(5);
      } else {
        await persistStep(4);
        setStep(4);
      }
    } else if (step === 4) {
      // Validate Account Name if entered
      if (accountName) {
        const balance = parseFloat(openingBalance) || 0;
        const newAcc: Account = {
          id: uid(),
          name: accountName,
          type: accountType,
          balance: balance,
          institution: accountType === "bank" ? "Bank" : undefined
        };
        dispatch({ type: "account:add", payload: newAcc });
        setAccountCreated(newAcc);
        toast.success("Account created successfully!");
      }
      await persistStep(5);
      setStep(5);
    } else if (step === 5) {
      // Validate Goal Name if entered
      if (goalName && goalTarget) {
        const target = parseFloat(goalTarget) || 0;
        const newGoal: Goal = {
          id: uid(),
          name: goalName,
          target: target,
          saved: 0,
          deadline: goalDate || new Date(Date.now() + 365*24*60*60*1000).toISOString().split("T")[0],
          category: goalCategory === "Custom" ? "Others" : "Savings"
        };
        dispatch({ type: "goal:add", payload: newGoal });
        setGoalCreated(newGoal);
        toast.success("Savings goal set successfully!");
      }
      await persistStep(6);
      setStep(6);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      const prevStep = step - 1;
      setStep(prevStep);
      persistStep(prevStep);
    }
  };

  const handleSkipStep = async () => {
    if (step === 4) {
      // Skip Account creation
      await persistStep(5);
      setStep(5);
    } else if (step === 5) {
      // Skip Goal creation
      await persistStep(6);
      setStep(6);
    }
  };

  const handleCompleteOnboarding = async () => {
    // Complete onboarding
    await persistStep(6, true);
    toast.success("Workspace ready! Welcome to GloriousFinance.");
    navigate({ to: "/", replace: true });
  };

  const handleSkipAll = async () => {
    await persistStep(6, true);
    toast.info("Onboarding skipped. You can complete your checklist on the dashboard.");
    navigate({ to: "/", replace: true });
  };

  // Keyboard Navigation: Enter for Next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const activeElement = document.activeElement;
        // Avoid triggering when user is typing in textarea or on a button
        if (activeElement?.tagName !== "TEXTAREA" && activeElement?.tagName !== "BUTTON") {
          e.preventDefault();
          if (step === 1) {
            persistStep(2).then(() => setStep(2));
          } else if (step === 6) {
            handleCompleteOnboarding();
          } else {
            handleNext();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, userType, accountName, openingBalance, accountType, goalName, goalTarget, goalDate]);

  // Framer Motion Animation Variants
  const slideVariants = {
    hidden: { opacity: 0, x: 25 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
    exit: { opacity: 0, x: -25, transition: { duration: 0.3, ease: "easeIn" as const } }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-canvas via-background to-ivory p-4 md:p-8">
      {/* Container */}
      <Card className="card-luxe relative flex w-full max-w-[960px] flex-col overflow-hidden bg-card/90 md:flex-row md:min-h-[580px] shadow-elevated">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-gold to-peach" />

        {/* Left Side: Premium Aesthetic Panel */}
        <div className="relative hidden w-[360px] flex-col justify-between bg-primary p-8 text-primary-foreground md:flex">
          {/* Subtle overlay grid */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-navy-soft/60 via-primary to-primary opacity-90" />
          
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold animate-pulse" />
              <span className="font-display text-sm font-semibold uppercase tracking-[0.2em]">GloriousFinance</span>
            </div>
            <p className="text-xs text-primary-foreground/60">AI Wealth Operating System</p>
          </div>

          {/* Dynamic illustrations for steps */}
          <div className="relative z-10 flex flex-col items-center justify-center py-10 text-center">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="welcome-ill"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-gold shadow-lg backdrop-blur-md">
                    <Sparkles className="h-10 w-10" />
                  </div>
                  <div className="text-sm font-medium text-gold">Elegant & Private</div>
                  <p className="text-xs text-primary-foreground/75 leading-relaxed">
                    Designed for individuals who value typography, luxury details, and quiet control over their net worth.
                  </p>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="workspace-ill"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-gold shadow-lg backdrop-blur-md">
                    {userType === "personal" ? <User className="h-10 w-10" /> : <Briefcase className="h-10 w-10" />}
                  </div>
                  <div className="text-sm font-medium text-gold">
                    {userType === "personal" ? "Personal Space" : "Business Workspace"}
                  </div>
                  <p className="text-xs text-primary-foreground/75 leading-relaxed">
                    Separate personal liabilities from business cash flow. Customize categories and intelligence targets.
                  </p>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="currency-ill"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-gold shadow-lg backdrop-blur-md">
                    <Coins className="h-10 w-10" />
                  </div>
                  <div className="text-sm font-medium text-gold">Indian Rupee (INR)</div>
                  <p className="text-xs text-primary-foreground/75 leading-relaxed">
                    Default currency set to INR (₹) with full formatting, locale precision, and standard lac/crore scale representation.
                  </p>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="account-ill"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="w-full space-y-4"
                >
                  {/* Real-time Account Card Preview */}
                  <motion.div 
                    className="mx-auto flex h-36 w-60 flex-col justify-between rounded-xl bg-gradient-to-br from-gold via-gold/90 to-peach p-4 text-left shadow-lg text-primary"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
                        {accountType.replace("_", " ")}
                      </span>
                      {accountType === "bank" && <Landmark className="h-4 w-4" />}
                      {accountType === "cash" && <Wallet className="h-4 w-4" />}
                      {accountType === "credit_card" && <CreditCard className="h-4 w-4" />}
                      {accountType === "investment" && <TrendingUp className="h-4 w-4" />}
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[10px] opacity-60">Balance</div>
                      <div className="font-numeric text-lg font-bold">
                        {formatINR(parseFloat(openingBalance) || 0)}
                      </div>
                    </div>
                    <div className="text-xs font-semibold truncate">
                      {accountName || "Account Name"}
                    </div>
                  </motion.div>
                  <p className="text-xs text-primary-foreground/75 leading-relaxed px-4">
                    Live account card preview. Create your starting balance to begin charting your assets immediately.
                  </p>
                </motion.div>
              )}

              {step === 5 && (
                <motion.div
                  key="goal-ill"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-gold shadow-lg backdrop-blur-md">
                    <Target className="h-10 w-10" />
                  </div>
                  <div className="text-sm font-medium text-gold">{goalName || "Savings Goal"}</div>
                  <p className="text-xs text-primary-foreground/75 leading-relaxed">
                    Set a financial target. GloriousFinance calculates your required monthly deposits and alerts you on deficits.
                  </p>
                </motion.div>
              )}

              {step === 6 && (
                <motion.div
                  key="ready-ill"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-gold shadow-lg backdrop-blur-md">
                    <CheckCircle2 className="h-10 w-10 text-success" />
                  </div>
                  <div className="text-sm font-medium text-gold">Ready to Launch</div>
                  <p className="text-xs text-primary-foreground/75 leading-relaxed">
                    Your luxury workspace configuration is complete. Welcome to quiet wealth monitoring.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Steps Progress Indicator */}
          <div className="relative z-10 space-y-2">
            <div className="flex justify-between text-[10px] uppercase tracking-widest text-primary-foreground/55">
              <span>Progress</span>
              <span>Step {step} of 6</span>
            </div>
            <div className="h-1 w-full rounded-full bg-white/15">
              <div 
                className="h-full bg-gold rounded-full transition-all duration-300"
                style={{ width: `${(step / 6) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Side: Onboarding Content */}
        <div className="flex flex-1 flex-col justify-between p-6 md:p-10 bg-background/30">
          {/* Header Mobile Progress bar */}
          <div className="block md:hidden mb-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Onboarding</span>
              <span className="font-numeric">Step {step}/6</span>
            </div>
            <Progress value={(step / 6) * 100} className="h-1" />
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                variants={slideVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                {/* STEP 1: WELCOME */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                        <Sparkles className="h-3.5 w-3.5" /> Introducing GloriousFinance
                      </div>
                      <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
                        Welcome to GloriousFinance 👋
                      </h1>
                      <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                        Build your complete, private financial workspace in under 2 minutes.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {[
                        { title: "Track Wealth", desc: "Consolidate cash, bank, and investments." },
                        { title: "Monitor Expenses", desc: "Stay within custom, intelligent budgets." },
                        { title: "Manage Investments", desc: "Track returns and index performance." },
                        { title: "Achieve Goals", desc: "Watch savings milestones grow dynamically." }
                      ].map((benefit, idx) => (
                        <div key={idx} className="flex gap-2.5 items-start p-3 rounded-xl border border-border/40 bg-white/40">
                          <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">{benefit.title}</h4>
                            <p className="text-xs text-muted-foreground">{benefit.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      <Button 
                        size="lg"
                        className="h-12 px-6 rounded-xl font-medium bg-primary hover:bg-navy-soft text-primary-foreground shadow-lg flex items-center justify-center gap-2 group cursor-pointer"
                        onClick={() => { setStep(2); persistStep(2); }}
                      >
                        Get Started
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="lg" 
                        className="h-12 px-6 rounded-xl font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={handleSkipAll}
                      >
                        Skip Setup
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 2: WORKSPACE TYPE */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
                        Select Workspace Type
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        We will customize categories, insights, and options based on your workspace.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 pt-2">
                      {[
                        {
                          id: "personal",
                          title: "Personal Finance",
                          desc: "Track your personal wealth, expenses, investments, budgets, and goals.",
                          icon: User,
                        },
                        {
                          id: "business",
                          title: "Business Finance",
                          desc: "Track company finances, cashflow, expenses, clients, and reports.",
                          icon: Briefcase,
                        },
                        {
                          id: "family",
                          title: "Family Finance",
                          desc: "Coordinate joint savings, household bills, pocket money, and mutual goals.",
                          icon: Users,
                          comingSoon: true
                        }
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = userType === item.id;
                        
                        return (
                          <motion.div
                            key={item.id}
                            className={`relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                              item.comingSoon 
                                ? "opacity-50 cursor-not-allowed border-dashed bg-muted/20" 
                                : isSelected 
                                  ? "bg-primary/5 border-primary shadow-sm" 
                                  : "bg-white/40 hover:bg-white border-border/50 hover:border-gold/30 cursor-pointer"
                            }`}
                            whileHover={item.comingSoon ? {} : { y: -2 }}
                            onClick={() => {
                              if (item.comingSoon) return;
                              setUserType(item.id as any);
                            }}
                          >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            
                            <div className="space-y-1 text-left">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground">{item.title}</span>
                                {item.comingSoon && (
                                  <span className="rounded bg-gold/10 px-1.5 py-0.5 text-[9px] font-semibold text-gold uppercase tracking-wider">
                                    Soon
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <Button variant="ghost" className="h-10 rounded-xl cursor-pointer" onClick={handleBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button className="h-10 px-5 rounded-xl bg-primary hover:bg-navy-soft text-primary-foreground cursor-pointer" onClick={handleNext}>
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 3: CURRENCY */}
                {step === 3 && (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
                        Select Base Currency
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        All transactions, balances, and reports will default to this currency.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="relative flex flex-col justify-between p-5 rounded-2xl border-2 border-primary bg-primary/5 text-left shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-display text-sm font-bold text-foreground">Indian Rupee</span>
                          <span className="font-display text-xs font-semibold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded">INR</span>
                        </div>
                        <div className="mt-8 flex items-baseline gap-1.5">
                          <span className="font-display text-3xl font-extrabold text-foreground">₹</span>
                          <span className="text-xs text-muted-foreground">Standard representation (₹ Lakh/Crore)</span>
                        </div>
                      </div>

                      <div className="relative flex flex-col justify-between p-5 rounded-2xl border border-dashed border-border/80 bg-muted/10 text-left opacity-60">
                        <div className="flex items-center justify-between">
                          <span className="font-display text-sm font-semibold text-muted-foreground">Other Currencies</span>
                          <Globe className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                          Multi-currency capabilities will be available in future releases to support international asset classes.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <Button variant="ghost" className="h-10 rounded-xl cursor-pointer" onClick={handleBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button className="h-10 px-5 rounded-xl bg-primary hover:bg-navy-soft text-primary-foreground cursor-pointer" onClick={handleNext}>
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 4: FIRST ACCOUNT */}
                {step === 4 && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
                        Create Your First Account
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Start with your primary bank, cash wallet, or investments. Skip if you want to set this up later.
                      </p>
                    </div>

                    <div className="space-y-4 pt-1">
                      {/* Selectable Account Types */}
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: "bank", label: "Bank", icon: Landmark },
                          { id: "cash", label: "Cash", icon: Wallet },
                          { id: "credit_card", label: "Card", icon: CreditCard },
                          { id: "investment", label: "Asset", icon: TrendingUp }
                        ].map((type) => {
                          const Icon = type.icon;
                          const isSelected = accountType === type.id;
                          return (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => setAccountType(type.id as any)}
                              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all ${
                                isSelected 
                                  ? "bg-primary/5 border-primary text-primary font-semibold" 
                                  : "bg-white/40 border-border/50 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              <span className="text-[10px] tracking-wide">{type.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Fields */}
                      <div className="grid grid-cols-2 gap-3 text-left">
                        <div className="col-span-2">
                          <Label htmlFor="acc-name" className="text-xs font-semibold text-muted-foreground">Account Name</Label>
                          <Input 
                            id="acc-name"
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                            placeholder="e.g. HDFC Salary, SBI Savings"
                            className="mt-1 h-9 rounded-lg"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="acc-balance" className="text-xs font-semibold text-muted-foreground">Opening Balance (₹)</Label>
                          <Input 
                            id="acc-balance"
                            type="number"
                            value={openingBalance}
                            onChange={(e) => setOpeningBalance(e.target.value)}
                            placeholder="e.g. 50000"
                            className="mt-1 h-9 rounded-lg font-numeric"
                          />
                        </div>
                        <div>
                          <Label htmlFor="acc-currency" className="text-xs font-semibold text-muted-foreground">Currency</Label>
                          <Input 
                            id="acc-currency"
                            value="INR (₹)"
                            disabled
                            className="mt-1 h-9 rounded-lg bg-muted/40 cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <Button variant="ghost" className="h-10 rounded-xl cursor-pointer" onClick={handleBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="ghost" className="h-10 rounded-xl cursor-pointer" onClick={handleSkipStep}>
                          Skip
                        </Button>
                        <Button 
                          className="h-10 px-5 rounded-xl bg-primary hover:bg-navy-soft text-primary-foreground cursor-pointer" 
                          onClick={handleNext}
                          disabled={!accountName}
                        >
                          Continue <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 5: FIRST GOAL */}
                {step === 5 && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
                        What's Your First Financial Goal?
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Add a milestone to stay focused on saving. You can skip this step at any time.
                      </p>
                    </div>

                    <div className="space-y-4 pt-1">
                      {/* Goal Categories */}
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                        {[
                          { id: "Emergency Fund", label: "Shield", icon: ShieldCheck },
                          { id: "House", label: "House", icon: Home },
                          { id: "Car", label: "Car", icon: Car },
                          { id: "Vacation", label: "Trip", icon: Plane },
                          { id: "Education", label: "Study", icon: GraduationCap },
                          { id: "Wealth Creation", label: "Grow", icon: TrendingUp },
                          { id: "Custom", label: "Other", icon: Target }
                        ].map((cat) => {
                          const Icon = cat.icon;
                          const isSelected = goalCategory === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setGoalCategory(cat.id)}
                              className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all ${
                                isSelected 
                                  ? "bg-primary/5 border-primary text-primary font-semibold" 
                                  : "bg-white/40 border-border/50 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              <span className="text-[9px] tracking-wide truncate max-w-full">{cat.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Fields */}
                      <div className="grid grid-cols-2 gap-3 text-left">
                        <div className="col-span-2">
                          <Label htmlFor="goal-name" className="text-xs font-semibold text-muted-foreground">Goal Name</Label>
                          <Input 
                            id="goal-name"
                            value={goalName}
                            onChange={(e) => setGoalName(e.target.value)}
                            placeholder="e.g. 6-Month Emergency Fund"
                            className="mt-1 h-9 rounded-lg"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="goal-target" className="text-xs font-semibold text-muted-foreground">Target Amount (₹)</Label>
                          <Input 
                            id="goal-target"
                            type="number"
                            value={goalTarget}
                            onChange={(e) => setGoalTarget(e.target.value)}
                            placeholder="e.g. 300000"
                            className="mt-1 h-9 rounded-lg font-numeric"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="goal-date" className="text-xs font-semibold text-muted-foreground">Target Date</Label>
                          <Input 
                            id="goal-date"
                            type="date"
                            value={goalDate}
                            onChange={(e) => setGoalDate(e.target.value)}
                            className="mt-1 h-9 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <Button variant="ghost" className="h-10 rounded-xl cursor-pointer" onClick={handleBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="ghost" className="h-10 rounded-xl cursor-pointer" onClick={handleSkipStep}>
                          Skip
                        </Button>
                        <Button 
                          className="h-10 px-5 rounded-xl bg-primary hover:bg-navy-soft text-primary-foreground cursor-pointer" 
                          onClick={handleNext}
                          disabled={!goalName || !goalTarget}
                        >
                          Continue <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 6: READY */}
                {step === 6 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="inline-flex h-9 items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                        <CheckCircle2 className="h-3.5 w-3.5 fill-success/10" /> Configuration Complete
                      </div>
                      <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
                        Your workspace is ready.
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        We've completed the initialization of your wealth console. Here is your summary:
                      </p>
                    </div>

                    {/* Summary Card */}
                    <div className="rounded-2xl border border-border/50 bg-white/40 p-4 space-y-3 text-left text-sm">
                      <div className="flex justify-between py-1 border-b border-border/30">
                        <span className="text-muted-foreground font-medium">Workspace</span>
                        <span className="font-semibold text-foreground">
                          {userType === "personal" ? "👤 Personal Finance" : "💼 Business Finance"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/30">
                        <span className="text-muted-foreground font-medium">Currency</span>
                        <span className="font-semibold text-foreground">INR (₹)</span>
                      </div>
                      {accountCreated && (
                        <div className="flex justify-between py-1 border-b border-border/30">
                          <span className="text-muted-foreground font-medium">Starting Account</span>
                          <span className="font-semibold text-foreground font-numeric">
                            {accountCreated.name} ({formatINR(accountCreated.balance)})
                          </span>
                        </div>
                      )}
                      {goalCreated && (
                        <div className="flex justify-between py-1 border-b border-border/30">
                          <span className="text-muted-foreground font-medium">Savings Goal</span>
                          <span className="font-semibold text-foreground font-numeric">
                            {goalCreated.name} (Target: {formatINR(goalCreated.target)})
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <Button variant="ghost" className="h-10 rounded-xl cursor-pointer" onClick={handleBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button 
                        size="lg"
                        className="h-12 px-6 rounded-xl font-medium bg-primary hover:bg-navy-soft text-primary-foreground shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                        onClick={handleCompleteOnboarding}
                      >
                        Go To Dashboard
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer Indicators */}
          <div className="mt-8 flex justify-between items-center text-[10px] text-muted-foreground">
            <span>GloriousFinance Onboarding</span>
            <div className="flex gap-1.5">
              {STEPS.map((s) => (
                <div 
                  key={s.id} 
                  className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                    s.id === step ? "w-4 bg-primary" : "bg-muted-foreground/30"
                  }`} 
                />
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
