# ADR-100: JIT User Profile Sync (Firestore /users/{uid})

**Status**: IMPLEMENTED
**Date**: 2026-02-08
**Category**: Security & Auth

---

## Context

Το πεδίο `assignedTo` στα CRM Tasks εμφάνιζε raw UIDs (π.χ. `dev-admin`) αντί για πραγματικά ονόματα χρηστών. Η αιτία ήταν ότι δεν υπήρχε μηχανισμός δημιουργίας user profile documents στο Firestore `users/{uid}` collection κατά το sign-in.

Υπήρχε ήδη lookup code στο task detail page που έψαχνε στο `users` collection, αλλά αποτύγχανε γιατί δεν υπήρχε document.

## Decision

Υιοθετούμε το **Just-In-Time (JIT) User Profile Provisioning** pattern — industry standard που χρησιμοποιείται από Google, Microsoft, Okta.

### Pattern: JIT Provisioning via `onAuthStateChanged`

- Κατά κάθε sign-in, ελέγχουμε αν υπάρχει Firestore document `/users/{uid}`
- Αν **δεν υπάρχει** → δημιουργούμε full profile με defaults (`setDoc`)
- Αν **υπάρχει** → ενημερώνουμε μόνο system fields (`setDoc` με `merge: true`)
- **Non-blocking**: Αποτυχία sync δεν εμποδίζει ποτέ το login

### Field-Level Source of Truth

| Field | Owner | Sync Behavior |
|-------|-------|---------------|
| `email`, `emailVerified` | Firebase Auth | Always synced from Auth |
| `displayName`, `photoURL` | Firebase Auth | Synced from Auth (authoritative) |
| `globalRole`, `companyId` | Custom Claims / Admin | Synced from claims, DB fallback |
| `status` | Admin-managed | Never overwritten by sync |
| `loginCount`, `lastLoginAt` | System | Auto-updated on each sign-in |
| `createdAt` | System | Set once, never modified |

## Implementation

### Files Modified

| File | Change |
|------|--------|
| `src/auth/types/auth.types.ts` | Added `UserProfileDocument` interface |
| `src/auth/contexts/AuthContext.tsx` | Added `syncUserProfileToFirestore()` + `ensureDevUserProfile()` |
| `src/app/crm/tasks/[taskId]/page.tsx` | Fixed type safety (`as string` → `UserProfileDocument`) |

### Firestore Document Schema

```typescript
interface UserProfileDocument {
  uid: string;
  email: string;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
  photoURL: string | null;
  companyId: string | null;
  globalRole: string | null;
  status: 'active' | 'inactive' | 'suspended';
  emailVerified: boolean;
  loginCount: number;
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
  authProvider: string;
}
```

### Integration Point

```
onAuthStateChanged → buildAuthUser → syncUserProfileToFirestore → setUser
```

Η sync εκτελείται **μετά** το loading custom claims και **πριν** τα components κάνουν render.

### Development Bypass

Σε `NODE_ENV === 'development'`, η `ensureDevUserProfile()` δημιουργεί αυτόματα document `/users/dev-admin` με `displayName: 'Dev Admin'`.

## Consequences

### Positive
- User name resolution λειτουργεί σε όλη την εφαρμογή (tasks, calendar, etc.)
- Zero-config: αυτόματη δημιουργία profile χωρίς manual setup
- Multi-tenant compatible (companyId synced from claims)
- Non-blocking: δεν επηρεάζει το login flow

### Negative
- Προσθέτει ~100-200ms στο πρώτο login (getDoc + setDoc)
- Client-side μόνο (χωρίς Cloud Functions, λόγω Vercel Hobby plan)

## Related ADRs

- **ADR-020**: Centralized Auth Module (base auth architecture)
- **ADR-063**: Company Isolation via Custom Claims (multi-tenancy)
- **ADR-077**: Firebase Admin SDK Unified Lazy Init
