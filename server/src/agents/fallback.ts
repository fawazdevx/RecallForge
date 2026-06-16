/**
 * Deterministic, offline agent engine.
 *
 * This is what powers the 3 agents when no `ANTHROPIC_API_KEY` is configured —
 * and the safety net the LLM path falls back to on error. It is a curated,
 * rule-based model of the "Linux privilege escalation" track: a challenge bank,
 * a concept-keyword scorer, and simple roadmap/recall generators. Everything it
 * returns already satisfies the shared zod schemas.
 *
 * The cybersecurity content here is strictly educational and defensive: it
 * teaches *enumeration* and *hardening* concepts (what to look for, how to fix
 * it), not weaponised exploits.
 */
import { randomUUID } from "node:crypto";
import type {
  Challenge,
  ChallengeRequest,
  Evaluation,
  EvaluateRequest,
  OnboardingRequest,
  Recall,
  RecalledMemory,
  RecallRequest,
  Roadmap,
  SkillArea,
} from "../../../shared/schema";
import { SKILL_LABELS } from "../../../shared/schema";

interface Concept {
  concept: string;
  weight: number;
  /** Lower-cased substrings that, if present in the answer, credit the concept. */
  keywords: string[];
}

interface ChallengeTemplate {
  skill: SkillArea;
  title: string;
  difficultyForLevel: (level: number) => Challenge["difficulty"];
  scenario: string;
  prompt: string;
  hints: string[];
  concepts: Concept[];
}

// ===== Challenge bank (Linux privesc track) =====

