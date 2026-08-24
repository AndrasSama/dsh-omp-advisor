/**
 * The `/dsh-omp-advisor` RPC channel: live advisor status for the settings
 * section. Endpoints:
 *   snapshot  {sessionId?}            -> one session's advisor state (or all)
 *   pause     {sessionId, advisor}    -> pause one advisor
 *   resume    {sessionId, advisor}    -> resume one advisor
 *   reviewNow {sessionId}             -> queue an immediate review pass
 */
import type { AdvisorService } from './service'
import type { CordisContextLike } from './types'

export const RPC_CHANNEL = '/dsh-omp-advisor'

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
  return connection.rpc.handle(RPC_CHANNEL, async (endpoint, rawPayload) => {
    const payload = rawPayload === undefined || rawPayload === null ? {} : record(rawPayload, 'payload')
    switch (endpoint) {
      case 'snapshot': {
        if (typeof payload.sessionId === 'string' && payload.sessionId) {
          return service.snapshot(payload.sessionId)
        }
        return {
          sessions: service.activeSessions().map(sessionId => service.snapshot(sessionId)),
          settings: service.settings
        }
      }
      case 'pause':
      case 'resume': {
        const sessionId = string(payload.sessionId, 'payload.sessionId')
        const advisor = string(payload.advisor, 'payload.advisor')
        return { ok: service.setPaused(sessionId, advisor, endpoint === 'pause') }
      }
      case 'reviewNow': {
        const sessionId = string(payload.sessionId, 'payload.sessionId')
        return { ok: service.reviewNow(sessionId) }
      }
      default:
        throw new Error(`unknown endpoint: ${endpoint}`)
    }
  })
}
