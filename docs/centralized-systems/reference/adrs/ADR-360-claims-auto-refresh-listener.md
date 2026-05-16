# ADR-360 — Firebase Custom Claims Auto-Refresh Listener

**Status:** Accepted
**Date:** 2026-05-16
**Supersedes:** Partial extension of ADR-063 (Company Isolation via Custom Claims)
**Related:** ADR-244 (Role Management Admin Console), ADR-145 (Super Admin)

## Context

Firebase ID tokens are cached on the client for up to one hour. When the
server mutates `setCustomUserClaims` (role change, company assignment, MFA
enrollment, super-admin grant, company migration), connected clients do not
observe the change until either:

1. The user signs out and back in, or
2. The application explicitly calls `firebaseUser.getIdToken(true)`.

In practice this manifests as "Missing or insufficient permissions" errors
on hard refresh when a recently-granted role hasn't propagated, or as stale
`companyId` claims after a tenant migration. Two of these incidents occurred
on 2026-05-16 (georgios.pagonis@gmail.com super_admin grant + pagonis.oe
declassification), where the affected user had to log out and back in to
pick up new claims — Google Workspace, Salesforce, and AWS IAM all
auto-propagate within seconds and we should match.

Before this ADR there was no SSOT for setting claims: six API routes and
four scripts each called `setCustomUserClaims` directly with subtly
different payloads, and none mirrored the change anywhere a client could
listen.

## Decision

1. **Server SSOT — `src/lib/auth/set-claims-with-mirror.ts`**
   All server code paths that mutate custom claims MUST call
   `setClaimsWithMirror(uid, claims)`. The helper stamps `claimsUpdatedAt`
   (epoch ms) into the claims AND writes the same value to
   `users/{uid}.claimsUpdatedAt`. Auth write is authoritative; Firestore
   mirror failure is logged and non-blocking (claims are still set
   correctly — only the live-refresh signal is lost).

2. **Client listener — `src/auth/contexts/auth-context/use-claims-refresh.ts`**
   Subscribes to `users/{uid}` via `onSnapshot`. When the mirrored
   `claimsUpdatedAt` exceeds the value baked into the current ID token,
   the hook calls `firebaseUser.getIdTokenResult(true)`, rebuilds the
   `FirebaseAuthUser`, and re-runs `syncServerSession()`. The new claims
   are reflected in the AuthContext within seconds without user action.

3. **Token field surfacing**
   `FirebaseAuthUser.claimsUpdatedAt` exposes the token's stamped value to
   the listener so it can detect divergence without an extra round-trip.

4. **Migration scope**
   All current claim-setters route through the SSOT:
   - API: `set-user-claims`, `role-management/[uid]/role`,
     `bootstrap-admin`, `migrate-company-id`, `auth/complete-registration`,
     `auth/mfa/enroll/complete`
   - Scripts: `bootstrap-pagonis-admin.js`, `claims.setCompanyId.js`
     (others — `set-super-admin.js`, `downgrade-super-admin.js`,
     `clear-permissions.js`, `set-user-claims-direct.js` — are admin
     escape-hatches; they remain free to call `setCustomUserClaims`
     directly but SHOULD use the helper or mirror manually).

## Architecture

```
┌─────────────────┐       setClaimsWithMirror()
│  API route or   │ ────────────────────────────┐
│  admin script   │                             ▼
└─────────────────┘                  ┌──────────────────────┐
                                     │  Firebase Auth       │ ◀── source of truth
                                     │  setCustomUserClaims │
                                     └──────────────────────┘
                                                │
                                                ▼ (stamped claimsUpdatedAt)
                                     ┌──────────────────────┐
                                     │  Firestore mirror    │ ◀── notification channel
                                     │  users/{uid}         │
                                     │   .claimsUpdatedAt   │
                                     └──────────────────────┘
                                                │
                                                ▼ onSnapshot
                                     ┌──────────────────────┐
                                     │  Client AuthContext  │
                                     │  useClaimsRefresh    │
                                     │  → getIdToken(true)  │
                                     │  → setUser(...)      │
                                     └──────────────────────┘
```

## Google-level Checklist (N.7.2)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | **Proactive** — server stamps `claimsUpdatedAt` at write time, client listens continuously |
| 2 | Race condition? | **No** — Auth write completes before Firestore mirror; client compares monotonic timestamps |
| 3 | Idempotent? | **Yes** — repeated `setClaimsWithMirror` calls each bump the stamp, listener no-ops if stamp ≤ last handled |
| 4 | Belt-and-suspenders? | **Yes** — Auth state change still does `getIdTokenResult(true)` on mount; listener handles in-session updates |
| 5 | Single Source of Truth? | **Yes** — `setClaimsWithMirror` is the only path; FirebaseAuth remains the SoT for claim values, Firestore is a notification mirror only |
| 6 | Fire-and-forget or await? | **Await Auth, log mirror** — Auth is required, Firestore is signal-only |
| 7 | Lifecycle owner? | **`@/lib/auth/set-claims-with-mirror.ts`** for writes, `useClaimsRefresh` for client propagation |

**✅ Google-level: YES** — claims propagate to live clients within Firestore
write-to-snapshot latency (typically <1s), matching the UX of Workspace
admin changes.

## Consequences

**Positive:**
- No more "log out and back in" instructions after admin changes claims
- Permission-denied storms after company migrations stop within seconds
- Auditable: every claim mutation now also touches `users/{uid}` with a
  monotonic timestamp

**Negative:**
- One extra Firestore write per claim mutation (negligible — claim writes
  are rare, audit-grade actions)
- One client-side `onSnapshot` per authenticated session on `users/{uid}`
  (the doc was already readable by the owner; no extra rules needed)
- Clients connected with very stale clocks could theoretically miss a
  refresh; mitigated because the timestamp is server-stamped and the
  listener only requires strict-greater-than vs the token's claim, both of
  which are issued by the same server clock.

## Migration Notes

- Existing claims without `claimsUpdatedAt` continue to work; the listener
  treats `mirroredAt === 0` as a no-op until the next server-side write
  stamps both sides.
- The four admin escape-hatch scripts that still call `setCustomUserClaims`
  directly do not break — they simply skip the live-refresh signal. Use
  them only for offline admin operations where the affected user is not
  expected to be online.

## Changelog

- **2026-05-16** — ADR created; SSOT helper, client listener, and 6 API
  routes + 2 scripts migrated in the same commit chain.
