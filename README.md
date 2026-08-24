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
- **Review trigger** — `turn` (review completed turns) or `step` (review while the turn runs).
- **Interrupting severities** — which severities steer; the rest ride as non-interrupting context.
- **Advisors** — the roster. Per advisor:
  - name,
  - **model picked from the DSH model list** (provider route → model → optional reasoning effort),
  - **max turns** — the advisor's tool-loop budget per review (1–10, default 4),
  - optional specialization instructions (e.g. *"Focus on security: injection, secrets, unsafe deserialization."*),
  - per-advisor enable toggle.

Settings live in the `dsh-omp-advisor` namespace and apply **live** — no restart needed when you edit the roster.

Advisor model calls go through `ctx.llm.stream` with the provider route + model id you picked, so billing, routing, and failover behave exactly like your other DSH model traffic.

## Safety model

- Advisors get **read-only** tools confined to the watched session's workspace (`read`, `grep`, `glob`). No mutating tools in v1 — oh-my-pi's WATCHDOG.yml grant system is future work.
- Advisor output passes a quarantine before it can become context: requests for unavailable tools and output-only destructive directives (ported hazard patterns) are replaced with a sanitized error.
- Advisories injected into the session are excluded from future advisor deltas (no feedback loops).
- The plugin never cancels, blocks, or gates the primary agent.
- The `/dsh-omp-advisor` RPC registers with `authority: 'trusted-host'`: requests pass the same Host/Origin trust fence as `/api` (loopback, or a deployment's `--trusted-host` authorities), so the settings section and live status panel also work from remote GUIs. Handlers return `RpcResult` values and never throw.
- Settings reads and writes ride that same channel (`snapshot` / `update` endpoints) instead of `ctx.settingsScope`: DSH keeps settingsScope persistence loopback-only, so a scope-bound section would render "unavailable" in every remote browser. Host-side, `update` still goes through the settings domain's schema + validation + live watch.

## Development

```bash
npm install        # dev deps only; DSH packages are runtime-provided
npm run build      # host ESM (lib/index.js) + client CJS ModuleLoader bundle (lib/client.js)
npm test           # 28 unit tests over the ported semantics
npm run typecheck  # tsc --noEmit (DSH packages shimmed)
```

Layout: `src/` host plugin (settings, service, runtime, advisor loop, tools, delivery, quarantine, delta), `src/client/` settings section, `src/prompts/` ported advisor prompts, `test/` node:test suite.

## Attribution & license

Advisor semantics and prompt texts ported from [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi) (`packages/coding-agent/src/advisor/`), © Mario Zechner / Can Bölük / Stencil Labs, under the MIT license reproduced in [`NOTICE-oh-my-pi-LICENSE`](./NOTICE-oh-my-pi-LICENSE). This plugin is an independent port for DeepSeek Harness and is not affiliated with the oh-my-pi project.

This plugin: MIT — see [`LICENSE`](./LICENSE).

## Known limitations (v1)

- Advisories render as ordinary plugin messages in the conversation (a dedicated advisory card is future work).
- No mutating-tool grants for advisors (oh-my-pi's WATCHDOG.yml roster).
- Status panel polls every 5 s while the settings section is open; no push yet.
- Web profile UI; other profiles can still configure the namespace by hand.
