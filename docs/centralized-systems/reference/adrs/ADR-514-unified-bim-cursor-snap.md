# ADR-514 — Unified BIM Cursor Snap («Ένας Εγκέφαλος Έλξης», Revit-grade)

- **Status**: 🟡 IN PROGRESS — Φ1 foundation + Φ2 column wiring DONE (jest GREEN, UNCOMMITTED), Φ2 pending browser-verify · Φ3-Φ5 TODO
- **Date**: 2026-06-24
- **Category**: DXF Viewer — Snapping (Master companion to ADR-378)
- **Related**: ADR-378 (Snap Master Architecture), ADR-398 (Column placement snap), ADR-508 (Unified linear-member framing), ADR-040 (Preview Canvas perf)

---

## 1. Context — η αλήθεια μετά από βαθιά χαρτογράφηση (2026-06-24)

Διεξήχθη πλήρης χαρτογράφηση ΟΛΩΝ των μηχανισμών έλξης (snap) στο `/dxf/viewer` με στόχο FULL
SSoT. Το εύρημα: η έλξη είναι **ήδη ~90% κεντρικοποιημένη** (ADR-378 master). Υπάρχουν δύο
συμπληρωματικοί «κόσμοι»:

- **Κόσμος Α — OSNAP point engine** (`ProSnapEngineV2`, 26 sub-engines, singleton `getGlobalSnapEngine()`).
  Εφαρμόζεται **κεντρικά** στο cursor pipeline: ο `snap-scheduler` γράφει το snapped σημείο στο
  `ImmediateSnapStore` σε κάθε move (preview)· ο `mouse-handler-up` εφαρμόζει `findSnapPoint` στο click
  point ΠΡΙΝ φτάσει σε οποιοδήποτε tool (commit). **Όλα τα tools** (incl. wall/beam/column) ήδη
  λαμβάνουν OSNAP-snapped cursor.
- **Κόσμος Β — BIM placement/face snap**: η ειδικευμένη «έξυπνη» τοποθέτηση δομικού μέλους που τρέχει
  **πάνω** στον ήδη-OSNAP-snapped cursor. `column` → `resolveColumnFaceSnapFromTargets` (9-λαβές +
  polar/rect magnet)· `wall`/`beam` → `resolveMemberGhostSnapFromStore` (column-priority → Τ-framing).

### Το πρόβλημα (η μόνη γνήσια ασυμμετρία)

Η επίλυση «πού πάει ο BIM cursor» (Layer 2 placement) ζει σε **3 διάσπαρτα σημεία**:

1. `systems/cursor/mouse-handler-up.ts` — bespoke branch **μόνο** για την κολώνα (commit).
2. `hooks/drawing/useWallTool.ts` + `useBeamTool.ts` — in-tool calls (commit).
3. `hooks/drawing/*-preview-helpers.ts` — ανεξάρτητες κλήσεις (preview).

Η κολόνα κάνει placement στο pipeline· ο τοίχος/δοκάρι μέσα στο tool. Λειτουργικά δουλεύουν, αλλά:
(α) preview ≡ commit συντηρείται **χειροκίνητα** σε παράλληλο κώδικα ανά εργαλείο, (β) κάθε νέο BIM
εργαλείο που θέλει face-snap πρέπει να ξανα-καλωδιωθεί, (γ) η ασυμμετρία είναι anti-SSoT.

> **Revit reference**: η Revit έχει **ΕΝΑ** snapping subsystem που εξυπηρετεί όλα τα tools ομοιόμορφα
> (point snaps + reference/face snaps σε ΕΝΑ ranked pipeline). Δεν υπάρχει «column κάνει αλλιώς».

## 2. Decision — «Ένας Εγκέφαλος Έλξης»

Εισάγουμε **ΕΝΑ tool-agnostic σημείο εισόδου**, `resolveBimCursorSnap`, που απαντά: «δοθέντος raw
cursor + ενεργού εργαλείου, πού προσγειώνεται το σημείο και σε τι κούμπωσε;». Συνθέτει:

- **Layer 2 (placement, ανά `toolKind`)** → delegates στους ΥΠΑΡΧΟΝΤΕΣ resolvers (μηδέν νέο geometry).
- **Layer 1 (point, OSNAP)** → fallback μέσω injected `findSnapPoint`.

Επιστρέφει discriminated union (`member-placement` | `column-placement` | `point`) — οι placements
column vs member είναι κατηγορηματικά διαφορετικού τύπου, οπότε ΔΕΝ συγχωνεύονται βίαια· ο caller κάνει
branch στο `.kind`. Το πεδίο `point` υπάρχει **πάντα** (τελικό σημείο που κουμπώνει ο cursor).

**SSoT**: `commit` ΚΑΙ `preview` καλούν την ΙΔΙΑ συνάρτηση → **preview ≡ commit by construction**.
Κάθε νέο εργαλείο αποκτά ομοιόμορφη έλξη με μηδέν αντιγραφή.

### Τοποθεσία (μηδέν import cycle)

`bim/placement/bim-cursor-snap.ts` — **πάνω** από `bim/columns` (→ `bim/framing`) και `bim/framing`.
Εισάγει και τους δύο placement resolvers· τίποτα στο columns/framing δεν εισάγει το placement.
**Pure** — zero React/DOM/store· `findSnapPoint` injected → πλήρως testable, type-only εξάρτηση από `snapping`.

