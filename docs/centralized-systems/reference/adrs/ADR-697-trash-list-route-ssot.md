# ADR-697 — Trash-List Route SSoT (`GET /api/{entity}/trash`) + Tenant Scope SSoT

**Status**: Accepted
**Date**: 2026-07-25
**Σχετικά**: ADR-226 (Deletion Guard), ADR-232 (Super-admin entities), ADR-245 (API Routes Centralization), ADR-255 (Tenant isolation), ADR-281 (SSoT Soft-Delete System), ADR-294 (SSoT Ratchet), ADR-308 (Buildings/Projects Trash), ADR-356 (Super-admin project scope), ADR-584 (jscpd Anti-Duplication), ADR-602 (API Route-Handler Factory), ADR-696 (Space Entity Route SSoT)

---

## 1. Context

### 1.1 Το εύρημα

Φρέσκια σάρωση `jscpd` (N.18 / CHECK 3.28, 2026-07-25, **2679** clones — από 2793 του
baseline) έδειξε ότι τα `trash` routes ήταν το μεγαλύτερο **πλήρες family** (όχι ζεύγος)
που έμενε ακέντρωτο:

```
399t x4   api/buildings/trash  ↔  api/projects/trash
399t x4   api/buildings/trash  ↔  api/properties/trash
399t x4   api/buildings/trash  ↔  api/storages/trash
          (+ api/parking/trash — ίδιο σχήμα, χαμηλότερο pairing λόγω sortField)
```

**Πέντε αρχεία × 79 γραμμές = 391 γραμμές**, σχεδόν byte-identical. Διέφεραν **μόνο** σε:

| | collection | response key | sortField | permission | noun |
|---|---|---|---|---|---|
| buildings | `BUILDINGS` | `buildings` | `name` | `buildings:buildings:view` | buildings |
| projects | `PROJECTS` | `projects` | `name` | `projects:projects:view` | projects |
| properties | `PROPERTIES` | `properties` | `name` | `properties:properties:view` | properties |
| parking | `PARKING_SPACES` | `parkingSpots` | `number` | `units:units:view` | parking spots |
| storages | `STORAGE` | `storages` | `name` | `units:units:view` | storage units |

### 1.2 Το ADR-281 είχε **ήδη** αποφασίσει το αντίθετο

Το ADR-281 §2 λέει ρητά: *«ENAS kentrikopoiimenos mixanismos, **oxi copy-paste ana
entity**»*. Το τήρησε για τρεις από τις τέσσερις πράξεις του κύκλου ζωής:

```
softDelete()        ✅ SSoT — soft-delete-engine.ts
restoreFromTrash()  ✅ SSoT — soft-delete-engine.ts
permanentDelete()   ✅ SSoT — soft-delete-engine.ts
ΑΝΑΓΝΩΣΗ του κάδου  ❌ copy-paste × 5 route files
```

Επιπλέον το **client** μισό είχε ήδη κεντρικοποιηθεί (`useEntityTrashState`, ADR-281 +
ADR-584): τα per-entity hooks είναι thin specs 50-70 γραμμών. Δηλαδή **και οι δύο άκρες
του σωλήνα ήταν κεντρικές — μόνο το server-side read ήταν πεντάδα αντιγράφων.**

### 1.3 SSoT audit ΠΡΙΝ τον κώδικα — τι βρέθηκε

| Ψάχτηκε | Βρέθηκε | Απόφαση |
|---|---|---|
| Route composition factory | ✅ `defineRoute` (ADR-602) — καμία trash route δεν το χρησιμοποιούσε | **Επαναχρησιμοποιήθηκε** |
| Per-entity soft-delete config | ✅ `SOFT_DELETE_CONFIG` (ADR-281) | **Επεκτάθηκε**, όχι νέο μητρώο |
| `list trashed` στο engine | ❌ δεν υπήρχε | **Προστέθηκε** ως 4η πράξη |
| Super-admin `?companyId=` list scoping | ❌ **κανένα SSoT** — 31 αρχεία το ξαναγράφουν | **Νέο SSoT** (§2.1) |
| Per-document tenant check | ✅ `tenant-isolation.ts` (ADR-255) | Άλλο ερώτημα — δεν εφαρμόζει |
| Header-switcher scoping | ✅ `super-admin-scope.ts` (ADR-356) | **Άλλη σημασιολογία** — δεν ενοποιείται (§2.1) |

