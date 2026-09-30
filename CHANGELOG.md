# Changelog

Notable changes to **Ward Council** (`dsh-omp-advisor`). This file starts at
v0.9.0; earlier releases are described in the git log and the README.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.3] — 2026-09-30

Closes the **feedback loop** on the advisor's most consequential signal.

### Fixed

- **A `blocker` now tells the advisor it gated.** Since tool-call interception
  landed, a gating-severity finding does not merely advise — it arms a real veto
  over the watched agent's next `write`/`edit`/`bash` call. But the advisor was
  handed a bare `Recorded.` for a note that had just blocked a tool call, so the
  one signal with teeth was the one it could never calibrate: it could not tell a
  note that stopped work from a note that was merely filed, could not see that the
  gate stands down after a bounded number of denials, and could not learn which of
  its judgements had been right to escalate.

  The `advise` reply now reports the consequence — whether the note gated, and how
  many refusals it may cost before the gate stands down on its own. Non-gating
  severities keep the plain `Recorded.`, and a duplicate-suppressed note reports no
  outcome, since nothing was delivered.

- **The prompt states the cost, not just the permission.** `system.md` defined
  `blocker` as "Stop/reconsider" advice and `advise-tool.md` said nothing about the
  gate, which left a model-perceived licence to escalate for emphasis. Both now say
  a `blocker` refuses the agent's next mutating call, that the reply reports whether
  it did, and that a wrong `concern` wastes a paragraph while a wrong `blocker`
  stops the agent — escalate only to stop work.

### Notes

- Threads an `AdviceOutcome` from the runtime's delivery through the gate and the
  advise tool, so the model's reply describes the real effect rather than a
  constant. Verified by mutation: reverting the reply to a constant fails the
  gating test, and dropping the outcome from the result fails two more.
  166 tests total.

## [0.9.2] — 2026-09-30

Fixes the **input side** of the advisor loop: what the reviewer is actually shown.
All three defects were found by auditing the renderer against the prompts that describe
it, and they share one shape — the prompt promised the advisor something the transcript
renderer never delivered, so the advisor reasoned about a world it could not see.

### Fixed

- **Reasoning blocks were dropped, while the prompt promised them.** `system.md` tells
  the advisor to challenge "skipped reasoning" and states it receives the transcript
  "including thoughts", but `blocksToText` extracted only `type: 'text'` blocks. DSH
  *does* persist `{ type: 'reasoning' }` blocks in `assistant/message` events — verified
  against real session logs, where they are a substantial share of assistant content — so
  every advisor was systematically mistaking *unrendered* reasoning for *absent* reasoning
  and could raise exactly the "skipped reasoning" challenge the prompt forbids, against an
  agent that had reasoned.
  Reasoning now renders as its own `### Assistant reasoning` section, ahead of the final
  text it explains, **tail-biased**: the head of an over-long chain is elided and the
  conclusion is always kept, because the conclusion carries the judgement. `system.md` now
  states this, and that reasoning absent from an update was genuinely not recorded.

- **Mutating tool arguments were truncated at 400 characters.** One uniform
  `ARGS_PREVIEW_LIMIT` applied the same narrow window to a `read` and to a `write`, so the
  advisor was shown the *shape* of a mutation and none of its content — while the same
  prompt forbade asserting anything about unrendered arguments. On the highest-risk events
  the advisor had to either stay silent or burn most of its per-update budget re-reading
  what the delta had already been given. Calls whose arguments *are* the change (`write`,
  `edit`, `patch`, `bash`, and any call carrying a content-bearing key such as
  `content`/`command`/`new_string`) now get a 2000-char window; reads keep the narrow bound.
  `system.md` now tells the advisor that every cut is explicitly marked, and that text with
  no marker beyond it is citable evidence.

- **`minDeltaChars` destroyed content instead of deferring it.** A delta below the threshold
  was logged, dropped, and — because the cursor had already advanced — unrecoverable. A user
  message is frequently *smaller* than the threshold, so a mid-session correction could be
  silently swallowed while the turn it corrected was reviewed. Sub-threshold deltas are now
  **buffered and folded into the next review**; a delta carrying a user message is **never**
  deferred; and deferral is bounded (`DEFERRED_SKIP_LIMIT`, 3) so a long run of small deltas
  cannot suppress review coverage indefinitely.

### Notes

- Behaviour change: a sub-threshold delta containing a user message is now reviewed
  immediately. The previous test asserted the old behaviour and was rewritten to encode the
  new contract.
- Every fix is covered by tests verified to *fail* when the fix is reverted (163 tests
  total): removing reasoning rendering fails exactly the two reasoning tests, removing the
  widening fails exactly the two mutating-argument tests, and each of the three deferral
  properties has its own failing mutation — permitting deferral of a user message, dropping
  the buffer, and removing the deferral bound.

