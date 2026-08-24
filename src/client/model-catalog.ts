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

interface RpcResultShape<T> {
  result?: { ok?: boolean; value?: T; error?: { code?: string; message?: string } }
}

function unwrap<T>(response: RpcResultShape<T>, label: string): T {
  const result = response?.result
  if (!result) throw new Error(`${label}: malformed response`)
  if (result.ok === false) {
    throw new Error(`${label}: ${result.error?.code ?? 'error'}: ${result.error?.message ?? 'unknown'}`)
  }
  return (result.value ?? (response as unknown as T)) as T
}

/** Fetch the host-scoped model catalog (no session needed). */
export async function fetchModelCatalog(connection: {
  api: { llm: { models(request: Record<string, never>): Promise<unknown> } }
}): Promise<ModelCatalog> {
  const raw = (await connection.api.llm.models({})) as RpcResultShape<{
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
  }>
  const value = unwrap(raw, 'llm.models')
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
