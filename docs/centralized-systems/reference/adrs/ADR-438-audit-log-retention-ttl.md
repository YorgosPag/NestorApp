# ADR-438 — Audit Log Retention / TTL Policy (Πολιτική Διατήρησης Audit Logs)

- **Status**: v2 IMPLEMENTED — code DONE (τριών-tier retention/delivery/dedup)· GCP-side TTL policy **ΑΚΟΜΑ ΟΧΙ enabled** (verified 2026-07-20)· pending commit
- **Date**: 2026-06-10 (v1) · **2026-07-20 (v2 — τριών-tier αναθεώρηση)**
- **Authors**: Opus (research + implementation), Giorgio (product owner)
- **Domain**: Security / Audit (RFC v6 authorization-rbac)
- **Retention window**: **τρία tiers** — security 24 μήνες, compliance 12 μήνες, access 1 μήνας (βλ. §2)
- **Επόμενο ελεύθερο ADR μετά**: ADR-439
- **Σχετικά ADR**: ADR-065 (audit extraction / SRP), ADR-210 (document-id-generation + audit), ADR-195 (entity-audit-trail — ξεχωριστό σύστημα), ADR-259D (access-denied Sentry capture)

---

## 0. ⚠️ Διόρθωση status (2026-07-20) — διαβάστε πρώτα αυτό

Το v1 του παρόντος ADR έγραφε **«Status: IN PROGRESS (code DONE· pending GCP-side TTL enable)»**.
Αυτό ήταν ανακριβές με τρόπο που έχει σημασία: **το GCP-side TTL policy δεν ενεργοποιήθηκε ποτέ**.

Επαλήθευση 2026-07-20:

```bash
$ gcloud firestore fields ttls list --project=pagonis-87766
Listed 0 items.
```

Μηδέν. Όχι «pending merge», όχι «σε εξέλιξη» — **ποτέ δεν εκτελέστηκε η `gcloud firestore fields ttls update`**
από τις 2026-06-10 μέχρι σήμερα (~6 εβδομάδες). Σε όλο αυτό το διάστημα το `expiresAt` γραφόταν κανονικά σε
κάθε audit document, αλλά **τίποτα δεν το τηρούσε**. Η πραγματική διατήρηση ήταν, εν τοις πράγμασι, **άπειρη** —
ακριβώς το πρόβλημα unbounded-growth που το ADR-438 v1 ισχυριζόταν ότι είχε λύσει.

Αυτό δεν είναι απλά ένα τεχνικό detail που ξεχάστηκε στο changelog: είναι το **σημαντικότερο λάθος του
εγγράφου** και διορθώνεται εδώ ρητά, χωρίς μαλάκωμα. Η ενέργεια `gcloud firestore fields ttls update` (§2.3)
παραμένει **ανεκτέλεστη** — το v2 δεν την αλλάζει, μόνο διορθώνει το ψευδές «done» status του v1 και προσθέτει
την τριών-tier λογική στο επίπεδο εφαρμογής (§2).

---

## 1. Context — Γιατί (v1, αμετάβλητο)

Το audit system (`src/lib/auth/audit-core.ts`) γράφει **ένα document ανά ενέργεια** (login, action, access-denied, webhook) σε:

- `companies/{companyId}/audit_logs/{auditId}` — collection group `audit_logs` (μέσω `logAuditEvent`)
- `system_audit_logs/{auditId}` — top-level (μέσω `logWebhookEvent`, public webhooks χωρίς AuthContext)

**Πρόβλημα: unbounded growth.** Τα documents **μόνο προστίθενται — ποτέ δεν διαγράφονται**. Σε πραγματική χρήση (~7.000 logins + χιλιάδες actions είχαν ήδη μαζευτεί σε μία company) ο όγκος μεγαλώνει ασταμάτητα → κόστος αποθήκευσης/reads ↑, αργά queries, GDPR/compliance ρίσκο (συχνά δεν επιτρέπεται απεριόριστη διατήρηση).

