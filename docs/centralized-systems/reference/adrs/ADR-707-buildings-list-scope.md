# ADR-707 — Buildings list scope: ένα endpoint, **μία** ερώτηση

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED (commit `80f7dbfc`) |
| **Date** | 2026-07-26 |
| **Domain** | API · Buildings · Projects · Navigation · Floorplan import |
| **Canonical Location** | `src/app/api/buildings/buildings-list.handler.ts` (GET· εξήχθη από το `route.ts` στο ίδιο commit για το όριο 300 γρ. των API routes) |
| **Anchor** | `src/app/api/buildings/__tests__/buildings-list-scope.route.test.ts` (7 tests, mutation-verified) |
| **Related** | ADR-209 (normalized `projectId`) · ADR-233 §3.4 (`codesOnly`) · ADR-281 (soft-delete) · ADR-232/ADR-702 (tenant scoping — **διαφορετικό επίπεδο**, βλ. §6) · ADR-284 (building↔project link) |

---

## 1. Context — πώς βρέθηκε

E2E verify «Έργων», **Φάση 3** (2026-07-26, browser automation). Το test entity **PRJ-002**
(ΣΥΓΚΡΟΤΗΜΑ ΚΑΤΟΙΚΙΩΝ ΑΙΓΑΙΟΝ ΙΙ) **δεν έχει κανένα κτίριο**. Τρεις καρτέλες, τρεις απαντήσεις:

| Καρτέλα | Τι έλεγε | Πηγή |
|---|---|---|
| **Δομή Έργου** | «0 κτίρια» | `/api/projects/structure/<id>` ✅ |
| **Πίνακας Χιλιοστών** | «Δεν βρέθηκαν κτίρια συνδεδεμένα με αυτό το έργο» | δικό του query ✅ |
| **Επιμετρήσεις** | «**1 κτίριο** στο έργο» | `/api/buildings?projectId=` 🔴 |
| **Χρονοδιάγραμμα** | «Πρόοδος ανά Κτίριο: **Κτήριο Α**» | `/api/buildings?projectId=` 🔴 |

Το «Κτήριο Α» **ανήκει στο ΕΡΓΟ Α**. Απόδειξη, 2 ανεξάρτητες εκτελέσεις live API:

```
GET /api/buildings?projectId=proj_2497601f…      (PRJ-002)
→ { count: 1, buildings: [{ name: "Κτήριο Α", projectId: "proj_04a6b4bb…" }] }
                                                  ^^^^^^^^^^^^^^^^^^^^^^ ΑΛΛΟ ΕΡΓΟ

GET /api/projects/structure/proj_2497601f…
→ { summary: { buildingsCount: 0 }, buildings: [] }
```

**Δεν ήταν θέμα δεδομένων.** Δύο endpoints, δύο απαντήσεις για το ίδιο έργο, την ίδια στιγμή.

---

## 2. Ο μηχανισμός

`src/app/api/buildings/route.ts` (πριν):

```ts
const projectQuery = adminDb.collection(COLLECTIONS.BUILDINGS)
  .where(FIELDS.PROJECT_ID, '==', normalizeProjectIdForQuery(projectId));
snapshot = await projectQuery.get();

// Step 3: Fallback — many buildings have no projectId field.
// Load ALL buildings for the same companyId so the user can pick one.
if (snapshot.empty && fallbackScope.companyId) {
  snapshot = await tenantScopedCollection(COLLECTIONS.BUILDINGS, fallbackScope).get();
}
```

Το σχόλιο λέει την αλήθεια για την **πρόθεση**: «so the user can **pick** one» — δηλαδή για **picker**.
Αλλά το ίδιο endpoint σερβίρει και **aggregates**. Ένα endpoint, **δύο σημασιολογίες**:

- «δείξε μου τα κτίρια **ΤΟΥ** έργου» → η σωστή απάντηση σε άδειο έργο είναι **`[]`**
- «δώσε μου κτίρια **ΓΙΑ ΝΑ ΔΙΑΛΕΞΩ** για αυτό το έργο» → μια ευρύτερη λίστα *ίσως* βοηθά

Ο καλών δεν μπορούσε να δηλώσει ποια από τις δύο ρωτά, **ούτε** να καταλάβει ποια απαντήθηκε.
Η απόκριση ήταν **δομικά πανομοιότυπη** και στις δύο περιπτώσεις — γι' αυτό επέζησε τόσο.

### Το εύρημα του audit: **κανένας** δεν ήθελε το fallback

