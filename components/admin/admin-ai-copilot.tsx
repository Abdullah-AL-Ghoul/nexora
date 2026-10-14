"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { 
  Sparkles, 
  Send, 
  X, 
  Bot, 
  User, 
  Loader2, 
  TrendingUp, 
  Package, 
  ExternalLink,
  Minimize2,
  Maximize2
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ActionItem = {
  label: string;
  action: string;
  url?: string;
};

type ChatMessage = {
  id: string;
  sender: "user" | "copilot";
  text: string;
  actions?: ActionItem[];
  timestamp: Date;
};

const INITIAL_PROMPTS = [
  "فحص المخزون والقطع التي أوشكت على النفاذ",
  "ملخص المبيعات وحركة الطلبات المسجلة",
  "اكتب وصف تسويقي فاخر لمنتج مجوهرات جديد",
  "Analyze low stock pieces & restock priorities",
];

export function AdminAiCopilot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init",
      sender: "copilot",
      text: "مرحباً بك في غرفة القيادة! أنا **المساعد الذكي التنفيذي (NEXORA AI Co-pilot)**.\n\nأنا متصل مباشرة بقاعدة بيانات متجرك ويمكنني فحص المخزون، تلخيص المبيعات، صياغة أوصاف المنتجات الفاخرة، ومساعدتك في إدارة المتجر بسرعة.",
      actions: [
        { label: "📊 فحص المخزون والقطع الناقصة", action: "query", url: "فحص المخزون" },
        { label: "💼 تقرير المبيعات والإيرادات", action: "query", url: "تقرير المبيعات" },
      ],
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  async function handleSend(queryText?: string) {
    const textToSend = (queryText ?? input).trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to contact AI Co-pilot");
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "copilot",
        text: data.message,
        actions: data.actionItems,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error contacting co-pilot";
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "copilot",
          text: `⚠️ عذراً، حدث خطأ أثناء معالجة الطلب: ${msg}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setOpen(!open)}
          className="group relative flex items-center gap-2 rounded-full border border-primary/40 bg-gradient-to-r from-background via-card to-background px-4 py-2.5 shadow-xl transition-all duration-300 hover:scale-105 hover:border-primary hover:shadow-primary/20 text-foreground"
        >
          <div className="relative flex size-6 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Sparkles className="size-3.5 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
          </div>
          <span className="font-serif text-xs font-semibold tracking-wide">
            {open ? "Close Co-pilot" : "Atelier AI Co-pilot"}
          </span>
          <Badge variant="outline" className="ml-1 border-primary/30 text-[9px] uppercase font-mono bg-primary/10 text-primary">
            Live
          </Badge>
        </Button>
      </div>

      {/* Slide-out Co-pilot Pane */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 flex h-[620px] max-h-[85vh] w-[420px] max-w-[92vw] flex-col rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl transition-all duration-300 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-r from-card via-card to-primary/5 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30">
                <Bot className="size-4" />
              </div>
              <div>
                <h3 className="font-serif text-sm font-semibold text-foreground flex items-center gap-1.5">
                  NEXORA Co-pilot
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </h3>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Atelier Executive Intelligence
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="size-7 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Quick Prompt Suggestions */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/50 bg-muted/20 px-3 py-2 no-scrollbar">
            {INITIAL_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void handleSend(prompt)}
                disabled={loading}
                className="whitespace-nowrap rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Conversation Stream */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.sender === "copilot" && (
                  <div className="size-6 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center mt-0.5">
                    <Sparkles className="size-3" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3 shadow-xs space-y-2.5 ${
                    m.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-xs"
                      : "border border-border/80 bg-muted/30 text-foreground rounded-tl-xs"
                  }`}
                >
                  <div className="whitespace-pre-line leading-relaxed">
                    {m.text}
                  </div>

                  {m.actions && m.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
                      {m.actions.map((act) =>
                        act.url && act.action === "navigate" ? (
                          <Button
                            key={act.label}
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] gap-1 px-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                          >
                            <Link href={act.url}>
                              <span>{act.label}</span>
                              <ExternalLink className="size-2.5" />
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            key={act.label}
                            variant="outline"
                            size="sm"
                            onClick={() => void handleSend(act.url || act.label)}
                            className="h-6 text-[10px] gap-1 px-2 border-border/80 text-foreground hover:bg-muted"
                          >
                            <span>{act.label}</span>
                          </Button>
                        )
                      )}
                    </div>
                  )}

                  <div className="text-[9px] opacity-60 text-right">
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {m.sender === "user" && (
                  <div className="size-6 shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center mt-0.5">
                    <User className="size-3" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-[11px] py-1">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                <span>NEXORA AI is reviewing database telemetry…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="border-t border-border/70 bg-card p-3"
          >
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about inventory, orders, or write copy…"
                disabled={loading}
                className="h-9 text-xs border-border/80 focus-visible:border-primary/60"
              />
              <Button
                type="submit"
                size="sm"
                disabled={loading || !input.trim()}
                className="h-9 px-3 gap-1 shrink-0"
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