---

## 2. Decision

### 2.1 `src/lib/auth/tenant-scope.ts` — ποιανού γραμμές μπορεί να διαβάσει ο καλών

Το μοτίβο που βρέθηκε σε **31 αρχεία**:

```ts
const isSuperAdmin = isRoleBypass(ctx.globalRole);
const tenantCompanyId = isSuperAdmin && queryCompanyId ? queryCompanyId : ctx.companyId;
```

Είναι μία γραμμή — γι' αυτό εξαπλώθηκε. Είναι **απόφαση ασφαλείας** — γι' αυτό δεν
επιτρέπεται να εξαπλώνεται. Μια χειροκίνητη επεξεργασία που χάνει το `isSuperAdmin &&`
μετατρέπει το `?companyId=` σε **cross-tenant data leak που διαβάζεται σαν κανονικός
κώδικας σε review**.

```ts
export function resolveTenantScope(ctx, requestedCompanyId): TenantScope
export function resolveTenantScopeFromUrl(url, ctx): TenantScope
// → { companyId, isSuperAdmin, isCrossTenant }
```

Πρακτική μεγάλων παιχτών: ο καλών **δεν παράγει μόνος του το scope του** — ζητά
resolved scope object και το δίνει στον query builder (AWS IAM request context,
Salesforce `WITH SECURITY_ENFORCED`, GitHub resource scoping).

**⚠️ ΔΥΟ ΔΟΓΜΑΤΑ SCOPING — μη τα μπερδέψεις:**

| | οδηγείται από | super admin χωρίς επιλογή |
|---|---|---|
| `resolveSuperAdminProjectScope` (ADR-356) | **header** switcher (`ctx.superAdminOverride`) | `filterCompanyId: null` → **χωρίς φίλτρο, όλα τα tenants** |
| `resolveTenantScope` (ADR-697) | **`?companyId=` query string** | πέφτει στο δικό του `ctx.companyId` |

Δεν είναι το ένα rewrite του άλλου· απαντούν **διαφορετικά ερωτήματα**. Η ενοποίησή τους
θα ήταν αλλαγή συμπεριφοράς ασφαλείας — **ΔΕΝ** γίνεται ως παρενέργεια de-duplication.

### 2.2 `listTrashed()` — η 4η πράξη, δίπλα στις άλλες τρεις

Στο `soft-delete-engine.ts` (κανονική τοποθεσία ADR-281):

```ts
export async function listTrashed(db, entityType, companyId): Promise<TrashedEntityRow[]>
```

**Γιατί sort στη μνήμη και όχι `orderBy`**: composite index `companyId + status + name`
**δεν υπάρχει**. Ένα `orderBy` στο query θα έκανε κάθε κάδο να πετάει
`FAILED_PRECONDITION` μέχρι να γίνει deploy του index. Το in-memory sort είναι η
συμπεριφορά που **ήδη** έστελναν τα 5 routes.

### 2.3 `SOFT_DELETE_CONFIG[x].trashList` — το συμβόλαιο ως δεδομένα

```ts
export interface TrashListConfig {
  responseKey: string;      // wire: {success, buildings, count}
  viewPermission: string;   // :view, ΟΧΙ :delete
  sortField: string;        // 'name' | 'number'
  labelPluralEn: string;    // σπλάισεται στο 500 message
  loggerName: string;       // τα server logs μένουν greppable
}
```

**`trashList` είναι optional και το `contact` δεν το έχει** — αυτή η απουσία *είναι* η
δήλωση ότι ο κάδος επαφών φιλτράρεται client-side και δεν έχει `/trash` endpoint.

### 2.4 `src/lib/api/trash-list-route.ts` — `createTrashListRoute(entityType)`

**Σύνθεση, όχι επανυλοποίηση:**

