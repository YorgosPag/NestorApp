# ADR-218: Firestore Timestamp Conversion Centralization

| Field       | Value                              |
|-------------|-------------------------------------|
| **ID**      | ADR-218                             |
| **Status**  | Implemented                         |
| **Created** | 2026-03-12                          |
| **Author**  | Claude (pair programming session)   |
| **Scope**   | Cross-cutting (all Firestore reads) |

## Context

Audit identified **80+ scattered occurrences** of Firestore Timestamp→Date/String conversions across 19+ files. Multiple local helper functions (`getTimestampString`, `toISOString`, `toDateString`, `extractDateString`, `toISOStringOrPassthrough`, `formatTimestamp`) duplicated the same logic that already existed in `normalizeToDate()` at `src/lib/date-local.ts`.

Additionally, `chunkArray()` in `firestore-query.service.ts` was a duplicate of the centralized version in `src/lib/array-utils.ts`.

## Decision

Extend `date-local.ts` with three new functions and eliminate all scattered duplicates:

### New Functions (Single Source of Truth)

```typescript
// src/lib/date-local.ts

/** Timestamp/Date/string/number → ISO string, or null */
export function normalizeToISO(val: unknown): string | null;

/** Extract Firestore field as ISO — for converters/services */
export function fieldToISO(data: Record<string, unknown>, field: string, fallback?: string): string;

/** Extract timestamp from nested object path (e.g., "audit.createdAt") */
export function getNestedTimestampISO(data: Record<string, unknown>, path: string): string;
```

### Τρέχον API του millis funnel (μετά την Phase 4, 2026-07-29)

> ⚠️ Ο κώδικας είναι η αλήθεια. Αν αυτό το μπλοκ αποκλίνει από το
> `src/lib/date-local.ts`, **ο κώδικας έχει δίκιο** — ενημέρωσε το ADR.

**Τρία ερωτήματα, τρία API.** Η επιλογή γίνεται από το *τι ρωτάς*, όχι από το τι
τύπο βολεύει:

```typescript
// Α. «Ποιο είναι πρώτο;» — ΤΑΞΙΝΟΜΗΣΗ.
//    Δεν παίρνεις αριθμό ⇒ δεν υπάρχει sentinel να διαρρεύσει σε αριθμητική.
//    NULLS LAST και στις δύο κατευθύνσεις (σύμβαση SQL).
export function compareInstantsAsc(a: unknown, b: unknown): number;
export function compareInstantsDesc(a: unknown, b: unknown): number;

// Β. «Πόσο είναι;» — ΜΕΤΡΗΣΗ. Ο compiler επιβάλλει τον χειρισμό του αγνώστου.
export function normalizeToMillisOrNull(val: unknown): number | null;

// Γ. «Πόσες μέρες;» — ΔΙΑΡΚΕΙΑ. Κλασματικό· η στρογγυλοποίηση είναι
//    πολιτική του καλούντος. `now` ενέσιμο για tests χωρίς fake timers.
export function daysSinceOrNull(val: unknown, now?: number): number | null;
export function daysUntilOrNull(val: unknown, now?: number): number | null;

export const MS_PER_DAY = 86_400_000;
```

**❌ ΚΑΤΑΡΓΗΘΗΚΕ:** `normalizeToMillis(val): number` (sentinel `0`). Το `0` **είναι
έγκυρο epoch** (1970-01-01), όχι «δεν ξέρω» — σε comparator περνούσε απαρατήρητο,
σε αριθμητική έδινε ~20.600 ημέρες. Για ταξινόμηση χρησιμοποίησε το **Α**.

**❌ ΜΗΝ γράψεις** `normalizeToDate(x)?.getTime() ?? <οτιδήποτε>` σε τοπικό helper.
Αυτό ακριβώς ήταν οι 11 κλώνοι· το `.ssot-registry.json` το μπλοκάρει πλέον όταν
ο helper λέγεται `toMs`/`tsToMs`/`toMillis`/`toEpochMs`/`normalizeCreatedAtMs`.

### Migration Summary

