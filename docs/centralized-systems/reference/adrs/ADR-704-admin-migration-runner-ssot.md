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

## 3.2 Recognition — τι έδειξε η χαρτογράφηση (2026-07-25)

Πλήρης ανάλυση των 9 routes (Explore agent + web research state-of-the-art). **Η αρχική
υπόθεση «9 routes, κοινό pattern» ΑΝΑΤΡΑΠΗΚΕ** — ακριβώς η παγίδα ADR-698/699 που αποφύγαμε:

| Route | Πραγματικό pattern | Ετυμηγορία |
|---|---|---|
| `backfill-file-companyid` (#1) | GET/POST dispatch· cursor scan· idempotent skip· `db.batch()` flush· report· audit | 🟢 **SSoT** |
| `fix-floorplan-companyid` (#2) | Ίδιο σχήμα· lookup via floor→building→unit maps· batch chunks 400 | 🟢 **SSoT** |
| `search-backfill` (#3) | Bundle 3 ασύνδετων ops· εξωτερικό engine· **ΚΑΝΕΝΑ audit** (gap) | 🔵 ξεχωριστό split |
| `migrations/execute` (#4) | Meta-router πάνω σε ετερόκλητα migration modules | 🔵 ξεχωριστό split |
| `migrations/execute-admin` (#5) | Χωρίς dry-run/pagination· έχει self-verification step | 🔵 ξεχωριστό split |
| `force-uniform-schema` (#6) | Schema-rewrite σε `navigation`· `.update()` per-doc· **δεν καλείται από πουθενά** | 🔴 **dead/superseded** |
| `normalize-schema` (#7) | Πιο ήπια εκδοχή του #6· `.update()` per-doc· **δεν καλείται** | 🔴 **dead/superseded** |
| `radical-clean-schema` (#8) | `.delete()`+`.set()` — φτιάχτηκε επειδή τα #6/#7 απέτυχαν να καθαρίσουν legacy πεδία | 🔴 **το «τελικό» — αλλά dead** |
| `seed-parking` (#9) | Seed από static templates, ΟΧΙ backfill πεδίου | 🟠 ξεχωριστό split |

**Κρίσιμο εύρημα #6/#7/#8:** ΔΕΝ είναι 3 features — είναι **3 διαδοχικές προσπάθειες στο ίδιο
bug** (schema inconsistency στο `navigation`). Το docblock του #8 το ομολογεί. Και τα 3 **δεν
καλούνται από κανένα caller** (ούτε import ούτε HTTP `fetch` string στο `src`). Η σωστή ενέργεια
ΔΕΝ είναι ενοποίηση — είναι **deprecation/διαγραφή** (μετά από έλεγχο ποιο, αν κάποιο, χρειάζεται
να τρέξει άλλη μία φορά).

## 3.3 SSoT-first — υπάρχει ήδη μισό SSoT (N.0)

Το `src/lib/admin-batch-utils.ts` (**ADR-214 Phase 8**) έχει ήδη το **read/scan** primitive:
`processAdminBatch(queryRef, batchSize, onBatch)` — cursor pagination με `startAfter`. **Αλλά τα
backfill routes ΔΕΝ το χρησιμοποιούν** — έχουν δικά τους inline pagination loops (= το duplication
που είδε το jscpd). Λείπουν από το module: **write** primitive (batched flush), **dry-run
envelope**, **lookup-cache** helper.

---

## 4. Decision

**Επέκταση του υπάρχοντος `src/lib/admin-batch-utils.ts`** (ΟΧΙ νέος φάκελος — N.0 SSoT-first·
απαντά Q1) με τα primitives που λείπουν. **Composable building blocks + thin envelope** (layered,
απαντά Q2 — επιβεβαιωμένο από Rails/Django/Flyway + Stripe/Firestore research):

```
// ΥΠΑΡΧΕΙ (ADR-214):
processAdminBatch(queryRef, batchSize, onBatch)      // cursor scan

// ΝΕΑ primitives:
buildLookupCache(queryRef, keyField, valueField)     // thin: processAdminBatch + .select()
flushInBatches(db, updates, batchSize)               // batched writer, flush σε όριο + per-batch retry
runBackfill(ctx, { name, dryRun, steps })            // envelope: guard(ADR-703)+dry-run+audit+report+try/catch
```

Enterprise αναβαθμίσεις (από research, ως **opt-in** στο envelope):
- **Checkpoint/resumability** — persist last cursor· resume αντί να ξεκινά απ' την αρχή (το #1 σε
  μεγάλο `files` collection το χρειάζεται· σήμερα λείπει).
- **Per-batch retry** — ένα batch αποτυγχάνει, δεν πέφτει όλο το migration.

Scope μετάπτωσης SSoT: **μόνο #1 + #2**. Το `runBackfill` γίνεται διαθέσιμο και στα #3/#5 να το
υιοθετήσουν **επιλεκτικά** — όχι υποχρεωτικά (αποφυγή wrong abstraction).

### Τι ΔΕΝ ενοποιείται (τεκμηριωμένο, όχι υπόθεση)
- **#6/#7/#8** → deprecation/διαγραφή (dead code), όχι SSoT.
- **#3/#4/#5** → ατομικό split ο καθένας (extract handlers/modules), προαιρετική υιοθέτηση primitives.
- **#9** → ατομικό split (ήδη delegates σε `parking-seed-operations`).
- **`telegram/webhook`** → εκτός scope (Q4: αργότερα, ξεχωριστά).

---

## 5. Πλάνο υλοποίησης (αναθεωρημένο μετά το recognition)

- **Φ0 — Dead-code επιβεβαίωση (navigation #6/#7/#8):** git log + έλεγχος αν κάποιο πρέπει να
  ξανατρέξει. Αν superseded → **διαγραφή** (⚠️ απόφαση Giorgio — irreversible/outward-facing).
  Λύνει το CHECK 4 για 3 routes «δωρεάν».
- **Φ1 — SSoT primitives:** επέκτεινε `admin-batch-utils.ts` με `flushInBatches` +
  `buildLookupCache` + `runBackfill` (+ opt-in checkpoint/retry) + tests (Google presubmit-grade).
- **Φ2 — Μετάπτωση #1 + #2:** reference-first· χρήση των primitives → κάτω από 300, με τον
  ADR-703 guard μαζί. `jscpd:diff` καθαρό.
- **Φ3 — Ατομικό split #3/#5 (+#9):** extract handlers· προαιρετική υιοθέτηση `runBackfill` όπου
  ταιριάζει· #4 (meta-router) πιθανόν μόνο split χωρίς primitives.
- **Φ4 — Registry:** `.ssot-registry.json` + `npm run ssot:baseline` + `jscpd:baseline`.
- **Φ5 (ξεχωριστό ADR):** `telegram/webhook` handler extract.

---

## 6. Ερωτήματα — απαντήθηκαν (Giorgio 2026-07-25: «enterprise, full SSoT, ερεύνησε, καμία έκπτωση»)

- **Q1 — Πού ζει το SSoT;** → **Επέκταση `src/lib/admin-batch-utils.ts`** (υπάρχον ADR-214 SSoT· N.0 SSoT-first, όχι νέος φάκελος).
- **Q2 — Ένα envelope ή building blocks;** → **Layered — και τα δύο** (composable primitives + thin `runBackfill`), όπως Rails/Django/Flyway. Επιβεβαιωμένο από research.
- **Q3 — Μπαίνουν τα navigation στο ίδιο SSoT;** → **ΟΧΙ.** Είναι dead/superseded code (§3.2) → deprecation, όχι ενοποίηση.
- **Q4 — `telegram/webhook`;** → **Αργότερα, ξεχωριστά** (Φ5, εκτός αυτού του ADR).

### Ανοιχτό — χρειάζεται απόφαση Giorgio
- **Διαγραφή navigation #6/#7/#8** (Φ0): irreversible + outward-facing → επιβεβαίωση πριν προχωρήσω.

---

## 7. Google-level declaration

> 🚧 **TODO** — συμπληρώνεται μετά την υλοποίηση (N.7.2). Σκελετός → καμία δήλωση ακόμη.

---

## 8. Changelog

| Ημ/νία | Αλλαγή | Συγγραφέας |
|---|---|---|
| 2026-07-25 | Σκελετός (🔵 DESIGN) — recognition από την εκκρεμότητα του ADR-703· 9/10 oversized routes σε scope, `telegram/webhook` εκτός | Claude Opus 4.8 + Γιώργος Παγώνης |
