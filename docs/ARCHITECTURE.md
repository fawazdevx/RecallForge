# RecallForge — Architecture

## Principles

1. **Memory is the product.** Everything a learner does becomes persistent,
   verifiable memory: reports on Walrus, progress on Sui.
2. **Stateless backend.** The server runs agents and brokers Walrus I/O. It
   keeps no per-user database — there is nothing to lose, leak, or lock in.
3. **Non-custodial.** The user's wallet signs every on-chain write. The backend
   only ever holds the (optional) Anthropic key, server-side.
4. **Decentralized recall.** A returning user's history is reconstructed from
   their own on-chain `SkillCheckpoint` objects + the Walrus blobs they point to.

## Components

| Layer | Tech | Responsibility |
| --- | --- | --- |
| Frontend | React 19, Vite 8, Tailwind v4, dApp-Kit | UI, wallet signing, on-chain reads |
| Backend | Node, Express, zod | 3 agents (Claude + fallback), Walrus broker |
| Memory | Walrus HTTP publisher/aggregator | Onboarding/attempt/recall artifacts |
| Chain | Sui Move package | Identity + verifiable skill checkpoints |
| Contract types | `shared/schema.ts` (zod) | Single source of truth, both ends |

## The three agents

- **Mentor** — `POST /api/onboarding` (roadmap + first Walrus artifact) and
  `POST /api/mentor/recall` (greets a returning learner, surfaces the weakest
  area, recommends the next focus/level).
- **Challenge** — `POST /api/challenge/generate` (a structured, rubric-backed
  Linux privesc challenge for a given skill + level).
- **Evaluator** — `POST /api/evaluate` (scores the answer against the rubric,
  returns strengths/weaknesses/feedback + a one-line memory summary, and stores
  the full report on Walrus).

Each agent first tries Claude (when `ANTHROPIC_API_KEY` is set), validates the
JSON against the shared schema, and falls back to a deterministic engine on any
failure — so output is always well-formed and the demo never hard-fails.

## Data flow — first session

```
User → Onboarding form
  Frontend ─POST /api/onboarding─► Mentor → roadmap
                                  → MemoryArtifact ─► Walrus  (blobId)
  Frontend ◄── {roadmap, stored.blobId} ──
  Frontend ─create_profile(handle)─► Sui  (LearnerProfile, owned)   [if deployed]

User → Start challenge
  Frontend ─POST /api/challenge/generate─► Challenge → Challenge JSON
User → Submit answer
  Frontend ─POST /api/evaluate─► Evaluator → Evaluation
                               → MemoryArtifact ─► Walrus (blobId)
  Frontend ◄── {evaluation, stored.blobId} ──
  Frontend ─record_checkpoint(skill, points, status, walrus_ref=blobId)─► Sui
```

## Data flow — return session (the "wow")

```
Frontend ─getOwnedObjects(SkillCheckpoint)─► Sui  → [checkpoints]
Frontend ─GET /api/walrus/:blobId (per checkpoint)─► Walrus → [reports]
Frontend ─POST /api/mentor/recall {history}─► Mentor
        ◄── "Last time you struggled with SUID enumeration…" + next focus
Frontend ─POST /api/challenge/generate {focus}─► targeted follow-up
```

The Memory timeline and Progress map are rendered from the same on-chain +
Walrus data — no extra backend state involved.

## On-chain objects (`move/recallforge`)

```move
LearnerProfile  { id, owner, handle, total_points, completed_count, attempted_count, created_at_ms }
SkillCheckpoint { id, owner, skill, level, points, status, walrus_ref, challenge_id, created_at_ms, completed_at_ms }
AgentPermission { id, owner, agent_name, can_read_memory, can_write_memory, expires_at_ms, revoked }   // optional
```

- All objects are **owned** by the learner → only they can mutate them; explicit
  `owner == ctx.sender()` assertions add auditable defense-in-depth.
- `record_checkpoint` updates the profile aggregates and emits
  `CheckpointRecorded`; `complete_checkpoint` promotes attempted → completed.
- Only compact references are stored on-chain; the heavy memory stays on Walrus.

## Walrus layer

`server/src/walrus/walrus.ts` exposes a `WalrusMemory` interface with two
implementations behind a factory:

- `HttpWalrusMemory` — `PUT /v1/blobs?epochs=N` to the publisher, `GET
  /v1/blobs/:id` from the aggregator; auto-falls back to local cache if the
  publisher is unreachable.
- `LocalWalrusMemory` — writes `server/.walrus-cache/<sha256>.json`, returns
  `local:<hash>` ids (used when `WALRUS_LOCAL=1` or as the network fallback).

This indirection means MemWal or the `@mysten/walrus` SDK could replace the HTTP
transport without touching any caller.

## Semantic memory layer (MemWal)

Raw Walrus + Sui is the *verifiable record*; **MemWal** adds *recall by
relevance* on top. `server/src/memory/agentMemory.ts` exposes an `AgentMemory`
interface (`remember` / `recall`) with two implementations behind a factory:

- `MemWalAgentMemory` — wraps `@mysten-incubation/memwal`. On every
  onboarding/attempt the route also calls `remember(<nl summary>, ns)`; on return
  `/api/mentor/recall` calls `recall(query, ns)` to fetch the most semantically
  similar past memories and feeds them into the Mentor prompt (and the
  deterministic fallback). The relayer does embedding + SEAL-encryption + Walrus
  upload server-side (TEE); the SDK only signs with an Ed25519 delegate key.
- `DisabledAgentMemory` — no-op used when `MEMWAL_*` env is absent. Recall then
  degrades to chronological history. The app never depends on MemWal being up.

Memories are scoped per learner by namespace `"<prefix>:<wallet-address>"`
(`nsFor`). Hard ownership stays on Sui; MemWal isolation is namespace-soft (one
server account holds the delegate key) — acceptable for the hackathon.

## Failure modes & guarantees

| If… | Then… |
| --- | --- |
| No Anthropic key | Deterministic agent engine serves valid schema-conformant output |
| Claude returns bad JSON | Schema validation fails → deterministic fallback |
| No MemWal credentials | Recall falls back to chronological Sui + Walrus history |
| MemWal relayer down / slow | `remember` skipped, `recall` returns [] (15s timeout); request still succeeds |
| Walrus publisher down | Blob cached locally, flagged `local:` in the UI |
| Move package not deployed | Agents + Walrus still work; on-chain writes gated with a banner |
| Wallet rejects a tx | Surfaced inline; nothing partially persisted on-chain |