| Category | Files | Change |
|----------|-------|--------|
| Extended | `src/lib/date-local.ts` | +3 functions (`normalizeToISO`, `fieldToISO`, `getNestedTimestampISO`) |
| Refactored | `src/lib/firestore/utils.ts` | `asDate()` → thin wrapper over `normalizeToDate` |
| Deleted local `getTimestampString` | 4 files | Replaced with `fieldToISO` import |
| Deleted local `firestoreTimestampToISO` | 2 files | milestones + construction-phases routes |
| Deleted local `getNestedTimestamp` | 1 file | conversations/route.ts → `getNestedTimestampISO` |
| Deleted local timestamp helpers | 5 files | `toISOString`, `toDateString`, `extractDateString`, etc. |
| Replaced `.toDate().toISOString()` | 10 files | Inline patterns → `normalizeToISO` / `fieldToISO` |
| Fixed `chunkArray` duplicate | 1 file | Local definition → import from `@/lib/array-utils` |
| **Total** | **~22 files** | |

### Files Changed

**Core (extended)**:
- `src/lib/date-local.ts` — Added `normalizeToISO()`, `fieldToISO()`, `getNestedTimestampISO()`
- `src/lib/firestore/utils.ts` — `asDate()` now delegates to `normalizeToDate()`

**Migrated (getTimestampString deleted)**:
- `src/hooks/inbox/useRealtimeMessages.ts`
- `src/app/api/projects/list/route.ts`
- `src/app/api/conversations/route.ts`
- `src/app/api/conversations/[conversationId]/messages/route.ts`

**Migrated (firestoreTimestampToISO deleted)**:
- `src/app/api/buildings/[buildingId]/milestones/route.ts`
- `src/app/api/buildings/[buildingId]/construction-phases/route.ts`

**Migrated (getNestedTimestamp deleted)**:
- `src/app/api/conversations/route.ts` — replaced with centralized `getNestedTimestampISO`

**Migrated (InboxView toISOString simplified)**:
- `src/components/shared/files/InboxView.tsx`

**Migrated (.toDate().toISOString() replaced)**:
- `src/services/file-record.service.ts` (10 occurrences)
- `src/services/communications.service.ts` (4 occurrences)
- `src/services/notificationService.ts` (2 occurrences)
- `src/services/units.service.ts` (1 loop pattern)
- `src/services/opportunities.service.ts` (1 loop pattern)
- `src/services/measurements/boq-repository.ts` (1 — full function replaced)
- `src/services/contacts/ContactNameResolver.ts` (1 — method simplified)
- `src/services/ai-pipeline/shared/sender-history.ts` (1 — function simplified)
- `src/lib/firestore/converters/workspace.converter.ts` (4 occurrences)
- `src/lib/firestore/converters/association.converter.ts` (4 occurrences)
- `src/app/api/projects/bootstrap/route.ts` (full function replaced)
- `src/components/file-manager/hooks/useAllCompanyFiles.ts` (function simplified)

**Fixed duplicate**:
- `src/services/firestore/firestore-query.service.ts` — local `chunkArray` → import from `@/lib/array-utils`

**Excluded (intentionally not touched)**:
- `scripts/check-recent-messages.js` — not production code
- `recovery/lost-found/...` — archived recovery file
- `src/utils/__tests__/unit-normalizer.test.ts` — test file (mock usage, valid)

## Consequences

### Positive
- Single source of truth for timestamp conversions
- ~200 lines of duplicate code eliminated
- Consistent behavior across all Firestore reads
- Easier to add format variants in the future (e.g., `normalizeToUnix()`)

### Negative
- None significant — all changes are backward compatible

---

## Επαλήθευση σε πραγματικά δεδομένα (pre-flight πριν από κάθε push σαν την Phase 4)

Η Phase 4 **αλλάζει συμπεριφορά σε παραγωγή**: εκεί που πριν ένα `NaN` περνούσε
τους φύλακες (fail-open), τώρα η εγγραφή παραλείπεται. Το μέγεθος της αλλαγής
είναι **ερώτημα δεδομένων**, όχι κώδικα — και δεν απαντιέται με ανάγνωση του diff.

```bash
npm run firestore:timestamps:audit          # ανθρώπινη αναφορά
npm run firestore:timestamps:audit -- --json # για diff μεταξύ εκτελέσεων
npx jest scripts/__tests__/timestamp-readability.test.ts   # ο θετικός έλεγχος
```

**Τρεις κανόνες που το εργαλείο επιβάλλει στον εαυτό του:**

