# ADR-360 — Claims Auto-Refresh SSoT (Firestore Mirror)

**Status**: IMPLEMENTED  
**Date**: 2026-05-16  
**Domain**: Auth / Security  

---

## Context

`setCustomUserClaims` (Firebase Admin SDK) updates the server-side claim store
but does NOT push the change to connected clients. The client's cached ID token
(max 1 h TTL) keeps stale claims until the user logs out/in or calls
`getIdToken(true)` explicitly.

This caused a known gap: an admin that grants a super-admin role would not take
effect until the target user's next token renewal.

## Decision

Mirror `claimsUpdatedAt` (epoch ms) into `users/{uid}` in Firestore every time
custom claims are written server-side. A client hook subscribes to that field
and force-refreshes the token within seconds of the server update.

**Primary path (server):**
- `setClaimsWithMirror(uid, claims)` in `src/lib/auth/set-claims-with-mirror.ts`
- Stamps `claimsUpdatedAt = Date.now()` inside claims AND in the Firestore mirror
- Auth write is authoritative; Firestore mirror failure is logged but non-fatal

**Reactive path (client):**
- `useClaimsRefresh({ uid, tokenClaimsUpdatedAt, setUser })` in `src/auth/contexts/auth-context/use-claims-refresh.ts`
- `onSnapshot` on `users/{uid}` compares `mirroredAt` vs token's `claimsUpdatedAt`
- If `mirroredAt > tokenClaimsUpdatedAt` → `getIdToken(true)` + propagate to AuthContext

## Files

| File | Role |
|------|------|
| `src/lib/auth/set-claims-with-mirror.ts` | Server SSoT — all claim mutations go through here |
| `src/auth/contexts/auth-context/use-claims-refresh.ts` | Client hook — Firestore listener + force-refresh |
| `src/auth/contexts/auth-context/auth-context-session.ts` | `buildAuthUser` now reads `claimsUpdatedAt` from token |
| `src/auth/types/auth.types.ts` | `FirebaseAuthUser.claimsUpdatedAt?: number` field added |

## Consequences

- Claims propagate to active sessions in < 5 s (Firestore snapshot latency)
- No re-login required after role/company changes
- Firestore mirror failure is non-blocking (Auth claims remain authoritative)

## Checklist (N.7.2)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | Proactive — mirror written at the same time as claims |
| 2 | Race condition? | No — auth write happens before mirror; client compares values |
| 3 | Idempotent? | Yes — same `claimsUpdatedAt` = no re-refresh |
| 4 | Belt-and-suspenders? | Yes — auth claims survive even if mirror fails |
| 5 | SSoT? | Yes — all servers use `setClaimsWithMirror` |

✅ Google-level: YES — proactive server mirror + reactive client refresh, zero re-login required

## Changelog

| Date | Change |
|------|--------|
| 2026-05-16 | Initial implementation (Phase 1) |
