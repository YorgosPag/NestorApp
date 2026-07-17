# ADR-674 — Ξεχωριστή προμέτρηση σιδερικών κουφωμάτων (hardware take-off: schedule + priced BOQ)

**Status:** **ΥΛΟΠΟΙΗΜΕΝΟ** — code + tests + i18n· μεγάλο μέρος ήδη committed real-time από τον Giorgio,
εκκρεμεί commit των Phase C leftovers (§9). 140/140 tests πράσινα σε 6 suites.
**Ημερομηνία:** 2026-07-18
**Σχετικά:** ADR-672 (επεξεργάσιμο υλικό ανά κούφωμα — resolver hardware), ADR-673 (κατώφλι),
ADR-363 (schedule presets + ΑΤΟΕ mapping), ADR-395 (BOQ quantities, multi-row stair pattern),
ADR-376 (opening signature-group BOQ aggregation), ADR-441 (foundation multi-row), CLAUDE.md N.8 / N.11 / N.18

---

## 1. Η αφορμή

> «Θέλω ξεχωριστή προμέτρηση σιδερικών: ο εργολάβος να παραγγείλει τα σιδερικά (χειρολαβές/κλειδαριές/
> μεντεσέδες) σαν δική τους γραμμή — 10 πόρτες → 10 χειρολαβές, τόσο κόστος.» — Giorgio, 2026-07-18

Το hardware **υλικό** ανά κούφωμα υπήρχε ήδη (ADR-672: `resolveOpeningMaterial().hardware`, default `mat-metal`)
και είχε 3Δ γεωμετρία (ADR-672 §8 Α). Έλειπε μόνο η **μέτρηση των σιδερικών ως αγοράσιμο αντικείμενο**.

## 2. Ground-truth των μεγάλων (επιβεβαιωμένο πριν τον κώδικα)

- **Revit:** ξεχωριστό **Door Hardware Schedule** (δικό του schedule view) — μία γραμμή ανά πόρτα με το
  hardware set, countable/groupable. ΟΧΙ 4η στήλη μέσα στο door schedule. Το κόστος = cost-parameter στο ίδιο
  schedule ή Material Takeoff.
- **ArchiCAD:** Interactive Schedule → ξεχωριστό listing εξαρτημάτων/hardware ως object parts.
- **Συμπέρασμα:** Revit-grade = **ξεχωριστό Hardware Schedule** (count/takeoff). Η priced γραμμή κόστους
  ανά εξάρτημα είναι επιπλέον επιχειρηματική επιλογή (το ΑΤΟΕ σύστημά μας), πέρα από το Revit default.

## 3. Απόφαση (Giorgio 2026-07-18)

**Και τα δύο παραδοτέα, με ανάλυση ανά εξάρτημα (λαβή + κλειδαριά + μεντεσέδες):**
1. **Hardware Schedule** (Revit Door Hardware Schedule parity) — μία γραμμή ανά κούφωμα, με ανάλυση εξαρτημάτων.
2. **Priced BOQ (ΑΤΟΕ) feed** — μία γραμμή κόστους ανά εξάρτημα (σιδερικά ως purchasable lines).

Επειδή μοντελοποιείται μέχρι σήμερα μόνο η χειρολαβή στο 3Δ, οι ποσότητες των υπόλοιπων εξαρτημάτων
(κλειδαριά/μεντεσέδες/σύρτης/ράγα/μηχανισμός) προέρχονται από **standard hardware-set defaults ανά family**
(Revit Hardware Set) — SSoT κατάλογος, όχι από 3Δ γεωμετρία.

## 4. Αρχιτεκτονική — 3 στρώματα, ένα SSoT μοντέλο

### Α. Hardware-Set SSoT μοντέλο (`bim/family-types/opening-hardware-set.ts`, greenfield)
- `OpeningHardwareComponent` — 9 τιμές: `lever | pull-handle | knob | window-handle | lockset | hinge |
  flush-bolt | sliding-track | friction-stay`.
