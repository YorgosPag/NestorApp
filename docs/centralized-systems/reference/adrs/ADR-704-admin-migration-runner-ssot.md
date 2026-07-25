# ADR-704 — Admin Migration-Runner SSoT: το κοινό «σάρωσε → παράγωγε → γράψε σε batch»

| | |
|---|---|
| **Κατάσταση** | 🔵 DESIGN — σκελετός· καμία γραμμή κώδικα ακόμη (Φάση 1 recognition, N.0.1) |
| **Ημερομηνία** | 2026-07-25 |
| **Συγγραφείς** | Claude Opus 4.8 + Γιώργος Παγώνης |
| **Σχετικά** | ADR-703 (ανέδειξε τα clones μέσω jscpd, αλλά δεν τα άγγιξε), ADR-702 (tenant scope), ADR-255 (SPEC-255A tenant isolation), ADR-698/699 (⚠️ παγίδα over-parameterised factory), N.7.1 (όριο 300 γρ. για API routes), N.18 (jscpd) |
| **Κατηγορία** | Admin — Data Migrations & Backfills |

---

## 1. Context

Η εκστρατεία ADR-703 (role-predicate SSoT) άγγιξε ~32 admin/navigation routes για να
αντικαταστήσει το inline `globalRole !== 'super_admin'` με `isRoleBypass()`/`bypassRoleGuard()`.
Το commit `1313d816` πέρασε **25 αρχεία** — αλλά **10 API routes μπλόκαραν στο CHECK 4**
(N.7.1: όριο **300 γραμμές** για `/api/**/route.ts`). Η αλλαγή ADR-703 πρόσθεσε **+1 net γραμμή**
(το `import { isRoleBypass }`) και έσπρωξε αρχεία που ήταν ήδη στο ή πάνω από το όριο.

### 1.1 Γιατί δεν είναι απλώς «κόψε γραμμές»

Το CHECK 3.28 (jscpd) έδειξε ότι αυτά τα routes **αντιγράφουν το ένα το άλλο** — δεν είναι
απλώς μεγάλα, είναι **δίδυμα**. Το feedback κανόνας είναι ρητός: *EXTRACT, never trim* +
*blank lines first*. Το πραγματικό χρέος είναι το copy-pasted batch-migration boilerplate,
όχι το μέγεθος καθαυτό. Το μέγεθος είναι το **σύμπτωμα**.

### 1.2 Η παγίδα που ΔΕΝ πατάμε (ADR-698/699)

Ο εύκολος δρόμος — ένα `createMigrationRoute(config)` factory με option-bag — απλώς
**μετακομίζει το clone στο config**. Το ADR-703 ήδη το απέφυγε (`bypass-role-guard.ts` χωρίς
option-bag). Εδώ ισχύει το ίδιο: εξάγουμε **συμπεριφορά** (functions που καλούνται), όχι ένα
παραμετρικό template που ξαναγράφει τον έλεγχο ροής μέσα σε ένα config object.

---

## 2. Η μέτρηση — τα 10 oversized routes

| Route | Γραμμές | Όριο | Κατηγορία |
|---|---|---|---|
| `admin/telegram/webhook/route.ts` | 440 | 300 | ⛔ **ΕΚΤΟΣ SCOPE** — Telegram bot webhook, άλλο domain, δικό του split |
| `admin/backfill-file-companyid/route.ts` | 415 | 300 | 🟢 Backfill (companyId derivation) — **reference** |
| `navigation/force-uniform-schema/route.ts` | 414 | 300 | 🟡 Navigation schema cleanup |
| `admin/migrations/execute/route.ts` | 411 | 300 | 🟢 Migration executor |
| `navigation/normalize-schema/route.ts` | 398 | 300 | 🟡 Navigation schema cleanup |
| `admin/migrations/fix-floorplan-companyid/route.ts` | 387 | 300 | 🟢 Backfill (companyId derivation) |
| `admin/seed-parking/route.ts` | 385 | 300 | 🟠 Seed |
| `navigation/radical-clean-schema/route.ts` | 338 | 300 | 🟡 Navigation schema cleanup |
| `admin/search-backfill/route.ts` | 318 | 300 | 🟢 Backfill |
| `admin/migrations/execute-admin/route.ts` | 301 | 300 | 🟢 Migration executor (οριακό: +1 από ADR-703) |

**Scope = 9 routes** (🟢🟡🟠). Το `telegram/webhook` **εξαιρείται** — δεν είναι migration· θα
χρειαστεί δικό του extract (handler helpers), σε ξεχωριστό record.

### 2.1 Τα clones που μέτρησε το jscpd (δείγμα από CHECK 3.28)

| Κοινό | Αρχεία | Γραμμές/tokens |
|---|---|---|
| GET/POST dispatch wrapper | `backfill-file-companyid:77-107` ↔ `fix-floorplan-companyid:68-98` | 31 / 140 |
| `flushBatch` (batch.update + commit) | `backfill-file-companyid:274-290` ↔ `fix-floorplan-companyid:91-107` | 17 / 50 |
| catch/error block | `backfill-file-companyid:404-415` ↔ `fix-floorplan-companyid:376-387` | 12 / 55 |
| batch-loop (accounting) | `migrate-accounting-profile:94-117` ↔ `migrate-accounting-singletons:128-152` | 24 / 102 |

⚠️ **ΜΗΝ αντιγράψεις αυτούς τους αριθμούς σε συμπέρασμα** — άνοιξε ξανά με `npm run jscpd:scan`
πριν την υλοποίηση (N.11/N.12 κανόνας: το «νούμερο» μπαγιατεύει).

