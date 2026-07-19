import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { chatWithAssistant } from "@/lib/ai-assistant.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, SendHorizonal, Loader2 } from "lucide-react";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: "AI Assistant · GloriousFinance" }] }),
  component: AssistantPage,
});

interface Msg { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "How much did I spend on Food this month?",
  "What's my current net worth?",
  "Which categories am I overspending on?",
  "Summarise my investment portfolio performance.",
  "What bills are due in the next 15 days?",
];

function AssistantPage() {
  const chat = useServerFn(chatWithAssistant);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => { areaRef.current?.focus(); }, []);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chat({ data: { messages: next } });
      setMessages((m) => [...m, { role: "assistant", content: res.content }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Something went wrong."}` }]);
    } finally { setBusy(false); areaRef.current?.focus(); }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <PageHeader
        title={<span className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-gold" />AI Financial Assistant</span>}
        subtitle="Ask about your accounts, budgets, spending patterns and investments. Grounded in your live data."
      />
      <div className="flex-1 overflow-y-auto px-6 pb-6 md:px-10">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-2xl py-8">
            <Card className="card-luxe p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-gold" />
              </div>
              <h3 className="mt-4 font-display text-xl">How can I help with your finances today?</h3>
              <p className="mt-2 text-sm text-muted-foreground">Try a starter question or ask your own.</p>
              <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-lg border border-border bg-card p-3 text-sm text-foreground transition hover:border-primary hover:shadow-sm">
                    {s}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4 py-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "card-luxe"}`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="card-luxe max-w-[85%] rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="inline h-4 w-4 animate-spin" /> Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      <div className="border-t border-border/60 bg-background/80 px-6 py-4 backdrop-blur md:px-10">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            ref={areaRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about your finances…" rows={1}
            className="min-h-[44px] resize-none"
          />
          <Button onClick={() => send()} disabled={busy || !input.trim()} size="icon">
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