**Τι κάνουν οι μεγάλοι παίκτες:** retention policy + TTL (Time-To-Live). Κάθε record φέρει «ημερομηνία λήξης»· ο πάροχος το διαγράφει αυτόματα. Το Firestore προσφέρει native **TTL policy** πάνω σε πεδίο τύπου `Timestamp`.

### 1.1 Γιατί δεν αρκούσε το v1 (flat 12 μήνες)

Το v1 έγραφε 12 μήνες σε **κάθε** audit action αδιακρίτως — από `role_changed` (μια αλλαγή δικαιωμάτων, σπάνια,
πρέπει να επιβιώνει για forensics) μέχρι `data_accessed` (ένα read, πυροδοτείται **ακόμη και σε cache hits**,
χιλιάδες φορές την ημέρα). Δύο επιπλέον προβλήματα στο v1 πέρα από το flat retention:

- Κάθε write ήταν **blocking** (`await logAuditEvent(...)`) — ακόμη και σε read paths, δηλαδή κάθε ανάγνωση
  πλήρωνε ένα επιπλέον Firestore round-trip πριν επιστρέψει response.
- Καμία καταστολή διπλοεγγραφών — ο ίδιος χρήστης που φορτώνει το ίδιο dashboard 10 φορές μέσα σε ένα λεπτό
  παρήγαγε 10 πανομοιότυπες γραμμές `data_accessed`.

Η λύση (v2) είναι ο διαχωρισμός που κάνουν **Figma / Atlassian / Google Workspace**: το «security-compliance
audit» (ποιος άλλαξε δικαιώματα) **δεν είναι το ίδιο πράγμα** με το «access telemetry» (ποιος διάβασε τι).
Διαφορετική αξία ανά γραμμή ⇒ διαφορετικό retention, διαφορετικό delivery, διαφορετικό dedup.

---

## 2. Decision — Τι φτιάχτηκε (v2 — τρία tiers)

### 2.1 Τα τρία tiers

Νέο αρχείο: **`src/lib/auth/audit-policy.ts`** — SSoT της πολιτικής retention/delivery/dedup.

| Tier | Retention | Delivery | Dedup | Γιατί |
|------|-----------|----------|-------|-------|
| **security** | 24 μήνες | blocking | — (0) | forensics — αλλαγές δικαιωμάτων/ταυτότητας/συστήματος πρέπει να επιβιώνουν μακρύτερα από το business record |
| **compliance** | 12 μήνες | blocking | — (0) | business record — ό,τι δημιουργήθηκε/άλλαξε/στάλθηκε. Αυτό ήταν το status quo του v1, τώρα σωστά scoped |
| **access** | 1 μήνας | async | 5 λεπτά | τηλεμετρία ανάγνωσης — όγκος >> αξία ανά γραμμή, δεν χρειάζεται να μπλοκάρει το request που την προκάλεσε |

```ts
export const AUDIT_TIER_CONFIG: Record<AuditTier, AuditTierConfig> = {
  security:   { retentionMonths: 24, delivery: 'blocking', dedupWindowMs: 0 },
  compliance: { retentionMonths: 12, delivery: 'blocking', dedupWindowMs: 0 },
  access:     { retentionMonths: 1,  delivery: 'async',    dedupWindowMs: 300_000 },
};
```

### 2.2 Η κατανομή actions → tier — και γιατί είναι `Record`, όχι `Partial`

```ts
export const AUDIT_ACTION_TIER: Record<AuditAction, AuditTier> = { /* … */ };
```

Το `AUDIT_ACTION_TIER` είναι **εξαντλητικό** πάνω στο `AuditAction` (κάθε κλειδί του `AUDIT_ACTIONS` σε
`src/lib/auth/audit-types.ts`). Ο τύπος είναι σκόπιμα `Record<AuditAction, AuditTier>` — **όχι** `Partial<>`,
**όχι** index signature. Συνέπεια: αν κάποιος προσθέσει νέο action στο `AUDIT_ACTIONS` και ξεχάσει να του
αναθέσει tier, **δεν κάνει compile**. Αυτό είναι type-driven anchor εν τοις πράγμασι — το «τι κρατάμε και για
πόσο» δεν μπορεί να ξεχαστεί σιωπηλά, με τον ίδιο τρόπο που το ADR-587 χρησιμοποιεί exhaustive unions για τα
renderable entity types. Μη το αδυνατίσεις σε `Partial<>` — αυτό θα ακύρωνε ακριβώς τον λόγο ύπαρξής του.

