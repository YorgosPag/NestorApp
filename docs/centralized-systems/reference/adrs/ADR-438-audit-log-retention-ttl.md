# ADR-438 — Audit Log Retention / TTL Policy (Πολιτική Διατήρησης Audit Logs)

- **Status**: v3 IMPLEMENTED — τριών-tier retention/delivery **DONE**· code-side bug που έσβηνε σιωπηλά τα `expiresAt`/`timestamp` (§0) **FIXED** (`isPlainObject` guard)· dedup **opt-in ανά call site** (§2.5) **DONE**· `floorplans/process` → `data_updated` **DONE**· GCP-side TTL policy **ΑΚΟΜΑ ΟΧΙ enabled — η μοναδική εναπομένουσα ενέργεια** (verified 2026-07-20)
- **Date**: 2026-06-10 (v1) · 2026-07-20 (v2 — τριών-tier αναθεώρηση) · **2026-07-20 (v3 — dedup opt-in)**
- **Authors**: Opus (research + implementation), Giorgio (product owner)
- **Domain**: Security / Audit (RFC v6 authorization-rbac)
- **Retention window**: **τρία tiers** — security 24 μήνες, compliance 12 μήνες, access 1 μήνας (βλ. §2)
- **Επόμενο ελεύθερο ADR μετά**: ADR-439
- **Σχετικά ADR**: ADR-065 (audit extraction / SRP), ADR-210 (document-id-generation + audit), ADR-195 (entity-audit-trail — ξεχωριστό σύστημα), ADR-259D (access-denied Sentry capture)

---

## 0. ⚠️ Διόρθωση status (2026-07-20) — διαβάστε πρώτα αυτό

Το v1 του παρόντος ADR έγραφε **«Status: IN PROGRESS (code DONE· pending GCP-side TTL enable)»**.
Αυτό ήταν διπλά ανακριβές — όχι μόνο ως προς το «pending», αλλά ως προς το ίδιο το **«code DONE»**.

### Δύο ανεξάρτητα σφάλματα, όχι ένα

Μέχρι σήμερα η πραγματική διατήρηση των audit logs ήταν **άπειρη** για ΔΥΟ ανεξάρτητους λόγους — ο καθένας
αρκετός από μόνος του για να ακυρώσει το retention, χωρίς τον άλλον:

**(α) Code-side — το `expiresAt` δεν γραφόταν ΠΟΤΕ στο document.** Η `removeUndefinedValues()` στο
`src/lib/auth/audit-core.ts` αναδρομούσε σε κάθε τιμή με `typeof value === 'object'` και πετούσε κάθε
κλειδί του οποίου η αναδρομή έδινε άδειο αντικείμενο. Τα `Date` instances και τα
`FieldValue.serverTimestamp()` sentinels δεν έχουν own enumerable properties —
`Object.entries(new Date())` → `[]` — άρα **ΚΑΙ το `expiresAt` ΚΑΙ το `timestamp`** αφαιρούνταν σιωπηλά
από κάθε audit document πριν αυτό φτάσει στο Firestore. Επαληθεύτηκε 2026-07-20 εκτελώντας την πραγματική
λογική του helper πάνω στο firebase-admin του ίδιου του repo:
```
Object.entries(new Date())            = []
Object.entries(serverTimestamp())     = []
SURVIVING KEYS = [ 'companyId', 'targetId' ]
```
Live από 2026-06-10 (v1) έως 2026-07-20 (~6 εβδομάδες) — δηλαδή σε **κανένα** audit document αυτής της
περιόδου δεν υπήρχε πραγματικά πεδίο `expiresAt` για να το δει ένα TTL policy, όποιο κι αν ήταν το GCP config.

**(β) GCP-side — το TTL policy δεν ενεργοποιήθηκε ποτέ.**

```bash
$ gcloud firestore fields ttls list --project=pagonis-87766
Listed 0 items.
```

Μηδέν. Όχι «pending merge», όχι «σε εξέλιξη» — **ποτέ δεν εκτελέστηκε η `gcloud firestore fields ttls update`**
από τις 2026-06-10 μέχρι σήμερα.

### Γιατί έχει σημασία ο διαχωρισμός

