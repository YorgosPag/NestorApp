# ADR-523 — Column head multi-reference flush snap (Revit «alignment references»)

- **Status**: **Accepted — Implemented (UNCOMMITTED, browser-verify εκκρεμεί)** (2026-06-25)
- **Date**: 2026-06-25
- **Domain**: DXF Viewer — BIM / Columns / Placement snap
- **Author**: κατόπιν εντολής Giorgio (2026-06-25)
- **Related**: ADR-398 (Column placement snap — §3.9/§3.11 center-on-axis· §3.18 footprint-edge),
  ADR-514 (Unified BIM cursor snap — ο εγκέφαλος), ADR-508 (Unified linear-member framing —
  `buildMemberAxisFrame`/`GhostFaceFrame`), ADR-040 (preview canvas perf — architecture-critical)
- **Ratchet impact**: ΚΑΝΕΝΑ νέο registry/ratchet. ΕΝΑ νέο focused module
  (`column-reference-lines.ts`) + ΕΝΑ νέο geometry export (`tshapeHeadReferences`). FULL SSoT reuse.

---

## 1. Context — το ζητούμενο (Giorgio, 2026-06-25 + στιγμιότυπο)

Εργαλείο **Κολόνα**, τύπος **Σχήμα Τ**. Η **κεφαλή (flange)** έχει πάχος → **τρεις παράλληλες γραμμές
αναφοράς**: βόρεια πλευρά **1-2** (έξω άκρη), κεντρικός **άξονας Γ**, νότια πλευρά **ε** (έσω άκρη). Ο
οριζόντιος **τοίχος** δίνει τρεις αντίστοιχες: βόρεια παρειά **Β**, άξονας **Δ**, νότια παρειά **Χ-Ψ**.

> **Α. Πάντα flush η κεφαλή:** όταν ο κέρσορας κινείται περιμετρικά γύρω από τον τοίχο, η πλευρά **1-2**
> ακουμπά flush στις παρειές (κουμπώνει & ολισθαίνει).
>
> **Β. Multi-reference (κίνηση Ν→Β):** κάθε reference-line της κεφαλής × κάθε reference-line του τοίχου
> → **nearest-wins** κάθετα, με **ολίσθηση κατά μήκος** της παρειάς. Ίδιο με τις «alignment references»
> της Revit.

## 2. Findings — CODE = SOURCE OF TRUTH (SSoT audit 2026-06-25)

- **`resolveAxisCenterFoot` / `resolveMemberAxisCenter`** (`column-face-snap-helpers.ts` / `column-face-snap.ts`):
  ο υπάρχων center-on-axis core κουμπώνει **ΚΕΝΤΡΟ κολόνας ↔ άξονα τοίχου** — το πρότυπο προς **γενίκευση**.
- **`buildMemberAxisFrame(axis, outline)`**: δίνει `{ a, u, alongMin, alongMax, halfThickness }` → ΟΛΕΣ οι
  reference lines του τοίχου χωρίς νέο math (άξονας `a+t·u`, παρειές `± halfThickness·n`).
- **`buildTshapeLocal`** (`column-geometry.ts`): οι φόρμουλες της κεφαλής (βόρεια `+hd`, άξονας
  `hd−flangeDepth/2`, νότια `hd−flangeDepth`, ημι-μήκος `halfFlange`).
- **flat-side / proposed ADR-522**: **ΔΕΝ υλοποιήθηκε** (grep) → ευθυγράμμιση, όχι reuse.
- **multi-reference snap**: **ΚΑΝΕΝΑ** υπάρχον (γνήσια νέο).
- **Κρίσιμο**: ο `resolveColumnFaceSnapFromTargets` **δεν λάμβανε** τα params της κεφαλής → απαιτείται
  threading των head-reference offsets από τα 2 call sites (preview + commit).

## 3. Decision — γενίκευση σε reference-line snapping (FULL SSoT)

1. **NEW geometry SSoT** `tshapeHeadReferences(width, depth, s, override)` (`column-geometry.ts`) — οι 3
   signed perp offsets της κεφαλής (κατά τοπικό y) + ημι-μήκος, από τις **ΙΔΙΕΣ** φόρμουλες με το
   footprint (extract `tshapeMetrics` → μηδέν διπλό math).