```
defineRoute (ADR-602)   →  rate-limit tier 'standard' + withAuth(viewPermission)
resolveTenantScope      →  ποιανού γραμμές (ασφάλεια)
listTrashed (ADR-281)   →  το Firestore read + ordering
SOFT_DELETE_CONFIG      →  το per-entity συμβόλαιο
```

Τα 5 routes γίνονται 17γραμμα declarations:

```ts
export const GET = createTrashListRoute('building');
```

**Fail-fast**: αν ζητηθεί entity χωρίς `trashList`, πετάει στο **module-evaluation time**
(build), όχι σε request time. Route που δεν πρέπει να υπάρχει σκάει στο πρώτο import.

---

## 3. Wire contract — ΠΑΓΩΜΕΝΟ σκόπιμα

| | Πριν | Μετά |
|---|---|---|
| success envelope | `{success:true, <perEntityKey>, count}` | **ίδιο** (από config) |
| 500 envelope | `{success:false, error:'Failed to fetch deleted X', details}` | **ίδιο** (από config) |
| status codes | 200 / 500 (+ auth/rate από wrappers) | **ίδιο** |

Το per-entity key **δεν** ενοποιήθηκε γιατί το `EntityTrashSpec.selectItems` στον client
ξετυλίγει ακριβώς αυτό (`response.buildings`, `response.parkingSpots`, …). Ενιαίο envelope
= **ξεχωριστό versioned rollout**, όχι παρενέργεια κεντρικοποίησης (μάθημα ADR-696 §3).

Το 500 envelope διατηρείται με **δικό του try/catch μέσα στον handler** αντί να αφεθεί
στο `defineRoute` — το `defineRoute` εκπέμπει `{success:false, error:<raw message>}` χωρίς
`details`, που **δεν** είναι byte-identical.

**Αλλαγή ΜΟΝΟ σε logs (όχι wire)**: το `properties` route είχε prefix `[Properties/Trash]`
στα log lines του, τα άλλα τέσσερα όχι. Τώρα και τα πέντε γράφουν
`Fetching deleted <noun>` / `Found deleted <noun>` / `Error fetching deleted <noun>` με
distinct `loggerName` ανά entity.

---

## 4. Ισοδυναμίες που αποδείχθηκαν (όχι «βελτιώσεις»)

1. **Νεκρή διακλάδωση**. Τα 5 routes είχαν:
   ```ts
   if (isSuperAdmin && queryCompanyId) query = query.where(COMPANY_ID,'==',queryCompanyId);
   else                                query = query.where(COMPANY_ID,'==',tenantCompanyId);
   ```
   Όταν `isSuperAdmin && queryCompanyId`, τότε `tenantCompanyId === queryCompanyId` εξ
   ορισμού → **και οι δύο κλάδοι είναι ταυτόσημοι**. Κατέρρευσε σε
   `.where(COMPANY_ID,'==',scope.companyId)`.

2. **Sort ανθεκτικό σε missing field**. `typeof value === 'string' ? value : ''` —
   γραμμές χωρίς το πεδίο πάνε πρώτες. Ήταν η υπάρχουσα συμπεριφορά, **διατηρήθηκε
   αντί να «διορθωθεί»**.

---

## 5. Boy Scout (N.0.2) — τι διορθώθηκε στη διαδρομή

1. **`TRASHED_STATUS`**: το literal `"deleted"` ήταν 6× μέσα στο `soft-delete-engine.ts`
   (+ 5× στα routes). Τώρα μία σταθερά στο `soft-delete-config.ts`.

2. **`loadLifecycleTarget()`**: το `jscpd:diff` έπιασε **προϋπάρχοντα** clones μέσα στο
   engine — ο ίδιος πρόλογος (collection lookup → existence check → tenant guard) ήταν
   γραμμένος **3×** σε `softDelete` / `restoreFromTrash` / `permanentDelete`
   (129t + 73t). Εξήχθη σε ένα helper. **Η διαφορά έγινε παράμετρος, όχι rewrite**: μόνο
   το `softDelete` περνά `isSuperAdmin` — το restore και το permanent-delete σκόπιμα
   **δεν** κάνουν ποτέ bypass, όπως έστελναν.