Προηγούμενη διατύπωση αυτού του ADR ισχυριζόταν ότι «το `expiresAt` γραφόταν κανονικά σε κάθε audit
document, αλλά τίποτα δεν το τηρούσε» — δηλαδή ότι το **μόνο** που έλειπε ήταν το GCP config, και ότι αν
κάποιος έτρεχε απλώς τη `gcloud ... ttls update` το πρόβλημα θα έκλεινε. Αυτό είναι **ψευδές**: το πεδίο δεν
υπήρχε καν μέσα στα documents (§0.α). Ενεργοποιώντας μόνο το TTL policy — αυτό που το v2 αρχικά περιέγραφε
ως τη μοναδική εναπομένουσα ενέργεια — **δεν θα άλλαζε τίποτα**· το Firestore θα έψαχνε ένα πεδίο που δεν
υπήρχε σε κανένα document.

### Η διόρθωση (2026-07-20)

Νέο type guard `isPlainObject()` στο `audit-core.ts` φιλτράρει την αναδρομή: αναδρομεί **ΜΟΝΟ** σε γνήσια
plain objects (prototype `Object.prototype` ή `null`)· `Date`, `Timestamp`, `FieldValue` sentinels,
`GeoPoint`, `DocumentReference` περνούν αυτούσια στον Admin SDK, που ξέρει να τα σειριοποιήσει. Regression
anchor: `src/lib/auth/__tests__/audit-core-persistence.test.ts` — επαληθεύει ότι το payload που φτάνει στο
`.set()` κρατά πραγματικό `Date` στο `expiresAt` (όχι `{}`).

**Lesson learned.** Ένα write path που πετάει σιωπηλά ένα πεδίο είναι αόρατο στο type checking όταν η
επιστροφή του helper (`Partial<T>` — που *σωστά* δηλώνει «μπορεί να λείπουν πεδία») γίνεται cast πίσω στον
πλήρη τύπο της εγγραφής στο σημείο κλήσης (`removeUndefinedValues(rawEntry) as PersistableAuditEntry`). Το
cast έκρυβε ακριβώς την απώλεια που ο τύπος `Partial<T>` προσπαθούσε να δηλώσει — ο compiler δεν είχε καμία
πιθανότητα να το πιάσει.

Η ενέργεια `gcloud firestore fields ttls update` (§2.3) παραμένει **ανεκτέλεστη** — αυτή είναι πλέον η
**ΜΟΝΗ** εναπομένουσα εκκρεμότητα (το code-side σφάλμα διορθώθηκε σήμερα, §0.α).

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

| Tier | Retention | Delivery | Dedup **παράθυρο** | Γιατί |
|------|-----------|----------|--------------------|-------|
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

⚠️ Η στήλη «Dedup παράθυρο» λέει **πόσο μεγάλο** είναι το παράθυρο, ΟΧΙ **αν** εφαρμόζεται. Από το v3 το
dedup είναι **opt-in ανά call site** (§2.5): χωρίς `dedupable: true`, το `access` tier δεν καταστέλλει
τίποτα. Το `0` στα blocking tiers σημαίνει «απαγορεύεται ακόμη κι αν ζητηθεί».

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

### 2.5 Dedup — **opt-in ανά call site** (v3)

```ts
export function resolveDedupWindowMs(action: AuditAction, dedupable: boolean | undefined): number
export function shouldSuppressDuplicate(key: string, windowMs: number, now: number): boolean
```

**Ο κανόνας**: το tier ορίζει **πόσο μεγάλο** είναι το παράθυρο· το call site ορίζει **αν** εφαρμόζεται,
μέσω `options.dedupable` στο `logAuditEvent`. Προεπιλογή `false` ⇒ **καμία καταστολή**.

Στο v2 το dedup ήταν καθολικό ανά tier — κάθε `data_accessed` καταστελλόταν αυτόματα. Αυτό ήταν λάθος,
για τον λόγο που τεκμηριωνόταν ήδη ως ανοιχτό ζήτημα στο §3: το κλειδί είναι
`companyId|actorId|action|targetId|path`, και σε endpoints όπως το `/api/search` **και τα πέντε
συστατικά είναι σταθερά ανά χρήστη**. Η διακριτική πληροφορία (query, resultCount) ζει στο
`newValue`/`reason`, **εκτός κλειδιού**. Άρα 20 διαφορετικές αναζητήσεις σε 5 λεπτά → **1 γραμμή**:
απώλεια τηλεμετρίας, όχι καταστολή διπλότυπων.

⚠️ Η προφανής «διόρθωση» — να μπει το `reason` στο κλειδί — είναι **λάθος**: το `reason` περιέχει
`duration ms`, άρα είναι πάντα μοναδικό, άρα το dedup θα γινόταν σιωπηλά **νεκρό παντού**.

