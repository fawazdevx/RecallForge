# RecallForge

**Persistent cybersecurity learning agents on Walrus & Sui.**

RecallForge is an AI-native cybersecurity learning platform whose autonomous
agents *remember* your progress across sessions. A **Mentor Agent** tracks your
weak areas and plans a roadmap, a **Challenge Agent** generates adaptive Linux
privilege-escalation labs, and an **Evaluator Agent** scores your answers and
writes a learning summary. Your memory, reports, and challenge history are
persisted on **Walrus**; portable, verifiable **skill checkpoints** and learner
identity live on **Sui**.

> _"Last time, you struggled with SUID enumeration during Linux privilege
> escalation. I generated a targeted follow-up challenge and updated your
> roadmap."_ — the Mentor Agent, on your return.

Built for **Sui Overflow · Walrus Track**.

---

## Why it's different

Most AI tutors forget everything after a session. RecallForge makes memory the
product:

- **Walrus** is the source of truth for learning memory (onboarding summaries,
  attempt reports, roadmaps) — stored as verifiable blobs.
- **Sui** is the source of truth for progress — each attempt anchors an owned
  `SkillCheckpoint` object that references its Walrus report.
- **Recall is decentralized.** On return, the app reads your owned checkpoints
  from Sui, fetches their Walrus reports, and feeds the summaries to the Mentor.
  There is **no server-side user database** — your data is yours.

## Architecture

```
Browser (Vite + React 19 + dApp-Kit)            Node/Express (stateless)        External
  • sign txs (wallet, non-custodial) ───────────────────────────────────────►  Sui testnet
  • read owned SkillCheckpoints (JSON-RPC) ─────────────────────────────────►  Sui fullnode
  • fetch /api/* ──► Mentor / Challenge / Evaluator agents ──► Claude (key stays server-side)
                  └► /api/walrus ──────────────► Walrus publisher / aggregator (HTTP)
```

- **Frontend** — React 19, Vite 8, Tailwind v4, `@mysten/dapp-kit-react`.
- **Backend** — small stateless Express API: runs the 3 agents (Anthropic Claude
  with a deterministic offline fallback) and stores/reads Walrus blobs. Never
  holds your wallet key; the Claude key never leaves the server.
- **Move package** — `LearnerProfile`, `SkillCheckpoint`, optional
  `AgentPermission`. Owner-asserted, event-emitting, compact on-chain state.
- **Shared schemas** — one zod source of truth (`shared/schema.ts`) validates
  every agent response on both ends.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full data flow.

### Two memory layers

RecallForge separates the **verifiable record** from **semantic recall**:

- **Verifiable record** — every onboarding/attempt is stored as a JSON blob on
  raw **Walrus** and anchored in an owned Sui `SkillCheckpoint`. This is the
  user-owned, independently-verifiable source of truth (open the blob on a public
  Walrus aggregator; see the object on Suiscan).