2. **NEW module** `bim/columns/column-reference-lines.ts`:
   - `buildColumnHeadReferences(kind, widthMm, depthMm, tshape, sceneUnits)` — **Τ μόνο** σήμερα
     (kind-dispatch· `null` αλλιώς → tier αδρανής). Generic-ready για L/I/U.
   - `resolveColumnHeadReferenceSnap(cursor, walls, head, sceneUnits)` — ο **matcher**: για κάθε τοίχο,
     κάθε ζεύγος (flangeRef × wallRef) × προσανατολισμό (sgn ∈ {+1,−1}), nearest-wins κάθετα εντός
     magnet capture (`MEMBER_GHOST_CAPTURE_MM`), ισοπαλία → **άξονας↔άξονας (Γ↔Δ)**. `position =
     a + along·u + (wp − sgn·p)·n` (η flangeRef πέφτει ΑΚΡΙΒΩΣ στη wallRef), `rotation` = flush
     (0/180 axis-aligned, λοξός → atan2 ±180), ολίσθηση κατά `along`. **Orientation-agnostic** (sgn
     καλύπτει flipY + πλευρά κέρσορα χωρίς special-case).
3. **Tier** στον `resolveColumnFaceSnapFromTargets` (νέο optional `columnHead`): όταν υπάρχει head, οι
   **τοίχοι φεύγουν από το bbox center-on-axis** και πάνε στον multi-reference tier (priority + μηδέν
   διπλό handling)· `headRefHit` μπαίνει **ΠΡΩΤΟ** στο `nearestHit` (ισοπαλία → multi-ref κερδίζει). Το
   **flush περιμετρικά (Α)** μένει μέσω του υπάρχοντος `footprintEdgeHit` (§3.18) — split κατά
   along/perp gating: εντός μήκους+ζώνης → multi-ref· εκτός → flush.
4. **Threading**: `BimCursorSnapInput.columnHead` → `resolveColumnFaceSnapFromTargets`. SSoT convenience
   `resolveColumnHeadReferences(kind, overrides, sceneUnits)` (`column-completion.ts`, ΙΔΙΑ width/depth
   defaults με το commit) → καλείται ΤΑΥΤΟΣΗΜΑ από **preview** (`generateColumnPreview`) ΚΑΙ **commit**
   (`mouse-handler-up`) → **preview ≡ commit by construction**.
5. **faceFrame**: reuse `buildCenteredAxisFaceFrame` → CL listening dims προς τον άξονα τοίχου.

## 4. SSoT reuse (μηδέν διπλότυπο)

`buildMemberAxisFrame` (wall refs), `tshapeHeadReferences`/`tshapeMetrics` (flange refs, ίδιες με
footprint), `axisAlignmentRotationDeg` (flush στροφή), `clamp` (ολίσθηση), `buildCenteredAxisFaceFrame`
(CL dims), `getKindDimensionDefaults` (width/depth defaults), `MEMBER_GHOST_CAPTURE_MM` (magnet capture).
Pure (zero React/DOM/store). Καμία cycle (`column-reference-lines` δεν εισάγει `column-completion`).

## 5. Files

| Αρχείο | Αλλαγή |
|---|---|
| `bim/geometry/column-geometry.ts` | NEW `tshapeHeadReferences` + `TshapeHeadReferences` + extract `tshapeMetrics` (refactor `buildTshapeLocal`, μηδέν αλλαγή footprint) |
| `bim/columns/column-reference-lines.ts` | **NEW** — builder + matcher (multi-reference) |
| `bim/columns/column-face-snap.ts` | `columnHead?` param + `headRefHit` tier (πρώτο στο `nearestHit`)· τοίχοι εκτός bbox όταν head |
| `bim/placement/bim-cursor-snap.ts` | `BimCursorSnapInput.columnHead` + pass-through |
| `hooks/drawing/column-completion.ts` | NEW SSoT convenience `resolveColumnHeadReferences(kind, overrides, sceneUnits)` |
| `hooks/drawing/column-preview-helpers.ts` | preview call site → `columnHead` |
| `systems/cursor/mouse-handler-up.ts` | commit call site → `columnHead` |
| `bim/columns/__tests__/column-reference-lines.test.ts` | **NEW** — 13 jest (refs + matcher + integration) |

## 6. Verification

- **jest**: 13 νέα + 158 regression (`column-face-snap`, `scene-snap-targets`, `bim-cursor-snap`,
  `column-geometry`, `beam-column-face-snap`) → **171/171 GREEN**.
- **Browser (Giorgio, admin)**: Τ-κολόνα κοντά σε οριζόντιο τοίχο· Ν→Β: 1-2→νότια/βόρεια παρειά, Γ→άξονας,
  ε→νότια· ολίσθηση κατά μήκος· περιμετρικά → 1-2 flush. ⚠️ `/dxf/viewer` admin-gated → οπτική
  επαλήθευση από Giorgio. **CHECK 6B/6D → stage ADR-040 + ADR-398/514 + ADR-523 μαζί.**

## 7. Scope / future (Giorgio defaults 2026-06-25)

