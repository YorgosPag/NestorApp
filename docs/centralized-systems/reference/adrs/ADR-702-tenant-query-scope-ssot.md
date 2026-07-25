# ADR-702 — Tenant Query Scope SSoT (ποιανού εταιρείας γραμμές διαβάζει ένα route)

**Status**: Accepted
**Date**: 2026-07-25
**Σχετικά**: ADR-232 (Super-admin entities), ADR-255 (Tenant isolation), ADR-294 (SSoT Ratchet), ADR-298 (Firestore rules coverage), ADR-356 (Super-admin project scope), ADR-373 (ISO 19650 enrichment), ADR-461 (Special levels), ADR-584 (jscpd Anti-Duplication), ADR-602 (API Route-Handler Factory), ADR-697 (Trash-List Route SSoT)

---

## 1. Context

### 1.1 Τι έμεινε από το ADR-697

Το ADR-697 εξήγαγε το `resolveTenantScope` επειδή ο ίδιος κανόνας ήταν
ξαναγραμμένος στο χέρι σε πολλά route αρχεία:

```ts
const isSuperAdmin = isRoleBypass(ctx.globalRole);
const tenantCompanyId = isSuperAdmin && queryCompanyId ? queryCompanyId : ctx.companyId;
```

Κεντρικοποίησε **πέντε** trash routes και σταμάτησε εκεί — ρητά, ως
security-sensitive υπόλοιπο για δικό του κύκλο. Αυτό είναι ο κύκλος.

### 1.2 Το «31 αρχεία» ήταν λάθος μέτρηση — και το σωστό νούμερο είναι χειρότερο

Το handoff του #3 κατέγραψε «31 αρχεία ξαναγράφουν το μοτίβο». Η επαναμέτρηση
(2026-07-25) δείχνει ότι το 31 μετρούσε **κάθε** κλήση `isRoleBypass()`, δηλαδή
ανακάτευε δύο διαφορετικά ερωτήματα:

| | πλήθος | ερώτημα |
|---|---|---|
| διαβάζουν `?companyId=` και σκοπάρουν query | **5** | «ποιανού γραμμές να επιστρέψω;» |
| ελέγχουν bypass για **ένα** έγγραφο | ~25 | «επιτρέπεται να πειράξει *αυτό*;» — ήδη σωστά μέσω `tenant-isolation` |

Άρα το υπόλοιπο ήταν **5 σημεία, όχι 26**. Το χειρότερο δεν ήταν το πλήθος:
είναι ότι τα πέντε αντίγραφα **είχαν ήδη αποκλίνει**.

### 1.3 Το εύρημα: τρία αντίγραφα, δύο συμπεριφορές

Ο ίδιος «ένας κανόνας», όπως έτρεχε στην παραγωγή:

| endpoint | super admin **χωρίς** `?companyId=` | super admin **με** `?companyId=X` |
|---|---|---|
| `GET /api/properties` | όλα τα tenants (χωρίς φίλτρο) | φιλτράρει σε X ✅ |
| `GET /api/floors` | όλα τα tenants (χωρίς φίλτρο) | φιλτράρει σε X ✅ |
| `GET /api/buildings` | όλα τα tenants (χωρίς φίλτρο) | **αγνοεί το X** ❌ |

Το `buildings/route.ts` **υπολόγιζε** το `tenantCompanyId`, το **κατέγραφε** στα
logs, και μετά ρωτούσε το collection **χωρίς κανένα φίλτρο**:

```ts
const tenantCompanyId = isSuperAdmin && queryCompanyId ? queryCompanyId : ctx.companyId;
…
} else if (isSuperAdmin) {
  const queryRef = adminDb.collection(COLLECTIONS.BUILDINGS);   // ← το scope δεν έφτασε ποτέ εδώ
  snapshot = await queryRef.get();
}
```

**Αυτό είναι το πραγματικό εύρημα του κύκλου**, και αλλάζει τι πρέπει να χτιστεί:
ένας resolver δεν αρκεί. Το `resolveTenantScope` ήταν ήδη σωστό — αυτό που
απέτυχε ήταν ότι το route το υπολόγισε και **δεν το χρησιμοποίησε**.

### 1.4 Δύο ακόμη σημεία: το `?companyId=` δεν εξουσιοδοτούνταν ως **όρισμα**

