# HANDOFF — ΣΤΕΓΗ ως ζωντανός οργανισμός: 4-φασικό πρόγραμμα (ADR-417 + ADR-487)

**Ημερομηνία:** 2026-06-22 · **Γλώσσα απαντήσεων στον Giorgio: ΕΛΛΗΝΙΚΑ (ΠΑΝΤΑ).**
**Μοντέλο:** Opus (cross-cutting, πολλαπλά domains).
**Working tree: ΜΟΙΡΑΖΕΤΑΙ με άλλους agents → stage ΜΟΝΟ δικές σου γραμμές. COMMIT τον κάνει ο Giorgio (N.(-1)/N.16).**
**FULL ENTERPRISE + FULL SSOT, όπως/καλύτερα από Revit. ΠΡΙΝ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep cross-domain, §3).**

---

## 0. Πλαίσιο — πώς προέκυψε

Μόλις ολοκληρώθηκε το **ADR-404 Φ5c: κεκλιμένη/ρύση ΠΛΑΚΑΣ UX** (UNCOMMITTED, βλ. memory `reference_slanted_slab_ux.md`).
Ο Giorgio ζήτησε «**το ίδιο σύστημα και στη στέγη**» και, σε ερώτηση κατεύθυνσης, διάλεξε **ΚΑΙ ΤΑ 4** χαρακτηριστικά
(όχι μόνο το UX κλίσης). Είναι ολόκληρο πρόγραμμα — γι' αυτό νέα συνεδρία ανά φάση.

**⚠️ ΜΑΘΗΜΑ ΑΠΟ ΤΟ Φ5c (κόστισε round, ο Giorgio το έπιασε):** το αρχικό SSoT audit έψαξε **slab-specific** και
έχασε ΥΠΑΡΧΟΝ SSoT (`roof-slope-units.ts` deg↔percent — το ξαναέγραψα tan/atan, διορθώθηκε σε delegate· επίσης
`normalizeAngleDeg`). **ΓΙΑ ΤΗ ΣΤΕΓΗ: grep CROSS-DOMAIN (roof/mep/structural/geometry) ΠΡΙΝ γράψεις οτιδήποτε.**

---

## 1. Στόχος (4 φάσεις, Giorgio επέλεξε όλες) — σειρά λόγω εξαρτήσεων

| Φ | Τίτλος | Domain | Εξάρτηση | Scale |
|---|--------|--------|----------|-------|
| **Φ1** | **Per-edge numeric κλίση** (το «ίδιο σύστημα» πλάκας, ανά ακμή) | roof ribbon | καμία (θεμέλιο) | Plan-mode (3-6 αρχεία) |
| **Φ2** | **1-κλικ straight-skeleton** (4-ρριχτη/σύνθετη auto) | roof geometry | Φ1 (per-edge edits) | Μεγάλο (αλγόριθμος) |
| **Φ3** | **Drainage organism** (ροές + EN 12056-3 λούκια/υδρορροές + auto-plug) | roof + MEP | Φ1/Φ2 (faces/slopes) | Μεγάλο, cross-domain |
| **Φ4** | **Φορτία χιονιού/ανέμου ανά νερό** (EN 1991-1-3/1-4 → structural organism) | roof + structural | Φ1/Φ2 (faces) | Μεσαίο, cross-domain |

**Σύσταση εκκίνησης: Φ1** (αυτοτελές, reuse-heavy, ξεκλειδώνει τα υπόλοιπα). Τα Φ2-Φ4 = ξεχωριστές συνεδρίες/ADR.

---

## 2. ΠΩΣ ΔΙΑΦΕΡΕΙ Η ΣΤΕΓΗ ΑΠΟ ΤΗΝ ΠΛΑΚΑ (μην κάνεις copy-paste του Φ5c)