**Δύο φρουροί, όχι ένας.** Ακόμη κι αν κάποιος γράψει `dedupable: true` σε security/compliance action,
το `dedupWindowMs: 0` του tier το ακυρώνει (`resolveDedupWindowMs` → `0`). Μια γραμμή forensics **δεν
μπορεί** να καταπιεί από λάθος σε call site. Καλύπτεται από ρητά tests.

**Η απόφαση ανά call site** (και τα 5 εναπομείναντα `data_accessed`):

| Call site | `dedupable` | Γιατί |
|---|---|---|
| `api/search` | ❌ **όχι** | κάθε αναζήτηση = διακριτό γεγονός· η διαφορά ζει εκτός κλειδιού |
| `financial-intelligence/portfolio` | ✅ ναι | idempotent refresh cached aggregate |
| `admin/role-management/users` | ✅ ναι | idempotent listing σε κάθε mount/refresh του πάνελ |
| `projects/[projectId]/customers` | ✅ ναι | idempotent listing· το `projectId` ΕΙΝΑΙ στο κλειδί |
| `v2/projects/[projectId]/customers` | ✅ ναι | ίδια απόφαση· το `/api/v2/` στο `path` το ξεχωρίζει από το v1 |

Ο μηχανισμός καταστολής παραμένει ο ίδιος: in-memory `Map<string, number>` (κλειδί → τελευταία εγγραφή
σε epoch ms), module-level. `windowMs === 0` επιστρέφει πάντα `false`. Bounded στα 5.000 entries: όταν
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
- ✅ Ίδιος χρήστης/στόχος/διαδρομή μέσα σε 5 λεπτά → μία γραμμή αντί για N — **μόνο στα 4 call sites που
  το δήλωσαν ρητά** (§2.5). Όπου δεν δηλώθηκε, κάθε κλήση γράφεται.
- ⚠️ **Το TTL policy δεν είναι ενεργό στο GCP (§0).** Το code-side σφάλμα (§0.α) διορθώθηκε σήμερα — το
  `expiresAt` γράφεται πλέον πραγματικά, με πραγματική τιμή, σε κάθε νέο document. Όμως μέχρι να τρέξει η
  `gcloud firestore fields ttls update` ×2, δεν υπάρχει κανείς να διαβάσει αυτό το πεδίο και να ενεργήσει
  πάνω του — η πραγματική διατήρηση παραμένει άπειρη σε production. Αυτή είναι πλέον η **μοναδική**
  εναπομένουσα εκκρεμότητα του ADR-438.
- ⚠️ **Το dedup είναι per-instance, in-memory.** Σε serverless deploy με N ζεστά instances, ο ίδιος χρήστης
  που χτυπάει το ίδιο endpoint μέσα στο ίδιο 5λεπτο παράθυρο μπορεί να παράγει έως N αντίγραφα (ένα ανά
  instance που τον εξυπηρέτησε) — όχι μηδέν. Αποδεκτό γιατί το access telemetry ανέχεται διπλότυπα εξ
  ορισμού· απλά να είναι γνωστό, όχι να θεωρηθεί εγγύηση single-copy.
- ⚠️ **Το async delivery μπορεί να χάσει ένα event.** Αν το instance τερματιστεί (cold shutdown, crash) ενώ
  το fire-and-forget write είναι ακόμη in-flight, η γραμμή `data_accessed` χάνεται σιωπηλά — δεν υπάρχει
  retry. Αυτό είναι το ρητά αποδεκτό trade-off για να μην μπλοκάρει κανένα read· ακριβώς γι' αυτό τα tiers
  `security` και `compliance` **παραμένουν blocking** — αυτά δεν μπορούν να ανεχθούν απώλεια.
- ✅ **ΛΥΘΗΚΕ (v3) — ήταν: «το dedup key αγνοεί το περιεχόμενο σε 3 endpoints».** Το v2 το κατέγραφε εδώ
  ως γνωστό ανοιχτό θέμα: το κλειδί `companyId|actorId|action|targetId|path` είναι **σταθερό ανά χρήστη**
  στο `api/search`, ενώ η διαφοροποίηση (search query, resultCount) ζει στο `newValue`/`reason` — εκτός
  κλειδιού. Άρα 20 διαφορετικές αναζητήσεις σε 5 λεπτά παρήγαγαν **μία** γραμμή: πραγματική απώλεια
  τηλεμετρίας, όχι καταστολή διπλοτύπων. **Λύση**: το dedup έγινε **opt-in ανά call site** (§2.5) αντί
  για καθολικό ανά tier. Το `api/search` δεν το δηλώνει ⇒ κάθε αναζήτηση καταγράφεται· τα idempotent
  listings/pollings το δηλώνουν ⇒ κρατούν το όφελος όγκου. Ο πυρήνας δεν αποφασίζει πλέον εκ μέρους του
  call site ποια πληροφορία είναι περιττή.
