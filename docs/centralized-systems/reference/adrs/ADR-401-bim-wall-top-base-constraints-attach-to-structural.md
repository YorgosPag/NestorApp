# ADR-401 — BIM Wall Top/Base Constraints + Attach-to-Structural (associative auto-height)

- **Status**: 🟡 PROPOSED — σχεδιασμός (έρευνα + ερωτήσεις). Καμία υλοποίηση κώδικα ακόμη.
- **Date**: 2026-05-30
- **Author**: Giorgio Pagonis + Claude (Opus 4.8)
- **Scope**: BIM `wall` (primary) — `column` mirror σε επόμενη φάση. Καταναλώνει `beam` + `slab` ως «structural hosts».
- **Builds on**: ADR-369 (Elevation Convention — datum), ADR-363 §5.4 (derived-geometry central cascade), ADR-399 (Levels/Floors SSoT)
- **Related**: ADR-396 (ETICS — assembly/ύψη τοίχου), ADR-358 (Stair↔Floor), ADR-366 (3D Viewer)
- **Impact**: 🟡 ADDITIVE σε τύπους· 🔴 αλλάζει το **πού** ορίζεται το κατακόρυφο ύψος τοίχου (από static scalar → resolved-from-context). Wipe & Reseed (ADR-369 Q10) — μηδέν data migration.

---

## 1. Context — Το πρόβλημα (από Giorgio)

Οι τοίχοι BIM είναι συνήθως τοίχοι **πλήρωσης**: μπαίνουν αφού στηθεί ο στατικός σκελετός. Ροή που θέλει ο Giorgio:

1. Φτιάχνω τοίχο BIM με προκαθορισμένο ύψος (π.χ. 2,85 μ).
2. Τοποθετώ **πάνω** του δοκάρι (π.χ. 0,50 μ).
3. Ο τοίχος **μικραίνει αυτόματα** ώστε να χωρά το δοκάρι — χωρίς χειροκίνητη επέμβαση.

**Αριθμητικό παράδειγμα** (ADR-369 datum):
```
Ύψος ορόφου (πάτωμα→πάτωμα)         = 3,00 μ   (FFL επόμενου ορόφου = 3,00)
Πλάκα οροφής (πάχος)                = 0,15 μ   → κάτω παρειά πλάκας = 2,85
Δοκάρι κάτω από πλάκα (ύψος)        = 0,50 μ   → κάτω παρειά δοκαριού = 2,50
─────────────────────────────────────────────
Τελικό ύψος τοίχου (κάτω από δοκάρι) = 2,50 μ   (αντί 2,85 χωρίς δοκάρι)
```

### 1.1 Γιατί ΟΧΙ «στατική αφαίρεση ενός αριθμού»

Το «αφαιρώ 0,50 μία φορά» είναι **εύθραυστο**: σπάει αν μετακινηθεί/σβηστεί το δοκάρι, αν αλλάξει το ύψος ορόφου, αν υπάρχουν 2 δοκάρια, αν το δοκάρι καλύπτει μέρος του τοίχου. Η σωστή λύση είναι **συσχετιστική** (associative), όπως το Revit «Attach Top/Base».

### 1.2 Industry research — Revit «Attach Top/Base»

- Μετά την τοποθέτηση, η κορυφή/βάση τοίχου **«κολλάει»** (attach) σε άλλο στοιχείο στο ίδιο κατακόρυφο επίπεδο: **πλάκα, στέγη, ταβάνι, δοκάρι** (πάνω/κάτω).
- Παραμετρική σχέση: το ύψος **μεγαλώνει/μικραίνει αυτόματα** ώστε να ακολουθεί το όριο του στοιχείου. Αλλαγή κλίσης/υψομέτρου του host → ο τοίχος ακολουθεί ζωντανά.
- Σε δοκάρι → ο τοίχος κολλάει στην **κάτω παρειά** του δοκαριού.
- Στο Revit το attach είναι **χειροκίνητο** (pick wall + pick element). Edit profile → **σπάει** το attach.
- 🟢 **Δική μας βελτίωση**: auto-attach κατά την τοποθέτηση του δοκαριού (εντοπισμός τοίχων από κάτω + attach με undo).

**Πηγές**: Autodesk «Attach Walls to Other Elements» (Revit 2020), Revit Structure «Attaching Structural Objects Together», Autodesk User's Guide «Attaching Walls».

### 1.3 Current State (ο κώδικας που τρέχει — code wins)