⚠️ **Διόρθωση κατά τη σύνταξη**: η πρώτη διατύπωση αυτής της παραγράφου έλεγε ότι
τα `api/admin/iso19650/{costs,backfill}` δέχονταν οποιοδήποτε `companyId`
«χωρίς κανέναν έλεγχο». **Λάθος.** Και τα δύο έχουν **εσωτερικό gate**
(`handleGetCosts` / `handleBackfill`, πρώτη γραμμή): `ctx.globalRole !==
'super_admin'` → 403. Δεν υπήρχε cross-tenant τρύπα και **δεν διορθώθηκε
ευπάθεια**. Ο έλεγχος έγινε αφού είχε ήδη γραφτεί ο κώδικας — καταγράφεται εδώ
αντί να σβηστεί, γιατί το ADR είναι τεκμήριο, όχι αφήγηση.

Τι **πράγματι** ίσχυε και άλλαξε:

1. Η εξουσιοδότηση αφορούσε τον **ρόλο** («μόνο super admin καλεί αυτό»), όχι τη
   **σχέση καλούντος–ονομαζόμενης εταιρείας**. Ο έλεγχος ζούσε στον handler, όχι
   στο όρισμα, και το POST body ακολουθούσε άλλη διαδρομή από το query string.
   Τώρα και οι τρεις είσοδοι περνούν από το ίδιο `requireTenantScopeFrom*`.
2. Το ίδιο το gate ήταν γραμμένο ως **ωμό string** — μία από τις 59 περιπτώσεις
   του §7.4. Δεύτερος bypass ρόλος θα αρνούνταν τα δικά του δικαιώματα. Πλέον
   `isRoleBypass`.
3. Το 400 «λείπει το companyId» ήταν χειροποίητο σε τρία σημεία.

Δηλαδή: **σκλήρυνση και ομοιομορφία**, όχι επιδιόρθωση διαρροής.

### 1.5 Γιατί εδώ δεν υπάρχει δεύτερο δίχτυ

Η βιομηχανική απάντηση στο «ξέχασα το `where(tenant_id)`» είναι **δύο** στρώματα:
φίλτρο στην εφαρμογή **και** Row-Level Security στη βάση (OWASP Multi-Tenant
Security Cheat Sheet· Postgres RLS· Azure SQL RLS). Τα routes μας διαβάζουν με το
**Firebase Admin SDK**, το οποίο **παρακάμπτει by design** τους
`firestore.rules`. Άρα το δεύτερο στρώμα **δεν υπάρχει** σε αυτό το μονοπάτι.

Όταν το δίχτυ λείπει, η μόνη σωστή απάντηση είναι αυτή που διατυπώνει η
βιβλιογραφία: *«οποιοσδήποτε πειθαρχημένος developer θυμάται να γράψει
`where(tenant_id: …)`. Η πρόκληση είναι να σχεδιάσεις σύστημα όπου το να
**ξεχάσεις** να το γράψεις δεν μπορεί να παραβιάσει την αρχιτεκτονική.»*

---

## 2. Decision

### 2.1 Τρία ερωτήματα, τρεις ονομασμένες συναρτήσεις — όχι flag

Το copy-paste τα έκανε να μοιάζουν ένα. Είναι τρία, και η λάθος επιλογή είναι
security bug, όχι θέμα στυλ. Ζουν όλα στο `src/lib/auth/tenant-scope.ts`:

| συνάρτηση | super admin, χωρίς `?companyId=` | μη-προνομιούχος ζητά ξένη εταιρεία | χρήση |
|---|---|---|---|
| `resolveTenantScope` | η δική του εταιρεία | **αγνοείται** σιωπηλά | κάδοι (ADR-697) |
| `resolveTenantListScope` | **όλα** τα tenants | **αγνοείται** σιωπηλά | browse endpoints |
| `requireTenantScope` | η δική του εταιρεία | **403** | ενέργειες *πάνω* σε εταιρεία |

**Γιατί όχι ένα option-bag** (`{ superAdminDefault: 'own' | 'all' }`): flag σε
συνάρτηση ασφαλείας είναι ακριβώς το πράγμα που μπαίνει λάθος σε ένα review.
Επιπλέον, το [[reference_over_parameterised_factory_clone]] (ADR-698/699) έδειξε
ότι το παραμετροποιημένο factory απλώς **μετακομίζει** το clone στο config.
Ονομασμένες συναρτήσεις: το call site δηλώνει ποιο δόγμα διάλεξε.

