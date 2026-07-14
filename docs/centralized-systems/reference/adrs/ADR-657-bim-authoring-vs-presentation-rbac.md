# ADR-657 — BIM RBAC: διαχωρισμός Authoring / Presentation στα security rules

**Status**: Accepted · **Ημερομηνία**: 2026-07-15 · **Σχετικά**: ADR-063 (company isolation via claims), ADR-298 (firestore rules test coverage), ADR-301 (storage rules test coverage), ADR-340 (raster backgrounds), ADR-370 (BIM read-only visualization), ADR-255 (security hardening phase 4), SPEC-257F (photo/floorplan delivery)

---

## 1. Πλαίσιο

### 1.1 Το κενό

Ο helper που φυλάει σχεδόν όλη τη BIM οικογένεια στα `firestore.rules` είναι αυτός:

```
function belongsToCompany(companyId) {
  return isAuthenticated() && getUserCompanyId() == companyId;
}
```

Ελέγχει **tenant. Ποτέ ρόλο.** Το `companyId` claim απαντά στο «ποιος είσαι», όχι στο «τι
δικαιούσαι» — και για 34 από τα 36 rule blocks της οικογένειας ήταν το **μοναδικό** gate στο
`read` και στο `create`.

Ταυτόχρονα, ο `external_user`:

- είναι ο **προεπιλεγμένος ρόλος κάθε αυτο-εγγραφής** (`src/app/api/auth/complete-registration/route.ts` — κάθε νέος λογαριασμός ξεκινά εκεί),
- έχει στο `src/lib/auth/roles.ts` **ακριβώς δύο** permissions: `projects:projects:view`, `properties:properties:view` — **μηδέν** floorplan/dxf,
- και παρ' όλα αυτά μπορούσε, με απευθείας client SDK, να **διαβάσει και να δημιουργήσει** τοίχους, πλάκες, υποστυλώματα, MEP δίκτυα και τοπογραφικές επιφάνειες ολόκληρης της εταιρείας.

Το `update`/`delete` έκοβε μόνο στο ownership leg (`createdBy == uid || isCompanyAdminOfCompany`)
— δηλαδή ένας `external_user` που **δημιούργησε** ένα doc μπορούσε και να το τροποποιήσει.

### 1.2 Δεν είναι σχεδιαστική επιλογή — είναι drift

Το σωστό μοτίβο **υπήρχε ήδη στο ίδιο αρχείο**: τα `floorplan_backgrounds` / `floorplan_overlays`
(ADR-340) απαιτούν `isInternalUser()` για create και `isInternalUserOfCompany()` για update/delete.
Το ίδιο κάνουν το `company_fonts` και όλη η οικογένεια `accounting_*`. Οι helpers
`isInternalUser()` / `isInternalUserOfCompany()` / `isCompanyAdminOfCompany()` **υπήρχαν ήδη**.

Τα υπόλοιπα 34 blocks απλώς τα **έχασαν από copy-paste**: κάθε νέο BIM collection αντέγραφε το
προηγούμενο, και το πρώτο αντίγραφο ήταν λάθος. Δεν χρειάστηκε καμία νέα υποδομή για τη
διόρθωση — ούτε νέο claim, ούτε migration. Μόνο ενοποίηση.

### 1.3 Δύο ακόμη ευρήματα της ίδιας έρευνας

**(α) Cross-tenant τρύπα στο `floor_floorplans`** (όχι απλώς RBAC):

```
|| !resource.data.keys().hasAny(['companyId', 'createdBy'])   // "Fallback: Any authenticated user (development)"
```

Οποιοσδήποτε authenticated χρήστης, **από οποιαδήποτε εταιρεία**, διάβαζε κάθε doc που δεν είχε
τα δύο πεδία. Ένα dev-fallback που ξέμεινε σε production rules.

**(β) Fail-open claims στο API layer** — `src/lib/auth/auth-context.ts`:

```typescript
const globalRoleRaw = (token.globalRole as string | undefined) || 'company_admin';
```

Token χωρίς `globalRole` claim ⇒ ο server τον περνά για **company_admin**. Δεύτερο αντίγραφο στο
`src/server/auth/require-project-for-page.ts`. Αυτό είναι σοβαρότερο από το αρχικό εύρημα: τα
rules δεν σε σώζουν όταν το API layer χαρίζει admin.

---

## 2. Απόφαση

### 2.1 Δύο βαθμίδες δεδομένων — authoring vs presentation

Τα εργαλεία αναφοράς του χώρου (Revit / Autodesk Construction Cloud, ArchiCAD· και το Figma για
τον ίδιο ακριβώς λόγο) **δεν** αντιμετωπίζουν τον οργανισμό ως όριο εξουσιοδότησης. Χωρίζουν:

