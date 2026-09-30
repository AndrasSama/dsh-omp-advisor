/**
 * Minimal React stub for node:test: the client modules under test only need
 * createElement (descriptor objects) and hook no-ops (probe paths never
 * render). Real rendering happens in the browser against the host page's
 * React — this stub only makes the modules importable in Node.
 */
export function createElement(type: unknown, props?: unknown, ...children: unknown[]): unknown {
  return { type, props, children }
}

export function useState<T>(initial: T | (() => T)): [T, (next: T) => void] {
  const value = typeof initial === 'function' ? (initial as () => T)() : initial
  return [value, () => {}]
}

export function useEffect(_effect: () => unknown, _deps?: unknown[]): void {
  // Probe tests drive lifecycles through the returned disposer, not effects.
}

export function useCallback<T>(fn: T, _deps?: unknown[]): T {
  return fn
}

export function useMemo<T>(fn: () => T, _deps?: unknown[]): T {
  return fn()
}

export function useRef<T>(initial: T): { current: T } {
  return { current: initial }
}

export function memo<T>(component: T): T {
  return component
}

/** Fragment: a stable identity is all createElement needs to describe it. */
export const Fragment = Symbol.for('react.fragment')

/** No-op like useEffect — the probe paths never paint. */
export function useLayoutEffect(_effect: () => unknown, _deps?: unknown[]): void {}

/**
 * Return the current snapshot. The seat memoises its snapshot object precisely
 * so this stays referentially stable across reads; a fresh object per call
 * would make React's Object.is comparison loop.
 */
export function useSyncExternalStore<T>(_subscribe: (notify: () => void) => () => void, getSnapshot: () => T): T {
  return getSnapshot()
}

export default {
  createElement,
  useState,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
  useCallback,
  useMemo,
  useRef,
  memo,
  Fragment
}