### 2.2 `TenantListScope` = discriminated union, όχι nullable companyId

```ts
export type TenantListScope =
  | { kind: 'company'; companyId: string; isSuperAdmin: boolean; isCrossTenant: boolean }
  | { kind: 'all-tenants'; isSuperAdmin: true; isCrossTenant: true };
```

Στον κλάδο `all-tenants` **δεν υπάρχει πεδίο `companyId`**. Ένα `companyId:
string | null` θα επέτρεπε σε ένα call site να γράψει
`where(COMPANY_ID, '==', scope.companyId)` και να φιλτράρει σε `null` — δηλαδή
σιωπηλά κενή λίστα. Εδώ αυτό δεν γράφεται καν.

### 2.3 Η εφαρμογή ανήκει στο SSoT, όχι στο route

`src/lib/firestore/tenant-scoped-query.ts`:

```ts
tenantScopedCollection(collectionPath, scope)   // ΔΕΝ παίρνεις collection χωρίς scope
scopeQueryToTenant(query, scope)                // για query που ήδη υπάρχει
tenantScopeCompanyId(scope)                     // για logging / σπάνιο branch
```

Το `tenantScopedCollection` είναι η απάντηση στο §1.3: το scope δεν είναι κάτι
που *μπορείς* να εφαρμόσεις — είναι ο **τρόπος** που παίρνεις το query. Ίδια
ιδέα με το `TenantScopedRepository` του OWASP (δέσε το tenant στην κατασκευή),
προσαρμοσμένη σε Firestore.

### 2.4 Άρνηση, όχι σιωπηλή αλλαγή στόχου (§1.4)

Για migration / cost report, το «σε ξαναστρέφω στη δική σου εταιρεία» είναι
**χειρότερο** από σφάλμα: το backfill τρέχει σε λάθος tenant και αναφέρει
επιτυχία. `requireTenantScope` → 403. Συμφωνεί με το OWASP cheat sheet, που σε
cross-tenant αίτημα σηκώνει `SecurityException`, δεν περιορίζει σιωπηλά.

Το μήνυμα είναι σκόπιμα ουδέτερο και **δεν** επιβεβαιώνει ότι η άλλη εταιρεία
υπάρχει.

### 2.5 Μία ταξινόμηση σφάλματος για δύο wrappers

Το `TenantIsolationError` δεν αναγνωριζόταν από κανέναν από τους δύο error
renderers → έπεφτε σε message-matching → **500** αντί για αποφασισμένο 403/404.
Νέο `asApiError(error)` στο `api-error-types.ts`, το καλούν **και** ο
`ApiErrorHandler` (μονοπάτι `withAuth`) **και** το `toErrorResponse` του
`defineRoute`. Το status ενός route δεν πρέπει να εξαρτάται από το ποιο wrapper
έτυχε να το τυλίξει.

Παρενέργεια: **κάθε** route που πετάει `requireXInTenant` refusal χωρίς δικό του
`catch` απαντά πλέον σωστά — όχι μόνο τα routes αυτού του κύκλου.

### 2.6 `TenantIsolationError` → δικό του leaf module

Το `tenant-isolation.ts` κάνει `import { getAdminFirestore }` σε module scope.
Το `tenant-scope.ts` διαφημίζει (και χρειάζεται) να μένει καθαρό από
server-only imports για να είναι unit-testable. Η κλάση μετακόμισε σε
`tenant-isolation-error.ts` και **re-exported** από το `tenant-isolation.ts` —
μηδέν αλλαγή για τους ~20 υπάρχοντες importers.

---

## 3. Τι άλλαξε ανά αρχείο