Αναλυτική κατανομή (43 actions):

**security (21)** — `access_denied`, `claims_updated`, `role_changed`, `permission_granted`,
`permission_revoked`, `permission_set_granted`, `permission_set_revoked`, `grant_created`, `grant_revoked`,
`ownership_changed`, `user_suspended`, `user_activated`, `member_added`, `member_removed`, `member_updated`,
`system_bootstrap`, `migration_executed`, `system_configured`, `data_fix_executed`,
`direct_operation_executed`, `asset_pack.access_denied`

**access (1)** — `data_accessed`

**compliance (21)** — `data_created`, `data_updated`, `data_deleted`, `soft_deleted`, `restored`,
`email_sent`, `message_sent`, `communication_created`, `communication_approved`, `communication_rejected`,
`webhook_received`, `financial_transition`, και τα 9 `procurement.po.*`
(`created`, `approved`, `ordered`, `status_changed`, `items_edited`, `cancelled`, `deleted`,
`delivery_recorded`, `invoice_linked`)

### 2.3 Πεδίο `expiresAt` — ένα πεδίο, τρία retention windows, μηδέν επιπλέον GCP config

```ts
export function computeAuditExpiry(action: AuditAction, now: Date = new Date()): Date {
  const expiry = new Date(now.getTime());
  expiry.setMonth(expiry.getMonth() + resolveAuditPolicy(action).retentionMonths);
  return expiry;
}
```

Το `expiresAt` παραμένει **ένα** πεδίο τύπου `Timestamp` σε κάθε document — ό,τι άλλαζε είναι **η τιμή του**,
όχι το σχήμα. Το Firestore TTL policy δουλεύει per-document: διαβάζει το `expiresAt` του κάθε εγγράφου, όποια
κι αν είναι η τιμή του. Άρα **ένα** ενεργοποιημένο TTL policy πάνω στο `expiresAt` εξυπηρετεί και τα τρία
tiers ταυτόχρονα — δεν χρειάζεται τίποτα επιπλέον στο GCP-side πέρα από αυτό που το v1 ήδη περιέγραφε:

```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=audit_logs --enable-ttl --project=pagonis-87766

gcloud firestore fields ttls update expiresAt \
  --collection-group=system_audit_logs --enable-ttl --project=pagonis-87766
```

Έλεγχος κατάστασης (αυτή τη στιγμή επιστρέφει `Listed 0 items` — βλ. §0):

```bash
gcloud firestore fields ttls list --project=pagonis-87766
```

### 2.4 Async delivery για το access tier

```ts
if (policy.delivery === 'async') {
  void persistAuditEntry(db, ctx, action, entry).catch((error) => {
    logger.error('[AUDIT] Async audit write failed:', { action, error: getErrorMessage(error) });
  });
  return;
}
await persistAuditEntry(db, ctx, action, entry);
```

Το write-body (company-existence validation + `.set()`) εξήχθη σε ιδιωτικό helper `persistAuditEntry()`.
Για `blocking` tiers (security, compliance) η συμπεριφορά είναι **ίδια με το v1** — `await` πλήρες.
Για το `access` tier το `logAuditEvent` καλεί το ίδιο helper **χωρίς** `await` (fire-and-forget με
`.catch()` net) και επιστρέφει αμέσως ένα ήδη-resolved `Promise<void>`. Αποτέλεσμα: τα **~110 υπάρχοντα**
`await logAuditEvent(...)` call sites στο codebase μένουν **αμετάβλητα** — συνεχίζουν να κάνουν `await` σε
κάτι, απλώς αυτό το κάτι πλέον δεν μπλοκάρει καθόλου όταν το action είναι `data_accessed`.

### 2.5 Dedup (μόνο access tier)

```ts
export function shouldSuppressDuplicate(key: string, windowMs: number, now: number): boolean
```