| Τι | Πού | Κατάσταση |
|----|-----|-----------|
| **Datum ορόφου** | ADR-369 (✅ IMPLEMENTED) | `Floor.elevation` = **πάνω επιφάνεια πλάκας** = FFL (πάτωμα→πάτωμα). Πλάκα/δοκάρι κρέμονται προς τα κάτω. **ΑΠΟΦΑΣΙΣΜΕΝΟ.** |
| **Wall vertical binding** | `bim/types/bim-binding.ts`, `wall-types.ts` | Υπάρχουν `baseBinding` (`storey-floor`\|`absolute`), `topBinding` (`storey-ceiling`\|`absolute`\|`unconnected`), `baseOffset`/`topOffset`/`unconnectedHeight`. |
| **Πραγματικό ύψος γεωμετρίας** | `bim/geometry/wall-geometry.ts:117`, `bim-3d/converters/wall-opening-extrude.ts:64` | ⚠️ Χρησιμοποιούν **απευθείας `params.height`**. Τα bindings είναι **σχεδόν διακοσμητικά** — δεν παράγουν resolved height. |
| **Vertical-extent resolver (μερικός)** | `bim-3d/2d-section/section-intersect.ts:96` `toWallPlan()` | Μόνο εδώ resolved-από-binding (baseY/topY). Κοιτάζει `unconnected`/`absolute`, αλλιώς `baseY + height`. **De-facto SSoT υποψήφιος προς γενίκευση.** |
| **Floor-height cascade** | `src/app/api/floors/floor-height-cascade.service.ts` | Όταν αλλάζει `floor.height` → recompute `params.height` για `topBinding='storey-ceiling'` τοίχους/κολώνες. Τύπος: `floor.height·1000 + topOffset − baseOffset`. ⚠️ **Αγνοεί πλάκα/δοκάρι** (δίνει 3000, όχι 2850). Server batch + EntityAudit. |
| **Hosted-opening cascade** | ADR-363 §5.4 `cascadeHostedOpeningsForWalls` | Pattern «το παιδί ακολουθεί τον γονιό σε ΟΛΑ τα transform paths». **Mirror για attach.** |
| **Plan-overlap utils** | `bim/geometry/shared/polygon-utils.ts` (`polygonIntersectionAreaMm2`, `clipPolygonBySH`) | Reuse για «ποιοι τοίχοι είναι κάτω από το δοκάρι/πλάκα». |
| **Beam→slab deduction** | `bim/geometry/slab-geometry.ts` + test | Πρότυπο plan-intersection + depth clamp — ίδια μαθηματικά με coverage detection. |

**Συμπέρασμα Phase 1 (Recognition)**: η υποδομή υπάρχει αλλά **ημιτελής** — τα top/base bindings ΔΕΝ καταναλώνονται από τη γεωμετρία, και δεν υπάρχει καθόλου «attach σε συγκεκριμένο structural element». Το ADR-369 §9 Q5 το είχε προβλέψει ως «auto-stretch cascade» αλλά υλοποιήθηκε μόνο floor-driven (storey-ceiling), όχι element-driven.

---

## 2. Decision

**Συσχετιστικά (associative) Top/Base Constraints για τοίχους BIM, με δυνατότητα «Attach to Structural» σε δοκάρι/πλάκα, ευθυγραμμισμένα με Revit + το datum του ADR-369.**

### 2.1 Δύο επίπεδα δέσμευσης (constraint)

1. **Storey-level constraints** (ήδη υπάρχουν, ενεργοποιούνται σωστά):
   - `baseBinding`/`topBinding` με σημασία ADR-369. Το `topBinding='storey-ceiling'` διορθώνεται ώστε να **αφαιρεί την πλάκα οροφής** (top = επόμενο FFL − πάχος πλάκας), όχι σκέτο floor-to-floor.
2. **Element-level attach** (νέο — η καρδιά του ADR):
   - Νέα τιμή `topBinding = 'attached'` + νέο πεδίο `attachTopToId?: string` (FK → beam ή slab entity).
   - Το πραγματικό ύψος **υπολογίζεται ζωντανά** = κάτω παρειά του host − βάση τοίχου. **Δεν αποθηκεύεται** ως `height`.
   - Mirror για βάση: `baseBinding='attached'` + `attachBaseToId?` (π.χ. πάνω σε δοκό θεμελίωσης) — Phase 2.

### 2.2 SSoT — `resolveWallTopProfile(wall, ctx)` (νέο, centralized) — FULL ENTERPRISE