const TEMPLATES: Record<string, ChallengeTemplate> = {
  "suid-enumeration": {
    skill: "suid-enumeration",
    title: "Hunting Dangerous SUID Binaries",
    difficultyForLevel: (l) => (l <= 1 ? "easy" : l <= 3 ? "medium" : "hard"),
    scenario:
      "You have a low-privileged shell as user `web` on a Linux host during an authorized engagement. " +
      "Your goal is to escalate to root through SUID misconfiguration. You can run normal user commands.",
    prompt:
      "Explain, step by step, how you would enumerate SUID binaries on this host, how you decide which ones " +
      "are exploitable, and how you would leverage one well-known SUID binary to gain a root shell. Then describe " +
      "how a defender should remediate the issue.",
    hints: [
      "The SUID bit means a binary runs with the file owner's privileges, not yours.",
      "There is a community project that catalogs how to abuse standard binaries.",
      "Not every SUID binary is exploitable — focus on ones that can spawn a shell or read/write arbitrary files.",
    ],
    concepts: [
      {
        concept: "Enumerate SUID binaries with find",
        weight: 25,
        keywords: ["find /", "-perm", "4000", "-perm -u=s", "suid", "setuid"],
      },
      {
        concept: "Cross-reference GTFOBins",
        weight: 20,
        keywords: ["gtfobins", "known exploitable", "abuse standard binary"],
      },
      {
        concept: "Abuse a SUID binary to spawn a shell",
        weight: 25,
        keywords: ["spawn", "/bin/sh", "bash -p", "root shell", "-p", "euid"],
      },
      {
        concept: "Understand effective UID vs real UID",
        weight: 15,
        keywords: ["euid", "effective uid", "real uid", "runs as owner", "owner privileges"],
      },
      {
        concept: "Remediation / hardening",
        weight: 15,
        keywords: ["remove suid", "chmod u-s", "nosuid", "least privilege", "audit", "mount option"],
      },
    ],
  },
  "sudo-misconfig": {
    skill: "sudo-misconfig",
    title: "Reading the sudoers Tea Leaves",
    difficultyForLevel: (l) => (l <= 1 ? "easy" : l <= 3 ? "medium" : "hard"),
    scenario:
      "As user `dev`, running `sudo -l` reveals you may run a specific editor and a backup script as root " +
      "without a password. You are authorized to escalate privileges on this lab host.",
    prompt:
      "Describe how you interpret `sudo -l` output, how a permitted command can lead to a root shell " +
      "(give a concrete example), the role of NOPASSWD and env_keep, and how an administrator should write " +
      "a safer sudoers policy.",
    hints: [
      "`sudo -l` lists exactly what the current user may run as another user.",
      "Many interactive programs can shell out to the OS.",
      "Environment variables preserved across sudo can change a program's behavior.",
    ],
    concepts: [
      {
        concept: "Interpret sudo -l output",
        weight: 20,
        keywords: ["sudo -l", "nopasswd", "may run", "as root", "(root)"],
      },
      {
        concept: "Shell escape from a permitted command",
        weight: 25,
        keywords: ["shell escape", "!sh", ":!/bin/sh", "shell out", "spawn shell", "gtfobins"],
      },
      {
        concept: "Risk of wildcards / scripts run as root",
        weight: 20,
        keywords: ["wildcard", "script", "argument injection", "writable", "tampered"],
      },
      {
        concept: "env_keep / LD_PRELOAD risk",
        weight: 15,
        keywords: ["env_keep", "ld_preload", "ld_library_path", "environment variable", "setenv"],
      },
      {
        concept: "Hardening sudoers",
        weight: 20,
        keywords: ["least privilege", "full path", "no wildcards", "visudo", "remove nopasswd", "secure_path"],
      },
    ],
  },
  "cron-jobs": {
    skill: "cron-jobs",
    title: "A Cron Job That Runs as Root",
    difficultyForLevel: (l) => (l <= 2 ? "medium" : "hard"),
    scenario:
      "On this authorized lab host, `/etc/crontab` runs `/opt/scripts/backup.sh` as root every minute, " +
      "and the script (or its directory) is writable by your group.",
    prompt:
      "Explain how you would discover root-owned cron jobs, why a world/group-writable script run by cron is " +
      "dangerous, exactly how you would leverage it to escalate, and how a defender should lock it down.",
    hints: [
      "Cron jobs often run as root on a fixed schedule.",
      "Check permissions on both the script and every directory in its path.",
      "You only need write access to something root will execute.",
    ],
    concepts: [
      {
        concept: "Enumerate cron jobs",
        weight: 20,
        keywords: ["/etc/crontab", "cron.d", "crontab -l", "/var/log/cron", "systemctl list-timers"],
      },
      {
        concept: "Identify writable script or path",
        weight: 25,
        keywords: ["writable", "ls -l", "permissions", "group writable", "world writable", "find -writable"],
      },
      {
        concept: "Inject a payload that runs as root",
        weight: 25,
        keywords: ["append", "reverse shell", "chmod +s", "copy bash", "add command", "echo >>"],
      },
      {
        concept: "Timing / persistence awareness",
        weight: 10,
        keywords: ["every minute", "wait for", "schedule", "next run"],
      },
      {
        concept: "Remediation",
        weight: 20,
        keywords: ["restrict permissions", "root-owned", "chmod 700", "absolute path", "remove writable"],
      },
    ],
  },
  "path-hijacking": {
    skill: "path-hijacking",
    title: "Hijacking a Relative PATH",
    difficultyForLevel: (l) => (l <= 2 ? "medium" : "hard"),
    scenario:
      "A root-run program on this lab host calls a system command without an absolute path (e.g. `service` or " +
      "`backup` invokes `tar`). Your account controls a directory that appears early in the effective PATH.",
    prompt:
      "Explain what PATH hijacking is, how you confirm a privileged program calls a binary by relative name, " +
      "how you would exploit it to run code as root, and how developers/admins prevent it.",
    hints: [
      "PATH is searched left to right for a command name.",
      "A program that calls `tar` instead of `/bin/tar` trusts the environment.",
      "If you can place an executable named like the target earlier in PATH, it wins.",
    ],
    concepts: [
      {
        concept: "Explain PATH search order",
        weight: 20,
        keywords: ["path", "search order", "left to right", "$path", "relative name", "environment"],
      },
      {
        concept: "Confirm a relative binary call",
        weight: 20,
        keywords: ["strings", "ltrace", "strace", "calls", "system(", "without absolute path"],
      },
      {
        concept: "Craft a malicious binary earlier in PATH",
        weight: 25,
        keywords: ["export path", "fake", "malicious", "chmod +x", "place binary", "writable dir"],
      },
      {
        concept: "Trigger execution as root",
        weight: 15,
        keywords: ["root runs", "triggered", "executes as root", "spawn shell"],
      },
      {
        concept: "Remediation",
        weight: 20,
        keywords: ["absolute path", "full path", "sanitize path", "secure_path", "reset environment"],
      },
    ],
  },
  capabilities: {
    skill: "capabilities",
    title: "Linux Capabilities Gone Wrong",
    difficultyForLevel: () => "hard",
    scenario:
      "On this authorized lab host, a binary has an unusual Linux capability set (for example `cap_setuid+ep`). " +
      "Capabilities split root's power into units that can be granted to individual binaries.",
    prompt:
      "Explain how you enumerate file capabilities, why a capability like cap_setuid or cap_dac_read_search is " +
      "dangerous, how you would abuse one to escalate, and how to assign capabilities safely.",
    hints: [
      "Capabilities are a finer-grained alternative to the SUID bit.",
      "`getcap` lists them; some let a process change UID or bypass file permissions.",
      "An interpreter with cap_setuid can simply set its UID to 0.",
    ],
    concepts: [
      {
        concept: "Enumerate capabilities with getcap",
        weight: 25,
        keywords: ["getcap", "-r /", "cap_", "+ep", "file capabilities"],
      },
      {
        concept: "Understand dangerous capabilities",
        weight: 25,
        keywords: ["cap_setuid", "cap_dac_read_search", "cap_dac_override", "cap_sys_admin", "bypass"],
      },
      {
        concept: "Abuse a capability to escalate",
        weight: 25,
        keywords: ["setuid(0)", "python", "perl", "os.setuid", "set uid to 0", "read /etc/shadow"],
      },
      {
        concept: "Remediation",
        weight: 25,
        keywords: ["setcap -r", "remove capability", "least privilege", "audit getcap", "avoid cap_setuid"],
      },
    ],
  },
  "linux-basics": {
    skill: "linux-basics",
    title: "Orienting on a New Host",
    difficultyForLevel: () => "intro",
    scenario:
      "You just landed a shell as an unprivileged user on a Linux host you are authorized to test.",
    prompt:
      "List the first enumeration commands you run to understand who you are, what the system is, and where " +
      "privilege-escalation opportunities might be. Explain what each command tells you.",
    hints: [
      "Start with identity and environment before anything fancy.",
      "Kernel version, users, and running services are all useful.",
      "Automated scripts exist, but understand the manual steps first.",
    ],
    concepts: [
      {
        concept: "Identity and groups",
        weight: 20,
        keywords: ["id", "whoami", "groups", "sudo -l"],
      },
      {
        concept: "System and kernel",
        weight: 20,
        keywords: ["uname -a", "/etc/os-release", "hostname", "kernel"],
      },
      {
        concept: "Users and access",
        weight: 20,
        keywords: ["/etc/passwd", "home", "ssh keys", "history"],
      },
      {
        concept: "Processes and services",
        weight: 20,
        keywords: ["ps aux", "netstat", "ss -", "services", "listening"],
      },
      {
        concept: "Privilege escalation surface",
        weight: 20,
        keywords: ["suid", "cron", "sudo", "capabilities", "writable", "linpeas"],
      },
    ],
  },
};

