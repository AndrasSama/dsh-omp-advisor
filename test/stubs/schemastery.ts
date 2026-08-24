/**
 * Chainable schemastery stub for the test bundle: settings.ts builds its
 * schema at module load, but the tests only exercise normalizeSettings.
 */
const chain: any = new Proxy(function stub() {}, {
  get(_target, prop) {
    if (prop === Symbol.toPrimitive) return () => 'stub'
    return chain
  },
  apply() {
    return chain
  }
})

export default chain