3. **`ApiError` import**: το engine το έπαιρνε από `@/lib/api/ApiErrorHandler`, που το
   re-exports αλλά σέρνει **ολόκληρο το `next/server`** μαζί του (→ `ReferenceError:
   Request is not defined` σε jest). Άλλαξε σε `@/lib/api/api-error-types` — το module
   που όντως το ορίζει, και αυτό που χρησιμοποιεί ήδη το `define-route.ts`.

---

## 6. Tests

| Suite | Tests | Τι κλειδώνει |
|---|---|---|
| `src/lib/auth/__tests__/tenant-scope.test.ts` | **14** | ασφάλεια: ξένο `?companyId` **αγνοείται** για κάθε non-bypass ρόλο (και για άγνωστο ρόλο); τιμάται μόνο για bypass; `''`/`undefined` = απόν |
| `src/lib/firestore/__tests__/soft-delete-trash-list.test.ts` | **18** | wire contract (5 response keys hard-coded σκόπιμα), `:view` ≠ `:delete`, sortField ανά entity, contact χωρίς κάδο, query filters, ordering, **anchor εξαντλητικότητας** |

**Anchor**: διαβάζει τα `src/app/api/*/trash/route.ts` από το filesystem, εξάγει το όρισμα
του `createTrashListRoute('X')` και απαιτεί το σύνολο να **ισούται** με το
`listTrashListableEntities()`. Άρα:
- config χωρίς route → ❌
- route χωρίς config → ❌
- trash route γραμμένο στο χέρι (χωρίς factory) → ❌

Πριν από αυτό το ADR: **μηδενική** κάλυψη tests στα 5 production auth routes.

---

## 7. Επαλήθευση

| Έλεγχος | Αποτέλεσμα |
|---|---|
| `npx jest src/lib/firestore/__tests__ src/lib/auth/__tests__ src/lib/api/__tests__ src/hooks/trash/__tests__` | ✅ **215/215** (11 suites) |
| `npm run jscpd:diff` (9 αρχεία) | ✅ καθαρό (**2ος γύρος** — ο 1ος έπιασε τα engine clones του §5.2) |
| `npm run test:registry-golden` | ✅ **96/96** (ERE έγκυρα σε real `grep -E -f`) |
| Μέτρηση false positives πριν την καταχώρηση | ✅ 3 + 2 + 3 matches, **όλα** allowlisted |
| `tsc` | ❌ **ΔΕΝ έτρεξε** — απαγορεύεται σε πράκτορες (N.17) |

### Μεγέθη (N.7.1)

| Αρχείο | Γραμμές |
|---|---|
| `soft-delete-engine.ts` | 367 (από 290, +listTrashed −3× πρόλογος) |
| `soft-delete-config.ts` | 178 (από 93) |
| `trash-list-route.ts` | 107 |
| `tenant-scope.ts` | 105 |
| 5 × `trash/route.ts` | **17 έκαστο** (από 79/75) |

**Καθαρό αποτέλεσμα**: 391 γραμμές διάσπαρτης λογικής → 85 γραμμές δηλώσεων + ένα SSoT.

---

## 8. Εκκρεμότητες που **αποκαλύφθηκαν** (δεν αγγίχθηκαν)

### 8.1 ✅ `usePropertiesTrashState.ts` — **όχι** εκκρεμότητα (τεκμηριωμένη εξαίρεση)

Κατά τη μέτρηση false positives εντοπίστηκε ότι τα 4 από τα 5 client trash hooks είναι
thin specs πάνω στο `useEntityTrashState` (50-70 γρ.), ενώ το `usePropertiesTrashState`
είναι **176 γραμμές** και δεν το χρησιμοποιεί.

**Ελέγχθηκε: είναι σκόπιμη απόφαση, όχι παράλειψη.** Το changelog του ADR-281
(2026-07-16) το δηλώνει ρητά — *«`usePropertiesTrashState` deliberately excluded
(0 clones against the quartet): different machine»*. Ο λόγος στέκει στον κώδικα:

- `useDeletionGuard('property')` pre-check πριν το permanent delete (ADR-226 — το property
  έχει τα περισσότερα blocking dependencies)
