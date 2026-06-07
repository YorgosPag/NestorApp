# HANDOFF — Νέοι τύποι κουφωμάτων BIM (Revit-grade door/window families)
**Ημερομηνία:** 2026-06-07
**Προηγούμενη συνεδρία:** Opus 4.8 (opening grips + SSoT centralization)
**Νέα συνεδρία:** Opus — **FULL ENTERPRISE + FULL SSOT**, Revit-grade
**Working tree:** ΚΟΙΝΟ με άλλον agent — **ΟΧΙ commit/push** (ο Giorgio κάνει commit)

---

## 0. ΣΕΙΡΑ ΕΡΓΑΣΙΩΝ (υποχρεωτική — ο Giorgio το όρισε ρητά)

1. **DEEP WEB RESEARCH**: Έρευνα στο διαδίκτυο για το τι ΑΚΡΙΒΩΣ κάνει η **Revit** —
   πόσα είδη κουφωμάτων (door + window families/types) χρησιμοποιεί και ποια είναι αυτά
   (2D plan symbol + 3D + παράμετροι ανά τύπο). Χρησιμοποίησε το `/deep-research` skill ή
   WebSearch/WebFetch. Κατάγραψε πηγές.
2. **ΝΕΟ ADR** (επόμενο ελεύθερο = **ADR-421** — επιβεβαίωσε πρώτα από
   `docs/centralized-systems/reference/adr-index.md`, μπορεί ο άλλος agent να πήρε 421):
   τεκμηρίωσε τους νέους τύπους, geometry/2D symbol/3D/IFC mapping ανά τύπο, decision.
3. **ΔΙΕΥΚΡΙΝΙΣΤΙΚΕΣ ΕΡΩΤΗΣΕΙΣ** (AskUserQuestion) ΠΡΙΝ από οποιαδήποτε υλοποίηση —
   ποιους τύπους να υλοποιήσουμε, scope (2D-only ή και 3D mesh;), προτεραιότητες, IFC.
4. **ΥΛΟΠΟΙΗΣΗ** (Plan Mode πρώτα) — full enterprise + full SSOT, μηδέν fork, μηδέν `any`,
   i18n-first, <500 γρ/αρχείο, <40 γρ/function, ADR-driven (N.0.1).

> ΠΡΟΣΟΧΗ: ΜΗΝ υλοποιήσεις πριν τα βήματα 1-3. Ο Giorgio θέλει research → ADR → ερωτήσεις → κώδικα.

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ

Σήμερα υπάρχουν **5 είδη** κουφωμάτων· ο Giorgio θέλει **περισσότερους τύπους σαν τη Revit**
(όχι μόνο ανοιγόμενο μονόφυλλο). Π.χ. (ενδεικτικά — η έρευνα θα δώσει την πλήρη/σωστή λίστα):
- **Πόρτες (IfcDoor):** single-flush, double-flush, sliding (μονό/διπλό), bi-fold, pocket,
  overhead/garage (γκαραζόπορτα), revolving, κ.λπ.
- **Παράθυρα (IfcWindow):** fixed, casement (ανοιγόμενο), double/single-hung, horizontal-sliding,
  awning (ανακλινόμενο πάνω), hopper (ανακλινόμενο κάτω), tilt-and-turn, bay/bow, louvre, κ.λπ.

Η Revit τα διαχειρίζεται ως **Families → Types** (Family = κατηγορία γεωμετρίας, Type = συγκεκριμένες
διαστάσεις/παράμετροι). Σκέψου αν το δικό μας μοντέλο θα είναι: (α) επέκταση του `OpeningKind`
enum, ή (β) ένα Family/Type σύστημα σαν το **ADR-412 BIM Family Types** (που υπάρχει ήδη για
walls/slabs — δες αν επαναχρησιμοποιείται). Αυτό είναι θέμα για τις διευκρινιστικές ερωτήσεις.

---

## 2. ΤΙ ΕΓΙΝΕ ΜΟΛΙΣ (context — UNCOMMITTED, ο Giorgio θα κάνει commit)

**ADR-363 §5.4/§6 Phase 2.5 — Πλήρεις λαβές κουφώματος + SSoT centralization:**
- Το κούφωμα εμφανίζει πλέον **6 grips** (4 γωνίες + περιστροφή=flip handing + μετακίνηση),
  ίδιο centred-box vocabulary με έπιπλα/MEP (`bim/grips/centred-box-grips.ts`).