- ⚠️ **Το opt-in έχει αντίστροφο κόστος: σιωπηλή αδράνεια.** Νέο `data_accessed` call site που ξεχνά το
  `dedupable: true` δεν σπάει — απλώς γράφει περισσότερες γραμμές από όσες χρειάζεται. **Σκόπιμο**: η
  προεπιλογή αστοχεί προς «κρατάω παραπάνω τηλεμετρία», όχι προς «χάνω σιωπηλά γεγονότα». Η αντίστροφη
  προεπιλογή ήταν ακριβώς το σφάλμα του v2. Δεν υπάρχει (και δεν θέλουμε) lint/hook που να το επιβάλλει.
- ⚠️ **Το `shouldSuppressDuplicate` μαρκάρει το κλειδί ΠΡΙΝ επιχειρηθεί το write.** Η
  `dedupSeen.set(key, now)` (§2.5) τρέχει συγχρονισμένα μέσα στο `shouldSuppressDuplicate`, πριν
  κληθεί καν το async `persistAuditEntry()`. Αν εκείνο το write αποτύχει ή χαθεί (βλ. προηγούμενο bullet),
  το κλειδί παραμένει «μαρκαρισμένο ως πρόσφατα γραμμένο» για ολόκληρο το παράθυρο — τυφλώνοντας το
  σε επόμενες, πραγματικές προσβάσεις μέσα στα ίδια 5 λεπτά, παρότι τίποτα δεν γράφτηκε τελικά.
- ✅ **ΔΙΟΡΘΩΘΗΚΕ (v3) — ήταν: «το `floorplans/process` έχει λάθος ετικέτα».** Είναι `POST` route που
  **μεταλλάσσει** δεδομένα (γράφει `processedData` + `processingStatus: 'done'`) αλλά καταγραφόταν ως
  `data_accessed`, κληρονομώντας 1μηνο retention + lossy async delivery για ένα business γεγονός.
  Πλέον `data_updated` ⇒ compliance tier: 12 μήνες, blocking, ποτέ dedup. Προϋπήρχε του v2· απέκτησε
  συνέπειες μόνο όταν το tiering έδεσε τη σημασία της ετικέτας με το retention.
- ⚠️ **Τα 4 σημεία `data_accessed` στο `projects/list` και `projects/by-company/[companyId]` αφαιρέθηκαν
  οριστικά** (cache-hit branch + post-Firestore branch, και στα δύο routes) αντί να μεταναστεύσουν στο νέο
  tiering. Αυτή η read-activity δεν είναι πλέον ανακτήσιμη· δεν υπάρχει ιστορικό γι' αυτά τα reads μετά την
  αφαίρεση. Τα υπόλοιπα 6 ευαίσθητα `data_accessed` σημεία (search, financial-intelligence portfolio,
  floorplans process, projects customers ×2, role-management users) κληρονόμησαν αυτόματα async delivery
  + 1 μήνα retention από τον πυρήνα, χωρίς αλλαγή στο call site — αυτός ήταν κι ο λόγος που το tiering
  μπήκε στον πυρήνα (`audit-core.ts`). **v3**: το ένα από τα έξι (`floorplans/process`) έγινε
  `data_updated` (mutating POST), και τα υπόλοιπα πέντε δηλώνουν πλέον ρητά `dedupable` — γιατί το
  *retention* και το *delivery* παράγονται σωστά από τον τύπο του action, αλλά το «διαδοχικές ταυτόσημες
  κλήσεις εδώ δεν προσθέτουν πληροφορία» είναι γνώση **του endpoint**, όχι του action (§2.5).
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
- **2026-07-20** — **Root-cause correction (post-review), το ΠΡΑΓΜΑΤΙΚΟ σημαντικότερο εύρημα της ημέρας.**
  Adversarial review αμφισβήτησε την §0 του v2 και βρήκε ότι το ADR είχε λάθος διάγνωση: δεν έφταιγε ΜΟΝΟ
  το GCP config. Η `removeUndefinedValues()` στο `audit-core.ts` αναδρομούσε σε ό,τι είχε
  `typeof value === 'object'` και πετούσε `Date`/`FieldValue.serverTimestamp()` sentinels σαν να ήταν
  κενά αντικείμενα (`Object.entries(new Date()) === []`) — άρα **τόσο το `expiresAt` όσο και το
  `timestamp`** έλειπαν σιωπηλά από κάθε audit document που γράφτηκε από τις 2026-06-10 έως σήμερα. Δύο
  ανεξάρτητα σφάλματα λοιπόν (code + GCP config), όχι ένα — βλ. §0 αναλυτικά. **Fix**: νέο
  `isPlainObject()` type guard στο `audit-core.ts` που αναδρομεί μόνο σε γνήσια plain objects· regression
  anchor `src/lib/auth/__tests__/audit-core-persistence.test.ts`. Το §0 ξαναγράφτηκε ώστε να μην αποδίδει
  πλέον το πρόβλημα αποκλειστικά στο GCP config, και το §3 (Consequences) ενημερώθηκε αντίστοιχα. Η
  review επιβεβαίωσε επίσης ότι δύο άλλοι ισχυρισμοί του ADR ήταν **σωστοί** παρά την αντίρρηση: «4 call
  sites σε 2 route files» (τα 2 στο `projects/list` committed ως `55653212`, τα 2 στο
  `projects/by-company/[companyId]` uncommitted στο ίδιο working tree) και «6 υπόλοιπα ευαίσθητα
  `data_accessed` σημεία» (επαληθεύτηκε με grep: search, financial-intelligence/portfolio,
  floorplans/process, `projects/[projectId]/customers`, `v2/projects/[projectId]/customers`,
  admin/role-management/users). (Opus, adversarial review + fix)