- `OPENING_HARDWARE_CATALOG: Readonly<Record<OpeningKind, ReadonlyArray<HardwareSetEntry>>>` — **εξαντλητικός**
  (compile-time total). Revit-standard ποσότητες:

  | Kind | Set |
  |---|---|
  | `door` | λαβή×1, κλειδαριά×1, **μεντεσές×3** |
  | `double-door` / `french-door` | λαβή×2, κλειδαριά×1, μεντεσές×6, σύρτης×2 |
  | `sliding-door` / `pocket-door` | χερούλι×1, ράγα×1 |
  | `double-sliding-door` | χερούλι×2, ράγα×1 |
  | `bifold-door` | πόμολο×1, μεντεσές×3 |
  | `window` / `tilt-turn-window` | χειρολαβή×1, μεντεσές×2 |
  | `double-hung-window` | χειρολαβή×1 |
  | `sliding-window` | χερούλι×1, ράγα×1 |
  | `awning-window` / `hopper-window` | χειρολαβή×1, μηχανισμός ανάκλισης×2 |
  | `fixed`, `bay-window`, `overhead-door`, `revolving-door` | **∅ (καμία)** |

- `resolveOpeningHardwareSet(params, typeParams?)` → `ReadonlyArray<{ component, quantity, materialId, labelKey }>`.
  Το `materialId` αντλείται από τον **υπάρχοντα** `resolveOpeningMaterial().hardware` (ADR-672, ποτέ re-derive).
- `openingHasOperableHardware(kind)` — extracted predicate (= set μη-κενό).

**Parity guard (N.18):** το predicate έγινε **early return-[] guard** μέσα στο 3Δ `buildHardwareSpecs`
(`opening-hardware-builders.ts`) → η γεωμετρία και η προμέτρηση **δεν μπορούν να αποκλίνουν**. Το set είναι
μη-κενό για ΑΚΡΙΒΩΣ τα kinds όπου το 3Δ σχεδιάζει χειρολαβή.

### Β. Hardware Schedule preset (`bim/schedule/`)
- Νέο `'hardware'` στο `ScheduleEntityType`. **Μία γραμμή ανά κούφωμα** (ο builder είναι 1 row/entity — δεν
  άλλαξε). Στήλες: `mark, floor, kind, hardwareSet (ανάλυση «Μεντεσές ×3 · Κλειδαριά ×1 …»), pieces (Σ), hardwareMaterial`.
- `selectCandidates` → φιλτράρει κουφώματα με `openingHasOperableHardware(kind)`.
- `ScheduleLookups.translateHardwareComponent` (mirror του `translateKind`) wired στο `useBimScheduleLookups`.
- i18n `dxf-schedule`: `entityType.hardware`, `col.hardwareSet`, `col.pieces`, node `hardwareComponent.*` (9 keys, el+en).

### Γ. Priced BOQ (ΑΤΟΕ) feed (`bim/services/opening-hardware-boq-sync.ts`, greenfield· **rev.2 aggregated**)
- `bim-to-atoe-mapping.ts`: `OPENING_HARDWARE_MAPPING` (9 → OIK-5.31…5.39, `pcs`, **PLACEHOLDER codes** όπως το MEP note),
  `resolveOpeningHardwareMapping` (mirror `resolveStairComponentMapping`).
- **Aggregated ανά (floorplan × εξάρτημα)** (§6 — big-player parity): `recomputeFloorplanHardwareBoq(ctx)` →
  `sumFloorplanHardware` πάνω σε ΟΛΑ τα floorplan openings → **μία** γραμμή/εξάρτημα με ΣΥΝΟΛΙΚΗ ποσότητα
  (`boq_bim_hw_<floorplanId>_<component>`, `sourceEntityId = floorplanId`).
- Wired στο `useOpeningPersistence` (onPersisted/onRestored/onDeleted, ενοποιημένο `feedOpeningBoqIfScoped` SSoT)·
  reuse `fetchAllOpeningsForFloorplan` (export από opening-boq-sync) + `syncManagedBoqRow`/`buildSingleEntityBoqRow`·
  idempotent (component σε 0 → zero-delete), detach + frozen-baseline guarded. Γραμμή κουφώματος OIK-5.01/5.02 **αμετάβλητη**.