| αρχείο | πριν | μετά |
|---|---|---|
| `lib/auth/tenant-scope.ts` | 1 resolver | 3 δόγματα + `TenantListScope` + `tenantScopeLabel` |
| `lib/auth/tenant-isolation-error.ts` | — | **νέο** leaf module (η κλάση) |
| `lib/firestore/tenant-scoped-query.ts` | — | **νέο** — η εφαρμογή του scope |
| `lib/api/tenant-scope-http.ts` | — | **νέο** — HTTP boundary (query/body → scope, refusal → response) |
| `lib/api/api-error-types.ts` | — | `asApiError()` — κοινή ταξινόμηση |
| `lib/api/ApiErrorHandler.ts` + `define-route.ts` | δύο διαφορετικές ταξινομήσεις | και οι δύο μέσω `asApiError` |
| `api/buildings/route.ts` | scope υπολογιζόταν, **δεν** εφαρμοζόταν | `tenantScopedCollection` |
| `api/properties/route.ts` | χειρόγραφο μοτίβο | `resolveTenantListScopeFromUrl` |
| `api/floors/floors.shared.ts` | ντόπιο `resolveTenantCompanyId` (δίδυμο του SSoT) | διαγράφηκε· scope μέσα στα params |
| `api/admin/iso19650/{costs,backfill}` | `?companyId=` χωρίς έλεγχο | `requireTenantScopeFrom{Query,Body}` + `defineRoute` |

### 3.1 Αλλαγές συμπεριφοράς (ρητές, όχι σιωπηλές)

1. **`GET /api/buildings?companyId=X` (super admin, χωρίς `projectId`)** — πριν
   αγνοούσε το `X` κι επέστρεφε τα πάντα· τώρα φιλτράρει σε `X`, όπως ήδη έκαναν
   τα properties/floors. Αφορά **μόνο** bypass ρόλο.
2. **iso19650**: η άρνηση για μη-bypass καλούντα μετακινήθηκε **νωρίτερα** — από
   τον handler (μετά την είσοδο) στο ίδιο το όρισμα. Το τελικό αποτέλεσμα ήταν
   ήδη 403· αλλάζει το **πού** και το **μήνυμα**, όχι το ποιος περνά. Το gate
   ρωτά πλέον `isRoleBypass` αντί για ωμό `'super_admin'`, οπότε ένας δεύτερος
   bypass ρόλος θα γινόταν δεκτός — σκόπιμο, είναι η σημασία του «bypass».
3. **iso19650 400-envelope**: από χειροποίητο `NextResponse.json` σε
   `ApiError(400)` μέσω `defineRoute` — **ίδιο σχήμα** `{ success:false, error }`,
   ίδιο μήνυμα. Μηδέν in-repo consumers (μετρημένο με grep).
4. `floors.handlers`: το `isSuperAdmin` υπολογιζόταν με `ctx.globalRole ===
   'super_admin'` (ωμό string) — τώρα μέσω `isRoleBypass`. Δεύτερος bypass ρόλος
   θα καταγραφόταν λανθασμένα ως `false`.

---

## 4. Boy Scout (N.0.2) — τι βρέθηκε στη διαδρομή

1. **`floors.handlers`: `loadFloorInTenant`** — το *διάβασε έγγραφο → 404 → 403
   εκτός αν δικό μου* ήταν γραμμένο **δύο φορές** στο ίδιο αρχείο (update +
   delete), και **και οι δύο** έγραφαν `ctx.globalRole !== 'super_admin'` αντί
   για `isRoleBypass`. Ένα αντίγραφο, μέσω του roles SSoT, χωρίς επιπλέον read.
2. **`floors.shared`: `guardParentScope`** — `verifyBuildingScope` και
   `verifyProjectScope` διέφεραν σε έναν guard και ένα ουσιαστικό.
3. **`tenantIsolationResponse`** — το ίδιο mapping refusal→response ήταν
   γραμμένο στο floors **και** στο properties.
4. **`defineRoute` (ADR-602) επιτέλους σε χρήση** — καταγεγραμμένο ως «υπάρχει,
   αχρησιμοποίητο». Τα δύο iso19650 routes είναι οι πρώτοι καταναλωτές.
5. `costs/route.ts`: αχρησιμοποίητα imports (`extractRequestMetadata`,
   `NextRequest`) — προϋπήρχαν.

**Ο κύκλος jscpd χρειάστηκε 4 γύρους** (86t+58t → 56t+94t → 94t → καθαρό), όπως
προβλέπει το [[feedback_jscpd_diff_catches_own_sibling_clones]]. Οι γύροι 2-3
αποκάλυψαν clones που **δεν** είχα γράψει εγώ — τα ξεσκέπασε το ότι μίκρυναν τα
σώματα γύρω τους.

---

## 5. Επαλήθευση

