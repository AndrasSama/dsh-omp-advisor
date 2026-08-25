# dsh-omp-advisor

**oh-my-pi's advisor subsystem, ported to [DeepSeek Harness](https://github.com/deepseek-ai/dsh) (DSH).**

Attach one or more independent *advisor* models to your live DSH sessions. Each advisor watches the primary agent's transcript as it grows, may investigate the workspace with read-only tools (`read` / `grep` / `glob`), and delivers concrete advice through a dedicated `advise` tool — exactly the advisor-watchdog design from [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi), re-built natively on DSH's plugin seams.

```
primary agent ──► session log ──► delta renderer ──► advisor model (your pick from the DSH model list)
      ▲                                                     │ read/grep/glob (read-only)
      │                                                     ▼
      └──── agent.inject / agent.steer ◄── advise tool ── dedupe + quarantine
```

## How it works

- **Incremental reviews.** Advisors never see the whole history twice: a cursor over the durable session log renders each new slice (`user/message`, `assistant/message`, `tool/call`, `tool/result`) into a compact markdown *update* the advisor model reviews.
- **Advice, not orders.** Notes arrive as
  `<advisory advisor="…" severity="…" guidance="weigh, don't blindly obey">…</advisory>`
  messages. The primary agent decides what to do with them.
- **Severities.** `nit` (default) · `concern` · `blocker`. Escalation-rank dedupe: the same note only re-delivers at a strictly higher severity.
- **Delivery channels (DSH-native).**
  | Severity | Primary running | Primary idle |
  |---|---|---|
  | non-interrupting (default: `nit`) | `agent.inject` — rides the next step boundary, never wakes | `agent.inject` |
  | interrupting (default: `concern`, `blocker`) | `agent.steer` — nearest step boundary | `concern` downgrades to `inject`; `blocker` still steers (may wake a turn) |
