# ADR-438 — Audit Log Retention / TTL Policy (Πολιτική Διατήρησης Audit Logs)

- **Status**: IN PROGRESS (code DONE· pending GCP-side TTL enable + browser/deploy verify + commit)
- **Date**: 2026-06-10
- **Authors**: Opus (research + implementation), Giorgio (product owner)
- **Domain**: Security / Audit (RFC v6 authorization-rbac)
- **Retention window**: **12 μήνες**
- **Επόμενο ελεύθερο ADR μετά**: ADR-439
- **Σχετικά ADR**: ADR-065 (audit extraction / SRP), ADR-210 (document-id-generation + audit), ADR-195 (entity-audit-trail — ξεχωριστό σύστημα), ADR-259D (access-denied Sentry capture)

---

## 1. Context — Γιατί

Το audit system (`src/lib/auth/audit-core.ts`) γράφει **ένα document ανά ενέργεια** (login, action, access-denied, webhook) σε:

- `companies/{companyId}/audit_logs/{auditId}` — collection group `audit_logs` (μέσω `logAuditEvent`)
- `system_audit_logs/{auditId}` — top-level (μέσω `logWebhookEvent`, public webhooks χωρίς AuthContext)

**Πρόβλημα: unbounded growth.** Τα documents **μόνο προστίθενται — ποτέ δεν διαγράφονται**. Σε πραγματική χρήση (~7.000 logins + χιλιάδες actions είχαν ήδη μαζευτεί σε μία company) ο όγκος μεγαλώνει ασταμάτητα → κόστος αποθήκευσης/reads ↑, αργά queries, GDPR/compliance ρίσκο (συχνά δεν επιτρέπεται απεριόριστη διατήρηση).

**Τι κάνουν οι μεγάλοι παίκτες:** retention policy + TTL (Time-To-Live). Κάθε record φέρει «ημερομηνία λήξης»· ο πάροχος το διαγράφει αυτόματα. Το Firestore προσφέρει native **TTL policy** πάνω σε πεδίο τύπου `Timestamp`.

---

## 2. Decision — Τι φτιάχτηκε

| Πτυχή | Απόφαση |
|-------|---------|
| Μηχανισμός | Firestore native **TTL policy** πάνω στο πεδίο `expiresAt` (όχι scheduled function — μηδέν compute κόστος, GCP-managed). |
| Retention | **12 μήνες** (`AUDIT_LOG_RETENTION_MONTHS = 12` στο `audit-core.ts`). |
| Πεδίο | `expiresAt = now + 12 μήνες` σε κάθε νέο audit doc· γράφεται ως JS `Date` → ο Admin SDK το persist-άρει ως Firestore `Timestamp` (απαίτηση TTL). |
| Σημεία εγγραφής | Και τα δύο: `logAuditEvent` + `logWebhookEvent`. |
| Τύπος | `AuditLogEntry.expiresAt?: Date` (optional — παλιά docs πριν το ADR-438 δεν το έχουν). |
| Collection groups | TTL enable σε `audit_logs` **ΚΑΙ** `system_audit_logs`. |

### Πεδίο `expiresAt` — υπολογισμός

```ts
const AUDIT_LOG_RETENTION_MONTHS = 12;

function computeAuditExpiry(): Date {
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + AUDIT_LOG_RETENTION_MONTHS);
  return expiry;
}
```

### Ενεργοποίηση TTL policy (GCP-side — out-of-band)

Το TTL policy **δεν** ορίζεται σε `firebase.json` ή `firestore.indexes.json` — εφαρμόζεται μέσω `gcloud` ανά collection group:

```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=audit_logs --enable-ttl --project=pagonis-87766

gcloud firestore fields ttls update expiresAt \
  --collection-group=system_audit_logs --enable-ttl --project=pagonis-87766
```

Έλεγχος κατάστασης:

```bash
gcloud firestore fields ttls list --project=pagonis-87766
```

---

## 3. Consequences — Τι να ξέρουμε (Honesty)

- ✅ Η βάση **αυτοκαθαρίζεται**· ο όγκος των audit logs σταθεροποιείται στο rolling παράθυρο 12 μηνών.
- ⚠️ **Όχι real-time διαγραφή**: το Firestore TTL διαγράφει τυπικά εντός **24-72 ωρών** μετά τη λήξη — όχι ακαριαία. Δεν είναι εγγύηση «exactly at expiry».
- ⚠️ **Backfill**: τα audit docs που γράφτηκαν **πριν** το ADR-438 δεν έχουν `expiresAt` → δεν θα διαγραφούν αυτόματα. Αφού η DB αδειάστηκε χειροκίνητα (2026-06-10), δεν υπάρχει σημαντικό backlog. Αν χρειαστεί, one-time backfill script που σφραγίζει `expiresAt` στα legacy docs (DEFER — δεν υλοποιήθηκε).
- ⚠️ **Single-field TTL** auto-exempt από indexing — μηδέν αλλαγή στο `firestore.indexes.json`.
- ⚠️ Το TTL είναι GCP-side write → απαιτεί `gcloud auth` + IAM δικαιώματα στο `pagonis-87766`. Δεν εφαρμόζεται μέσω app deploy.

---

## 4. Changelog

- **2026-06-10** — v1: Προστέθηκε `expiresAt` (now + 12 μήνες) σε `logAuditEvent` + `logWebhookEvent` (`audit-core.ts`)· `AuditLogEntry.expiresAt?` στο `types.ts`. **Pending**: GCP-side TTL enable (gcloud ×2 collection groups) + commit. (Opus)