| | Πλάκα (Φ5c ✅) | **Στέγη** |
|---|---|---|
| Μοντέλο κλίσης | **ΕΝΑ επίπεδο** `SlabSlope {direction°, angle%, pivotEdge}` | **ΑΝΑ ΑΚΜΗ** `RoofEdgeSlope {definesSlope, slope, overhangMm}[]` (length == κορυφές outline) |
| Μορφή | — | **Derived** από το ποιες ακμές κλίνουν (flat/mono/gable/hip) — ΟΧΙ kind |
| Geometry | επίπεδο | **`RoofFace[]` (νερά) + `RoofRidgeLine[]` (ridge/hip/valley/eave)** ΗΔΗ υπολογισμένα |
| Μονάδα | %/μοίρες/λόγος (Φ5c, NEW) | **deg/percent ΗΔΗ** (`roof-slope-units.ts` — ίδιο SSoT) |
| Toggle on/off | `geometryType:'box'\|'tilted'` invariant | — (η στέγη είναι πάντα «στέγη»· flat = καμία slope-defining ακμή) |

**Συμπέρασμα:** το «ίδιο σύστημα» = **per-edge numeric** (διάλεξε ακμή → όρισε `slope`/`overhangMm`/`definesSlope`).
Σήμερα η κλίση αλλάζει **όλες** τις ακμές μέσω `applyRoofShapePreset` (shape-based), ΟΧΙ per-edge.

---

## 3. ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT — ΤΙ ΥΠΑΡΧΕΙ (επαληθεύτηκε 2026-06-22, grep)

### Γεωμετρία/τύποι στέγης (ΜΗΝ ξαναγράψεις):
- `bim/types/roof-types.ts` — `RoofParams {outline, edges:RoofEdgeSlope[], slopeUnit, basePivotZ, thickness, dna?, fascia/soffit/tile…}`, `RoofEdgeSlope` (γρ.85), `RoofFace` (γρ.163), `RoofRidgeLine {a,b,kind:'ridge'|'hip'|'valley'|'eave'}` (γρ.174), `RoofGeometry {faces, ridges, projectedAreaM2, grossAreaM2, perimeterM, volumeM3, shape, ridgeHeightMm}` (γρ.186), `RoofShape='flat'|'mono-pitch'|'gable'|'hip'|'complex'` (γρ.69).
- `bim/geometry/roof-slope-units.ts` — **`roofSlopeToRatio`/`roofSlopeFromRatio` (deg↔percent↔rise/run) SSoT** — reuse ΟΠΟΥ υπάρχει μετατροπή κλίσης (το slab Φ5c delegate-άρει εδώ· βλ. pending-ratchet «promote σε generic `slope-units.ts`»).
- `bim/geometry/roof-geometry.ts` — `computeRoofGeometry` + **`applyRoofShapePreset(outline, shape, slope, unit)`** (ξαναχτίζει τα edges ανά μορφή). **straight-skeleton hip/complex = Φ2, ΑΝΟΛΟΚΛΗΡΩΤΟ** (RoofShape έχει 'hip'/'complex' αλλά ο preset δεν τα παράγει πλήρως — ΕΔΩ μπαίνει το Φ2).

### Ribbon/bridge/undo (εδώ μπαίνει το Φ1 UI):
- `ui/ribbon/hooks/useRibbonRoofBridge.ts` — ΗΔΗ: shape combobox, **global** slope, basePivotZ, **global** overhangMm, toggle μοίρες↔ποσοστό. `dispatchParams`→**`UpdateRoofParamsCommand`** (undoable, ΚΑΜΙΑ νέα εντολή). `currentSlope` = 1η slope-defining ακμή· `onComboboxChange` slope → `applyRoofShapePreset` (όλες οι ακμές). **Per-edge ΔΕΝ υπάρχει.**
- `ui/ribbon/hooks/bridge/roof-command-keys.ts` — `ROOF_RIBBON_KEYS` (shape/slope/basePivotZ/overhangMm) + `isRoofRibbonKey`/`isRoofRibbonStringKey`/`isRoofRibbonToggleKey`. **ΔΙΑΒΑΣΕ ΤΟ ΠΡΩΤΟ** (πρόσθεσε `edge` group).
- `ui/ribbon/data/contextual-roof-tab.ts` — τα panels (πρόσθεσε panel «Ακμή»/«Κλίση ανά νερό»). **ΔΙΑΒΑΣΕ ΤΟ.**
- `core/commands/entity-commands/UpdateRoofParamsCommand.ts` — ΥΠΑΡΧΕΙ· ίδιο για per-edge edit (ΕΝΑ undo).
- `bim/roofs/roof-grips.ts` — **ΔΙΑΒΑΣΕ:** αν υπάρχει per-edge selection/grip → το Φ1 «διάλεξε ακμή» μπορεί να
  κουμπώσει εκεί (edge index από grip). Αλλιώς MVP = dropdown «Ακμή 1..N» ή compass (Β/Ν/Α/Δ ακμή).
