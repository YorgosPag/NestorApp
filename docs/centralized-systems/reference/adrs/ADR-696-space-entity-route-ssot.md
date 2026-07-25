# ADR-696 — Building-Space Entity Route SSoT (`/api/parking/[id]`, `/api/storages/[id]`)

**Status**: Accepted
**Date**: 2026-07-25
**Σχετικά**: ADR-184 (Building Spaces Tabs), ADR-233 (Entity coding), ADR-239 (Entity linking), ADR-247 F-4 (allocationCode cascade), ADR-281 (Soft-delete), ADR-294 (SSoT Ratchet), ADR-584 (jscpd), ADR-602 (API Route-Handler Factory), SPEC-256A (Version-checked writes)

---

## 1. Context

`jscpd` (N.18 / CHECK 3.28) έδειξε **εννέα** clone blocks (~750 tokens) ανάμεσα σε
`src/app/api/parking/[id]/route.ts` (246 γρ.) και `src/app/api/storages/[id]/route.ts` (238 γρ.):

```
imports (94t) · zod schema (61t + 102t) · withAuth wrapper (61t) · doc read + parse (55t)
· updateData build (115t) · allocationCode cascade (68t) · DELETE handler (87t)
```

Ήταν **δομικά δίδυμα**: ίδιο pipeline (tenant guard → doc read → schema parse →
updateData → `withVersionCheck` → allocationCode cascade → `linkEntity` → audit → envelope),
ίδια permissions (`units:units:update/delete/view`), ίδιο rate tier. Διέφεραν **μόνο** σε
δηλωτικά δεδομένα: collection, tenant guard, display field (`number` vs `name`), labels,
και 3-4 entity-specific πεδία.

Το ότι ανήκουν στην ίδια οικογένεια δεν είναι δική μου ερμηνεία — ο κώδικας ήδη τα
μεταχειρίζεται ως αδέρφια: `propagateSpaceAllocationCodeChange`, `linkedSpaces`,
τα δίδυμα `requireParkingInTenant` / `requireStorageInTenant`, τα κατοπτρικά `trash` routes.

### 1.1 Υπήρχε ήδη μερικό SSoT — δεν το χρησιμοποιούσαν

Το `defineRoute` (ADR-602, `src/lib/api/define-route.ts`) καλύπτει ήδη τη σύνθεση
rate-limit → withAuth → try/catch → parse → envelope, και το χρησιμοποιούν 20+ routes.
**Κανένα από τα δύο space routes δεν είχε μεταναστεύσει.** Αυτό όμως καλύπτει μόνο το
cross-cutting μέρος· η **επιχειρησιακή** επανάληψη (updateData, cascades, audit) έμενε.

### 1.2 Μηδενική κάλυψη tests

Κανένα test δεν άγγιζε αυτά τα δύο production auth routes πριν από αυτό το ADR.

---

## 2. Decision

**`src/lib/api/space-entity-route.ts`** — `createSpaceEntityRoutes(config)` επιστρέφει
`{ PATCH, DELETE, GET }`. **Σύνθεση, όχι επανυλοποίηση**: κάθε primitive μένει εκεί που ζει
(`withStandardRateLimit`, `withAuth`, `safeParseBody`, `withVersionCheck`, `softDelete`,
`linkEntity`, `propagateSpaceAllocationCodeChange`, `logAuditEvent`, `ApiError`/`apiSuccess`).

**`src/lib/api/space-entity-fields.ts`** — το **καθαρό** μέρος (zod κοινό σχήμα +
`mapCommonSpaceFields` + `resolveAllocationCodeChange`), σκόπιμα **χωριστό αρχείο**:
το route module είναι `server-only` και τραβά το Next/Firebase-Admin graph, που κάνει
την καθαρή λογική **μη-testable** σε απλό jest περιβάλλον (`ReferenceError: Request is not defined`).

### 2.1 Το wire contract είναι ΠΑΓΩΜΕΝΟ

Τα `message` strings, τα status codes και τα audit payload shapes περνούν **αυτούσια**
ανά entity (`SpaceEntityMessages`) αντί να παράγονται με template. Λόγος: τα δύο routes
**δεν ήταν συνεπή μεταξύ τους** —

| | parking | storages |
|---|---|---|
| 400 | `'Parking spot ID is required'` | `'Storage ID is required'` ← όχι «Storage unit» |
| logger | `'Error updating parking spot'` | `'Error updating storage'` ← όχι «storage unit» |
| message | `'Parking spot updated'` | `'Storage unit updated'` |

Η κεντρικοποίηση **δεν επιτρέπεται** να ξαναγράψει σιωπηλά ό,τι λαμβάνουν ήδη οι clients
(ίδια αρχή με το ADR-602: «byte-identical envelope»). Η ασυνέπεια είναι πλέον **δηλωμένο
δεδομένο** αντί για κρυφό copy-paste drift — ορατή και διορθώσιμη όποτε αποφασιστεί.

### 2.2 Permissions είναι σταθερές, όχι config

`units:units:update` / `:delete` / `:view` είναι hard-coded στο factory. Και τα δύο space
entities ζουν κάτω από το ίδιο RBAC resource· απόκλιση εκεί θα ήταν **απόφαση ασφαλείας**,
όχι ρύθμιση, και πρέπει να γίνει ρητά.