ΕΝΑΣ pure resolver, **μοναδική** πηγή για το κατακόρυφο εύρος τοίχου. Επειδή επιλέξαμε FULL (όχι single-scalar height), ο resolver επιστρέφει **προφίλ κορυφής** κατά μήκος του άξονα του τοίχου — υποστηρίζει **σκαλωτή** (πολλαπλά δοκάρια/μερική κάλυψη) και **κεκλιμένη** (κεκλιμένο δοκάρι/στέγη) κορυφή. Καταναλώνεται από **ΟΛΑ** τα paths (3D extrude, section, BOQ, grips, dimensions, 2D annotation):

```ts
interface WallVerticalContext {
  readonly floorElevationMm: number;            // FFL του ορόφου του τοίχου (ADR-369)
  readonly nextFloorElevationMm?: number;       // FFL επόμενου ορόφου (storey-ceiling)
  readonly ceilingSlabThicknessMm?: number;     // πάχος πλάκας οροφής (storey-ceiling − slab)
  /** Επιστρέφει την κάτω-παρειά ενός host ως συνάρτηση κατά μήκος άξονα (mm)
   *  + plan-overlap span [t0,t1] (0..1) πάνω στον τοίχο. null = δεν βρέθηκε. */
  readonly resolveHost?: (id: string) => HostUndersidePlan | null;
  /** Όλοι οι structural hosts του ορόφου — για auto-detect κάλυψης κατά μήκος. */
  readonly candidateHosts?: readonly HostUndersidePlan[];
}
/** Γραμμικό προφίλ κάτω-παρειάς host προβαλλόμενο στον άξονα τοίχου. */
interface HostUndersidePlan {
  readonly hostId: string;
  readonly hostType: 'beam' | 'slab' | 'roof' | 'wall';
  readonly t0: number; readonly t1: number;     // span κάλυψης (0..1) πάνω στον άξονα
  readonly z0mm: number; readonly z1mm: number;  // underside στα t0, t1 (γραμμικό → κεκλιμένο)
}
/** Ένα τμήμα κορυφής: από t0 έως t1, top πηγαίνει γραμμικά z0→z1. */
interface WallTopSegment {
  readonly t0: number; readonly t1: number;
  readonly z0mm: number; readonly z1mm: number;
  readonly source: 'attached' | 'storey-ceiling' | 'absolute' | 'unconnected' | 'fallback';
  readonly hostId?: string;
}
interface WallTopProfile {
  readonly baseZmm: number;
  readonly segments: readonly WallTopSegment[];  // ordered, καλύπτουν [0,1] χωρίς κενά
  readonly maxTopZmm: number;                    // για bbox
  readonly hasAttach: boolean;
  readonly missingHostIds: readonly string[];    // hosts που λείπουν → fallback + warning
}
```

**Κανόνας σύνθεσης (lower-envelope)**: για κάθε σημείο `t` του άξονα, η κορυφή = το **χαμηλότερο** όριο μεταξύ όλων των hosts που καλύπτουν το `t` + του storey-ceiling. Όπου δεν καλύπτει κανείς host → storey-ceiling (ή nominal fallback). Έτσι βγαίνει αυτόματα και η σκαλωτή (διαφορετικά δοκάρια) και η μερική κάλυψη (το ακάλυπτο μέρος μένει ψηλά).

- `params.height` υποβιβάζεται σε **nominal/unattached fallback** (όπως το Revit «Unconnected Height»): ισχύει μόνο όπου δεν υπάρχει host ούτε storey-ceiling. Host λείπει (σβήστηκε) → segment πέφτει σε fallback + `missingHostIds`.
- Το υπάρχον `toWallPlan()` (`section-intersect.ts`) γίνεται **consumer** του resolver (παράγει το single-segment ή stepped προφίλ), όχι παράλληλη λογική. Single host οριζόντιος → ένα segment με z0=z1 (back-compat με ίσιο τοίχο).

### 2.3 Host underside formula (ADR-369 datum)

```
beam.underside(t)  = beam.topElevation(t) − beam.depth      (κρέμεται κάτω· κεκλιμένο → z0≠z1)
slab.underside     = slab.levelElevation + heightOffset − slab.thickness
roof.underside(t)  = γραμμικό κατά την κλίση (Phase E2)
wall.top(t)        = min{ host.underside(t) : host καλύπτει t } ⊓ storeyCeiling   (lower envelope)
```

### 2.4 Γεωμετρία στερεού (stepped/sloped prism) — 3D + section