- composer: `ui/ribbon/hooks/useRibbonCommands.ts` — δρομολογεί roof keys στον `roofBridge` (γρ.149 + γρ.267).
  **⚠️ ΤΟ ΜΑΘΗΜΑ ΤΟΥ ΤΟΙΧΟΥ/ΠΛΑΚΑΣ:** αν φτιάξεις νέο διακριτό `isRoofEdgeKey` set → πρόσθεσέ το **ΚΑΙ στα 2
  guards** (onComboboxChange + getComboboxState), αλλιώς no-op «δεν ανταποκρίνεται».

### Drainage (Φ3 — reuse, ΜΗΝ φτιάξεις παράλληλο):
- **Ολόκληρο engine** `systems/mep-design/drainage/`: `gravity-router`, `slope-assignment`, `outfall-resolve`,
  **`drainage-sizing`**, `discharge-units`, `drainage-demand`, `drainage-design-types`, `build-drainage-commit`,
  `drainage-proposal-store` + ghost overlay. Φ3 = η στέγη **τροφοδοτεί** αυτό (grossArea → rainwater Q → λούκι/
  υδρορροή· οι υδρορροές = connectors που πιάνει ο `gravity-router`). EN 12056-3 sizing μπαίνει εδώ ή reuse.
- ⚠️ Roof rainwater/gutter ΔΕΝ υπάρχει (grep gutter/downpipe/rainfall → μηδέν στη στέγη). Νέο αλλά πάνω σε υπάρχον engine.

### Structural organism (Φ4 — reuse):
- `bim/structural/organism/` + loads (`bim/structural/loads/`). Φ4 = φορτίο χιονιού/ανέμου ανά `RoofFace` →
  `AppliedMemberLoad`-style → ο οργανισμός ξανα-διαστασιολογεί. Grep `structural/loads/structural-loads-types.ts`.

---

## 4. Φ1 — PLAN (per-edge numeric κλίση) — ΞΕΚΙΝΑ ΑΠΟ ΕΔΩ

**Recognition πρώτα (read):** `roof-command-keys.ts`, `contextual-roof-tab.ts`, `roof-grips.ts` (edge selection;).

**Design (mirror Φ5c slab, προσαρμογή per-edge):**
- **Edge target:** πώς διαλέγει ο χρήστης ακμή; (Α) reuse roof grip edge-selection αν υπάρχει· (Β) MVP dropdown
  «Ακμή» (index ή compass) στο panel. **Ρώτα Giorgio με concrete παράδειγμα** (όπως Φ5c).
- **NEW `roof-edge-param.ts`** (pure SSoT, mirror `slab-slope-param.ts`): resolve/apply για `edge.slope`/
  `edge.overhangMm`/`edge.definesSlope` της ΕΠΙΛΕΓΜΕΝΗΣ ακμής· deg↔percent **reuse `roof-slope-units`** (ΜΗΝ
  ξαναγράψεις)· γράφει `{ ...p, edges: p.edges.map((e,i)=> i===sel? {...e, slope}: e) }` → `dispatchParams`.
- `roof-command-keys.ts` += `edge` group (`edgeSelect`/`edgeSlope`/`edgeOverhang`/`edgeDefines`) + `isRoofEdgeKey`.
- `useRibbonRoofBridge.ts` += edge branch (selected-edge state· πιθανό module store ή selection-driven).
- `useRibbonCommands.ts` += `isRoofEdgeKey` στα **2 guards** (ΤΟ ΜΑΘΗΜΑ).
- `contextual-roof-tab.ts` NEW panel «Κλίση ανά νερό» (edge picker + slope + overhang + «ορίζει κλίση;»).
- i18n el+en: `roofEditor.edge.*` + `panels.roofEdge`.
- Tests: `roof-edge-param.test.ts` (per-edge apply, deg/percent reuse, definesSlope toggle αλλάζει μορφή).

