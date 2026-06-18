import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { useState } from "react";
import {
  Brain,
  History,
  LayoutDashboard,
  Loader2,
  Map as MapIcon,
  ShieldCheck,
} from "lucide-react";
import type { SkillArea } from "../shared/schema";
import { Landing } from "./views/Landing";
import { Onboarding } from "./views/Onboarding";
import { Dashboard } from "./views/Dashboard";
import { ChallengeView } from "./views/ChallengeView";
import { Timeline } from "./views/Timeline";
import { ProgressMap } from "./views/Progress";
import { MemoryExplorer } from "./views/MemoryExplorer";
import { useRecallForge } from "./context/RecallForgeContext";
import { cn } from "./lib/utils";

type View = "dashboard" | "challenge" | "timeline" | "progress" | "memory";

interface ActiveChallenge {
  focus: SkillArea;
  level: number;
}

const NAV: Array<{ id: View; label: string; icon: React.ReactNode }> = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "timeline", label: "Timeline", icon: <History className="h-4 w-4" /> },
  { id: "memory", label: "Memory", icon: <Brain className="h-4 w-4" /> },
  { id: "progress", label: "Progress", icon: <MapIcon className="h-4 w-4" /> },
];

function App() {
  const account = useCurrentAccount();
  const { profileId, profileLoading, network } = useRecallForge();
  const [view, setView] = useState<View>("dashboard");
  const [active, setActive] = useState<ActiveChallenge | null>(null);

  function startChallenge(focus: SkillArea, level: number) {
    setActive({ focus, level });
    setView("challenge");
  }

  // Not connected → marketing landing.
  if (!account) {
    return (
      <Shell network={network} nav={null}>
        <Landing />
      </Shell>
    );
  }

  // Connected, but still discovering the profile from chain → loader (avoids
  // flashing onboarding for a returning learner on a fresh browser).
  if (profileLoading) {
    return (
      <Shell network={network} nav={null}>
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Restoring your profile from Sui…
        </div>
      </Shell>
    );
  }

  // Connected but no profile yet → onboarding.
  if (!profileId) {
    return (
      <Shell network={network} nav={null}>
        <Onboarding onComplete={() => setView("dashboard")} />
      </Shell>
    );
  }

  return (
    <Shell
      network={network}
      nav={
        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActive(null);
                setView(item.id);
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                view === item.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </nav>
      }
    >
      {view === "dashboard" && <Dashboard onStart={startChallenge} />}
      {view === "challenge" && active && (
        <ChallengeView
          focus={active.focus}
          level={active.level}
          onBack={() => setView("dashboard")}
        />
      )}
      {view === "timeline" && <Timeline />}
      {view === "memory" && <MemoryExplorer />}
      {view === "progress" && <ProgressMap onStart={startChallenge} />}
    </Shell>
  );
}

/** Shared app chrome: top bar with brand, nav slot, network badge and wallet. */
function Shell({
  children,
  nav,
  network,
}: {
  children: React.ReactNode;
  nav: React.ReactNode;
  network: string;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-brand-2 text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Recall<span className="text-gradient">Forge</span>
            </span>
          </div>

          {nav}

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-surface/60 px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {network}
            </span>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-12 border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        RecallForge · Persistent cybersecurity learning agents on Walrus & Sui
      </footer>
    </div>
  );
}

export default App;