- **authoring data** — το μοντέλο· το πειράζει η ομάδα μελέτης,
- **published views** — τι δημοσιεύεται προς τον πελάτη.

Ο πελάτης δεν παίρνει πρόσβαση στο μοντέλο επειδή «ανήκει στον οργανισμό». Παίρνει τη
δημοσιευμένη όψη επειδή **δικαιούται** συγκεκριμένα αυτήν.

Το υιοθετούμε αυτούσιο:

| Βαθμίδα | Περιεχόμενο | `read` | `create` / `update` / `delete` |
|---|---|---|---|
| **AUTHORING** (22 collections + storage `/topo-surfaces/`) | Δεδομένα που διαβάζονται **μόνο** μέσα στο `/dxf/viewer` (AdminGuard) | `isInternalUserOfCompany()` | `isInternalUserOfCompany()` |
| **PRESENTATION** (14 blocks) | Ό,τι βλέπει ο πελάτης: `/properties` + Buildings/Projects floorplan tabs (ADR-370) | tenant-wide — **αμετάβλητο** | `isInternalUserOfCompany()` |

Η **μόνη** διαφορά μεταξύ των δύο βαθμίδων είναι η γραμμή `read`. Αυτό είναι σκόπιμο: η Phase 2
(§5) είναι μηχανική αντικατάσταση ενός helper σε 14 γραμμές.

### 2.2 Η ιδιοκτησία ΔΕΝ δίνει δικαίωμα συγγραφής

Το OR-leg `createdBy == request.auth.uid` **αφαιρείται από κάθε write** της οικογένειας. Η
συγγραφή BIM δεδομένων είναι **πράξη μελέτης**, ανεξάρτητα από το ποιος έτυχε να δημιουργήσει το
έγγραφο. Ο ρόλος δίνει το δικαίωμα, όχι το ιστορικό.

Πρακτικά: ένας `external_user` που κατάφερε (πριν το ADR-657) να δημιουργήσει doc, δεν κρατά
δικαίωμα να το τροποποιεί.

### 2.3 Γιατί ΟΧΙ σκέτο deny στον `external_user`

Επειδή θα **έσπαγε παραγωγή σήμερα.** Το `/properties` — προσβάσιμο από κάθε authenticated
χρήστη, χωρίς route-level role guard — κάνει **απευθείας client-SDK subscriptions** σε 9
collections:

| Hook | Collections |
|---|---|
| `src/components/shared/files/media/useFloorplanBimEntities.ts` (ADR-370) | `floorplan_walls`, `_slabs`, `_beams`, `_columns`, `_openings`, `_slab_openings`, `_stairs` |
| `src/hooks/useFloorOverlays.ts` | `floorplan_overlays` |
| `src/hooks/useBackgroundScale.ts` | `floorplan_backgrounds` |

Και ο `external_user` είναι ο ρόλος **κάθε νέας εγγραφής**. Deny στο read εκεί ⇒ κάθε νέος
χρήστης βλέπει σπασμένο floorplan tab.

Αντίθετα, τα 22 authoring collections διαβάζονται **αποκλειστικά** μέσα στο
`src/subapps/dxf-viewer/**` (route `/dxf/viewer`, πίσω από `AdminGuard`). Το deny εκεί έχει
**αποδεδειγμένα μηδενικό blast radius** — επαληθεύτηκε με πλήρη σάρωση των call sites.

### 2.4 Το SSoT λεξιλόγιο (`firestore.rules`)

Τρία επίπεδα. **Μοιραζόμαστε τα role gates, ΟΧΙ τους field validators** — τα
backgrounds/overlays έχουν δικά τους payload guards (`_overlayWriteValid()`, `naturalBounds`,
`scale`) που παραμένουν **verbatim**· να τα «ενοποιήσεις» θα ήταν security regression.

```
// ── Layer 1: role gates (και για τα 36 blocks) ────────────────────────────
function canReadBimAuthoring(cid)    { return isInternalUserOfCompany(cid); }
function canReadBimPresentation(cid) { return isSuperAdminOnly() || belongsToCompany(cid); }
function isBimWriter(cid)            { return isInternalUserOfCompany(cid); }

// ── Layer 2: BIM entity payload guards (μόνο τα 29 floorplan_* entities) ──
function canCreateBimEntity(requiredKeys) { … isInternalUser() && cid == claim
                                              && createdBy == uid
                                              && keys().hasAll(requiredKeys) }
function bimImmutablesUnchanged()  { companyId, projectId, floorplanId, createdBy, createdAt }
function bimSoftLockValid()        { G24 anti-spoof — ADR-358 §6.8 }
function canUpdateBimEntity()      { isSuperAdminOnly() || (isBimWriter(…) && immutables && softLock) }
function canDeleteBimEntity()      { isBimWriter(resource.data.companyId) }

// ── Layer 3: legacy containers (floorplans + 4× *_floorplans) ─────────────
function canReadLegacyFloorplan() / canCreateLegacyFloorplan() / canWriteLegacyFloorplan()
```