## 5. Το αρχιτεκτονικό εύρημα που διόρθωσε το μοντέλο (κώδικας = SSoT)

Το αρχικό mental model («ο `BimToBoqBridge` επεκτείνει τα κουφώματα σε γραμμές») ήταν **μπαγιάτικο**: το
`BimToBoqBridge.upsertBoqItemForBim` **ΑΠΟΡΡΙΠΤΕΙ** τα κουφώματα (warn+skip, ADR-376 B.2). Τα κουφώματα
τροφοδοτούν BOQ μέσω **signature groups** (`opening-boq-sync`, aggregated), οι σκάλες μέσω `upsertStairBoq`
(per-entity, από persistence). Άρα το hardware wired εκεί που τα κουφώματα ήδη γίνονται BOQ: **στο persistence**,
mirror του stair.

## 6. Aggregation altitude — ΛΥΘΗΚΕ: aggregated ανά (floorplan × εξάρτημα) (Giorgio 2026-07-18)

Απόφαση «όπως οι μεγάλοι»: η προμέτρηση κιγκαλερίας βγαίνει **aggregated**, ΟΧΙ per-instance — **μία** γραμμή
ανά άρθρο εξαρτήματος με τη ΣΥΝΟΛΙΚΗ ποσότητα του floorplan («Μεντεσές: 150 τεμ»). Big-player parity: Revit
Door Hardware Schedule «itemize every instance = OFF» + Count· ArchiCAD «merge uniform items»· ελληνική ΑΤΟΕ
προμέτρηση σιδερικών = μία γραμμή/άρθρο, συνολική ποσότητα. Ίδιο aggregation altitude με την signature-group
γραμμή κουφώματος → τα δύο feeds του κουφώματος μιλούν την ίδια γλώσσα.

**Υλοποίηση (rev.2):** `recomputeFloorplanHardwareBoq(ctx)` διαβάζει ΟΛΑ τα persisted openings του floorplan
(reuse `fetchAllOpeningsForFloorplan`, SSoT), αθροίζει ανά εξάρτημα (pure `sumFloorplanHardware`), και upsert-άρει
**μία** γραμμή ανά (floorplan × εξάρτημα): `boq_bim_hw_<floorplanId>_<component>`, `sourceEntityId = floorplanId`.
Κάθε opening save/restore/delete → full recompute (μικρό, fire-and-forget, mirror του `upsertOpeningGroupForOpening`).
Component που έπεσε σε 0 → zero-delete μέσω `syncManagedBoqRow` (detach + frozen-baseline guards δωρεάν).

## 7. Zero regression
- Legacy κούφωμα → part defaults (frame/leaf=ξύλο, hardware=μέταλλο)· hardware-less kinds → 0 γραμμές/candidates.
- 3Δ γεωμετρία handle-kinds **αμετάβλητη** (early-guard = ίδιο αποτέλεσμα).
- Υπάρχουσα γραμμή κουφώματος OIK-5.01/5.02 + door/window material schedules (ADR-672) **αμετάβλητα**.

## 8. Placeholder ΑΤΟΕ codes
`OIK-5.31…5.39` (κιγκαλερία/μηχανισμοί κουφωμάτων) είναι **placeholders** — αντικατάσταση με τα πραγματικά
ΑΤΟΕ article numbers στο **ένα** αρχείο `bim-to-atoe-mapping.ts` όταν είναι διαθέσιμος ο priced master
(ίδιο pattern με τα MEP ΗΛΜ placeholders, ADR-408).

## 9. Αρχεία (SSoT map)