const TRACK_ORDER: SkillArea[] = [
  "linux-basics",
  "suid-enumeration",
  "sudo-misconfig",
  "cron-jobs",
  "path-hijacking",
  "capabilities",
];

function templateFor(skill: SkillArea): ChallengeTemplate {
  return TEMPLATES[skill] ?? TEMPLATES["suid-enumeration"];
}

// ===== Challenge generation =====

export function fallbackChallenge(req: ChallengeRequest): Challenge {
  const tpl = templateFor(req.focus);
  const maxScore = tpl.concepts.reduce((sum, c) => sum + c.weight, 0);
  return {
    id: `rf-${req.focus}-l${req.level}-${randomUUID().slice(0, 8)}`,
    title: tpl.title,
    skill: tpl.skill,
    level: req.level,
    difficulty: tpl.difficultyForLevel(req.level),
    scenario: tpl.scenario,
    prompt: tpl.prompt,
    hints: tpl.hints,
    rubric: tpl.concepts.map((c) => ({ criterion: c.concept, weight: c.weight })),
    expectedConcepts: tpl.concepts.map((c) => c.concept),
    maxScore,
  };
}

// ===== Evaluation =====

export function fallbackEvaluate(req: EvaluateRequest): Evaluation {
  const { challenge, answer } = req;
  const tpl = templateFor(challenge.skill);
  const haystack = answer.toLowerCase();

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 0;

  for (const concept of tpl.concepts) {
    const hit = concept.keywords.some((k) => haystack.includes(k.toLowerCase()));
    if (hit) {
      score += concept.weight;
      strengths.push(concept.concept);
    } else {
      weaknesses.push(concept.concept);
    }
  }

  const maxScore = challenge.maxScore;
  // Small length bonus discourages one-word answers from scraping by on keywords.
  const tooShort = answer.trim().length < 40;
  if (tooShort) {
    score = Math.min(score, Math.floor(maxScore * 0.4));
  }
  score = Math.max(0, Math.min(maxScore, score));

  const pct = score / maxScore;
  const passed = pct >= 0.6;

  // Next focus: the first track skill not yet demonstrated, else advance.
  const nextFocus: SkillArea = weaknesses.length
    ? challenge.skill
    : advanceSkill(challenge.skill);

  const label = SKILL_LABELS[challenge.skill];
  const feedback = buildFeedback({
    label,
    pct,
    passed,
    strengths,
    weaknesses,
    tooShort,
  });

  const memorySummary = passed
    ? `Completed ${label} (L${challenge.level}) at ${Math.round(pct * 100)}%. ` +
      (weaknesses.length ? `Still shaky on: ${weaknesses[0]}.` : "Solid across the rubric.")
    : `Struggled with ${label} (L${challenge.level}) at ${Math.round(pct * 100)}%. ` +
      `Weak on: ${weaknesses.slice(0, 2).join("; ") || "fundamentals"}.`;

  return {
    challengeId: challenge.id,
    skill: challenge.skill,
    score,
    maxScore,
    passed,
    strengths,
    weaknesses,
    feedback,
    nextFocus,
    memorySummary: memorySummary.slice(0, 280),
  };
}