- `isDeleting` state
- `Promise.allSettled` με **3 κλάδους** partial-failure notification (vs `bulkPermanentDelete`)
- `handleRestoreProperties` **δεν κάνει restore** — θέτει μόνο selection (άλλη σημασιολογία!)

Το jscpd μετρά **0 clones** έναντι της τετράδας → **δεν υπάρχει ratchet χρέος** και δεν
προστίθεται στο `pending-ratchet-work.md`. Καταγράφεται εδώ ώστε ο επόμενος που δει το
176 vs 60 να μη «διορθώσει» μια απόφαση.

### 8.2 🟡 Το `?companyId=` scoping σε 31 αρχεία

Το `resolveTenantScope` υπάρχει τώρα, αλλά **μόνο** το trash factory το χρησιμοποιεί.
Άλλα ~30 route files εξακολουθούν να γράφουν τη γραμμή στο χέρι. Είναι ξεχωριστός
κύκλος (security-sensitive, 30 αρχεία) — **όχι** παρενέργεια αυτού.

### 8.3 🟡 Smoke test πριν production

Άλλαξαν 5 **production auth routes** χωρίς runtime επαλήθευση. Ζητούμενο: άνοιγμα κάδου
ανά entity (buildings / projects / properties / parking / storages) και έλεγχος ότι
γεμίζει. Τα tests καλύπτουν τη λογική, όχι το wiring του Next.

---

## 9. Google-level δήλωση (N.7.2)

| # | Ερώτημα | Απάντηση |
|---|---|---|
| 1 | Proactive ή reactive? | **Proactive** — το συμβόλαιο ζει ως δεδομένα, το anchor απαιτεί να συμφωνούν config και routes |
| 2 | Race condition? | **Όχι** — pure read, χωρίς state |
| 3 | Idempotent? | **Ναι** — GET |
| 4 | Belt-and-suspenders? | **Ναι** — fail-fast στο build + anchor test + 3 ratchet patterns |
| 5 | SSoT? | **Ναι** — ένα factory, ένα engine, ένα entity registry, ένα tenant-scope |
| 6 | Await ή fire-and-forget? | **Await** — το σώμα της απόκρισης |
| 7 | Ποιος κατέχει τον κύκλο ζωής? | **Ρητά**: `soft-delete-engine` τα δεδομένα, `trash-list-route` το HTTP, `SOFT_DELETE_CONFIG` το συμβόλαιο |

✅ **Google-level: ΝΑΙ** — 391 γραμμές πενταπλού αντιγράφου έγιναν ένα συνθετικό SSoT με
παγωμένο wire contract, νέο SSoT ασφαλείας για το tenant scoping, anchor που εμποδίζει
απόκλιση, και 32 tests σε κώδικα που πριν είχε **μηδέν**.

---

## 10. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-25 | **Φάση 3 — το tenant-scope υπόλοιπο έκλεισε στο [ADR-701](ADR-701-tenant-query-scope-ssot.md).** Το «31 αρχεία» αυτού του ADR ήταν υπερμέτρηση (μετρούσε κάθε `isRoleBypass()`): τα πραγματικά δίδυμα ήταν **5**, και είχαν ήδη αποκλίνει σε **δύο** συμπεριφορές. Το `resolveTenantScope` παραμένει ό,τι χρησιμοποιούν οι κάδοι· τα browse endpoints πήραν το `resolveTenantListScope` (το `all-tenants` είναι νόμιμη απάντηση) και οι admin ενέργειες το `requireTenantScope` (403, όχι σιωπηλή αλλαγή στόχου). |
| 2026-07-25 | **Δημιουργία.** Κύκλος #3 της εκστρατείας κεντρικοποίησης (μετά ADR-695, ADR-696). `createTrashListRoute` + `listTrashed` + `SOFT_DELETE_CONFIG.trashList` + `resolveTenantScope`. 5 routes → 17γραμμα declarations. Boy Scout: `TRASHED_STATUS`, `loadLifecycleTarget`, `ApiError` import. Registry module `trash-list-route` (370 modules). 32 νέα tests. |