| Αρχείο | Τι σημαίνει για τον καλούντα | Ήθελε fallback; |
|---|---|---|
| `components/projects/tabs/ProjectMeasurementsTab.tsx:126` | aggregate «κτίρια του έργου» | ❌ |
| `components/projects/ProjectTimelineTab.tsx:75` | aggregate «πρόοδος ανά κτίριο» | ❌ |
| `components/navigation/core/services/navigationApi.ts:153` | **δέντρο πλοήγησης** | ❌ |
| `features/floorplan-import/hooks/useFloorplanImportState.ts:200` | **στόχος import κάτοψης** | ❌ |
| `components/shared/files/LinkToBuildingModal.tsx:117` | «σύνδεσε αρχείο με κτίριο **του έργου**» | ❌ |
| `subapps/dxf-viewer/components/SimpleProjectDialog.tsx:108` | έργο → κτίριο → όροφος | ❌ |
| `components/building-management/building-services.ts:355` | `codesOnly` — **επόμενος κωδικός στο έργο** | ❌ |

**7/7 θέλουν project-scoped.** Ακόμα και οι δύο «pickers» επιλέγουν *μέσα από το έργο* — κτίριο άλλου
έργου στη λίστα δεν είναι διευκόλυνση, είναι λάθος επιλογή ένα κλικ μακριά.

Το `building-services.ts:355` ήταν **δεύτερο, αθέατο bug**: `getBuildingCodesByProject` προτείνει τον
επόμενο σειριακό κωδικό («Κτήριο Α», «Κτήριο Β»…). Με το fallback, ένα **φρέσκο** έργο έβλεπε τους
κωδικούς **όλης της εταιρείας** και πρότεινε «Κτήριο Β» για το **πρώτο** του κτίριο.

---

## 3. Decision

1. **Το `?projectId=X` σημαίνει «κτίρια ΤΟΥ έργου X». Τίποτα άλλο.** Άδειο έργο → `[]`.
2. Το company-wide fallback γίνεται **opt-in**: `?fallback=company`. Κανένας καλών δεν το ζητά σήμερα·
   η διέξοδος μένει για legacy δεδομένα των οποίων τα κτίρια **δεν έχουν καθόλου** `projectId`.
3. Η απόκριση **δηλώνει ποια ερώτηση απάντησε** — νέο πεδίο `scope`:

```ts
type BuildingsListScope = 'project' | 'company-fallback' | 'tenant';
```

Το (3) είναι το σημείο που δεν έκανε ο αρχικός κώδικας και είναι ο λόγος που το ελάττωμα έζησε:
**η διφορούμενη απάντηση ήταν μη παρατηρήσιμη.** Πλέον ο καλών μπορεί να ισχυριστεί
`scope === 'project'` αντί να **εμπιστεύεται** ότι ο server εννοούσε το ίδιο πράγμα.
Επιπλέον, το fallback όταν συμβεί γράφει **`logger.warn`**, όχι `info` — δεν είναι ρουτίνα.

### Γιατί όχι σκέτη διαγραφή του fallback
Θα ήταν σιωπηλή αλλαγή συμβολαίου για δεδομένα που δεν έχω μετρήσει (κτίρια χωρίς `projectId`).
Το opt-in πετυχαίνει **το ίδιο σωστό αποτέλεσμα σήμερα** (κανείς δεν το ζητά) διατηρώντας τη
δυνατότητα **ρητή και ονομασμένη**. Αν σε 6 μήνες το `grep '?fallback=company'` βγάζει μηδέν,
τότε η διαγραφή είναι τεκμηριωμένη — όχι πριν.

### Γιατί όχι client-side έλεγχος στους 4 aggregate καλούντες
Θα αντέγραφε τον **ίδιο κανόνα σε 4 σημεία** — ακριβώς το anti-pattern που ο N.12 απαγορεύει.
Ο server είναι ο **ένας** ιδιοκτήτης της σημασιολογίας. Το `scope` υπάρχει για παρατηρησιμότητα
και για όποιον **επιλέξει** μελλοντικά το fallback.

---

## 4. Implementation

**Ένα αρχείο κώδικα.** Γράφτηκε στο `src/app/api/buildings/route.ts` και στο **ίδιο commit**
μετακινήθηκε αυτούσιο στο `buildings-list.handler.ts` (SRP split, `route.ts` 315→186 γρ.).
Το anchor πέρασε **7/7 και μετά τη μετακίνηση** — αυτό ακριβώς κάνει ένα anchor:

