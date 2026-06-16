import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import {
  Brain,
  Database,
  ShieldCheck,
  Sparkles,
  Target,
  ClipboardCheck,
} from "lucide-react";

const AGENTS = [
  {
    icon: <Brain className="h-5 w-5" />,
    name: "Mentor Agent",
    desc: "Tracks your goals, weak areas and pace — and recalls them every time you return.",
  },
  {
    icon: <Target className="h-5 w-5" />,
    name: "Challenge Agent",
    desc: "Generates adaptive Linux privilege-escalation labs targeted at your gaps.",
  },
  {
    icon: <ClipboardCheck className="h-5 w-5" />,
    name: "Evaluator Agent",
    desc: "Scores your answers, explains mistakes and writes a memory summary.",
  },
];

const PILLARS = [
  {
    icon: <Database className="h-5 w-5" />,
    title: "Walrus memory",
    desc: "Session summaries, attempts and reports persist as verifiable Walrus blobs.",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Sui checkpoints",
    desc: "Each attempt anchors a portable, owned SkillCheckpoint on Sui.",
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "Persistent agents",
    desc: "Your AI tutor never forgets — it builds on every past session.",
  },
];

export function Landing() {
  return (
    <div className="relative mx-auto max-w-5xl px-4 py-16">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-60" />

      <div className="text-center animate-in">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Sui Overflow · Walrus Track
        </span>
        <h1 className="mt-6 text-5xl font-extrabold tracking-tight sm:text-6xl">
          <span className="text-gradient">RecallForge</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          AI cybersecurity tutors that actually <em>remember</em>. Persistent
          learning agents that track your progress, generate adaptive challenges,
          and verify your skill growth using Walrus memory and Sui identity.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <ConnectButton />
          <p className="text-xs text-muted-foreground">
            Connect a Sui wallet to begin. Testnet recommended.
          </p>
        </div>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {AGENTS.map((a) => (
          <div key={a.name} className="glass rounded-2xl p-5 animate-in">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              {a.icon}
            </div>
            <h3 className="mt-3 font-semibold">{a.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <div
            key={p.title}
            className="flex items-start gap-3 rounded-xl border border-border/70 p-4"
          >
            <span className="mt-0.5 text-accent">{p.icon}</span>
            <div>
              <h4 className="text-sm font-semibold">{p.title}</h4>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-border/70 bg-surface/50 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          “Last time, you struggled with{" "}
          <span className="text-foreground">SUID enumeration</span> during Linux
          privilege escalation. I generated a targeted follow-up challenge and
          updated your roadmap.”
        </p>
        <p className="mt-2 text-xs text-primary">— your Mentor Agent, on return</p>
      </div>
    </div>
  );
}
