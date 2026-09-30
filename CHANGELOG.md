# Changelog

Notable changes to **Ward Council** (`dsh-omp-advisor`). This file starts at
v0.9.0; earlier releases are described in the git log and the README.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