1. **Ο SSoT είναι ο μόνος κριτής.** Το «αναγνώσιμο» το αποφασίζει **αποκλειστικά**
   η `normalizeToMillisOrNull`. Ένας χειρόγραφος έλεγχος (`Date.parse`,
   `instanceof Timestamp`, `!isNaN`) θα μετρούσε **άλλο πράγμα** από την
   παραγωγή — ακριβώς η κίνηση που γέννησε τους 11 κλώνους.
2. **«Μη αναγνώσιμο» ≠ «αλλάζει συμπεριφορά».** Όποιος καταναλωτής έχει ήδη
   `if (!value) continue` (`detectTaskBlocked`, `detectNoProgress`) παρέλειπε
   τα falsy **και πριν**· εκεί αλλάζουν μόνο οι truthy-αλλά-άχρηστες τιμές.
   Το εργαλείο μετρά τις δύο στήλες **χωριστά** — η ενοποίησή τους θα φούσκωνε
   τον κίνδυνο του push.
3. **Το «0» αποδεικνύεται, δεν δηλώνεται.** 31 tests τρέχουν το εργαλείο πάνω σε
   γνωστά χαλασμένα δεδομένα (και τα 6 σχήματα που ο SSoT δέχεται, και τα 7 που
   απορρίπτει, και τα τρία ζωντανά σενάρια). Χωρίς αυτά, το «0 ευρήματα» θα
   σήμαινε «κανείς δεν κοίταξε» — η επαναλαμβανόμενη παγίδα των N.11/N.12.
   ⚠️ **Και τα ίδια τα tests επαληθεύτηκαν με 5 μεταλλάξεις** (παράκαμψη SSoT ⇒ 8
   κόκκινα· `??`→`||` ⇒ 3· `only-truthy`→`always` ⇒ 2· `zero`→`garbage-number` ⇒ 2·
   ευρετική ξανά case-insensitive ⇒ 1). Η δεύτερη μετάλλαξη **περνούσε αρχικά με
   28/28 πράσινα**: το test για την αλυσίδα χρησιμοποιούσε truthy σκουπίδι, όπου
   `??` και `||` συμφωνούν. Προστέθηκαν τρία tests με falsy-μη-null τιμές
   (`''`, `0`, `NaN`) — εκεί οι δύο τελεστές αποκλίνουν, και η απόκλιση
   **υπο-μετρά**: με `||` το εργαλείο θα κατέβαινε στο `createdAt`, θα το έβρισκε
   αναγνώσιμο και θα έκρυβε το πρόβλημα που η παραγωγή (`??`) βλέπει.

**Δεύτερη φάση — sweep όλων των συλλογών.** Ό,τι δεν ξέραμε να ρωτήσουμε: κάθε
πεδίο κάθε συλλογής, με χαρακτηρισμό «χρονικό» **από τα ίδια τα δεδομένα**
(≥1 τιμή που ο SSoT διάβασε) **και** ανεξάρτητο σήμα (τύπος `Timestamp`/`Date`,
ή camelCase κατάληξη `…At`/`…Date`/`…Until`). ⚠️ Η πρώτη εκδοχή της ευρετικής
ήταν case-insensitive αναζήτηση υποσυμβολοσειράς και βρήκε `elev(at)ion`,
`preload(On)Idle`, `nameAutoGener(at)ed` — με `/i` το `[A-Z]` ταιριάζει και πεζά,
οπότε το «όριο λέξης» εξαφανίζεται. Επιπλέον, το `boolean` **περνά** τη
`normalizeToDate` (`new Date(true)` = 1970-01-01T00:00:00.001Z) — ιδιοτροπία της
JS, όχι ημερομηνία· τα boolean/array πεδία αποκλείονται ρητά.

## Changelog

