/**
 * createExternalStore — re-export shim (WAVE 3 promote).
 *
 * The canonical vanilla external-store primitive now lives in the shared platform lib at
 * `@/lib/state/createExternalStore` so non-dxf subapps can share the SAME SSoT (big-player
 * canonical: a core store primitive belongs at package/core level, not buried in one
 * feature module). This file stays as a thin re-export so the ~126 existing dxf import
 * sites keep working unchanged.
 *
 * New code — dxf or otherwise — may import from either path; both resolve to the one
 * implementation. Do NOT re-add store machinery here.
 *
 * @see @/lib/state/createExternalStore — the canonical implementation
 */

export * from '@/lib/state/createExternalStore';
