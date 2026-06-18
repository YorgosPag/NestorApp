# ADR-495 — Slab→Beam Load Propagation (η πλάκα/πρόβολος φορτίζει τον οργανισμό)

**Status:** ✅ Slice 1 implemented (UNCOMMITTED) · **Date:** 2026-06-19
**Author:** Opus session · **Υλοποιεί:** ADR-487 §5 (βήμα 6 «πλάκα οροφής») + §4 («σε κάθε κίνηση recompute»)
**Mirror του:** ADR-478 (wall→beam line loads) · **Πυρήνας:** ADR-467 (load-path engine)

---

## 1. Πρόβλημα (παρατήρηση Giorgio, screenshot 2026-06-18)

2 κολώνες + πέδιλα ενωμένες με δοκάρι· προσθήκη **πλάκας οροφής (προβόλου)** κολλημένης
στο δοκάρι → τα διαγράμματα/διατομές **κολώνας/δοκαριού/πεδίλου ΔΕΝ άλλαξαν**. Η πλάκα
ήταν στατικά αόρατη.

## 2. Root cause (repro-confirmed από τον κώδικα)

- `load-path-takedown.ts → beamLoad()`: το δοκάρι έπαιρνε `tributaryAreaM2` από το
  **column-grid spacing** (`buildColumnTributary`), που εξαρτάται ΜΟΝΟ από τις θέσεις
  των κολονών — **slab-agnostic**. Ίδιες κολώνες → ίδιο tributary → ίδιο `appliedLoad`
  → ίδιο `designLineLoadKnM` (`section-context`) → ίδιο M_Ed/As/sizing/διάγραμμα/FEM.
- Η πλάκα ήταν **εκτός structural graph** (μόνο πληροφοριακό `slabLoad`, μηδέν διοχέτευση).

Ο μηχανισμός «recompute σε κάθε κίνηση» (ADR-487 §4) **έτρεχε** — το **load model** δεν
ήταν slab-aware.

**Repro guard (jest):** δοκάρι χωρίς πλάκα → 25 kN live (grid 12.5 m²)· με πρόβολο 5×4m →
40 kN live (20 m²). Πριν το fix: ταυτόσημα.

## 3. Απόφαση — (B) Slab-aware load path (Revit-grade, FEM-free)

Η πλάκα διοχετεύει το εμβαδό ευθύνης της (m²) στις **φέρουσες δοκούς** → το υπάρχον
takedown το μετατρέπει σε G/Q (UDL → M_Ed) και ρέει αυτόματα σε **οπλισμό (ADR-472),
sizing (ADR-475), διαγράμματα (ADR-483) και FEM (ADR-481 → ροπές κολώνας ADR-491)**.

Απορρίφθηκαν: (A) grid-tributary = το bug· (C) FEM plate element = overkill/DEFER (το
διάγραμμα ακολουθεί ήδη μέσω (B) επειδή το FEM load-vector διαβάζει το beam `appliedLoad`).

## 4. Υλοποίηση (Slice 1)

### NEW `bim/structural/loads/slab-beam-support.ts` (pure SSoT, mirror ADR-478)
`computeSlabBeamTributary(entities): Map<beamId, m²>`
- **Spatial binding** (η `SlabEntity` ΔΕΝ έχει `attachBaseToIds`): φέρουσα δοκός = μία
  παρειά της πλάκας τρέχει κατά μήκος του άξονά της (ελάχιστη κάθετη απόσταση
  ≤ `EDGE_TOL_M`=0.15m) με διαμήκη επικάλυψη.
- **Διατήρηση φορτίου:** όλο το εμβαδό μοιράζεται κατά μήκος-κάλυψης
  (`area × Lcov / ΣLcov`). Πρόβολος (1 δοκός) → 100%· αμφιέρειστη (2 δοκοί) → 50/50.
  Μηδέν double/under-count.
- **Reuse:** `projectPolygonOnAxis` (ADR-494), `beamEndpointsM`, `slab.geometry.netArea`,
  `mmToSceneUnits`. Μηδέν νέος engine.

### MOD `load-path-takedown.ts`
`beamLoad(...)` +param `slabTribM2?`: **slab-aware tributary ΥΠΕΡΙΣΧΥΕΙ** του grid· χωρίς
πλάκα → fallback grid (μηδέν regression). Το `extraDeadAxialKn` (self + τοίχος ADR-478)
αμετάβλητο.

## 5. Scope / DEFER (slice 2+)

- **Slice 1 αλλάζει:** beam M/V/N, As δοκού, ύψος δοκού, διαγράμματα, **FEM ροπές κολώνας**
  (→ ADR-491 M-N).
- **DEFER:** (α) πρόβολος-moment (cantilever hogging στον κόμβο)· (β) πραγματικά
  two-way/interior δοκοί (slab straddle με αμφότερες πλευρές βαθιές)· (γ) **slab→column-N→
  footing** (το gravity αξονικό κολώνας μένει grid-tributary· το πέδιλο αλλάζει μόνο μέσω
  FEM αντιδράσεων). Επιλογή Giorgio 2026-06-19: Slice 1 τώρα.

## 6. Tests
- NEW `__tests__/slab-beam-support.test.ts` — 9 cases (πρόβολος/αμφιέρειστη/ασύμμετρη/
  μη-φέρουσα/partial/εκφυλισμένα).
- `__tests__/load-path-takedown.test.ts` +2 (repro guard). Σύνολο loads suite: 86 GREEN.

## 7. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-19 | **Δημιουργία + Slice 1.** NEW `slab-beam-support.ts` (slab→δοκός εμβαδό ευθύνης, conservation-weighted)· wiring `beamLoad` (slab-aware υπερισχύει grid). Λύνει το «πλάκα/πρόβολος δεν φορτίζει τον οργανισμό». 11 jest, 86 loads GREEN. UNCOMMITTED. |