## 3. Contract

```ts
type BimSnapToolKind = 'wall' | 'beam' | 'column' | 'point-only';

resolveBimCursorSnap({
  toolKind, cursor, targets: SceneSnapTargets, sceneUnits,
  findSnapPoint?,                // Layer 1 (injected). OPTIONAL — παρέλειψέ το όταν ο cursor
                                 //   είναι ήδη OSNAP-snapped upstream → anti double-snap (§2 wiring).
  memberWidthMm?, memberKinds?,  // wall/beam
  columnOpts?,                   // column polar/rect magnet
}): BimCursorSnap

type BimCursorSnap =
  | { kind: 'member-placement'; placement: MemberGhostSnapResult; point }
  | { kind: 'column-placement'; placement: ColumnFaceSnap;        point }
  | { kind: 'point'; point; snapType: ExtendedSnapType | null; candidate: SnapCandidate | null }
```

Λογική: `column` → `resolveColumnFaceSnapFromTargets`· `wall`/`beam` → `resolveMemberGhostSnapFromStore`
(column-priority μέσα του)· miss/`point-only` → `findSnapPoint` → `point`· κανένα → καθαρός cursor.

## 4. Phases

| Φ | Τι | Status | Verify |
|---|----|--------|--------|
| **Φ1** | Pure SSoT `resolveBimCursorSnap` + tests (6 jest). Μηδέν wiring → μηδέν regression. | ✅ DONE | jest GREEN |
| **Φ2** | Wire **κολόνα**: `mouse-handler-up` column branch (commit) + `column-preview-helpers` (preview) → καταναλώνουν τον εγκέφαλο (`toolKind:'column'`, ΧΩΡΙΣ findSnapPoint = anti double-snap). | ✅ DONE (jest, UNCOMMITTED) | 🔴 browser-verify κολόνα |
| **Φ3** | Wire **wall + beam**: `useWallTool`/`useBeamTool` + `*-preview-helpers` → εγκέφαλος. Εξάλειψη in-tool placement calls. | 🔴 TODO | browser-verify τοίχος/δοκάρι |
| **Φ4** | Ομοιόμορφη έλξη σε νέα tools (slab/roof/foundation-line) μέσω του ΙΔΙΟΥ εγκεφάλου. | 🔴 TODO | browser-verify |
| **Φ5** | SSoT registry entry + ADR-378/398/508 cross-links + dead-code baseline. | 🔴 TODO | pre-commit |

⚠️ **Wiring touches ADR-040 architecture-critical files** (`mouse-handler-up`, snap-scheduler) → CHECK
6B/6D: stage ADR-040 + ADR-514 μαζί. Κάθε φάση browser-verified ΠΡΙΝ την επόμενη (zero-regression gate).

## 5. Consequences

- ✅ FULL SSoT: ΕΝΑ σημείο επίλυσης BIM cursor· preview ≡ commit by construction.
- ✅ Εξάλειψη ασυμμετρίας column-vs-wall/beam.
- ✅ Επεκτασιμότητα Revit-grade: νέο εργαλείο = ΕΝΑ `toolKind`, μηδέν αντιγραφή.
- ⚠️ Layer 1 (OSNAP) **παραμένει** κεντρικά στο pipeline (ήδη σωστό)· ο εγκέφαλος ΔΕΝ διπλο-εφαρμόζει
  point-snap — ο `findSnapPoint` καλείται **μόνο** στο fallback. Wiring πρέπει να αποφύγει double-snap.

## 6. Changelog

- **2026-06-24** — Φ1: δημιουργία `bim/placement/bim-cursor-snap.ts` (pure SSoT) + 6 jest. ADR created.
  (Αντικατέστησε ενδιάμεσο `bim/framing/unified-cursor-snap.ts` — στενότερο member+point — για μηδέν
  επικαλυπτόμενα SSoT.)
- **2026-06-24** — Φ2 (column wiring, UNCOMMITTED): `findSnapPoint` → **optional** στον εγκέφαλο
  (anti double-snap, §2: ο cursor έρχεται ήδη OSNAP-snapped κεντρικά). Wired **commit**
  (`systems/cursor/mouse-handler-up.ts` — column branch τώρα καλεί `resolveBimCursorSnap({toolKind:'column'})`,
  branch στο `.kind==='column-placement'`) + **preview** (`hooks/drawing/column-preview-helpers.ts` —
  ΙΔΙΟ entry point, ίδια opts/targets/cursor → preview ≡ commit by construction). Καθαρό refactor: ΙΔΙΟΙ
  resolvers/stores (`resolveColumnFaceSnapFromTargets` delegate· anchor/rotation/status setters αμετάβλητα),
  μηδέν νέο geometry/store. +2 jest (optional findSnapPoint). 76/76 jest GREEN (placement + column-face-snap).
  tsc: παραλείφθηκε (άλλος agent έτρεχε tsc — N.17 single-tsc). 🔴 browser-verify εκκρεμεί.
  ⚠️ CHECK 6B/6D: stage ADR-040 + ADR-514 μαζί (τροποποιήθηκε `mouse-handler-up.ts`).