---

## 3. Το κοινό pattern — τι είναι ΠΡΑΓΜΑΤΙΚΑ επαναχρησιμοποιήσιμο

Από την ανάλυση του `backfill-file-companyid` (reference, 415 γρ.), τα **6 δομικά κομμάτια**:

1. **Dry-run/execute dispatch** — `GET` = dry-run, `POST` = execute· και τα δύο
   `withSensitiveRateLimit(withAuth(handler, { permissions }))`.
2. **Cursor-paginated cache builder** — `.select(field).orderBy('__name__').limit(PAGE_SIZE)`
   loop με `startAfter(lastDoc)` → `Map<id, value>`.
3. **Cursor-paginated collection scanner** — ίδιο pagination + **idempotent skip**
   (`if (data.companyId) continue;`) + orphan/missing tracking.
4. **Batched writer** — `db.batch()` + `batch.update()` + `commit()`, με flush στο `BATCH_LIMIT` (450).
5. **Report shape** — `{ dryRun, timestamp, durationMs, ...counts, errors }` (τυποποιημένο).
6. **Handler envelope** — role guard (ADR-703) + try/catch → 500 + audit log (`logMigrationExecuted`).

### 3.1 Προτεινόμενο SSoT (υπό συζήτηση)

Ένα module `src/lib/admin/migration-runner.ts` (ή `src/services/…`) που εκθέτει **συμπεριφορές**:

```
buildLookupCache(db, collection, field): Promise<Map<string,string>>
scanAndBackfill(db, collection, opts): Promise<CollectionResult>   // idempotent, cursor-paged
flushInBatches(db, updates): Promise<void>
runMigration(ctx, { dryRun, steps, name }): Promise<NextResponse>  // envelope: guard+try/catch+audit
```

Κάθε route κρατά **μόνο** τη δική του λογική (ποιο collection, ποιο field, πώς παράγεται η τιμή)
και **καλεί** τα παραπάνω. Το route πέφτει κάτω από 300 γρ. ως **παρενέργεια**, όχι ως στόχος.

**Τι ΔΕΝ εξάγεται** (μένει inline, framework-mandated):
- Τα `export const GET/POST = …` signatures (συμβόλαιο Next.js App Router).
- Τα import blocks (το jscpd τα βλέπει ως clone — false positive, N.18).

---

## 4. Decision

> 🚧 **TODO — απόφαση Giorgio.** Σκελετός· η τελική μορφή του SSoT εξαρτάται από τα Q1–Q4 (§6).

Κατεύθυνση: extract **συμπεριφοράς** (functions), ΟΧΙ option-bag factory (ADR-698/699).

### Τι ΔΕΝ θα αποφασιστεί εδώ
- Το `telegram/webhook` (άλλο domain).
- Οι 3 `navigation/*-schema` routes **ίσως** έχουν διαφορετικό pattern (schema-rewrite, όχι
  companyId-backfill) — χρειάζονται δικό τους έλεγχο πριν μπουν στο ίδιο SSoT (κίνδυνος: να τα
  χώσουμε σε λάθος αφαίρεση → ακριβώς η παγίδα ADR-698/699).

---

## 5. Πλάνο υλοποίησης (προτεινόμενες φάσεις)

- **Φ0** — Επιβεβαίωση pattern: διάβασε πλήρως τα 3 🟢 backfill routes + τα 3 🟡 navigation
  routes· επιβεβαίωσε ποια μοιράζονται πραγματικά το pattern (jscpd + χειροκίνητο).
- **Φ1** — Δημιούργησε το `migration-runner` SSoT + tests (Google presubmit-grade).
- **Φ2** — Μετέγραψε τα 🟢 backfill routes (reference-first) → κάτω από 300, ADR-703 guard μαζί.
- **Φ3** — Αξιολόγησε 🟡 navigation + 🟠 seed ξεχωριστά (μπορεί να μη χωρούν στο ίδιο SSoT).
- **Φ4** — Πρόσθεσε στο `.ssot-registry.json` + `npm run ssot:baseline` + `jscpd:baseline`.

---

## 6. Ανοιχτά ερωτήματα (απόφαση Giorgio)

- **Q1** — Πού ζει το SSoT; `src/lib/admin/migration-runner.ts` ή `src/services/migrations/`;
- **Q2** — Ένα ενιαίο `runMigration` envelope, ή μόνο τα building blocks (cache/scan/flush) και
  κάθε route κρατά το δικό του envelope; (Ισορροπία: DRY vs wrong-abstraction.)
- **Q3** — Μπαίνουν τα 3 `navigation/*-schema` στο ίδιο SSoT ή είναι διαφορετικό pattern;
- **Q4** — Το `telegram/webhook` γίνεται ξεχωριστό ADR ή απλό inline extract handler;

---

## 7. Google-level declaration

> 🚧 **TODO** — συμπληρώνεται μετά την υλοποίηση (N.7.2). Σκελετός → καμία δήλωση ακόμη.

---

## 8. Changelog

| Ημ/νία | Αλλαγή | Συγγραφέας |
|---|---|---|
| 2026-07-25 | Σκελετός (🔵 DESIGN) — recognition από την εκκρεμότητα του ADR-703· 9/10 oversized routes σε scope, `telegram/webhook` εκτός | Claude Opus 4.8 + Γιώργος Παγώνης |
