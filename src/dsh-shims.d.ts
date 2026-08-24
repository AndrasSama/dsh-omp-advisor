/**
 * Ambient shims for DSH runtime packages, used only for standalone
 * typechecking (`npm run typecheck`). At runtime the DSH host resolves the
 * real packages; the plugin code consumes them through the narrow structural
 * types declared in src/types.ts.
 */

declare module '@deepseek-ai/cordis' {
  export class Service {
    constructor(ctx: unknown, name: string)
    readonly ctx: unknown
  }
}

declare module '@deepseek-ai/dsh-llm' {
  export function createUserMessage(input: {
    content: unknown[]
    source: { kind: 'plugin'; plugin: string }
  }): unknown
}

declare module '@deepseek-ai/schemastery' {
  const z: any
  export default z
}

declare module '*.md' {
  const text: string
  export default text
}