## [0.9.1] — 2026-09-30

### Added

- **Searchable composer model seat.** The custom type-to-filter model selector
  that used to ship as the separate `dsh-model-search` plugin is now part of this
  plugin: the composer's `conversation.input.model` seat becomes a search box over
  the same per-session model directory the stock selector and the `/model` popup
  read, so a choice made in either place stays in sync. Search matches name, id,
  provider or description; `↑`/`↓` move, `Enter` picks, `Esc` closes, the active
  row stays scrolled into view, the open panel's footer carries the current model's
  reasoning-effort chips, a failed catalog load stays visible with a Retry, and the
  seat renders disabled where a session may not use Agent-bound model RPCs — all
  exactly as before.
  - Vendored from `dsh-model-search` v0.1.0 as `src/client/model-select.ts`,
    registered from the client entry inside a `try`/`catch` so a seat failure can
    never take the settings section down with it.
  - Its locale namespace was renamed to `dsh-omp-advisor-model-select`, so a
    profile that still has the standalone plugin installed during migration cannot
    register the same namespace twice.
  - It needs only the host page's `react`/`react-dom`, so it adds **no**
    `dsh.client.inject` entry and cannot strand this plugin's client fiber.
  - With the standalone plugin removed from a profile, this is the only
    registration of the seat; the seat survives the merge because the plugin
    already had a loader row and a `dsh.client` declaration, so no
    `cordis.patch.yml` row was needed.

### Changed

- The client-bundle test's external allowlist now permits `react-dom` alongside
  `react`. Both are provided by the host page; the test's actual purpose — that
  every other capability arrives as an injected *service* rather than a required
  package — is unchanged.

## [0.9.0] — 2026-09-30

### Added

- **Tool-call gate.** Advisors can now stop a tool call *before its body runs*,
  instead of only advising against it. The plugin returns a real `PreToolDecision`
  from DSH's `tools/pre-execute` waterfall — `deny` refuses the call and returns
  the advisor's reason to the model, `ask` holds the call for the user's decision
  with a localized prompt.
  - Configured in **Settings → General → Tool gate**: enable, mode (`deny`/`ask`),
    the gating severities (default `blocker`), the gated tool set (default the
    mutating set `bash`/`write`/`edit`), `maxDenials`, and an optional note
    appended to the refusal the model sees.
  - **Bounded per finding** (`maxDenials`, default 2; `0` = never stand down), so
    a disagreeing advisor can never deadlock the agent. A new finding re-arms the
    gate and resets the bound.
  - Refusals, holds, and stand-downs are recorded in the Monitor activity feed
    (`gate-denied` / `gate-ask` / `gate-stood-down`); the armed finding rides the
    session snapshot as a `toolGate` field and shows in the sidebar as a chip with
    a **Clear gate** button.
  - New RPC endpoint `clearToolGate {sessionId?}`.
  - Off by default. With the gate disabled the `tools/pre-execute` listener stays a
    pure pass-through, so tool-call behaviour is unchanged from v0.8.0.
- `CHANGELOG.md`.

### Changed

- **DeepSeek Harness 0.2 support.** Settings now bind adaptively: the alpha line's
  `settings.register` is used when the host provides it, and 0.2's config +
  settings-service path (`SettingsForms.update`) when it does not. This replaces
  the unconditional `settings.register` call that failed on 0.2 with
  `hostCtx.settings.register is not a function`.
- Settings writes (`updateSettings`, `setAdvisorWorkspace`, `addWorkspaceAdvisor`)
  are asynchronous end-to-end, and the RPC handlers await them.
- A 0.2 config edit restarts the plugin (cordis `internal/update`). Session
  runtimes are rebuilt in place on the write path, and sessions are re-attached
  lazily on their next event, so advisors resume without a restart. The settings
  `watch` subscription is a documented no-op on 0.2, where no watcher fires.
- README: corrected the claim that DSH exposes no pre-tool-call veto (it exposes a
  `PreToolDecision` waterfall, present since at least `dsh-tools@0.1.0-rc.6` and
  verified on 0.2.0-rc.2), the RPC `authority: 'trusted-host'` description (trust
  is applied by the carrier before dispatch; `rpc.handle` is two-argument on both
  lines), and the prerequisites/limitations sections.

### Fixed

- The `assertAdvisorsRunnable` guard is now documented for what it is: a defensive
  restatement of the v0.1.x `validate` hook, not an effective gate —
  `normalizeSettings` already drops advisors missing a name, provider, or model.

## Unreleased

- Consuming `ctx.changeLedger` when `dsh-turn-rewind` is installed, and
  session-state (seed-replay) rewind.
- Pattern-based risk approval (e.g. "ask before any `rm -rf`") beyond the
  finding-armed gate.
- Advisor write grants (oh-my-pi's `WATCHDOG.yml` roster) behind DSH approvals.
