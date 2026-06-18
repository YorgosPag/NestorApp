# ADR-478 — Γραμμικά Φορτία Τοιχοποιίας σε Δοκούς (Wall Line-Loads, T1)

**Status:** 🟢 DONE (UNCOMMITTED 2026-06-18 Opus) · **Σχετικά:** ADR-467 (load path), ADR-464 (footing takedown), ADR-472 (load-aware reinforcement), ADR-475 (auto member sizing), ADR-474 (occupancy auto loads), ADR-401 (wall attach-to-structural), ADR-449 (segment-polygon coverage SSoT).
**Ημ/νία:** 2026-06-18 · **Γλώσσα:** Ελληνικά.
**Roadmap:** Πρώτο tier (T1) του gap analysis στατικής μελέτης (`HANDOFFS/HANDOFF_2026-06-18_GAP-ANALYSIS_static-study-vs-app.md`).

---

## 1. Context — γιατί

Gap analysis εγκεκριμένου τεύχους στατικών (Statics 2025): οι **τοιχοποιίες πληρώσεως**
(μπατικές ~3.6 / δρομικές ~2.1 kN/m² όψης) μεταφέρονται ως **γραμμικά μόνιμα φορτία** στις
φέρουσες δοκούς (μερισμός DIN 1045 + ίδιο βάρος τοίχου). Στην εφαρμογή μας τα φορτία ήταν
**μόνο επιφανειακά** (occupancy area loads, ADR-474): ένας μοντελοποιημένος τοίχος **δεν φόρτιζε
καθόλου** τη δοκό που πατούσε. Το πιο εμφανές κενό ακρίβειας που λύνεται **χωρίς solver** (gap #18).

## 2. Decision — auto γραμμικό φορτίο, fold σε αξονικό της δοκού

**Κρίσιμο εύρημα (code-as-SoT):** η δοκός ΗΔΗ αποθηκεύει το συνολικό tributary φορτίο ως
**αξονικά G/Q (kN)** και ο `resolveBeamDesignLoad` (`section-context.ts`) το smear-άρει σε
**ισοδύναμο UDL** `w_Ed = W_Ed(ULS)/L → M_Ed = w·L²/divisor` → οπλισμός (ADR-472) + ύψος (ADR-475).
Άρα προσθέτουμε το φορτίο τοίχου ως **πρόσθετο μόνιμο αξονικό (kN)** → ρέει αυτόματα σε όλη την
αλυσίδα. **Μηδέν** breaking change σε `AppliedMemberLoad` / `load-combinations` / design.

### NEW SSoT `bim/structural/loads/wall-line-loads.ts` (pure, mirror `occupancy-loads.ts`)
- `resolveWallFaceLoadKpa(params)` — φορτίο όψης g_face [kN/m²] = Σ(layer.t[m]·γ_layer[kN/m³])
  από **DNA layers** (σοβάς+τούβλο+μόνωση)· fallback ενιαίο `thickness`+`material`. γ = ρ·g/1000,
  ρ από `WALL_MATERIAL_DENSITY` (`wall-material-catalog`)· άγνωστο υλικό → `DEFAULT_MASONRY_DENSITY_KG_M3`
  (1800, ποτέ silent-drop).
- `resolveWallLineLoadKnm(params)` — γραμμικό g_wall [kN/m] = g_face · ύψος[m].
- `isMasonryLineLoadCandidate(params)` — true για **τοιχοποιία πληρώσεως**, false για **φέρον
  τοίχωμα Ο.Σ.** (core υλικό `mat-concrete-cNN` = χυτό RC shear wall → κατακόρυφο μέλος, T6· **όχι**
  line load). `mat-concrete-block` (μπλοκ) = τοιχοποιία → candidate.
- `resolveEffectiveWallLineLoad({explicitDeadLineLoadKnm?, params})` — explicit-wins (Revit override,
  future-proof)· αλλιώς auto. Η τοιχοποιία = αμιγώς **μόνιμη** δράση (G), μηδέν live.

### NEW SSoT `bim/structural/loads/wall-beam-support.ts` (spatial resolve + aggregation)
- `computeWallBeamDeadLoads(entities)` → `Map<beamId, deadKn>`: ΕΝΑ pass.
  - **Ποια δοκός;** (1) **explicit FK** — `baseBinding='attached'` → μόνο οι δοκοί του
    `attachBaseToIds` (ADR-401)· (2) **spatial fallback** — αλλιώς όποια δοκός το footprint της
    καλύπτει τμήμα του άξονα τοίχου.
  - **Καλυμμένο μήκος** πάντα από γεωμετρική επικάλυψη: `coveredIntervals` SSoT (ADR-449,
    `segment-polygon-coverage`) × `wall.geometry.length`. Beam footprint = `beamHostInput().footprint`
    (reuse ADR-401).
  - `contribution[beam] = g_wall[kN/m] · καλυμμένο_μήκος[m]`, αθροιζόμενο ανά δοκό.

### MOD `bim/structural/loads/load-path-takedown.ts`
- `computeLoadPathPatches`: pre-pass `computeWallBeamDeadLoads(entities)` → map.
- `beamLoad(...)`: `extraDeadAxialKn = beamSelfWeightKn(b) + wallDeadKn`. Manual-vs-takedown guard
  (`isTakedownWritable`) αμετάβλητος.

### MOD `hooks/useProactiveStructuralLoads.ts` (Revit auto re-study)
+`bim:wall-params-updated` (atomic undo group)· +`bim:wall-delete-requested`· +`bim:walls-from-grid`·
+`bim:walls-from-perimeter`. (create/move ήδη καλύπτονται από `drawing:entity-created`/`bim:entities-moved`.)

## 3. Συνέπεια / backward-compat
- **Μηδέν regression**: όταν δεν υπάρχουν τοίχοι, `computeWallBeamDeadLoads` επιστρέφει κενό πριν
  αγγίξει δοκούς (early-return). Ο guard «χωρίς area loads → κενό» αμετάβλητος.
- **Idempotent**: το φορτίο τοίχου είναι derived· κάθε re-run δίνει το ίδιο `appliedLoad`
  (source='takedown'), ΠΟΤΕ overwrite χειροκίνητου.
- **Ύψος**: χρησιμοποιείται `params.height` (nominal). Live attach-derived ύψος + αφαίρεση
  ανοιγμάτων = DEFER (§5).

## 4. N.7.2 Google-level checklist
1. Proactive ✅ (re-study σε wall create/move/edit/delete/batch). 2. Race-free ✅ (pure pre-pass πριν
το beam loop). 3. Idempotent ✅. 4. Belt-and-suspenders ✅ (explicit FK → spatial fallback). 5. SSoT ✅
(ΕΝΑ wall-line-load module, ΕΝΑ coverage SSoT reuse). 6. Await ✅ (sync pure). 7. Lifecycle owner ✅
(`computeLoadPathPatches`).
**✅ Google-level: YES** — pure SSoT, μηδέν `any`/hardcoded, ≤40γρ/fn, reuse coverage+density+takedown.

## 5. DEFER (μελλοντικά)
- **Double-count κινητών χωρισμάτων**: το `resolveDefaultDeadLoadKpa` (ADR-474) έχει +1.0 kPa
  *movable/light partitions* (EN1991-1-1 §6.3.1.2) — **διαφορετικό** από modeled masonry, αλλά
  πιθανή μερική επικάλυψη. DEFER: optional `StructuralSettings.partitionsModeledAsWalls` που μηδενίζει
  το +1.0 όταν υπάρχουν modeled τοίχοι. Το 1.0 kPa είναι conservative → ασφαλές προσωρινά.
- Live attach-derived ύψος τοίχου + αφαίρεση βάρους ανοιγμάτων (openings).
- Σεισμικό φορτίο τοιχοπληρώσεων / επιρροή δυσκαμψίας (T4/T5).
- UI selector explicit kN/m override (το default auto δουλεύει zero-input).

## 6. Αρχεία
**NEW:** `bim/structural/loads/wall-line-loads.ts`, `bim/structural/loads/wall-beam-support.ts`,
`__tests__/wall-line-loads.test.ts`, `__tests__/wall-beam-support.test.ts`.
**MOD:** `bim/structural/loads/load-path-takedown.ts`, `hooks/useProactiveStructuralLoads.ts`,
`__tests__/load-path-takedown.test.ts`.
**Tests:** 30 GREEN (11 νέα + 19 regression).

## 7. Changelog
- **2026-06-18** (Opus, UNCOMMITTED) — Δημιουργία. T1 wall masonry line-loads: 2 NEW SSoT modules +
  takedown wiring + proactive triggers + 11 jest. tsc = Giorgio (N.17).
