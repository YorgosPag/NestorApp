import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Type-safe shallow merge: applies partial updates to a base object and
 * returns a value typed as T.  Equivalent to `{ ...base, ...updates }` but
 * avoids the TS spread caveat where optional source properties widen required
 * target properties to `T | undefined`, causing SetStateAction mismatches.
 *
 * Safe because `base` already satisfies all of T's required keys and
 * `updates` only overwrites a subset of them at runtime.
 */
export function applyUpdates<T extends object>(
  base: T,
  updates: Partial<T>
): T {
  return Object.assign({}, base, updates) as T;
}
