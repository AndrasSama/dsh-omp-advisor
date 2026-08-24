/**
 * Host model catalog access for the advisor settings section: the same
 * session-independent catalog the settings surface uses (`llm.models`), so
 * advisor models are always picked from the DSH model list.
 */

export interface CatalogReasoningEffort {
  id: string
  name: string
  description?: string
}

export interface CatalogModel {
  id: string
  name: string
  description?: string
  efforts: CatalogReasoningEffort[]
  defaultEffort?: string
}

export interface CatalogGroup {
  /** Provider route id used for requests. */
  id: string
  name: string
  models: CatalogModel[]
}

export interface ModelCatalog {
  groups: CatalogGroup[]
  failures: { id: string; name: string; message: string }[]
}

interface RpcErrorShape {
  code?: string
  message?: string
}

/**
 * Unwrap one RPC result. The browser `connection.rpc.call` resolves to the
 * RpcResult itself (`{ok, value}` / `{ok:false, error}`); some carriers wrap
 * it as `{ result: {...} }`, so both shapes are accepted.
 */
export function unwrapRpcResult<T>(response: unknown, label: string): T {
  if (!response || typeof response !== 'object') {
    throw new Error(`${label}: malformed response`)
  }
  const outer = response as { result?: unknown; ok?: unknown; value?: unknown; error?: RpcErrorShape }
  const result = (
    outer.result && typeof outer.result === 'object' ? outer.result : outer
  ) as { ok?: unknown; value?: unknown; error?: RpcErrorShape }
  if (result.ok === false) {
    throw new Error(`${label}: ${result.error?.code ?? 'error'}: ${result.error?.message ?? 'unknown'}`)
  }
  if ('value' in result) return result.value as T
  return result as unknown as T
}

/** Fetch the host-scoped model catalog (no session needed). */
export async function fetchModelCatalog(connection: {
  api: { llm: { models(request: Record<string, never>): Promise<unknown> } }
}): Promise<ModelCatalog> {
  const raw = await connection.api.llm.models({})
  const value = unwrapRpcResult<{
    groups: {
      id: string
      name: string
      models: {
        id: string
        name: string
        description?: string
        reasoning?: { efforts?: CatalogReasoningEffort[]; defaultEffort?: string }
      }[]
    }[]
    failures: { id: string; name: string; message: string }[]
  }>(raw, 'llm.models')
  return {
    groups: (value.groups ?? []).map(group => ({
      id: group.id,
      name: group.name,
      models: (group.models ?? []).map(model => ({
        id: model.id,
        name: model.name,
        ...(model.description ? { description: model.description } : {}),
        efforts: model.reasoning?.efforts ?? [],
        ...(model.reasoning?.defaultEffort ? { defaultEffort: model.reasoning.defaultEffort } : {})
      }))
    })),
    failures: value.failures ?? []
  }
}