In-memory `Map<string, number>` (κλειδί → τελευταία εγγραφή σε epoch ms), module-level. `windowMs === 0`
επιστρέφει πάντα `false` — τα blocking tiers δεν καταστέλλονται ποτέ. Bounded στα 5.000 entries: όταν
γεμίσει, πρώτα eviction των ληγμένων· αν παραμένει υπερμεγέθης, πλήρες `clear()`.

### 2.6 Barrel

`src/lib/auth/audit.ts` re-exports το public surface του `audit-policy.ts`, ώστε οι καταναλωτές να
συνεχίζουν να κάνουν `import { resolveAuditTier, AUDIT_TIER_CONFIG, ... } from '@/lib/auth'`.
**Παγίδα**: το `audit-policy.ts` είναι σκόπιμα **χωρίς** `import 'server-only'` (ώστε τα tests να μπορούν να
καλούν `computeAuditExpiry(action, fixedNow)` ντετερμινιστικά), αλλά ο barrel το εκθέτει μέσα από
`audit-core.ts`, που **έχει** `server-only`. Οτιδήποτε το φτάνει μέσω `@/lib/auth` κληρονομεί άρα το
server-only tainting. Tests ή οποιοσδήποτε isomorphic καταναλωτής πρέπει να κάνουν import απευθείας από
`'./audit-policy'`.

---

## 3. Consequences — Τι να ξέρουμε (Honesty)

- ✅ Η βάση **αυτοκαθαρίζεται** — όταν ενεργοποιηθεί το TTL (§2.3, ακόμα pending)· ο όγκος audit logs
  σταθεροποιείται σε rolling παράθυρο 24/12/1 μηνών ανάλογα με το tier, αντί για flat 12.
- ✅ Reads δεν μπλοκάρουν πλέον σε Firestore write για audit — το `data_accessed` είναι async.
- ✅ Ίδιος χρήστης/στόχος/διαδρομή μέσα σε 5 λεπτά → μία γραμμή αντί για N.
- ⚠️ **Το TTL policy δεν είναι ενεργό στο GCP (§0).** Μέχρι να τρέξει η `gcloud firestore fields ttls update`
  ×2, το `expiresAt` γράφεται αλλά δεν τηρείται από κανέναν — η πραγματική διατήρηση παραμένει άπειρη.
  Αυτό είναι το ίδιο ανοιχτό πρόβλημα του v1, όχι κάτι νέο που εισάγει το v2.
- ⚠️ **Το dedup είναι per-instance, in-memory.** Σε serverless deploy με N ζεστά instances, ο ίδιος χρήστης
  που χτυπάει το ίδιο endpoint μέσα στο ίδιο 5λεπτο παράθυρο μπορεί να παράγει έως N αντίγραφα (ένα ανά
  instance που τον εξυπηρέτησε) — όχι μηδέν. Αποδεκτό γιατί το access telemetry ανέχεται διπλότυπα εξ
  ορισμού· απλά να είναι γνωστό, όχι να θεωρηθεί εγγύηση single-copy.
- ⚠️ **Το async delivery μπορεί να χάσει ένα event.** Αν το instance τερματιστεί (cold shutdown, crash) ενώ
  το fire-and-forget write είναι ακόμη in-flight, η γραμμή `data_accessed` χάνεται σιωπηλά — δεν υπάρχει
  retry. Αυτό είναι το ρητά αποδεκτό trade-off για να μην μπλοκάρει κανένα read· ακριβώς γι' αυτό τα tiers
  `security` και `compliance` **παραμένουν blocking** — αυτά δεν μπορούν να ανεχθούν απώλεια.
