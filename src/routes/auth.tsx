import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in · GloriousFinance" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Welcome to GloriousFinance. Check your email to verify your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in successfully");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast.error("Please enter your email address first");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Password reset instructions sent to your email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-canvas via-background to-ivory">
      <div className="grid min-h-screen w-full lg:grid-cols-[1.1fr_1fr]">
        {/* Editorial hero */}
        <div className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/10">
              <Sparkles className="h-5 w-5 text-gold" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold">GloriousFinance</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/60">Wealth Operating System</div>
            </div>
          </div>
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.3em] text-gold">Private Wealth Console</p>
            <h1 className="font-display text-5xl font-semibold leading-tight">
              Every rupee, <br />quietly accounted for.
            </h1>
            <p className="max-w-md text-sm text-primary-foreground/70">
              An editorial-grade command center for accounts, budgets, investments and taxes — with an AI assistant that understands your finances.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 border-t border-primary-foreground/10 pt-6 text-xs text-primary-foreground/60">
            <div><div className="text-primary-foreground text-lg font-display">₹</div>Native INR</div>
            <div><div className="text-primary-foreground text-lg font-display">◈</div>End-to-end RLS</div>
            <div><div className="text-primary-foreground text-lg font-display">✦</div>AI-native</div>
          </div>
        </div>
        {/* Form */}
        <div className="flex items-center justify-center p-6 lg:p-12">
          <Card className="card-luxe w-full max-w-md p-8">
            <div className="mb-6">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{mode === "signin" ? "Welcome back" : "Create account"}</div>
              <h2 className="mt-1 font-display text-2xl font-semibold">
                {mode === "signin" ? "Sign in to your workspace" : "Start your wealth journal"}
              </h2>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={google} disabled={busy}>
              Continue with Google
            </Button>
            <div className="my-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
              )}
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></div>
              {mode === "signin" && (
                <div className="text-right">
                  <button type="button" onClick={handlePasswordReset} className="text-xs font-medium text-muted-foreground hover:text-primary">
                    Forgot password?
                  </button>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
            <div className="mt-4 text-center text-xs text-muted-foreground">
              {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
              <button className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