- **Semantic recall (MemWal)** — the same events are also written to
  **[MemWal / Walrus Memory](https://docs.memwal.ai/)** as natural-language
  memories. On return, the Mentor *queries* MemWal (vector search) for the
  learner's most **relevant** past struggle — regardless of recency — instead of
  replaying the last N checkpoints. The Dashboard shows a "🧠 Recalled from
  MemWal" panel as proof.

MemWal is **optional**: without credentials the app runs exactly as before
(chronological recall from Sui + Walrus). To enable it, generate a delegate key +
account id at the Walrus Memory dashboard (testnet:
`https://staging.memory.walrus.xyz`) and set `MEMWAL_ACCOUNT_ID`,
`MEMWAL_DELEGATE_KEY`, and `MEMWAL_SERVER_URL` in `server/.env` (see
`server/.env.example`). `GET /api/health` reports `memwal: true/false`.

---

## Quick start

### 1. Install

```bash
npm install
npm --prefix server install
```

### 2. Configure

```bash
cp .env.example .env                 # frontend (package id, optional API url)
cp server/.env.example server/.env   # backend (Walrus urls, optional Claude key)
```

- **No Anthropic key?** Leave `ANTHROPIC_API_KEY` unset — the agents run on the
  built-in deterministic engine, so the whole app works offline.
- **Want live AI?** Set `ANTHROPIC_API_KEY` in `server/.env`.
- **Offline Walrus demo?** Set `WALRUS_LOCAL=1` to cache blobs on disk.

### 3. Run (web + api together)

```bash
npm run dev:all
```

- Web: http://localhost:5173
- API: http://localhost:8787 (`GET /api/health` to check the engine/Walrus mode)

The Vite dev server proxies `/api` → the backend, so the frontend needs no extra
config in development.

---

## Deploy the Move package

The Sui CLI is required (see the
[install guide](https://docs.sui.io/guides/developer/getting-started/sui-install)).

```bash
# one-time testnet setup
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet
# fund your address from https://faucet.sui.io

# build, test, publish
sui move build      --path move/recallforge
sui move test       --path move/recallforge
sui client publish  --gas-budget 100000000 move/recallforge
```

Copy the published **packageId** into `.env`:

```bash
VITE_RECALLFORGE_PACKAGE_ID_TESTNET=0x<your_package_id>
```

Restart `npm run dev:all`. The "contract not deployed" banner disappears and
on-chain profile + checkpoint actions activate.

> Until a package id is set, the agents and Walrus memory still work fully — only
> the on-chain writes are gated, with a clear in-app notice.

(Optional) regenerate TypeScript bindings — the app doesn't require them (it uses
`tx.moveCall` directly) but they're handy:

```bash
npm run codegen
```

---

## Demo flow

1. Connect a Sui wallet → create a RecallForge profile (on-chain if deployed).
2. The Mentor Agent onboards you and writes a roadmap artifact to Walrus.
3. The Challenge Agent generates a Linux privesc challenge.
4. Submit an imperfect answer → the Evaluator scores it, identifies the weakness,
   and stores the report on Walrus.
5. Record a Sui `SkillCheckpoint` (signed by your wallet) referencing the blob.
6. **Return later** → the Mentor reads your checkpoints + Walrus reports and
   recalls your weak area, then the Challenge Agent generates a targeted
   follow-up. The Memory timeline and Progress map show the whole history.

---

## Security practices

- **Secrets server-side only.** The Anthropic key is read once in `server/env.ts`,
  never sent to the client, never logged. The frontend bundle contains no keys.
- **Non-custodial.** Every on-chain write is signed by the user's wallet; the
  backend never signs Sui transactions.
- **Validated everywhere.** All API inputs and all LLM outputs are parsed with
  zod before use; malformed model output falls back to the deterministic engine
  instead of reaching the UI.
- **Abuse/cost controls.** Per-IP rate limiting on agent routes, request body
  size limits, `helmet` headers, and CORS locked to the configured origin.
- **Safe Move.** Owner assertions + named error codes on every mutation,
  bounded string lengths, `Clock`-based timestamps, owned (non-shared) objects.
- **Defensive content.** Challenges teach *enumeration* and *remediation* of lab
  misconfigurations — educational, authorized-context material, not weaponized
  exploits.

---

## Project layout

```
move/recallforge/      Sui Move package (LearnerProfile, SkillCheckpoint, AgentPermission)
shared/schema.ts       zod schemas + types shared by frontend and backend
server/                stateless Express API (agents + Walrus)
  src/agents/          mentor, challenge, evaluator, llm wrapper, deterministic fallback
  src/walrus/          Walrus HTTP client + local fallback
  src/routes/          /api endpoints
  src/middleware/      validate, rate-limit, async handler
src/                   React frontend
  views/               Landing, Onboarding, Dashboard, Challenge, Timeline, Progress
  components/ui/        design-system components (dark theme)
  lib/                  api client, Sui read/tx helpers, formatting
  context/             app state (profile pointer, on-chain data)
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev:all` | Run frontend + backend together |
| `npm run dev` | Frontend only |
| `npm run dev:server` | Backend only |
| `npm run build` | Type-check + build the frontend |
| `npm --prefix server run typecheck` | Type-check the backend |
| `npm run codegen` | Regenerate Move TS bindings (optional) |