| Αρχείο | Ρόλος | Κατάσταση |
|---|---|---|
| `bim/family-types/opening-hardware-set.ts` | **Α — Hardware-set SSoT** (catalog + resolver + predicate) | committed |
| `bim-3d/converters/opening-hardware-builders.ts` | **Α** — early-guard parity refactor | committed |
| `bim/schedule/types.ts` | **Β** — `'hardware'` + `translateHardwareComponent` | committed |
| `bim/schedule/schedule-preset-columns.ts` | **Β** — `HARDWARE_COLUMNS` | pending commit |
| `bim/schedule/schedule-preset-mappers.ts` | **Β** — `mapHardware` (ανάλυση + pieces) | pending commit |
| `bim/schedule/schedule-presets.ts` | **Β** — registry `'hardware'` | committed |
| `bim/schedule/schedule-builder.ts` | **Β** — `selectCandidates` route | committed |
| `ui/components/bim-schedule/ScheduleEntityToggle.tsx` | **Β** — toggle option | committed |
| `hooks/data/useBimScheduleLookups.ts` | **Β** — `translateHardwareComponent` wiring | committed |
| `i18n/locales/{el,en}/dxf-schedule.json` | **Β** — `entityType.hardware`, `col.hardwareSet/pieces`, `hardwareComponent.*` | committed |
| `bim/config/bim-to-atoe-mapping.ts` | **Γ** — `OPENING_HARDWARE_MAPPING` + resolver | committed |
| `bim/services/opening-hardware-boq-sync.ts` | **Γ — priced BOQ SSoT** (rev.2 aggregated per floorplan×component) | pending commit |
| `bim/services/opening-boq-sync.ts` | **Γ** — export `fetchAllOpeningsForFloorplan` (SSoT reuse) | pending commit |
| `hooks/data/useOpeningPersistence.ts` | **Γ** — `feedOpeningBoqIfScoped` SSoT (κούφωμα group + hardware recompute) | pending commit |

## 10. Gates
- Tests: `opening-hardware-set` (20) + `hardware-schedule` (9) + `opening-hardware-boq-sync` + `bim-to-atoe-mapping` +
  `opening-material-schedule` (regression) + `opening-mesh` (3Δ regression) → **140/140 πράσινα, 6 suites**.
- `jscpd:diff`: Α καθαρό, Γ καθαρό· Β = μόνο προϋπάρχοντα declarative column-table clones (baseline-unaware,
  εκτός diff — δεν εισήχθη νέο clone· `HARDWARE_COLUMNS` reuse `HARDWARE_MATERIAL_COLUMN`).
- Χωρίς tsc (N.17) — Giorgio / pre-commit hook.

## 11. Changelog
- **2026-07-18** — Αρχική έκδοση. Orchestrator 3-φάσεων (Α barrier → Β‖Γ). Feature πλήρης: hardware-set SSoT
  μοντέλο + Hardware Schedule preset + priced ΑΤΟΕ BOQ feed. 140/140 tests. Commits real-time από Giorgio
  (`99382751` 3Δ guard, `bf88e15f` set tests, `437f31b6` schedule preset).
- **2026-07-18 — rev.2 (§6 ΛΥΘΗΚΕ) — aggregated hardware BOQ.** Απόφαση Giorgio «όπως οι μεγάλοι»: το priced BOQ
  feed άλλαξε από per-instance (`boq_bim_<openingId>_hw_<c>`) σε **aggregated ανά (floorplan × εξάρτημα)**
  (`boq_bim_hw_<floorplanId>_<c>`, ΣΥΝΟΛΙΚΗ ποσότητα) — Revit «itemize=OFF»/ArchiCAD merge/ΑΤΟΕ parity, ίδιο
  altitude με τη signature-group γραμμή κουφώματος. `opening-hardware-boq-sync.ts` rewrite: pure `sumFloorplanHardware`
  + `recomputeFloorplanHardwareBoq` (reuse εξαγόμενου `fetchAllOpeningsForFloorplan`). Wiring ενοποιήθηκε σε
  `feedOpeningBoqIfScoped` (N.18 — έλυσε νέο jscpd clone onPersisted/onRestored). Tests rewrite (17)· full sweep
  **172/172 πράσινα (8 suites)**· `jscpd:diff` καθαρό.
