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

export default { createElement, useState, useEffect, useCallback, useMemo, useRef, memo }