- **2026-07-20** — **v3: dedup opt-in ανά call site** — κλείνει το ανοιχτό 🔴 ζήτημα που το v2 είχε
  καταγράψει στο §3 (το dedup key αγνοεί το περιεχόμενο ⇒ το `/api/search` έχανε τηλεμετρία).
  - `audit-policy.ts`: νέα `resolveDedupWindowMs(action, dedupable)` — **ο μοναδικός τόπος** όπου
    συναντιούνται η δήλωση του call site και η πολιτική του tier. Χωρίς `dedupable: true` → `0`.
    Διπλός φρουρός: `dedupable: true` σε security/compliance παραμένει `0` (το tier υπερισχύει).
  - `audit-core.ts`: νέο `options.dedupable?: boolean` (default `false`) στο `logAuditEvent`· το gate
    διαβάζει πλέον `resolveDedupWindowMs(...)` αντί για `policy.dedupWindowMs`.
  - `audit.ts` + `index.ts`: barrel export της `resolveDedupWindowMs`.
  - Call sites: `dedupable: true` σε `financial-intelligence/portfolio`, `admin/role-management/users`,
    `projects/[projectId]/customers`, `v2/projects/[projectId]/customers` (idempotent listings/polling)·
    **σκόπιμα ΧΩΡΙΣ** σε `api/search` (κάθε αναζήτηση = διακριτό γεγονός), με σχόλιο στο call site
    ώστε να μην «διορθωθεί» από κάποιον που δεν ξέρει το ιστορικό.
  - `floorplans/process`: `data_accessed` → **`data_updated`** (mutating POST — έγραφε
    `processingStatus: 'done'` ενώ καταγραφόταν ως ανάγνωση). Κλείνει το 🟡 #3 του handoff.
  - Tests: +10 (47 συνολικά, όλα πράσινα). `audit-policy.test.ts` +6 για την `resolveDedupWindowMs`
    (συμπερ. καθολικό δίχτυ πλήθους πάνω σε ΟΛΑ τα actions)· `audit-core-persistence.test.ts` +4
    **observable write-count** tests μέσα από το public API (πόσα documents φτάνουν πράγματι στο
    `.set()`), γιατί ένα regression που καλεί σωστά τη συνάρτηση αλλά αγνοεί το αποτέλεσμα θα περνούσε
    από τα unit tests. Επαληθεύτηκε ότι δαγκώνουν: με τον κανόνα αναιρεμένο → **4 κόκκινα**.
  - **Δεν** έγινε: #4 (το dedup σφραγίζει το κλειδί πριν το write) και #5 (eviction `clear()`,
    stateful export στο barrel) — παραμένουν ανοιχτά, βλ. §3. (Opus)
