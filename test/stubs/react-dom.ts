/**
 * Minimal react-dom stub for node:test.
 *
 * The client modules under test import react-dom for `createPortal` (the
 * searchable model selector renders its panel into document.body to escape the
 * settings card's overflow clipping). Node has no DOM, and the probe tests
 * never mount components, so the stub only has to resolve the import and hand
 * the node straight back — real portalling happens in the browser against the
 * host page's React.
 */
export function createPortal(children: unknown, _container?: unknown, _key?: string): unknown {
  return children
}

export default { createPortal }