- **Mid-turn deferral.** With `reviewTrigger: step`, non-blocker notes raised while the turn is still running are withheld and flushed deterministically when the turn completes, so partial work is not interrupted and no advice is lost.
- **Coalescing (optional).** With several advisors attached, notes can land in rapid succession. Set **Coalesce advice** to a window in ms (e.g. `1500`) and the runtime buffers notes from *all* advisors for that window, then emits them as **one multi-`<advisory>` message per delivery channel** instead of one message per note. Semantics:
  - `0` (default) — every note is delivered individually, exactly as above.
  - Window active — the timer starts on the first buffered note; when it fires, the batch is grouped by channel at emit time (steer vs inject is re-resolved against the primary's *current* state) and sent as one message per non-empty channel.
  - Interrupting severity — a `concern`/`blocker` (per your interrupting set) **flushes the whole batch immediately**, so urgent advice never waits out the window.
  - Session dispose cancels the timer and drops buffered notes: a disposed session never receives advice.
- **Auto-retry (optional, on by default).** Failures recover automatically instead of dying silently:
  - A failed advisor review (rate limit, transient provider error) re-runs the *same* delta after the configured delay, up to the configured attempt cap.
  - A failed **primary-model turn** (`turn/end` with `reason.kind: "error"`) receives an automatic *"continue from where you left off"* followup message after the same delay, bounded per failure episode and reset by any completed turn.
  - User aborts and permanent errors (unknown model/provider) never retry. Toggle the whole feature off with **Auto-retry failures**.
- **Tiny-delta skip (optional).** With **Skip tiny deltas** set, transcript updates smaller than the threshold are skipped without calling the advisor model — a cheap way to cut advisor traffic on chatty sessions (skipped deltas are not replayed later).
- **Containment (ported).** Output quarantine (unavailable-tool requests, output-only destructive directives), 3-consecutive-failure backlog drop, permanent-error halt until settings change, quota/rate-limit cooldown pause. The advisor **never blocks the primary agent** — a deliberate, safer deviation from oh-my-pi's catch-up wait.

## Install

```bash
dsh plugin --profile web add github:AndrasSama/dsh-omp-advisor
# or from a local checkout:
dsh plugin --profile web add "file:/path/to/dsh-omp-advisor"
```

Then restart DSH Web and hard-refresh the browser (Ctrl+Shift+R).

## Configure

Open **Settings → OMP Advisor**:

- **Attach advisors to sessions** — master switch (off by default).
- **Review trigger** — `turn` (review completed turns) or `step` (review while the turn runs). Step mode fires on every tool step — the UI warns it is heavy on rate-limited or metered providers.
- **Interrupting severities** — which severities steer; the rest ride as non-interrupting context.
- **Coalesce advice (ms)** — `0` = deliver each note immediately; `>0` = batch notes from all advisors within the window into one message per channel (see [How it works](#how-it-works)). Clamped to 0–10000.
- **Auto-retry failures** — toggle + delay (ms, 1000–300000, default 5000) + attempt cap (1–10, default 3). Retries failed advisor reviews and sends an automatic "continue" to a failed primary turn (see [How it works](#how-it-works)).
- **Skip tiny deltas (chars)** — `0` = review everything; `>0` = skip transcript updates smaller than this.
- **Add from preset** — one click creates a ready-made advisor from one of the 25 built-in personas (see [Presets](#presets)).
- **Advisors** — the roster. Per advisor:
  - name,
  - **model picked from the DSH model list** (provider route → model → optional reasoning effort),
  - **max turns** — the advisor's tool-loop budget per review (1–10, default 4),
  - optional specialization instructions (e.g. *"Focus on security: injection, secrets, unsafe deserialization."*),
  - **workspaces** — comma-separated substrings matched against the session's workspace path; the advisor only runs in matching sessions (empty = every session). This is how you give the writing bench to your novel workspace and the engineering bench to your code workspace.
  - **skills** — the advisor's curated skill chips: remove one (`×`), add any packaged skill from the catalog dropdown, or **reset to preset defaults** if the advisor was created from a preset (see [Skills](#skills)),
  - **skill delivery** — `inject` (default: full skill bodies in the system prompt) or `lazy` (id+description index plus a `load_skill` tool — saves tokens, costs one extra call per loaded skill),
  - per-advisor enable toggle.

Settings live in the `dsh-omp-advisor` namespace and apply **live** — no restart needed when you edit the roster.

Advisor model calls go through `ctx.llm.stream` with the provider route + model id you picked, so billing, routing, and failover behave exactly like your other DSH model traffic.

## Presets

The **Add from preset** dropdown ships 25 ready-made advisor personas. Applying a preset creates a new advisor (name collisions get a numeric suffix) whose specialization instructions are the persona's expanded *soul description* and whose skill list is the persona's 10 curated skills. You can then edit everything — model, instructions, skills — like any advisor.

| # | Role | Preset |
|---|---|---|
| 1 | High-Concurrency Backend | The Rustacean Weaver |
| 2 | AI Inference Integrator | The Weights Whisperer |
| 3 | Appchain Developer | The Genesis Architect |
| 4 | Infrastructure Admin | The Edge Guardian |
| 5 | Python Service Architect | The Django Synthesizer |
| 6 | Node.js Systems Dev | The Event Loop Maestro |
| 7 | Harness Plugin Creator | The Meta Coder |
| 8 | Code Review Gatekeeper | The Linting Oracle |
| 9 | Technical Writer | The Clarifier |
| 10 | Security Auditor | The Red Teamer |
| 11 | Digital Marketing Strategist | The Conversion Alchemist |
| 12 | Direct Response Copywriter | The Hook Master |
| 13 | Web Novel Architect | The Worldbuilder |
| 14 | Author Community Manager | The Patron Whisperer |
| 15 | Investigative Journalist | The Fact Finder |
| 16 | Editorial Desk Editor | The Style Enforcer |
| 17 | Financial Analyst | The Ledger Reader |
| 18 | Legal Contract Reviewer | The Clause Hunter |
| 19 | GDPR & Privacy Officer | The Data Steward |
| 20 | EU AI Act & Governance | The Model Auditor |
| 21 | IP & Copyright Sentinel | The License Guardian |
| 22 | Cybersecurity & NIS2 Readiness | The Resiliency Engineer |
| 23 | E-Commerce & Consumer Protection | The Consumer Shield |
| 24 | Privacy-by-Design Engineer | The Minimizer |
| 25 | Agent Tool-Safety Guardian | The Tool Warden |

Domain presets (finance, legal, privacy, marketing…) frame their advice as **review flags and analysis, not professional counsel** — the soul descriptions tell them to surface risks and defer final judgment to qualified humans.

## Skills

The plugin packages **250 advisor skills** under [`skills/<id>/SKILL.md`](./skills) — 10 curated per preset. Each skill is a compact briefing (what to watch for, best practices, a quick checklist) that sharpens the advisor in a specific domain, e.g. `n-plus-one-query-audit`, `prompt-injection-via-tool-results`, `gdpr-data-mapping`, `cliffhanger-mechanics`.

- **Injection (default).** An advisor's configured skill bodies are embedded into its system prompt as `<skills><skill name="id">…</skill></skills>` on every review call. Unknown ids are skipped, never fatal. One model call covers everything — best on rate-limited providers.
- **Lazy loading (opt-in per advisor).** With skill delivery set to `lazy`, the system prompt carries only an id+description index and the advisor gets a `load_skill` tool to fetch a body on demand. Saves ~15KB of prompt per advisor; each loaded skill costs one extra tool-loop call, so prefer it on token-metered providers with headroom.
- **Per-advisor editor.** Every advisor card lists its skills as chips: `×` removes one, the **+ add packaged skill…** dropdown adds any of the 250 (with its description as tooltip), and advisors created from a preset get a **reset to preset defaults** button restoring the curated list.
- **Build-time embedding.** `scripts/gen-skills.mjs` scans `skills/` and generates the host embed (full bodies) and the client catalog (ids + descriptions) before every build and test run; the `skills/` tree is the source of truth and ships in the package.

## Safety model

- Advisors get **read-only** tools confined to the watched session's workspace (`read`, `grep`, `glob`, plus `load_skill` in lazy mode). No mutating tools yet — oh-my-pi's WATCHDOG.yml grant system is planned for v0.4 behind DSH's approval flow.
- Advisor output passes a quarantine before it can become context: requests for unavailable tools and output-only destructive directives (ported hazard patterns) are replaced with a sanitized error.
- Advisories injected into the session are excluded from future advisor deltas (no feedback loops).
- The plugin never cancels, blocks, or gates the primary agent. Auto-retry only ever *adds* a followup message after a failed turn — it never suppresses, rewrites, or re-drives anything else, and it stops after the configured attempt cap.
- The `/dsh-omp-advisor` RPC registers with `authority: 'trusted-host'`: requests pass the same Host/Origin trust fence as `/api` (loopback, or a deployment's `--trusted-host` authorities), so the settings section and live status panel also work from remote GUIs. Handlers return `RpcResult` values and never throw.
- Settings reads and writes ride that same channel (`snapshot` / `update` endpoints) instead of `ctx.settingsScope`: DSH keeps settingsScope persistence loopback-only, so a scope-bound section would render "unavailable" in every remote browser. Host-side, `update` still goes through the settings domain's schema + validation + live watch.

## Development

```bash
npm install        # dev deps only; DSH packages are runtime-provided
npm run build      # gen-skills + host ESM (lib/index.js) + client CJS ModuleLoader bundle (lib/client.js)
npm test           # 66 unit tests over the ported semantics
npm run typecheck  # tsc --noEmit (DSH packages shimmed)
```

Layout: `src/` host plugin (settings, service, runtime, advisor loop, tools, delivery, quarantine, delta), `src/client/` settings section + presets, `src/prompts/` ported advisor prompts, `skills/` the 250 packaged advisor skills (source of truth for the build-time embeds), `scripts/gen-skills.mjs` the skill embed generator, `test/` node:test suite.

## Attribution & license

Advisor semantics and prompt texts ported from [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi) (`packages/coding-agent/src/advisor/`), © Mario Zechner / Can Bölük / Stencil Labs, under the MIT license reproduced in [`NOTICE-oh-my-pi-LICENSE`](./NOTICE-oh-my-pi-LICENSE). This plugin is an independent port for DeepSeek Harness and is not affiliated with the oh-my-pi project.

This plugin: MIT — see [`LICENSE`](./LICENSE).

## Known limitations

- Advisories render as ordinary plugin messages in the conversation (a dedicated advisory card is future work).
- No mutating-tool grants for advisors yet (oh-my-pi's WATCHDOG.yml roster) — targeted for v0.4 behind the DSH approval flow.
- No in-session "advisors watching" badge yet; health is visible in the settings Live status panel (errors now show inline there).
- Status panel polls every 5 s while the settings section is open; no push yet.
- Web profile UI; other profiles can still configure the namespace by hand.