| Date | Change |
|------|--------|
| 2026-03-12 | Initial implementation — Phases 1-6 complete |
| 2026-03-12 | Phase 7: Added `getNestedTimestampISO`, eliminated remaining 7 duplicate functions (milestones, construction-phases, InboxView, conversations nested) |
| 2026-03-13 | **Phase 2**: Added 3 new functions (`normalizeToMillis` in date-local.ts, `normalizeToTimestamp` in firestore/utils.ts, `formatFlexibleDate` in intl-utils.ts). Migrated 22 files across 5 categories: deleted 6 local duplicate functions (~90 lines), replaced inline `.toDate()` patterns in 7 components and 6 services, replaced 2 sort helpers with `normalizeToMillis`, replaced `instanceof Timestamp` chains with `normalizeToTimestamp` in TasksRepository. Total ~180 lines boilerplate eliminated. |
| 2026-07-16 | **Phase 3 — the serialised-Timestamp gap closed; 8 regrown duplicates deleted.** `normalizeToDate` knew `toDate()` / `Date` / ISO / epoch but **not a Timestamp that has been through `JSON.stringify`** — the client SDK serialises to `{seconds,nanoseconds}`, and the Admin SDK, which has no `toJSON()` at all, leaks `{_seconds,_nanoseconds}`. Both are plain method-less objects, so they fell through to `new Date({…})` → `NaN` → `null`. **The gap is why Phase 2's de-duplication regrew**: eight consumers had each privately re-implemented this funnel, structurally identical apart from their null convention — `construction-alert-rules.toMs` (NaN), `ContactQuotesSection.timestampToDate` ('—', with its own `{_seconds}` regression test), `property-media.normalizeCreatedAtMs` (undefined), `quick-filter-predicates.tsToMs` (null), `framework-agreement-discount.toMs` (NaN), `VendorInviteSection` / `VendorNotificationDialog` / `QuoteDetailSummary` / `FrameworkAgreementFormDialog.tsToIso` / `quote-service` / `useFrameworkAgreements` (sort). These were **not workarounds around a bug** — they were correct polymorphic readers, written eight times, because their inputs genuinely arrive from two producers. When eight teams route around the SSoT, the SSoT is wrong. `normalizeToDate` now reads both serialised shapes structurally (`toDate()` still wins when present, so a live client Timestamp is unaffected); every clone deletes and calls the SSoT, each keeping its own null convention at the call site. First test suite for this module: 20 tests covering all six input shapes + the null contract of each helper. **The strict/liberal split is deliberate** (Postel): this module *reads* untrusted input and is liberal; the API boundary *writes* a contract and stays strict — see ADR-663 §4 part 5, which serialises Framework Agreements to ISO 8601 rather than let a Timestamp near `JSON.stringify`. |
| 2026-07-29 | **Phase 4 — «κάθε καλών κρατά τη δική του σύμβαση null» ΑΝΑΤΡΑΠΗΚΕ· 11 κλώνοι, 4 sentinels, 2 ζωντανά fail-open σφάλματα.** Η Phase 3 έλυσε το *σχήμα* αλλά **επικύρωσε ρητά** τη διασπορά της σημασιολογίας («each keeping its own null convention at the call site»). Αυτό ήταν λάθος, και το τίμημα μετρήθηκε: **11** τοπικοί helpers ρωτούσαν «δώσε μου millis από αυτή την άγνωστη στιγμή» με **τέσσερα** διαφορετικά «δεν ξέρω» — `NaN` (×2), `null` (×2), `undefined` (×1), `0` (×6, εκ των οποίων 2 inline στο `opening-boq-sync`). Οι ονομαστικοί φύλακες του `.ssot-registry.json` έβλεπαν **μόνο** τα κανονικά ονόματα, οπότε οι κλώνοι απλώς λέγονταν `toMs`/`tsToMs`/`toMillis` και ήταν **αόρατοι** — η παγίδα του N.12, ξανά. **ΔΥΟ ΖΩΝΤΑΝΑ ΣΦΑΛΜΑΤΑ, και τα δύο fail-OPEN** (όχι σιωπή — το αντίθετο της σιωπής): (1) `construction-alert-rules` — `daysSince` επέστρεφε `NaN`, ο φύλακας `if (days < 3) continue` δεν παρέλειπε (`NaN < 3` ≡ `false`) και **εκπεμπόταν ειδοποίηση «μπλοκαρισμένη για NaN ημέρες»** με `blockedDays: NaN` προς εγγραφή· ίδιο σε `no_progress`, και το ίδιο σχήμα υπήρχε αδιάγνωστο σε `daysUntil`/`overdueDays`. (2) `framework-agreement-discount` — `if (now < from \|\| now > until) return false` με `NaN` και στα δύο άκρα **δεν απέρριπτε ποτέ**, άρα συμφωνία με μη αναγνώσιμο `validUntil` ήταν **μονίμως ενεργή** και εφάρμοζε έκπτωση που είχε λήξει (μονοπάτι χρημάτων· `validUntil: Timestamp` χωρίς `?`, αλλά το Firestore δεν επιβάλλει τύπους — αρκεί ένα έγγραφο γραμμένο πριν υπάρξει το πεδίο). **ΑΠΟΦΑΣΗ — τρία ερωτήματα, τρία API, μηδέν διφορούμενο:** (α) *ταξινόμηση* → `compareInstantsAsc`/`compareInstantsDesc`: ο καλών **δεν παίρνει ποτέ αριθμό**, άρα δεν υπάρχει sentinel να διαρρεύσει σε αριθμητική — `NULLS LAST` και στις δύο κατευθύνσεις (σύμβαση SQL· με φθίνουσα ταυτίζεται bit-προς-bit με το παλιό `0`, και υπάρχει test που το αποδεικνύει)· (β) *μέτρηση* → `normalizeToMillisOrNull(): number \| null`, ο compiler επιβάλλει τον χειρισμό· (γ) *διάρκεια* → `daysSinceOrNull`/`daysUntilOrNull` με ενέσιμο `now` και **κλασματικό** αποτέλεσμα (η στρογγυλοποίηση είναι πολιτική του καλούντος). Το `normalizeToMillis` (sentinel `0`) **ΔΙΑΓΡΑΦΗΚΕ** — το `0` είναι έγκυρο epoch, όχι «δεν ξέρω»· και οι 5 καταναλωτές του μετανάστευσαν (4 comparators + το `BuildingRow.createdAtMs`, που έγινε `number \| null` ώστε ένα κτήριο χωρίς αναγνώσιμη ημερομηνία να μην αρπάζει το **πρώτο** γράμμα κωδικού). **ΓΙΑΤΙ ΥΠΗΡΧΑΝ ΟΙ ΚΛΩΝΟΙ — η ρίζα:** 6 από τους 11 διάβαζαν `toMillis()`, σχήμα που ο `normalizeToDate` **δεν υποστήριζε** (ήξερε `toDate()`, `Date`, `{seconds}`, `{_seconds}`, ISO, epoch). Δεν αντέγραφαν από τεμπελιά — ο SSoT δεν διάβαζε τον τύπο τους. Ο `normalizeToDate` δέχεται πλέον και `{ toMillis(): number }` (με το `toDate()` να προηγείται, ώστε ζωντανός Timestamp να μένει ανεπηρέαστος)· ως παρενέργεια, όσοι κλώνοι επέστρεφαν `0` για ISO strings / `Date` / `{seconds}` **σταματούν να χάνουν δεδομένα**. **ΠΡΑΚΤΙΚΗ ΜΕΓΑΛΩΝ ΠΑΙΧΤΩΝ (τεκμηριωμένη):** Temporal (TC39) **κατάργησε** το invalid instance — «Temporal doesn't have the concept of 'invalid date'», εκτός εύρους ⇒ `RangeError`· NodaTime `Instant` = struct χωρίς άκυρη κατάσταση, parsing ⇒ `ParseResult<T>`· `java.time` ⇒ `DateTimeParseException` + `Optional`. Το invalid-instance της Luxon είναι η **παλιά** παραχώρηση και η ίδια η τεκμηρίωσή της το περιγράφει ως «fail silently», με `Settings.throwOnInvalid` για να το σβήσεις. Απορρίφθηκε ως λύση εδώ: θα εισήγαγε νέο τύπο-περιτύλιγμα σε 11 σημεία που ανταλλάσσουν σκέτο `number`, για κέρδος που το `null` δίνει δωρεάν. **ΠΕΡΑ ΑΠΟ ΤΟΥΣ ΜΕΓΑΛΟΥΣ ΠΑΙΧΤΕΣ:** μια βιβλιοθήκη σου δίνει τη σωστή συνάρτηση — **δεν μπορεί να σε εμποδίσει να την ξαναγράψεις**· εμείς όμως ελέγχουμε όλα τα σημεία κλήσης, οπότε (i) το ταξινομικό API **δεν εκθέτει καθόλου** τον αριθμό («make illegal states unrepresentable» εφαρμοσμένο στο συγκεκριμένο σφάλμα) και (ii) προστέθηκε forbiddenPattern `function\s+(toMs\|tsToMs\|toMillis\|toEpochMs\|normalizeCreatedAtMs)\s*\(` που αγκυρώνει σε `function\s+` και **όχι** `(function\|const)`, ώστε τοπικές μεταβλητές ορίων ημερομηνιών (`const toMs = Date.parse(...)` σε BimDiagnosticsView / entity-audit-client / quarter-helpers) να μη γίνουν θόρυβος — **πιάνει 0 αρχεία σήμερα, άρα ούτε allowlist ούτε baseline: κάθε εύρημα είναι ΝΕΟΣ κλώνος**. **ΠΑΡΑΛΕΙΨΗ + ΚΑΤΑΓΡΑΦΗ, ποτέ σιωπηλή απόρριψη** (Revit journal / ArchiCAD Report): τα δύο fail-open σημεία κάνουν πλέον `logger.warn` με entityId + ωμή τιμή· ο `date-local` μένει **καθαρός** (καμία καταγραφή μέσα σε lib κανονικοποίησης — ούτε η Luxon λογκάρει). Tests: 47 στο `date-local.test.ts` (από 20), όλα mutation-relevant — το suite έπιασε ήδη ένα πραγματικό ψεγάδι (`-0` από comparator με `direction = -1`), που διορθώθηκε **στην πηγή**. **ΥΠΟΛΟΙΠΟ (καταγεγραμμένο, όχι κρυμμένο):** το `Overlay.createdAt: number` (legacy, 33 καταναλωτές στο dxf-viewer) κρατά `?? 0` σε **ΕΝΑ** τεκμηριωμένο σύνορο (`toLegacyOverlayMillis`) αντί για 3 ξαναγραμμένους αναγνώστες σχήματος· η διαπλάτυνση σε `number \| null` είναι δικό της ratchet. |
| 2026-07-29 | **Phase 4.1 — pre-flight μέτρηση σε πραγματικά δεδομένα: 0 μη αναγνώσιμες στιγμές, αποδεδειγμένα.** Η Phase 4 άλλαξε δύο ζωντανά fail-open μονοπάτια σε fail-closed, άρα το ερώτημα πριν το push δεν ήταν «είναι σωστός ο κώδικας;» αλλά «**πόσα πραγματικά έγγραφα σπάει;**» — ερώτημα δεδομένων, αναπάντητο από το diff. Νέο εργαλείο `scripts/audit-unreadable-timestamps.ts` (+ `_shared/timestamp-readability.ts`, `_shared/timestamp-sweep.ts`), **read-only**, `npm run firestore:timestamps:audit`. **ΑΠΟΤΕΛΕΣΜΑ (project `pagonis-87766`, database `(default)`, όλες οι εταιρείες, 2026-07-29):** και οι 7 στόχοι **0 μη αναγνώσιμα / 0 αλλαγές συμπεριφοράς**. Οι τέσσερις κρίσιμες συλλογές — `framework_agreements` (🔴 μονοπάτι χρημάτων), `construction_tasks`, `construction_phases`, `building_milestones` — **δεν υπάρχουν καν**: απουσιάζουν από το `listCollections()` και ο έλεγχος subcollections σε όλα τα έγγραφα όλων των ριζών δεν βρήκε ομώνυμη φωλιά. Δεδομένα υπάρχουν μόνο σε `buildings.createdAt` (1 έγγραφο, `Timestamp`) και `files.createdAt` (3 έγγραφα, 1 εντός εμβέλειας, `Timestamp`) — και τα δύο αναγνώσιμα. **ΤΡΕΙΣ ΣΧΕΔΙΑΣΤΙΚΕΣ ΑΠΟΦΑΣΕΙΣ:** (1) *Ο SSoT είναι ο μόνος κριτής* — το εργαλείο **δεν έχει** δικό του έλεγχο εγκυρότητας και δεν επιτρέπεται να αποκτήσει· η `readInstantField` καλεί `normalizeToMillisOrNull` και μόνο· το `shape` (`missing`/`null`/`empty-string`/`zero`/`garbage-string`/`garbage-number`/`unknown-shape`) **περιγράφει**, δεν κρίνει. Ένας χειρόγραφος έλεγχος θα μετρούσε άλλο πράγμα από την παραγωγή — η ίδια κίνηση που γέννησε τους 11 κλώνους. (2) *«Μη αναγνώσιμο» ≠ «αλλάζει συμπεριφορά»* — το `detectTaskBlocked`/`detectNoProgress` έχουν ήδη `if (!blockedSince) continue`, άρα missing/null/`''`/`0` παραλείπονταν **και πριν**· μόνο οι truthy-αλλά-άχρηστες τιμές αλλάζουν αποτέλεσμα (`behaviourChange: 'only-truthy'`). Το `resolveActiveFa` και το `detectMilestoneAtRisk` δεν έχουν προηγούμενο φύλακα (`'always'`), το backfill αλλάζει μόνο σειρά (`'ordering-only'`). Οι δύο στήλες μετρώνται **χωριστά** — η ενοποίησή τους θα υπερεκτιμούσε τον κίνδυνο. Τα φίλτρα εμβέλειας είναι αντίγραφα των πραγματικών φυλάκων, μαζί με το λεξικογραφικό `plannedEndDate >= today` του `detectTaskOverdue`. (3) *Το «0» αποδεικνύεται* — `scripts/__tests__/timestamp-readability.test.ts`, **31 tests, mutation-verified 5/5**: και τα 6 σχήματα που ο SSoT δέχεται (`toDate`, `toMillis`-only, `Date`, `{seconds}`, `{_seconds}`, ISO/epoch), και τα 7 που απορρίπτει, η σημασιολογία του `??` (σκουπίδι **δεν** ενεργοποιεί fallback — το `??` πιάνει μόνο null/undefined), και τα τρία ζωντανά σενάρια Α/Β/Γ. Χωρίς αυτά, το «0 ευρήματα» θα ήταν «κανείς δεν κοίταξε» — η παγίδα των N.11/N.12 για τέταρτη φορά. **Τα ίδια τα tests επαληθεύτηκαν με 5 μεταλλάξεις** και η μία **πέρασε αρχικά με 28/28 πράσινα**: η μετάλλαξη `??`→`||` στην αλυσίδα ήταν αόρατη, γιατί το test χρησιμοποιούσε **truthy** σκουπίδι, όπου οι δύο τελεστές συμφωνούν. Οι τιμές που τους ξεχωρίζουν είναι οι falsy-μη-null (`''`, `0`, `NaN`) — και η διαφορά **υπο-μετρά**: με `||` το εργαλείο θα κατέβαινε στο `createdAt`, θα το έβρισκε αναγνώσιμο και θα έκρυβε ακριβώς το έγγραφο που η παραγωγή (`??` + `if (!blockedSince)`) παραλείπει. Προστέθηκαν 3 tests· τώρα η μετάλλαξη δίνει 3 κόκκινα. **ΔΕΥΤΕΡΗ ΦΑΣΗ — sweep 33 συλλογών / 134 εγγράφων** για ό,τι δεν ξέραμε να ρωτήσουμε· ένα πεδίο χαρακτηρίζεται χρονικό μόνο με **σύζευξη** δύο σημάτων (≥1 τιμή που ο SSoT διάβασε **και** τύπος `Timestamp`/`Date` ή camelCase κατάληξη). ⚠️ **Δύο παγίδες που έπιασε η ίδια η σάρωση**: (α) η πρώτη ευρετική ήταν case-insensitive substring και έβγαλε `elev(at)ion`, `preload(On)Idle`, `nameAutoGener(at)ed` — με `/i` το `[A-Z]` ταιριάζει και πεζά, άρα το «όριο λέξης» εξαφανίζεται· (β) το `boolean` **περνά** τη `normalizeToDate` (`new Date(true)` = 1970-01-01T00:00:00.001Z), ιδιοτροπία της JS — boolean/array αποκλείονται ρητά. Και οι δύο κλειδώθηκαν με tests. Μοναδικό εύρημα του sweep: `projects.issueDate` = `''` σε 1 από 2 έργα — πεδίο φόρμας άδειας που το UI διαβάζει ως `project.issueDate \|\| ''` και **δεν** περνά από το `date-local`· **εκτός εμβέλειας Phase 4**, καταγράφεται ως πληροφορία. **ΓΙΑΤΙ ΜΕΝΕΙ ΤΟ ΕΡΓΑΛΕΙΟ:** η εφαρμογή είναι pre-production με έναν χρήστη — το σημερινό «0» σημαίνει «άδειες συλλογές», όχι «καθαρά δεδομένα». Την ημέρα που θα μπουν πραγματικές συμφωνίες-πλαίσιο, το ερώτημα επανέρχεται και η απάντηση θέλει **ξαναμέτρηση**, όχι παραπομπή σε αυτή τη γραμμή. |