function advanceSkill(skill: SkillArea): SkillArea {
  const idx = TRACK_ORDER.indexOf(skill);
  if (idx === -1 || idx === TRACK_ORDER.length - 1) return skill;
  return TRACK_ORDER[idx + 1];
}

function buildFeedback(args: {
  label: string;
  pct: number;
  passed: boolean;
  strengths: string[];
  weaknesses: string[];
  tooShort: boolean;
}): string {
  const { label, pct, passed, strengths, weaknesses, tooShort } = args;
  const parts: string[] = [];
  parts.push(
    passed
      ? `Nice work — your answer covers the core of ${label} (${Math.round(pct * 100)}% on the rubric).`
      : `You're on the way with ${label}, but this attempt scored ${Math.round(pct * 100)}% — below the 60% bar.`,
  );
  if (strengths.length) {
    parts.push(`You clearly demonstrated: ${strengths.join("; ")}.`);
  }
  if (weaknesses.length) {
    parts.push(
      `To improve, address: ${weaknesses.join("; ")}. ` +
        `Be concrete — name the exact command and explain why it works.`,
    );
  }
  if (tooShort) {
    parts.push(
      "Your answer was quite short; graders want to see your reasoning, not just keywords.",
    );
  }
  parts.push("Remember to always include the defensive/remediation angle.");
  return parts.join(" ");
}