- 🐛 Διορθώθηκε **unit mismatch** (drag δεν δούλευε σε σχέδια μέτρων): NEW SSoT
  **`projectPointToWallOffsetMm(point, hostWall)`** στο `bim/geometry/opening-geometry.ts`
  (scene-units→mm), που χρησιμοποιούν ΚΑΙ creation (`opening-completion.ts`) ΚΑΙ grip-drag.
- Αρχεία: `grip-kinds.ts`, `opening-grips.ts`, `OpeningRenderer.ts` (getGrips), `grip-glyph-registry.ts`,
  `opening-geometry.ts` (+SSoT), `opening-completion.ts`, tests. tsc 0 (scope), 81/81 PASS.
- **ΣΗΜΑΝΤΙΚΟ για το νέο work:** οποιοσδήποτε νέος τύπος που κρατά footprint = width × wall-thickness
  **κληρονομεί ΟΛΑ τα 6 grips ΔΩΡΕΑΝ** (μηδέν αλλαγή στο grip σύστημα).

---

## 3. ΥΦΙΣΤΑΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΚΟΥΦΩΜΑΤΩΝ (SSoT — ΠΡΩΤΑ διάβασε αυτά)

**Governing ADR:** `ADR-363-bim-drawing-mode.md` §5.4 (το opening ADR).

| Concern | Αρχείο | Σημείωση |
|---|---|---|
| Types/schema | `bim/types/opening-types.ts` (+`opening.schemas.ts` zod) | `OpeningKind` (5), `OpeningParams`, `OPENING_KIND_DEFAULTS`, `isHingedKind`/`isGlazedKind` |
| Geometry | `bim/geometry/opening-geometry.ts` | `computeOpeningGeometry`· `buildHingeArc` (door/french)· `buildOutline` (κοινό rect)· `projectPointToWallOffsetMm` SSoT |
| 2D render | `bim/renderers/OpeningRenderer.ts` (+`opening-kind-style.ts`) | `drawKindOverlay`: hinge arc / sliding line / glazing. ADR-040-sensitive |
| 3D | `bim-3d/converters/wall-opening-extrude.ts` + `wall-opening-pieces.ts` | **kind-agnostic σήμερα** (ορθογώνιο κενό στον τοίχο· ΚΑΝΕΝΑ 3D mesh κουφώματος) |
| Creation tool | `hooks/drawing/useOpeningTool.ts` + `opening-completion.ts` | FSM· `buildDefaultOpeningParams` |
| Ribbon UI | `ui/ribbon/data/contextual-opening-tab.ts` (`OPENING_KIND_OPTIONS`) + `useRibbonOpeningBridge.ts` | combobox επιλογής kind |
| Validator | `bim/validators/opening-validator.ts` | code violations (door+sill) |
| Factory/IFC | `services/factories/opening.factory.ts` (`inferOpeningIfcType`) | IfcDoor/IfcWindow ανά kind |
| Persistence | `hooks/data/useOpeningPersistence.ts` + `bim/walls/opening-firestore-service.ts` | event-driven |
| Mark/Tag | `bim/walls/opening-mark-allocator.ts` + `opening-mark-service.ts` (ADR-376) | prefix ανά kind μέσω i18n |
| Schedule | `bim/schedule/schedule-presets.ts` (`openingKindToScheduleType`) + builder + PDF exporter | door/window presets |
| BOQ/ΑΤΟΕ | `bim/config/bim-to-atoe-mapping.ts` (`OPENING_MAPPING`) + `opening-boq-grouper.ts` | ανά kind |
| Grips | `bim/walls/opening-grips.ts` | 6 grips, footprint-driven (κληρονομούνται) |

---

## 4. REGISTRATION SURFACE — «για να προσθέσεις νέο OpeningKind, αγγίζεις ΑΥΤΑ» (checklist)

(Αν η απόφαση είναι enum-extension· αν γίνει Family/Type σύστημα → άλλη προσέγγιση, δες ADR-412.)

