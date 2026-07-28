/**
 * Centralized URL extraction helpers for API route handlers.
 *
 * Eliminates duplicated `extractIdFromUrl` / `extractUidFromPath` functions
 * that were scattered across 7+ route files.
 *
 * @module lib/api/route-helpers
 * @see ADR-245 API Routes Centralization
 */

import type { NextRequest } from 'next/server';

// =============================================================================
// extractIdFromUrl — Last segment of the URL path
// =============================================================================

/**
 * Extract the last path segment as the document ID.
 *
 * Works for routes like:
 * - `/api/properties/prop_abc123` → `"prop_abc123"`
 * - `/api/parking/park_xyz`      → `"park_xyz"`
 * - `/api/storages/stor_xyz`     → `"stor_xyz"`
 */
export function extractIdFromUrl(url: string): string | null {
  const segments = new URL(url).pathname.split('/');
  return segments[segments.length - 1] || null;
}

// =============================================================================
// extractSegmentFromEnd — Nth segment counting back from the end
// =============================================================================

/**
 * Extract a path segment by its distance from the END of the path.
 *
 * `fromEnd = 0` is the last segment (equivalent to {@link extractIdFromUrl}),
 * `1` the one before it, and so on.
 *
 * Example: `/api/deletion-guard/property/prop_abc123`
 *   → `extractSegmentFromEnd(url, 0)` → `"prop_abc123"`
 *   → `extractSegmentFromEnd(url, 1)` → `"property"`
 *
 * ⚠️ Counts from the end **on purpose**, not from a named anchor: `[entityType]`
 * routes have no fixed literal to anchor on — the segment IS the variable. Empty
 * segments are dropped first, so a trailing slash does not shift the count.
 */
export function extractSegmentFromEnd(url: string, fromEnd: number): string | null {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  return segments[segments.length - 1 - fromEnd] || null;
}

// =============================================================================
// extractNestedIdFromUrl — ID before a trailing sub-resource segment
// =============================================================================

/**
 * Extract a document ID that appears before a sub-resource segment.
 *
 * Example: `/api/properties/prop_abc123/activity`
 *   → `extractNestedIdFromUrl(url, 'properties')` → `"prop_abc123"`
 *
 * @param url       Full request URL
 * @param parentSeg The path segment that precedes the ID (e.g. `"properties"`)
 */
export function extractNestedIdFromUrl(
  url: string,
  parentSeg: string,
): string | null {
  const segments = new URL(url).pathname.split('/');
  const idx = segments.indexOf(parentSeg);
  if (idx === -1 || idx + 1 >= segments.length) return null;
  return segments[idx + 1] || null;
}

// =============================================================================
// extractUidFromPath — UID from /users/[uid]/<endpoint> routes
// =============================================================================

/**
 * Extract the UID from admin routes shaped `/…/users/[uid]/<action>`.
 *
 * Uses `lastIndexOf('users')` to avoid false matches with other path segments,
 * and validates that the extracted segment is not the trailing action name.
 *
 * @param request   Next.js request (uses `nextUrl.pathname`)
 * @param actionSeg The trailing segment to reject (e.g. `"role"`, `"status"`,
 *                  `"permission-sets"`). If the extracted UID equals this value
 *                  it means the URL was malformed.
 */
export function extractUidFromPath(
  request: NextRequest,
  actionSeg: string,
): string | null {
  const segments = request.nextUrl.pathname.split('/');
  const usersIdx = segments.lastIndexOf('users');
  if (usersIdx === -1 || usersIdx + 1 >= segments.length) return null;
  const uid = segments[usersIdx + 1];
  return uid && uid !== actionSeg ? uid : null;
}
