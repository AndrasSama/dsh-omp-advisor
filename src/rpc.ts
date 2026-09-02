/**
 * The `/dsh-omp-advisor` RPC channel: live advisor status and settings writes
 * for the settings section. Endpoints:
 *   snapshot  {sessionId?}            -> one session's advisor state (or all)
 *   update    {patch}                 -> merge advisor settings; returns them
 *   setAdvisorWorkspace {advisor, cwd, active}
 *                                     -> atomic workspace-scoped enable/disable
 *   addWorkspaceAdvisor {entry}       -> atomic append of one advisor
 *   pause     {sessionId, advisor}    -> pause one advisor
 *   resume    {sessionId, advisor}    -> resume one advisor
 *   reviewNow {sessionId}             -> queue an immediate review pass
 *   memoryRescan {}                   -> re-probe memory engines, return view
 *   memoryApprove {writeId}           -> approve one pending memory write
 *   memoryDiscard {writeId}           -> discard one pending memory write
 *
 * Contract notes (dsh-client-connection, verified against 0.1.2-alpha.4):
 *  - `rpc.handle(channel, handler)` is two-argument; the rc.8 third options
 *    argument (`authority: 'trusted-host'`) was removed — trust and
 *    authentication are applied by the physical carrier before dispatch, so
 *    remote GUIs can still reach this channel.
 *  - Handlers return an RpcResult (`{ok:true,value}` / `{ok:false,error}`)
 *    and never throw: a thrown error becomes an opaque HTTP 500.
 *
 * Settings writes ride THIS channel instead of `ctx.settingsScope`: the
 * scope's persistence is loopback-only by DSH policy (remote browsers get a
 * process-local scope whose snapshot is permanently `unavailable`), while
 * this channel's trusted-host fence works from remote GUIs.
 */
import type { AdvisorService } from './service'
import type { CordisContextLike } from './types'

export const RPC_CHANNEL = '/dsh-omp-advisor'

type RpcResultShape =
  | { ok: true; value: unknown }
  | { ok: false; error: { code: string; message: string; details: Record<string, unknown> } }

function badRequest(message: string): RpcResultShape {
  return { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } }
}

function internal(message: string): RpcResultShape {
  return { ok: false, error: { code: 'internal', message, details: {} } }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`)
  return value
}

export function registerAdvisorRpc(ctx: CordisContextLike, service: AdvisorService): () => void {
  const connection = ctx.connection
  if (!connection) return () => {}
  return connection.rpc.handle(
    RPC_CHANNEL,
    async (endpoint, rawPayload, signal): Promise<RpcResultShape> => {
      try {
        if (signal?.aborted) {
          return { ok: false, error: { code: 'cancelled', message: 'request cancelled', details: {} } }
        }
        const payload = rawPayload === undefined || rawPayload === null ? {} : record(rawPayload, 'payload')
        switch (endpoint) {
          case 'snapshot': {
            if (typeof payload.sessionId === 'string' && payload.sessionId) {
              return { ok: true, value: service.snapshot(payload.sessionId) }
            }
            return {
              ok: true,
              value: {
                sessions: service.activeSessions().map(sessionId => service.snapshot(sessionId)),
                // Editor view (non-destructive): the poll must not delete a
                // card whose name/description the user has cleared mid-edit.
                settings: service.settingsView,
                // Additive monitor fields (v0.6.0): workspace matrix rows and
                // the activity ring. Older clients ignore them.
                knownWorkspaces: service.knownWorkspaces(),
                recentEvents: service.recentEvents(),
                // Additive v0.7.0: memory engine statuses + pending writes.
                memory: service.memoryView()
              }
            }
          }
          case 'update': {
            let patch: unknown
            try {
              patch = record(payload.patch, 'payload.patch')
            } catch (error) {
              return badRequest(String(error instanceof Error ? error.message : error))
            }
            try {
              return { ok: true, value: { settings: service.updateSettings(patch) } }
            } catch (error) {
              // Schema/validation rejections are user input errors.
              return badRequest(String(error instanceof Error ? error.message : error))
            }
          }
          case 'setAdvisorWorkspace': {
            // Atomic workspace-scoped enable/disable (v0.7.6): load-modify-save
            // host-side so the sidebar never read-modify-writes a stale array.
            let advisor: string
            let cwd: string
            try {
              advisor = string(payload.advisor, 'payload.advisor')
              cwd = string(payload.cwd, 'payload.cwd')
            } catch (error) {
              return badRequest(String(error instanceof Error ? error.message : error))
            }
            const active = payload.active === true
            try {
              return { ok: true, value: { settings: service.setAdvisorWorkspace(advisor, cwd, active) } }
            } catch (error) {
              return badRequest(String(error instanceof Error ? error.message : error))
            }
          }
          case 'addWorkspaceAdvisor': {
            // Atomic append of one caller-built advisor (v0.7.6).
            try {
              return { ok: true, value: { settings: service.addWorkspaceAdvisor(payload.entry) } }
            } catch (error) {
              return badRequest(String(error instanceof Error ? error.message : error))
            }
          }
          case 'pause':
          case 'resume': {
            const sessionId = string(payload.sessionId, 'payload.sessionId')
            const advisor = string(payload.advisor, 'payload.advisor')
            return { ok: true, value: { ok: service.setPaused(sessionId, advisor, endpoint === 'pause') } }
          }
          case 'reviewNow': {
            const sessionId = string(payload.sessionId, 'payload.sessionId')
            return { ok: true, value: { ok: service.reviewNow(sessionId) } }
          }
          case 'memoryRescan': {
            return { ok: true, value: { memory: await service.memoryRescan() } }
          }
          case 'memoryApprove':
          case 'memoryDiscard': {
            const writeId = string(payload.writeId, 'payload.writeId')
            const result =
              endpoint === 'memoryApprove' ? await service.memoryApprove(writeId) : await service.memoryDiscard(writeId)
            return { ok: true, value: result }
          }
          default:
            return badRequest(`unknown endpoint: ${endpoint}`)
        }
      } catch (error) {
        return internal(String(error instanceof Error ? error.message : error))
      }
    }
  )
}