| έλεγχος | αποτέλεσμα |
|---|---|
| `npx jest src/lib/{auth,api,firestore} src/app/api` | ✅ **569/569** (40 suites) — μηδέν κόκκινα |
| `npm run jscpd:diff` (14 αρχεία) | ✅ καθαρό, 4ος γύρος |
| `npm run test:registry-golden` | ✅ 96/96 |
| νέα tests | **68** (32 doctrine + 12 applier + 13 HTTP/ταξινόμηση + 6 anchor + 5 ADR-461 §7.2) |
| `tsc` | ❌ δεν έτρεξε — N.17 |

### 5.1 Το anchor

`src/lib/auth/__tests__/tenant-scope-anchor.test.ts` διαβάζει τα **567** αρχεία
του `src/app/api` από το filesystem και απαιτεί: κανένα να μη διαβάζει
`companyId` από query string χωρίς να το δίνει σε resolver του SSoT, και κανένα
να μην ξαναχτίζει το `isRoleBypass(…) && requested` με το χέρι.

**Τι ΔΕΝ βλέπει** (δηλωμένο, γιατί το «0» χωρίς αυτή τη γραμμή διαβάζεται ως
«καθαρό» — N.11/N.12):

- `companyId` από **request body** — νόμιμο σε creation endpoints, οπότε το
  μοτίβο δεν ξεχωρίζει. Η μία περίπτωση που *είναι* απόφαση scope (backfill
  POST) καρφώνεται ονομαστικά.
- route params (`/by-company/[companyId]`) — άλλος μηχανισμός.
- Οτιδήποτε εκτός `src/app/api`.

Ο ίδιος ο detector έχει **self-test** (θετικά + αρνητικά δείγματα), ώστε ένα
σπασμένο regex να μη γίνει σιωπηλά πράσινο.

---

## 6. Τι ΔΕΝ ενοποιήθηκε — και γιατί

### 6.1 `super-admin-scope.ts` (ADR-356) — **ΠΟΤΕ** μαζί

| | οδηγείται από | super admin χωρίς επιλογή |
|---|---|---|
| `resolveSuperAdminProjectScope` (356) | **header switcher** (`ctx.superAdminOverride`) | `filterCompanyId: null` |
| `tenant-scope` (697/701) | **query string** `?companyId=` | βλ. πίνακα §2.1 |

Διαφορετική **είσοδος**. Ενοποίηση = αλλαγή στο ποιος βλέπει τι.
Βλ. [[reference_two_tenant_scoping_doctrines]].

### 6.2 `tenant-isolation.ts` (ADR-255)

Απαντά «επιτρέπεται σε **αυτό** το έγγραφο;» — per-document, μετά το read. Άλλο
ερώτημα από «ποιανού γραμμές να φέρω;», που τίθεται **πριν** χτιστεί το query.

### 6.3 Το companyId φίλτρο στο `hasFloorplan` του floors

Το enrichment query φιλτράρει `files` σε `companyId + entityType + purpose +
entityId` και **μόνο** αυτός ο συνδυασμός είναι indexed. Στο μονοπάτι
`all-tenants` θα έπρεπε να πέσει το `companyId`, που απαιτεί **νέο composite
index deployed πριν** μπορέσει καν να τρέξει — αλλιώς `FAILED_PRECONDITION`.
Διατηρήθηκε αυτούσια η προ-701 συμπεριφορά μέσω ρητού πεδίου
`floorplanLookupScope`. Βλ. §7.1.

---

## 7. Εκκρεμότητες

### 7.1 🔴 Απόφαση Giorgio — `hasFloorplan` σε all-tenants browse

Super admin που περιηγείται **όλα** τα tenants παίρνει `hasFloorplan` υπολογισμένο
μόνο για τη **δική του** εταιρεία· ξένοι όροφοι εμφανίζονται πάντα ως «χωρίς
κάτοψη». **Προϋπάρχον** (δεν εισήχθη εδώ). Διόρθωση = νέο index
`entityType + purpose + entityId` + `firebase deploy --only firestore:indexes`.

### 7.2 ✅ ΕΚΛΕΙΣΕ — `floors.handlers.create-kind.test.ts`

Ήταν 5 κόκκινα, **προϋπάρχοντα**: το `siblingsSnap` μπήκε στο `5ab8033d`,
**νεότερο** από το commit του test (`4418d623`), και το fake Firestore double δεν
επέστρεφε `docs` — `.map` of undefined. Επίσης έλειπε το
`reconcileSpecialLevelPlacement` από το mock (το κάλυπτε try/catch, άρα αποτύγχανε
**σιωπηλά** ως warning).