Το `isBimWriter()` είναι σκόπιμα **alias** του `isInternalUserOfCompany()`. Υπάρχει ώστε η
*πρόθεση* να είναι greppable, και ώστε μια μελλοντική αλλαγή πολιτικής («τα writes θέλουν
company_admin») να είναι **μία** επεξεργασία αντί για 36.

Το `requiredKeys` είναι **παράμετρος** — υπάρχουν **6 διαφορετικές** λίστες στα 29 blocks:

| `hasAll([...])` | Πλήθος | Παράδειγμα |
|---|---|---|
| `companyId, projectId, floorplanId, kind, params` | 20 | `floorplan_walls` |
| `companyId, projectId, floorplanId, params` | 5 | `floorplan_mep_systems` |
| `companyId, projectId, floorplanId, category, kind, params` | 1 | `floorplan_symbols` |
| `companyId, projectId, floorplanId, guides` | 1 | `floorplan_grid_guides` |
| `companyId, projectId, floorplanId, data` | 1 | `floorplan_hatches` |
| `companyId, projectId, floorplanId` | 1 | `floorplan_topo_surfaces` |

Κάθε rule block πέφτει από ~20 γραμμές boolean soup σε 4:

```
// ADR-657 AUTHORING tier — editor-only (/dxf/viewer). external_user denied.
match /floorplan_mep_boilers/{boilerId} {
  allow read:   if canReadBimAuthoring(resource.data.companyId);
  allow create: if canCreateBimEntity(['companyId', 'projectId', 'floorplanId', 'kind', 'params']);
  allow update: if canUpdateBimEntity();
  allow delete: if canDeleteBimEntity();
}
```

Παρενέργεια που αξίζει να σημειωθεί: το `firestore.rules.compiled` **μικραίνει**, δίνοντας
πραγματικό headroom κάτω από το όριο 256 KiB του Firebase.

### 2.5 Machine-readable tier lists

`tests/firestore-rules/_registry/bim-tiers.ts` — τα δύο arrays + τα `requiredKeys` ανά collection.
**Ένα** SSoT, που το καταναλώνουν και ο validator (§3.1) και τα test matrices (§3.2).

### 2.6 `storage.rules`

Νέος helper `isInternalUserOfCompany(cid)` (το `storage.rules` παράγει ήδη ανεξάρτητα τα
`isInternalUser()` / `isSuperAdmin()` — είναι χωριστό αρχείο, χωρίς κοινό κώδικα με τα firestore
rules). Το `/topo-surfaces/{companyId}/**` γίνεται authoring tier και στα τρία legs.

### 2.7 Το `floor_floorplans` dev-fallback φεύγει

Το leg του §1.3(α) διαγράφεται. **Προαπαιτούμενο**: query στο production για
`floor_floorplans` χωρίς `companyId`. Αν υπάρχουν → **backfill**, όχι τυφλή διαγραφή (αλλιώς
γίνονται μη-αναγνώσιμα από όλους πλην super_admin).

---

## 3. Επιβολή (enforcement)

### 3.1 Tier conformance validator — CHECK 3.16, στατικός, ΟΛΑ τα 36 blocks

Νέα κλάση ελέγχου στο `scripts/check-firestore-rules-test-coverage.js`. Για **κάθε** block:

1. το `allow read` καλεί τον helper που επιβάλλει η βαθμίδα του (`canReadBimAuthoring` ή `canReadBimPresentation`),
2. το `allow create` καλεί `canCreateBimEntity(...)` με **ακριβώς** τα `requiredKeys` του `bim-tiers.ts`,
3. **κανένα** write leg δεν περιέχει πλέον `createdBy == request.auth.uid ||`,
4. **κάθε** `match /floorplan_*` ή `match /*floorplans` ανήκει σε **ακριβώς μία** βαθμίδα.

Το (4) είναι το ratchet: **νέο BIM collection δεν μπορεί να προστεθεί χωρίς να δηλώσει βαθμίδα.**

### 3.2 Γιατί ΔΕΝ γράφουμε 28 emulator suites