Το στερεό του τοίχου παύει να είναι απλό box-extrude. Γίνεται **prism με επίπεδη βάση και πολυγραμμική/κεκλιμένη κορυφή** που ακολουθεί το `WallTopProfile`: ανά segment, η κορυφή είναι quad/τραπέζιο (z0→z1). 3D: build top faces per segment (mirror `wall-opening-extrude` piece-wise). Section/2D height annotation: ίδιο προφίλ. BOQ volume: Σ (segment area × thickness), όχι `length×height`.

### 2.5 Attach UX — auto + manual (FULL Revit parity + βελτίωση)

**Auto-attach** κατά το **commit τοποθέτησης δοκαριού/πλάκας**:
1. Plan-overlap detection (reuse `polygonIntersectionAreaMm2`) → ποιοι τοίχοι του ίδιου ορόφου περνούν από κάτω (+ span t0..t1).
2. Για κάθε τέτοιον τοίχο **με `topBinding='storey-ceiling'`** (default «ελεύθερη» κορυφή): καταχωρείται attach στον host. Τοίχοι ήδη `absolute`/`unconnected`/manual → **δεν** πειράζονται.
3. **Undoable** ενιαία command (`AttachWallsTopCommand`) — ένα undo αναιρεί όλο το auto-attach.

**Manual attach/detach** (Revit parity, Phase D): ribbon «Κόλλησε κορυφή σε…» (pick host) + «Αποκόλληση». Πολλαπλά attach σε διαφορετικά spans → σκαλωτό προφίλ (§2.2). FULL: ο τοίχος κρατά **λίστα** `attachTopToIds: string[]` (όχι μόνο ένα) ώστε να δένει σε πολλά δοκάρια ταυτόχρονα.

### 2.6 Associative cascade (mirror ADR-363 §5.4) — FULL SSoT

ΕΝΑ SSoT `cascadeStructuralAttachForHosts(hostIds, scene)` καλείται σε **ΟΛΑ** τα transform paths του host (move/rotate/scale/grip/depth-edit/delete) **και** του τοίχου (ώστε να ξαναϋπολογιστεί η κάλυψη/προφίλ αν μετακινηθεί ο τοίχος). Επιστρέφει τους τοίχους με αλλαγμένο προφίλ για re-render/persist. Client (live command) + server batch (mirror `floor-height-cascade.service.ts`) με EntityAudit. Idempotent· belt-and-suspenders no-op όταν μηδέν επηρεαζόμενοι.

---

## 3. Datum Convention (ΑΠΟΦΑΣΙΣΜΕΝΟ — ADR-369, εδώ μόνο επανάληψη)

`Floor.elevation` = **πάνω επιφάνεια τελειωμένης πλάκας (FFL)** = το πάτωμα που πατάς. Ύψος ορόφου = πάτωμα→πάτωμα. Πλάκα & δοκάρι κρέμονται προς τα κάτω. Top-of-structural = `FFL − finishThickness` (default 80mm). **Επιλογή Α — δεν ξανανοίγει.**

---

## 4. SSoT & επαναχρησιμοποίηση (no duplicates)

| Ανάγκη | Υπάρχον SSoT προς reuse |
|--------|-------------------------|
| Datum/elevation | `bim/utils/bim-floor-utils.ts` `getEntityAbsoluteElevation`, ADR-369 |
| Vertical-extent | επέκταση `section-intersect.ts toWallPlan` → νέο `resolveWallTopProfile` (stepped/sloped) |
| Coverage detection | `shared/polygon-utils.ts` `polygonIntersectionAreaMm2`, `clipPolygonBySH` |
| Cascade pattern | ADR-363 §5.4 `cascadeHostedOpeningsForWalls` (client) + `floor-height-cascade.service.ts` (server) |
| Floors SSoT | `useFloorsByBuilding` (FLOORS doc), ADR-399 |
| Audit | `EntityAuditService.recordChange` (ADR-195) |

---

## 5. Φάσεις υλοποίησης (FULL — όλες εντός scope, ΥΠΟ ΕΓΚΡΙΣΗ σειράς)