- **Τ + L** τώρα (§8)· generic-ready (kind-dispatch) → I/U/composite μετά χωρίς refactor.
- **Μόνο κεφαλή/σκέλος** references (όχι κορμός/web).
- **Μόνο τοίχος** στόχος· η αρχιτεκτονική generic για κολόνα/δοκάρι/πλάκα-ακμή αργότερα.
- **Tie-break**: nearest κάθετη· ισοπαλία → άξονας↔άξονας.

## 8. L-shape extension (§L-shape, 2026-06-25, UNCOMMITTED)

**Context (Giorgio + στιγμιότυπο `2026-06-25 010254.jpg`):** φάντασμα κολόνας **Σχήμα Γ (L)** κοντά σε
**οριζόντιο τοίχο** → το **οριζόντιο σκέλος** του L (3 γραμμές: νότια **Α-Β**, άξονας **Γ1**, βόρεια **Δ**)
αγκυρώνει + ολισθαίνει στις 3 του τοίχου (βόρεια **1-2**, άξονας **Γ2**, νότια **Z**), Revit-style, καθώς
ο κέρσορας κατεβαίνει Β→Ν.

**Decision — kind-dispatch, ΟΧΙ νέος μηχανισμός (SSoT audit 2026-06-25):** το handoff πρότεινε νέο
ADR-522 + νέο αρχείο/resolver/tier (`column-lshape-reference-lines.ts`, `resolveLshapeWallAlignSnap`). Ο
SSoT audit έδειξε ότι **αυτό θα ήταν διπλότυπο** του παρόντος ADR-523 — ο matcher
(`resolveColumnHeadReferenceSnap`) ΚΑΙ ο tier είναι ήδη **kind-agnostic**. Κατόπιν εντολής Giorgio →
**επέκταση ADR-523**, μηδέν νέος μηχανισμός/αρχείο/tier.

**Γεωμετρία:** το οριζόντιο σκέλος είναι η κάτω μπάρα του L — εκτείνεται σε ΟΛΟ το πλάτος `[-hw, hw]`
(centered → `alongHalf = hw`), πάχος `armLength`. Οι 3 γραμμές κατά τοπικό y: `−hd` (Α-Β), `−hd+armLength/2`
(Γ1), `−hd+armLength` (Δ) — **κάτοπτρο** της T-κεφαλής (σκέλος στο −y). `flipY` → πρόσημα αντίστροφα
(orientation-agnostic matcher → μηδέν special-case). Επειδή το σκέλος είναι centered στον x, η ολίσθηση
`along` + το tie-break άξονα↔άξονα δουλεύουν ΑΥΤΟΥΣΙΑ όπως στην T.

**Files (extension):**

| Αρχείο | Αλλαγή |
|---|---|
| `bim/geometry/column-geometry.ts` | NEW `lshapeHeadReferences` + `LshapeHeadReferences` + extract `lshapeMetrics` (refactor `buildLshapeLocal`, μηδέν αλλαγή footprint) — mirror του T-shape SSoT |
| `bim/columns/column-reference-lines.ts` | `buildColumnHeadReferences`: +param `lshape` + dispatch `'L-shape' → lshapeHeadReferences` |
| `hooks/drawing/column-completion.ts` | `resolveColumnHeadReferences`: pass `overrides.lshape` |
| `bim/columns/__tests__/column-reference-lines.test.ts` | +9 jest (L-shape γεωμετρία + Β→Ν στάδια + ολίσθηση + integration) |

**Tier/matcher/threading/bim-cursor-snap: ΚΑΜΙΑ αλλαγή** (ήδη generic). FULL SSoT, μηδέν διπλότυπο.

## Changelog

- **2026-06-25** — **§8 L-shape extension** (UNCOMMITTED). Kind-dispatch του υπάρχοντος multi-reference
  matcher σε **L-shape** (οριζόντιο σκέλος ↔ οριζόντιος τοίχος, σενάριο στιγμιότυπου). NEW `lshapeHeadReferences`
  + extract `lshapeMetrics` (SSoT με footprint)· `buildColumnHeadReferences` +`lshape` dispatch· threading
  `overrides.lshape`. **ΟΧΙ νέος μηχανισμός/tier/αρχείο** (handoff πρότεινε ADR-522 — απορρίφθηκε ως διπλότυπο
  μετά SSoT audit, εντολή Giorgio). +9 jest → 164 στο suite, 192/192 regression GREEN. 🔴 browser-verify + commit.
- **2026-06-25** — Initial (Implemented, UNCOMMITTED). NEW `column-reference-lines.ts` (builder +
  multi-reference matcher) + `tshapeHeadReferences` geometry SSoT· tier στον `resolveColumnFaceSnapFromTargets`
  (priority όταν Τ ghost)· threading preview/commit μέσω `resolveColumnHeadReferences` (preview ≡ commit).
  171/171 jest. 🔴 browser-verify + commit (Giorgio).