- ⚠️ **Τα 4 σημεία `data_accessed` στο `projects/list` και `projects/by-company/[companyId]` αφαιρέθηκαν
  οριστικά** (cache-hit branch + post-Firestore branch, και στα δύο routes) αντί να μεταναστεύσουν στο νέο
  tiering. Αυτή η read-activity δεν είναι πλέον ανακτήσιμη· δεν υπάρχει ιστορικό γι' αυτά τα reads μετά την
  αφαίρεση. Τα υπόλοιπα 6 ευαίσθητα `data_accessed` σημεία (search, financial-intelligence portfolio,
  floorplans process, projects customers ×2, role-management users) **δεν αγγίχτηκαν** — κληρονομούν αυτόματα
  async delivery + dedup + 1 μήνα retention από τον πυρήνα, χωρίς να χρειαστεί αλλαγή στο call site τους.
  Αυτό είναι κι ο λόγος που το tiering μπήκε στον πυρήνα (`audit-core.ts`) και όχι σε κάθε call site.
- ⚠️ **Όχι real-time διαγραφή** (όταν το TTL ενεργοποιηθεί): το Firestore TTL διαγράφει τυπικά εντός
  **24-72 ωρών** μετά τη λήξη — όχι ακαριαία.
- ⚠️ **Backfill/migration δεν έγινε — σκόπιμα.** Τα audit docs που υπήρχαν πριν το v2 (και πριν το v1) δεν
  μεταναστεύτηκαν σε νέο tier retroactively· απλά **απορρίφθηκαν** αντί να γραφτεί migration script. Ο
  λόγος: το project είναι **pre-production, με έναν και μοναδικό χρήστη** (Giorgio) — δεν υπάρχει πραγματικό
  compliance backlog που να αξίζει τον κίνδυνο/χρόνο ενός backfill. Δεν είναι ελλιπής υλοποίηση· είναι
  συνειδητή επιλογή scope για τη φάση του project.
- ⚠️ **Single-field TTL** auto-exempt από indexing — μηδέν αλλαγή στο `firestore.indexes.json` (αμετάβλητο
  από v1).
- ⚠️ Το TTL enable είναι GCP-side write → απαιτεί `gcloud auth` + IAM δικαιώματα στο `pagonis-87766`. Δεν
  εφαρμόζεται μέσω app deploy (αμετάβλητο από v1).

---

## 4. Changelog

- **2026-06-10** — v1: Προστέθηκε `expiresAt` (now + 12 μήνες) σε `logAuditEvent` + `logWebhookEvent` (`audit-core.ts`)· `AuditLogEntry.expiresAt?` στο `types.ts`. **Pending**: GCP-side TTL enable (gcloud ×2 collection groups) + commit. (Opus)
- **2026-07-20** — v2: **Τριών-tier retention/delivery/dedup.** Νέο `src/lib/auth/audit-policy.ts`
  (`AuditTier`, `AUDIT_TIER_CONFIG`, εξαντλητικό `AUDIT_ACTION_TIER: Record<AuditAction, AuditTier>`,
  `resolveAuditTier`, `resolveAuditPolicy`, `computeAuditExpiry(action, now?)`, `buildAuditDedupKey`,
  `shouldSuppressDuplicate` με bounded in-memory Map). `audit-core.ts`: αφαιρέθηκε το τοπικό
  `AUDIT_LOG_RETENTION_MONTHS` + τοπικό `computeAuditExpiry()`· το write-body εξήχθη σε
  `persistAuditEntry()`· `logAuditEvent` πλέον resolve-άρει tier ανά action (blocking για security/
  compliance, async fire-and-forget για access, dedup 5 λεπτών για access)· `logWebhookEvent` χρησιμοποιεί
  `computeAuditExpiry('webhook_received')` από το νέο module. `audit.ts` barrel re-exports το public surface
  του `audit-policy.ts`. Αφαιρέθηκαν τα 4 `data_accessed` call sites σε
  `src/app/api/projects/list/route.ts` και `src/app/api/projects/by-company/[companyId]/route.ts`
  (cache-hit + post-Firestore branches και στα δύο) — μη ανακτήσιμη read-activity, βλ. §3.
  **Διορθώθηκε ψευδές status**: το GCP-side TTL policy **δεν** ενεργοποιήθηκε ποτέ κατά το v1
  (`gcloud firestore fields ttls list` → `Listed 0 items`, επαληθεύτηκε 2026-07-20) — βλ. §0. Παραμένει
  pending. (Opus, implementation report βάσει οδηγιών lead)