28 από τα 29 entity collections ήταν στο `FIRESTORE_RULES_PENDING`. Το προφανές («γράψε suite για
το καθένα») είναι ~2000 γραμμές σχεδόν πανομοιότυπου κώδικα και ~840 νέα emulator cells — το
runtime CI job θα ξεπερνούσε κατά πολύ το budget των 8′.

Η θέση του ADR-657, την οποία **αναγνωρίζει ρητά το ADR-298**:

> **Structural conformance για ΟΛΑ (στατικά) + behavioural canaries για αντιπροσώπους (emulator).**

Ο στατικός validator επαληθεύει το **κείμενο του κανόνα** και για τα 36 blocks — αυτό είναι
**ισχυρότερο** από ένα δείγμα συμπεριφοράς, όχι χαλαρότερο. Οι canaries αποδεικνύουν ότι οι ίδιοι
οι helpers συμπεριφέρονται σωστά στον emulator, ένας ανά rule-shape variant:

| Canary | Βαθμίδα | Τι αποδεικνύει |
|---|---|---|
| `floorplan_walls` | presentation | `external_user × read` → **allow** (το `/properties` ζει) |
| `floorplan_stairs` | presentation | `kind+params` + G24 soft-lock |
| `floorplan_topo_surfaces` | authoring | `external_user × read` → **deny** (η τρύπα έκλεισε)· scope-only keys |
| `floorplan_grid_guides` | authoring | `guides` variant — **αποφοιτά από PENDING** |
| `floorplan_foundations` | authoring | `kind+params` — **αποφοιτά από PENDING** |
| `floorplan_hatches` | authoring | `data` variant |
| `floorplan_symbols` | authoring | `category+kind+params` variant |
| `floorplan_mep_systems` | authoring | `params`-only variant |

### 3.3 CHECK 3.19 — θάνατος του line-number matching

Ο έλεγχος κάλυψης storage rules έκανε match με **αριθμούς γραμμών**
(`rulesRange[0] <= line <= rulesRange[1]`). Κάθε γραμμή που προστίθεται **πάνω** από ένα match
block ξεκάρφωνε σιωπηλά όλα τα επόμενα. Αυτό **έσπασε ήδη** στο commit `964fd03e`, και θα ξανάσπαγε
την ίδια στιγμή που το ADR-657 προσθέτει τον helper στη γραμμή ~60.

Αντικαθίσταται από **`// @pathId: <id>` annotation** πάνω από κάθε inner `match`, που διαβάζει ένας
νέος `scripts/_shared/storage-rules-parser.js` (καθρέφτης του υπάρχοντος
`firestore-rules-parser.js`, ο οποίος κάνει ήδη σωστά match by name). Το match γίνεται **string**.

Νέες validations: **E** — λείπει annotation ⇒ BLOCK (το ratchet: νέο storage path δεν μπαίνει
χωρίς ταυτότητα)· **F** — διπλό `pathId`. Το `rulesRange` υποβιβάζεται σε τεκμηρίωση με soft
warning σε drift.

### 3.4 Νέο CI workflow — το storage suite έτρεχε ΠΟΥΘΕΝΑ

Δεν υπήρχε `.github/workflows/storage-rules.yml`. Το storage rules suite δεν έτρεχε ούτε στο CI
ούτε τοπικά (ο storage emulator δεν σηκώνεται στο μηχάνημα ανάπτυξης — κρεμάει πριν δέσει τη θύρα
9199· το ίδιο κάνει και το προϋπάρχον `cad-files` suite, άρα δεν φταίει ο νέος κώδικας).

Προστίθεται workflow-καθρέφτης του `firestore-rules.yml` (static job + emulator runtime job).
**Το CI γίνεται ο authoritative runner για τα storage rules.** Καταγράφεται εδώ ώστε να μην
«διορθώσει» κανείς το πρόβλημα σβήνοντας το suite.

### 3.5 Fail-closed claims

`extractCustomClaims()` σε `src/lib/auth/auth-context.ts` **και** το αντίγραφό του σε
`src/server/auth/require-project-for-page.ts`: χωρίς `companyId` **ή** `globalRole` claim ⇒
`null` (401). Όχι `company_admin`. Όχι `NEXT_PUBLIC_DEFAULT_COMPANY_ID`. Log level `info` → `warn`
— είναι security event και θέλουμε να φαίνεται.