```ts
// 🔒 ADR-707: `?projectId=X` means "buildings OF project X" — nothing else.
const allowCompanyFallback = searchParams.get('fallback') === 'company';

let scope: BuildingsListScope = projectId ? 'project' : 'tenant';
…
if (snapshot.empty && allowCompanyFallback && fallbackScope.companyId) {
  logger.warn('[Buildings] Project matched nothing — caller opted into company-wide fallback', …);
  snapshot = await tenantScopedCollection(COLLECTIONS.BUILDINGS, fallbackScope).get();
  scope = 'company-fallback';
}
```

Το `scope` επιστρέφεται **και** στο `codesOnly` branch **και** στο κανονικό.

**Καμία αλλαγή στους 7 καλούντες** — το `scope` είναι προσθετικό πεδίο και ο καθένας δηλώνει το δικό
του στενότερο interface.

### Anchor — `buildings-list-scope.route.test.ts` (7 tests)

| Test | Τι κλειδώνει |
|---|---|
| άδειο έργο → `[]` | το ίδιο το bug· **και** ότι το company query **δεν εκδίδεται καν** |
| έργο με κτίρια → μόνο τα δικά του, `scope='project'` | δεν σπάσαμε το happy path |
| `codesOnly` σε άδειο έργο → κανένας δεσμευμένος κωδικός | το 2ο, αθέατο bug (§2) |
| `?fallback=company` → τιμάται **και δηλώνεται** `scope='company-fallback'` | η διέξοδος δουλεύει και είναι ορατή |
| `fallback=true\|1\|yes\|Company` → **off** | καμία κατά λάθος ενεργοποίηση |
| χωρίς `projectId` → `scope='tenant'` | το ADR-232/702 branch αμετάβλητο |
| soft-deleted εξαιρούνται | ADR-281 αμετάβλητο |

**Mutation-verified:** αφαίρεσα το `&& allowCompanyFallback` → **3 tests κόκκινα**· επαναφορά → **7/7 πράσινα**.
*(Το ελάττωμα είναι ένα διαγραμμένο `&&` μακριά από την επιστροφή του, και επανέρχεται **σιωπηλά** —
η απόκριση φαίνεται απολύτως υγιής. Anchor, όχι διακοσμητικό — ADR-587 §6.1.)*

---

## 5. Consequences

✅ Οι «Επιμετρήσεις» και το «Χρονοδιάγραμμα» λένε πλέον την αλήθεια για άδειο έργο.
✅ Το δέντρο πλοήγησης δεν κρεμά ξένα κτίρια κάτω από έργο.
✅ Το floorplan import δεν μπορεί να στοχεύσει κτίριο άλλου έργου.
✅ Ο επόμενος κωδικός κτιρίου φρέσκου έργου είναι ξανά «Κτήριο Α».
⚠️ Αν υπάρχουν legacy κτίρια **χωρίς** `projectId`, δεν εμφανίζονται πια σε pickers. Αυτό είναι
**σωστό** (δεν ανήκουν στο έργο) — η σύνδεση γίνεται από `ADR-284 LINK_PROJECT`. Αν χρειαστεί
μεταβατικά, ο picker προσθέτει ρητά `&fallback=company` **και** εμφανίζει ότι η λίστα είναι ευρύτερη.

---

## 6. Τι **ΔΕΝ** είναι αυτό το ADR

**Δεν** αγγίζει tenant scoping. Το `resolveTenantScopeFromUrl` / `resolveTenantListScopeFromUrl`
(ADR-702/697/356/255 — **4 δόγματα που ΠΟΤΕ δεν ενοποιούνται**) μένουν ακριβώς ως έχουν.
Εδώ πρόκειται για **entity scoping** (`projectId`), ένα επίπεδο κάτω. Το fallback **ήταν ήδη**
company-strict· το θέμα δεν ήταν ποτέ *ποιανού tenant* — ήταν *ποιανού έργου*.

---

## 7. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-26 | GET εξήχθη σε `buildings-list.handler.ts` (SRP· όριο 300 γρ. API routes). Λογική **αμετάβλητη**· anchor 7/7 πράσινο μετά τη μετακίνηση. |
| 2026-07-26 | Δημιουργία. Fallback → opt-in `?fallback=company`· νέο πεδίο `scope`· `info`→`warn` στο fallback· anchor 7 tests (mutation-verified). Βρέθηκε στο E2E verify Έργων Φάση 3 (Ε-8), αναπαραγώγιμο 2/2 σε API **και** UI. |