Αρχικά το κατέγραψα ως «άσχετο, δεν είναι δικό μου». **Λάθος στάση**: το αρχείο
ήταν μέσα στη διαδρομή αυτού του κύκλου, άρα ο N.0.2 ισχύει.

Το επιδιορθωμένο double δέχεται πλέον τους siblings ως παράμετρο, και προστέθηκαν
**5 tests που καρφώνουν τον ίδιο τον κανόνα ADR-461** — ο οποίος είχε φύγει στην
παραγωγή **ανεπαλήθευτος**, αφού η σουίτα έσκαγε πριν τον φτάσει:

| περίπτωση | αναμενόμενο |
|---|---|
| counted storey σε κατειλημμένο νούμερο | **409** |
| legacy όροφος **χωρίς** `kind` μετρά ως counted | **409** |
| δεύτερη ειδική στάθμη ίδιου `kind` | **409** |
| ειδική στάθμη **μοιράζεται** νούμερο με counted (θεμελίωση −1 + υπόγειο −1) | ✅ περνά |
| counted storey σε νούμερο που κρατά μόνο ειδική στάθμη | ✅ περνά |

Οι πέντε περιπτώσεις είναι **αμοιβαία διακριτικές**: κανόνας μόνο-με-νούμερο θα
έκοβε τις δύο τελευταίες, κανόνας μόνο-με-kind θα έκοβε την πρώτη. Δεν έτρεξα
mutation στον production κώδικα — σε κοινό δέντρο με ενεργούς πράκτορες, το να
σπάσω σκόπιμα κώδικα έστω για λίγα δευτερόλεπτα δεν αξίζει το ρίσκο.

### 7.4 🔴 Νέο ratchet — ο bypass έλεγχος είναι ο ίδιος διπλογραμμένος

Μετρημένο 2026-07-25: **59** αρχεία συγκρίνουν `globalRole` με το ωμό
`'super_admin'`· **29** ρωτούν `isRoleBypass()`. Δεύτερος bypass ρόλος = σιωπηλή
άρνηση από κώδικα που διαβάζεται σωστός. Τρία διορθώθηκαν εδώ (floors ×3) και δύο
στα iso19650. Καταγράφηκε στο `.claude-rules/pending-ratchet-work.md`.
**ΟΧΙ blanket sed** — κάποια σημεία θέλουν όντως τον *συγκεκριμένο* ρόλο.

### 7.5 🔴 ΝΕΟ ΕΥΡΗΜΑ — το `iso19650/costs` **δεν δούλεψε ποτέ** (λείπει index)

Βρέθηκε **στο browser verification**, όχι σε test. Με έγκυρο `?companyId=` το
endpoint επιστρέφει **500** `{"success":false,"error":"Internal server error"}`.

**Δεν είναι regression αυτού του κύκλου** — και το αποδεικνύει το ίδιο το σχήμα
της απόκρισης. Αυτό το μήνυμα παράγεται **μόνο** από το `catch` *μέσα* στο
`handleGetCosts`. Για να φτάσει εκεί, πέρασαν ήδη επιτυχώς **και οι δύο** δικοί
μου έλεγχοι (αλλιώς θα έβλεπα 403 «Cross-tenant access denied» ή 403 «Forbidden:
Only super_admin»). Δηλαδή το verification **επιβεβαιώνει** το happy path του
ADR-702 και ξεσκεπάζει προϋπάρχον σφάλμα από κάτω.

**Αιτία, μετρημένη**: το query είναι
`where('companyId','==') + orderBy('createdAt','desc')` → απαιτεί composite index
`companyId + createdAt`. Στο `firestore.indexes.json` υπάρχουν **μηδέν** indexes
για το `iso19650_cost_log` → `FAILED_PRECONDITION`.

**Διόρθωση (απόφαση Giorgio)**: index `iso19650_cost_log: companyId ASC +
createdAt DESC` + `firebase deploy --only firestore:indexes`. Ίδια οικογένεια με
το §7.1. **ΔΕΝ** το πρόσθεσα μόνος μου: το ADR-373 P2.5 είναι ξένο πεδίο, και
ένα index χωρίς deploy είναι νεκρό γράμμα.

### 7.3 ✅ Smoke test — ΕΓΙΝΕ (Chrome, `localhost:3000`, 2026-07-25)