1. `OpeningKind` union — `opening-types.ts`
2. `OpeningKindSchema` zod — `opening.schemas.ts`
3. `OPENING_KIND_DEFAULTS` (width/height/sill) — `opening-types.ts`
4. `isHingedKind`/`isGlazedKind` — `opening-types.ts`
5. Geometry: νέος builder ή branch (αν νέο plan symbol/swing) — `opening-geometry.ts` (`buildHingeArc` ή νέο)
6. 2D renderer: `drawKindOverlay` branch + `openingOutlineSubcat`/`openingOverlaySubcat` — `OpeningRenderer.ts`
7. Χρώμα: `OPENING_KIND_STROKE` — `opening-kind-style.ts`
8. IFC: `inferOpeningIfcType` — `opening.factory.ts`
9. ΑΤΟΕ/BOQ: `OPENING_MAPPING` — `bim-to-atoe-mapping.ts`
10. Schedule routing: `openingKindToScheduleType` — `schedule-presets.ts`
11. Ribbon combobox: `OPENING_KIND_OPTIONS` — `contextual-opening-tab.ts`
12. i18n label: `ribbon.commands.openingEditor.kind.<kind>` — el+en `dxf-viewer-shell.json`
13. i18n mark prefix: `opening.tag.prefix.<kind>` — el+en
14. Validator (προαιρετικά) code violations — `opening-validator.ts`
15. ADR-421 (νέο)

**ΚΛΗΡΟΝΟΜΟΥΝΤΑΙ (ΟΧΙ αλλαγή):** grips (6 grips footprint-driven), 3D wall-cut (kind-agnostic),
mark service/allocator (dynamic i18n), firestore, BOQ grouper (kind=grouping key), PDF exporter.

⚠️ **ΠΡΟΣΟΧΗ — exhaustive `Record<OpeningKind, …>` maps:** προσθήκη kind σπάει type-check σε
ΟΛΑ τα exhaustive maps (OPENING_KIND_DEFAULTS, OPENING_KIND_STROKE, OPENING_MAPPING,
RenumberOpeningsHost `kindPrefixes`). Ο tsc τα δείχνει — καλό compile-time safety net.

---

## 5. ΚΑΝΟΝΕΣ

- **Working tree ΚΟΙΝΟ → ΟΧΙ commit/push** (ο Giorgio αποφασίζει).
- **FULL ENTERPRISE + FULL SSOT** (Revit-grade), GOL (N.7): μηδέν `any`/inline styles/hardcoded strings,
  i18n-first, <500 γρ/αρχείο, <40 γρ/function.
- **ADR-driven (N.0.1):** ADR-421 + ενημέρωση adr-index + local_ΕΚΚΡΕΜΟΤΗΤΕΣ (N.15) στο ίδιο work.
- **Γλώσσα:** απαντάς ΠΑΝΤΑ Ελληνικά.
- **Plan Mode** πριν τον κώδικα. Αν 5+ αρχεία & 2+ domains → ενημέρωσε για Orchestrator (N.8).
- **ADR-040:** ο `OpeningRenderer` είναι canvas-renderer — αν αλλάξει, δες CHECK 6D/stage ADR.
- **Tests:** unit tests ανά νέο kind (geometry symbol + IFC + schedule routing).

---

## 6. PROMPT ΓΙΑ COPY-PASTE ΣΤΗ ΝΕΑ ΣΥΝΕΔΡΙΑ

```
Διάβασε το αρχείο C:\Nestor_Pagonis\HANDOFFS\HANDOFF-bim-opening-types-revit-2026-06-07.md και
ακολούθησε ΑΥΣΤΗΡΑ τη σειρά: (1) κάνε DEEP web research για το τι ακριβώς κάνει η Revit — πόσα
και ποια είδη κουφωμάτων (πόρτες + παράθυρα families/types) χρησιμοποιεί, με 2D plan symbol + 3D +
παραμέτρους ανά τύπο, κατάγραψε πηγές. (2) Γράψε ΝΕΟ ADR (επόμενο ελεύθερο, επιβεβαίωσε από
adr-index) που τεκμηριώνει τους τύπους + geometry/2D/3D/IFC ανά τύπο. (3) ΠΡΙΝ υλοποιήσεις, κάνε
διευκρινιστικές ερωτήσεις (ποιους τύπους, scope 2D/3D, IFC, enum-extension vs Family/Type σύστημα).
(4) Μετά υλοποίησε με Plan Mode, FULL ENTERPRISE + FULL SSOT, Revit-grade. ΜΗΝ υλοποιήσεις πριν τα
βήματα 1-3. Working tree κοινό — ΜΗΝ κάνεις commit. Opus. Απάντα Ελληνικά.
```