// ===== Roadmap (onboarding) =====

export function fallbackRoadmap(req: OnboardingRequest): Roadmap {
  const start: SkillArea =
    req.experience === "advanced"
      ? "sudo-misconfig"
      : req.experience === "intermediate"
        ? "suid-enumeration"
        : "linux-basics";

  const startIdx = TRACK_ORDER.indexOf(start);
  const ordered = TRACK_ORDER.slice(startIdx);

  const steps = ordered.slice(0, 5).map((skill, i) => ({
    skill,
    title: `${SKILL_LABELS[skill]}`,
    rationale:
      i === 0
        ? `A ${req.experience} learner should start here to build a solid base for Linux privilege escalation.`
        : `Builds on ${SKILL_LABELS[ordered[i - 1]]}; a common real-world escalation path.`,
    targetLevel: Math.min(5, 2 + i) as Roadmap["steps"][number]["targetLevel"],
  }));

  return {
    greeting:
      `Welcome to RecallForge, ${req.handle}! I'm your Mentor Agent. ` +
      `Based on your ${req.experience} background${req.goals ? ` and your goal "${req.goals}"` : ""}, ` +
      `I've mapped a Linux privilege-escalation roadmap for you. We'll start with ${SKILL_LABELS[start]} ` +
      `and I'll remember exactly where you struggle so every challenge targets your weak spots.`,
    focusArea: start,
    steps,
  };
}

// ===== Recall =====

export function fallbackRecall(
  req: RecallRequest,
  recalledMemories: RecalledMemory[] = [],
): Recall {
  if (req.history.length === 0) {
    // Even with no on-chain history, MemWal may surface a memory from a prior
    // session (e.g. fresh browser, same wallet) — recall the most relevant one.
    const top = recalledMemories[0];
    if (top) {
      return {
        recall:
          `Welcome back, ${req.handle}. I remember from before: ${top.text} ` +
          `Let's build on that.`,
        focusArea: "linux-basics",
        recommendedLevel: 1,
        note: "Picking up where your memory left off.",
      };
    }
    return {
      recall:
        `Welcome back, ${req.handle}. I don't have any past attempts on record yet — ` +
        `let's start your Linux privilege-escalation journey.`,
      focusArea: "linux-basics",
      recommendedLevel: 1,
      note: "Begin with host enumeration fundamentals.",
    };
  }

  // Most recent attempt drives the recall headline.
  const sorted = [...req.history].sort((a, b) => b.ts - a.ts);
  const last = sorted[0];
  const weakest = pickWeakest(req.history);
  const label = SKILL_LABELS[weakest.skill];

  const recall =
    last.status === "completed" && last.score >= 80
      ? `Welcome back, ${req.handle}. Last time you crushed ${SKILL_LABELS[last.skill]} (${last.score}%). ` +
        `Your weakest area overall is still ${label} — let's reinforce it with something a notch harder.`
      : `Welcome back, ${req.handle}. Last time you struggled with ${SKILL_LABELS[last.skill]} ` +
        `(${last.score}%). I generated a targeted follow-up on ${label} and updated your roadmap.`;

  const recommendedLevel = clampLevel(
    weakest.score >= 70 ? 3 : weakest.score >= 40 ? 2 : 1,
  );

  return {
    recall,
    focusArea: weakest.skill,
    recommendedLevel,
    note: `Focus: ${label}. ${weakest.summary || "Tighten up the concrete commands and remediation."}`,
  };
}

function pickWeakest(history: RecallRequest["history"]): RecallRequest["history"][number] {
  return [...history].sort((a, b) => a.score - b.score)[0];
}

function clampLevel(n: number): Recall["recommendedLevel"] {
  return Math.max(1, Math.min(5, n)) as Recall["recommendedLevel"];
}
