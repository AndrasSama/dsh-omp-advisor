/**
 * The `/dsh-omp-advisor` RPC channel: live advisor status and settings writes
 * for the settings section. Endpoints:
 *   snapshot  {sessionId?}            -> one session's advisor state (or all)
 *   update    {patch}                 -> merge advisor settings; returns them
 *   pause     {sessionId, advisor}    -> pause one advisor
 *   resume    {sessionId, advisor}    -> resume one advisor
 *   reviewNow {sessionId}             -> queue an immediate review pass
 *
 * Contract notes (dsh-client-connection, rc.8):
 *  - `rpc.handle` REQUIRES the options argument; `authority` is read
 *    unguarded, so omitting it crashes the plugin tree at boot.
 *  - `authority: 'trusted-host'` accepts loopback plus the deployment's
 *    `--trusted-host` authorities (same fence as `/api`), so the settings
 *    section works from remote GUIs too. `'loopback'` would 403 them.
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
                settings: service.settingsView
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
          default:
            return badRequest(`unknown endpoint: ${endpoint}`)
        }
      } catch (error) {
        return internal(String(error instanceof Error ? error.message : error))
      }
    },
    { authority: 'trusted-host' }
  )
}