**Προαπαιτούμενο, μη διαπραγματεύσιμο**: read-only audit (`scripts/audit-missing-auth-claims.js`)
των χρηστών με κενά claims **πριν** το ship. Είναι το μόνο βήμα ολόκληρου του ADR που μπορεί να
**κλειδώσει έξω πραγματικό άνθρωπο**. Μηδέν αποτελέσματα ⇒ ship. Αποτελέσματα ⇒ backfill σε
`external_user` (η **ασφαλής** τιμή), και χειροκίνητη επαναπροαγωγή όποιου ήταν όντως admin.

---

## 4. Εκτός σκοπού — συνειδητά

Το `storage.rules` έχει **9 ακόμη company-scoped paths** με το ίδιο role-less μοτίβο
(`belongsToCompany(cid) || isSuperAdmin()`): `bim_animations`, `bim_environments`,
`bim-material-thumbnails`, `bim-material-textures`, `engineer-stamps`, `block-library`, `quotes`,
και τα 2 canonical file paths.

**Δεν αγγίζονται εδώ** — έχουν πραγματικό blast radius (τα canonical paths είναι ο file browser του
πελάτη) και θέλουν δική τους ανάλυση. Ο helper `isInternalUserOfCompany()` μπαίνει ήδη στο
`storage.rules`, ώστε η επόμενη δουλειά να είναι **rename**, όχι σχεδίαση.

Καταγράφονται ρητά εδώ ώστε ο επόμενος αναγνώστης να ξέρει ότι **δεν ξεχάστηκαν**.

---

## 5. Phase 2 — αναβαλλόμενο (ΔΕΝ υλοποιείται σε αυτό το ADR)

Ο τελικός στόχος είναι **όλη** η οικογένεια στο authoring tier: ο πελάτης δεν διαβάζει BIM
γεωμετρία απευθείας από τη βάση — παίρνει **δημοσιευμένη όψη** που ο server του **δικαιούται**
(ακριβώς το μοντέλο του SPEC-257F: PDF, per-unit, με entitlement check, μέσω Admin SDK).

Βήματα:

1. Μεταφορά των 3 client hooks (§2.3) πίσω από server route με Admin SDK + `PropertyGrant`
   entitlement check (`GrantScope`, π.χ. `unit:dxf:view` — υπάρχει ήδη στο `types.ts`, αλλά τα
   rules **δεν το συμβουλεύονται καθόλου** σήμερα· ακόμα κι αν ένα grant ανακληθεί, η απευθείας
   πρόσβαση Firestore δεν επηρεάζεται).
2. Μετακίνηση των 14 PRESENTATION entries → AUTHORING στο `bim-tiers.ts`.
3. Flip `canReadBimPresentation` → `canReadBimAuthoring` (14 γραμμές).

**Να μην επιχειρηθεί στο ίδιο commit** — το βήμα 3 χωρίς το βήμα 1 σπάει το `/properties` για κάθε
νέο χρήστη.

---

## 6. Συνέπειες

**Θετικές**
- Ο `external_user` χάνει read σε 22 collections + το topo storage — η τρύπα κλείνει, με μηδενικό blast radius.
- Η ιδιοκτησία παύει να δίνει δικαίωμα συγγραφής, σε όλη την οικογένεια.
- Κλείνει cross-tenant τρύπα (`floor_floorplans`) και fail-open admin (`auth-context`).
- Ένα λεξιλόγιο· μια αλλαγή πολιτικής = μια επεξεργασία, όχι 36.
- Τα storage rules αποκτούν CI **για πρώτη φορά**.
- Ratchet: νέο BIM collection **δεν μπορεί** να μπει χωρίς βαθμίδα· νέο storage path **δεν μπορεί** να μπει χωρίς `@pathId`.
- Μικρότερο compiled ruleset — headroom κάτω από το όριο 256 KiB.

**Κόστος / ρίσκα**
- Το fail-closed claims μπορεί να κλειδώσει έξω χρήστες με ελλιπή claims — **μετριάζεται με υποχρεωτικό audit πριν το ship**.
- 22 collections παραμένουν χωρίς emulator suite — **μετριάζεται με τον στατικό validator**, που καλύπτει και τα 36 (§3.2).
- Το PRESENTATION tier παραμένει tenant-wide στο read μέχρι την Phase 2 — **γνωστό, τεκμηριωμένο, όχι ξεχασμένο**.

---

## 7. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-07-15 | Αρχική έκδοση. Δύο βαθμίδες (authoring/presentation)· SSoT helpers στα `firestore.rules` + `storage.rules`· `bim-tiers.ts`· tier-conformance validator (CHECK 3.16)· CHECK 3.19 → `@pathId`· νέο storage CI workflow· fail-closed claims· αφαίρεση cross-tenant fallback στο `floor_floorplans`. |