- **Phase A — Resolver SSoT**: `resolveWallTopProfile` (stepped/sloped, lower-envelope) + `topBinding='attached'` + `attachTopToIds: string[]` στους τύπους/Zod. Διόρθωση `storey-ceiling` ώστε να αφαιρεί πλάκα οροφής. `section-intersect`, 3D extrude, bbox, BOQ → consumers του resolver.
- **Phase B — Stepped/sloped solid**: piece-wise prism geometry (top faces per segment) σε 3D + section + 2D height annotation + BOQ volume integration.
- **Phase C — Associative cascade**: `cascadeStructuralAttachForHosts` σε όλα τα host & wall transform paths (client commands + server batch + EntityAudit). Detach-on-host-delete → fallback nominal + warning.
- **Phase D — Auto-attach UX**: εντοπισμός τοίχων κατά την τοποθέτηση δοκαριού/πλάκας + `AttachWallsTopCommand` (undoable, batch).
- **Phase E — Manual attach/detach ribbon** (Revit parity: «Κόλλησε κορυφή σε…» / «Αποκόλληση», multi-host) **+ E2 κεκλιμένη στέγη/δοκάρι** + base-attach (δοκός θεμελίωσης).
- **Phase F — Column mirror** (ίδιος resolver + cascade, generalized).

---

## 6. Edge cases — ΑΠΟΦΑΣΙΣΜΕΝΑ (FULL ENTERPRISE + FULL SSOT, Giorgio 2026-05-30)

| Θέμα | Απόφαση |
|------|---------|
| **Πολλαπλά δοκάρια / μερική κάλυψη** | **Σκαλωτή κορυφή** — ο τοίχος ακολουθεί το **χαμηλότερο όριο** ανά τμήμα (lower-envelope, §2.2). Ακάλυπτο μέρος → storey-ceiling. Όχι single-scalar height. |
| **Trigger** | **Auto + manual** — auto-attach (undoable) κατά την τοποθέτηση host + χειροκίνητο attach/detach ribbon (Revit parity). |
| **Ποια στοιχεία «κολλάνε»** | **Όλα τα valid**: δοκάρι, πλάκα οροφής, στέγη (κεκλιμένη), τοίχος από πάνω. `attachTopToIds` λίστα. |
| **Σβήσιμο host** | Ο τοίχος επιστρέφει αυτόματα στο nominal/storey-ceiling + `missingHostIds` warning flag (associative cascade). |
| **Χειροκίνητη αλλαγή ύψους attached τοίχου** | **Σπάει το attach** → γίνεται `unconnected` με το νέο ύψος (Revit parity). |
| **Κεκλιμένο δοκάρι/στέγη** | **Εντός scope** — γραμμικό underside z0→z1 ανά segment (Phase B/E2). |

---

## 7. Tests (προβλεπόμενα)

- `resolve-wall-top-profile.test.ts` — attached/storey-ceiling(−slab)/absolute/unconnected/fallback· **lower-envelope** σκαλωτό (2 δοκάρια)· μερική κάλυψη· κεκλιμένο (z0≠z1)· παράδειγμα 3,00→2,85→2,50.
- `structural-attach-cascade.test.ts` — host move/scale/depth-edit/delete → wall προφίλ· πολλαπλά δοκάρια· idempotent· detach-on-delete + warning.
- `auto-attach-detection.test.ts` — plan-overlap, μερική κάλυψη (span t0..t1), μόνο storey-ceiling τοίχοι attach.
- `wall-stepped-solid.test.ts` — piece-wise prism: 3D top faces per segment + BOQ volume integration.
- Regression: `wall-geometry`, `wall-opening-extrude`, `section-intersect` με νέο resolver.

---

## 8. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-05-30 | Giorgio + Claude (Opus 4.8) | Initial PROPOSED — έρευνα (ADR-369 datum ήδη αποφασισμένο = Επιλογή Α· current code: bindings μη-καταναλωμένα από geometry· floor-height-cascade υπάρχει· hosted-opening cascade pattern). Industry Revit Attach Top/Base. Decision: associative resolver + element attach + auto-attach UX. Q&A §6 ανοιχτό. |
| 2026-05-30 | Giorgio + Claude (Opus 4.8) | **Giorgio: «ΘΕΛΩ ΛΟΓΙΚΗ ΚΑΙ ΥΛΟΠΟΙΗΣΗ FULL ENTERPRISE + FULL SSOT».** Όλα τα §6 ανοιχτά → ΑΠΟΦΑΣΙΣΜΕΝΑ στην πλήρη μορφή: σκαλωτή/κεκλιμένη κορυφή (lower-envelope `resolveWallTopProfile` αντί single-scalar), `attachTopToIds[]` multi-host (δοκάρι/πλάκα/στέγη/τοίχος), auto+manual attach, detach-on-delete+warning, manual-edit-breaks-attach. §2.2 resolver → top-profile· §2.4 stepped/sloped solid· §5 φάσεις A-F (όλες in-scope). |