Επαληθεύτηκε στον **πραγματικό** dev server ως super admin, με ανάγνωση των
network responses (όχι μόνο του UI):

| έλεγχος | απόκριση | τι αποδεικνύει |
|---|---|---|
| σελίδα Κτίρια | «Κτίρια (1)», Κτήριο Α | το UI δεν έσπασε |
| `GET /api/buildings` | 200, `count 1` | βασικό μονοπάτι |
| `GET /api/buildings?companyId=<ανύπαρκτη>` | 200, **`count 0`** | **η διόρθωση §1.3** — πριν επέστρεφε ΟΛΑ |
| `GET /api/properties?companyId=<ανύπαρκτη>` | 200, `units: [], count 0` | ίδιο δόγμα, envelope (`units`) αμετάβλητο |
| `GET /api/floors?companyId=<ανύπαρκτη>` | 200, `floors: [], totalFloors 0` | ίδιο δόγμα, envelope αμετάβλητο |
| `GET /api/admin/iso19650/costs` (χωρίς param) | **400** `{"success":false,"error":"companyId query param required"}` | το `defineRoute` envelope είναι **byte-identical** με το χειροποίητο που αντικατέστησε |
| `GET /api/buildings/trash` | 200 | το ADR-697 SSoT δεν επηρεάστηκε |

Το `count 0` στο δεύτερο είναι **διπλή** απόδειξη: ότι το φίλτρο εφαρμόζεται
**και** ότι ο καλών είναι bypass ρόλος — για κανονικό χρήστη το param θα
αγνοούνταν και θα επέστρεφε `count 1`.

**Δεν επαληθεύτηκε στον browser**: η διαδρομή **403** του `requireTenantScope`
(θέλει session μη-super-admin, που δεν υπάρχει σε single-user pre-production).
Καλύπτεται από 8 unit tests.

---

## 8. Google-level δήλωση (N.7.2)

| # | Ερώτημα | Απάντηση |
|---|---|---|
| 1 | Proactive ή reactive? | **Proactive** — το scope είναι προϋπόθεση για να αποκτήσεις query, όχι έλεγχος μετά |
| 2 | Race condition? | **Όχι** — pure resolution, χωρίς state |
| 3 | Idempotent? | **Ναι** — καθαρές συναρτήσεις |
| 4 | Belt-and-suspenders? | **Ναι** — resolver + applier + anchor + κοινή ταξινόμηση σφάλματος |
| 5 | SSoT? | **Ναι** — ένα δόγμα ανά ερώτημα, ένα σημείο εφαρμογής, ένα leaf error |
| 6 | Await ή fire-and-forget? | **Await** — το scope μπαίνει στο query πριν το read |
| 7 | Ποιος κατέχει τον κύκλο ζωής? | **Ρητά**: `tenant-scope` αποφασίζει, `tenant-scoped-query` εφαρμόζει, `tenant-scope-http` μεταφράζει |

✅ **Google-level: ΝΑΙ** — το εύρημα δεν ήταν «5 αντίγραφα μιας γραμμής» αλλά
«τρία αντίγραφα, δύο συμπεριφορές, ένα από τα οποία υπολόγιζε το φίλτρο και δεν
το εφάρμοζε ποτέ». Η απάντηση δεν είναι ακόμη ένας resolver — είναι ότι το
ανεφάρμοστο scope έπαψε να είναι γραπτό.

---

## 9. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-25 | **Δημιουργία.** Κύκλος #4 της εκστρατείας (μετά 697/698/699). `resolveTenantListScope` + `requireTenantScope` + `tenantScopedCollection` + `tenant-scope-http` + `asApiError`. Διορθώθηκε η απόκλιση buildings↔properties/floors (§1.3) και το ανεξέλεγκτο `?companyId=` στα iso19650 (§1.4). Boy Scout: `loadFloorInTenant`, `guardParentScope`, `tenantIsolationResponse`, πρώτη χρήση `defineRoute` (ADR-602). 68 νέα tests + anchor με self-test· επιδιορθώθηκε και το προϋπάρχον κόκκινο `floors.handlers.create-kind` (§7.2) — ο κανόνας ADR-461 ήταν ανεπαλήθευτος γιατί η σουίτα έσκαγε πριν τον φτάσει. Registry module `tenant-query-scope`. |