**Invariants στέγης:** η μονάδα ζει ΗΔΗ στο `params.slopeUnit` (per-roof, ΟΧΙ per-edge — μην το αλλάξεις σε pref store
όπως η πλάκα· η στέγη το έχει ως δεδομένο). `definesSlope=false` → η ακμή είναι γείσο/αέτωμα (slope αγνοείται).

---

## 5. Φ2/Φ3/Φ4 — sketches (ξεχωριστές συνεδρίες, δικό ADR/phase η καθεμία)

- **Φ2 straight-skeleton:** footprint + uniform slope → πλήρης hip με valleys/ridges. NEW `roof-straight-skeleton.ts`
  (αλγόριθμος· grep αν υπάρχει skeleton οπουδήποτε ΠΡΙΝ — π.χ. offset/medial). Παράγει `edges`+`faces`+`ridges`.
  `applyRoofShapePreset('hip')` → delegate. ⚠️ Δύσκολος αλγόριθμος — δες βιβλιογραφία (Aichholzer straight skeleton).
- **Φ3 drainage organism:** από `RoofFace.slope`+`RoofRidgeLine` (valley=collector, eave=gutter) → ροές +
  EN 12056-3 (`Q = grossArea × i`, i=ένταση βροχής περιοχής) → διατομή λούκι + N×Ø υδρορροών (reuse
  `drainage-sizing`/`discharge-units`)· υδρορροές = connectors → `gravity-router` auto-plug. Βελάκια ροής (2D overlay,
  ⚠️ADR-040 leaf). Ponding warning (flat, ρύση<min). NEW `roof-drainage/` αλλά REUSE το MEP engine.
- **Φ4 snow/wind per face:** EN 1991-1-3 (μ·s_k, drift στα valleys/υπήνεμη) + EN 1991-1-4 → `AppliedMemberLoad` ανά
  RoofFace → structural organism. REUSE `structural/loads` + `structural/organism`.

---

## 6. ADR / Docs (N.0.1 + N.15)
- **ADR-417** (`docs/.../adrs/ADR-417-bim-roof-element.md`) — ο κύριος ADR στέγης· πρόσθεσε phases (Φ1 per-edge,
  Φ2 skeleton, Φ3 drainage, Φ4 loads) ή δικό ADR ανά μεγάλη φάση (Φ2/Φ3/Φ4 αξίζουν δικό ADR).
- **ADR-487** (`ADR-487-living-structural-organism-vision.md`) — το vision (Φ3/Φ4 το υλοποιούν).
- **ADR-404 Φ5c** — το precedent της πλάκας (μοτίβο per-element numeric· `reference_slanted_slab_ux.md`).
- Μετά από ΚΑΘΕ φάση: ADR changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γρ.) + adr-index + MEMORY (N.15).

## 7. Κανόνες (ΠΑΝΤΑ)
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε `Get-CimInstance ... node.exe ... tsc` ΠΡΙΝ). Σε αυτή τη συνεδρία ο full tsc
  έκανε **abort 134 (OOM)** στον υπολογιστή — προτίμησε targeted + βασίσου σε ts-jest type-check.
- **N.(-1)/N.16:** COMMIT/PUSH μόνο ο Giorgio. Shared tree → stage ΜΟΝΟ δικές σου γραμμές (`useRibbonCommands.ts`
  = hot, πολλοί agents).
- **N.11:** i18n el+en πρώτα, μηδέν hardcoded. **N.2/N.3:** μηδέν `any`/inline styles.
- **N.0.2 Boy Scout:** βρήκες διπλότυπο → fix-on-spot (μικρό) ή pending-ratchet (μεγάλο).
- **SSoT audit CROSS-DOMAIN πρώτα** (το μάθημα Φ5c) + απάντα τις σκληρές ναι/όχι του Giorgio με grep evidence.