### 2.3 Σημασιολογία πεδίων που ΔΕΝ επιτρέπεται να μετακινηθεί

Ένα Firestore write path που αλλάζει τον χειρισμό `undefined` / `null` / `''`
**διαφθείρει έγγραφα σιωπηλά** αντί να αποτύχει θορυβωδώς. Κλειδώθηκε:

- `undefined` = «δεν δόθηκε» → το κλειδί παραλείπεται, η αποθηκευμένη τιμή μένει ανέπαφη.
- ρητό `null` ή κενό string → γράφεται `null`.
- display field / `type` / `status` → **truthy** guard: κενό αγνοείται, δεν μηδενίζεται.
- `area` / `price` → `0` είναι έγκυρο (falsy αλλά σωστό)· μη-αριθμός → `null`.

Το `floor` κανονικοποιούνταν με **δύο διαφορετικές γραφές** στα δύο routes· επαληθεύτηκε
ότι είναι **σημασιολογικά ταυτόσημες** σε όλες τις εισόδους (number / string / blank / null)
πριν ενοποιηθούν.

### 2.4 Μία μοναδική χοάνη σφαλμάτων

Το `ConflictError` (SPEC-256A) πιάνεται τώρα και για τα **δύο** ρήματα. Το DELETE δεν κάνει
version check άρα δεν μπορεί να το σηκώσει — ο κλάδος είναι **αδρανής** εκεί. Μία χοάνη που
δεν μπορεί να αποκλίνει είναι ασφαλέστερη από δύο που μπορούν.

---

## 3. Consequences

### Θετικά
- `parking/[id]`: **246 → 71** γρ. · `storages/[id]`: **238 → 65** γρ.
- Νέο space entity = ~60 γραμμές config, όχι 240 γραμμές αντιγραφής.
- Πρώτη κάλυψη tests σε αυτό το write path (**25 tests**).
- Μια αλλαγή στο pipeline (π.χ. νέο audit πεδίο) πάει σε **ένα** σημείο.

### Όρια
- Τα `route.ts` list/create (`/api/parking`, `/api/storages`, 298/291 γρ.) **δεν** μεταφέρθηκαν —
  έχουν μόνο 2 μικρά clones (schema shapes), όχι κοινό pipeline. Ξεχωριστή δουλειά.
- Τα `trash/` δίδυμα δεν εξετάστηκαν σε αυτόν τον κύκλο.
- Το factory **δεν** χτίστηκε πάνω στο `defineRoute` (ADR-602). Συνθέτει τα ίδια primitives
  απευθείας, γιατί το `defineRoute` δεν εκθέτει το «guard + load existing doc» prologue που
  χρειάζονται και τα δύο ρήματα. ⚠️ Πιθανή μελλοντική ευθυγράμμιση.

---

## 4. File impacts

### Νέα
- `src/lib/api/space-entity-route.ts` (369 γρ.) — handler factory (`server-only`)
- `src/lib/api/space-entity-fields.ts` (118 γρ.) — καθαρό schema + field mapping
- `src/lib/api/__tests__/space-entity-route-fields.test.ts` — 25 regression anchors

### Modified
- `src/app/api/parking/[id]/route.ts` (246 → 71)
- `src/app/api/storages/[id]/route.ts` (238 → 65)
- `.ssot-registry.json` — νέο module `space-entity-route`

---

## 5. Verification

| Έλεγχος | Αποτέλεσμα |
|---|---|
| `npx jest src/lib/api/__tests__` | ✅ 49/49 (25 νέα + 24 `define-route`) |
| `npm run jscpd:diff` (4 αρχεία) | ✅ καθαρό — 3 γύροι μέχρι το μηδέν |
| `npm run test:registry-golden` | ✅ |

**Δεν έτρεξε `tsc`** — απαγορεύεται σε πράκτορες (N.17).

⚠️ **ΔΕΝ επαληθεύτηκε runtime.** Δεν έγινε κλήση στα endpoints. Η ισοδυναμία τεκμηριώνεται
από ανάγνωση γραμμή-προς-γραμμή + τα 25 unit tests στο μέρος που μπορεί να απομονωθεί
(field mapping / cascade trigger). Το factory wiring (wrappers, audit, envelope) στηρίζεται
σε επιθεώρηση. **Συνιστάται smoke test** σε ένα PATCH + DELETE ανά entity πριν το production.

### Ο ίδιος ο έλεγχος N.18 έπιασε 3 γύρους δικών μου sibling clones
1. τα δύο zod schemas (→ `SPACE_COMMON_UPDATE_FIELDS`)
2. το `guard + load` prologue PATCH/DELETE (→ `guardAndLoad`)
3. ο σκελετός mutation handler (→ `buildMutationHandler`)

Απόδειξη ότι το CHECK 3.28 δουλεύει ακριβώς όπως προβλέπει το ADR-584: πιάνει
structural clones **εντός ενός diff**, ανεξάρτητα ονόματος.

---

## 6. Changelog

| Date | Change |
|---|---|
| 2026-07-25 | Initial. 9 clone blocks → `createSpaceEntityRoutes` + καθαρό field module· 484 → 136 γρ. στα routes· 25 πρώτα tests· καταχώρηση στο `.ssot-registry.json`. |
