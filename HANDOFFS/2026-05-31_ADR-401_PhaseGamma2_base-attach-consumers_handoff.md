# HANDOFF — ADR-401 (γ) base-attach — γ2 CONSUMERS DONE

**Ημερομηνία:** 2026-05-31
**Μοντέλο:** Opus 4.8
**Κατάσταση:** γ1 (μηχανή) + γ2 (consumers 3D/2D/BOQ) ΥΛΟΠΟΙΗΜΕΝΑ + tsc 0 errors + 8/8 νέα + 607/607 regression. **ΟΛΑ pending commit — ΚΑΜΙΑ αλλαγή committed.**
**Επόμενο:** γ3 (ETICS dual-band + docs N.15 + rest tests). Βλ. §3.

---

## 0. ΑΠΟΦΑΣΗ ΣΥΜΠΕΡΙΦΟΡΑΣ (επαληθευμένη Autodesk)

base-attach = **bidirectional / target-driven** (Revit «increases OR decreases to conform»). Η βάση πάει στην **άνω-παρειά** (topside) host(s) — πάνω Ή κάτω. Πολλά hosts → **upper-envelope** (πατάει στο ΨΗΛΟΤΕΡΟ στήριγμα· καθρέφτης του top lower-envelope). Auto-attach = συντηρητικό, μόνο host **κάτω** από τη βάση (foundation), inverted Z-gate.

---

## 1. ΤΙ ΕΓΙΝΕ ΣΤΟ γ2 (consumers — base-attach πλέον ΟΡΑΤΟ)

Πλήρης καθρέφτης του top-profile wiring. **12 αρχεία κώδικα + 3 tests:**

### 3D κάτω-έδρα
| Αρχείο | Τι |
|--------|-----|
| `bim-3d/converters/wall-opening-pieces.ts` | `WallOpeningPiece.zBotM` → **`zBotAM`/`zBotBM`** (per-boundary πάτος)· NEW `WallBaseLocalFn`· `computeWallOpeningPieces(wall, openings, wallTop?, wallBase?)`· `cutsBetween` = **union** top+base breakpoints· `pushTopPiece`/`pushFlatPiece` παίρνουν `zBotAt:(f)=>number` |
| `bim-3d/converters/wall-piece-geometry.ts` | `buildSlopedWallPieceGeometry` bottom verts @`zBotAM`/`zBotBM` (κεκλιμένος/σκαλωτός πάτος) |
| `bim-3d/converters/BimToThreeConverter.ts` | NEW `makeWallBaseLocalFn(profile, floorElevationMm)`· `wallToMesh(..., baseProfile?)`· `buildStraightWallWithOpenings(..., wallBase?)`· flat-extrude ΜΟΝΟ όταν top **&** base flat (`zTopAM≈zTopBM && zBotAM≈zBotBM`), depth=`zTopAM−zBotAM`, yOffset=`floorY+zBotAM`· piece-path ενεργό όταν `openings ‖ wallTop ‖ wallBase` |
| `bim-3d/converters/wall-opening-extrude.ts` | `buildWallMeshWithOpenings(..., wallBase?)`· κάτω ακμή front-face shape = polyline base profile (αριστερά→δεξιά μέσα από base breakpoints) |
| `bim-3d/scene/BimSceneLayer.ts` | `syncWalls`: `resolveWallBaseProfile`+`makeWallBaseContext` ανά `baseBinding==='attached'`· `hasAttached` = top **‖** base· `wallToMesh(..., profile, baseProfile)` |
| `bim-3d/converters/EnvelopeToThree.ts` | piece literal → `zBotAM:zBot, zBotBM:zBot` (επίπεδος band πάτος) |

### 2D τομή
| Αρχείο | Τι |
|--------|-----|
| `bim-3d/2d-section/section-intersect.ts` | `WallPlan.baseProfile?`· `toWallPlan(wall, floorElevationM, resolveHost?, resolveHostTopside?)`· `baseY = baseProfile.minBaseZmm`· `wallSection` αποτιμά **και** top **και** base profile στο cut (`needsT` gate)· **αφαιρέθηκε** το αχρησιμοποίητο `resolveWallBaseZmm` import |
| `bim-3d/2d-section/section-scene-sync.ts` | `makeResolveHostTopside` περνά ως 4ο arg στο `toWallPlan` |

### BOQ
| Αρχείο | Τι |
|--------|-----|
| `bim/geometry/wall-geometry.ts` | `computeWallGeometry(..., baseProfile?)` (5η param)· gross = **trapezoidal ∫(top(t)−base(t)) σε union breakpoints** (νέο `profileGrossAreaM2(lengthM, heightMm, top?, base?)` + `evalProfileSegAt` interior-biased segment-eval· top-only flat = byte-for-byte)· bbox bottom = `minBaseZmm`, top = `maxTopZmm` (ή nominal) |
| `hooks/data/wall-boq-feed.ts` | `resolveAttachedWallProfile` → `resolveAttachedWallProfiles` (επιστρέφει `{top, base}`)· `wallBoqEntity` recompute όταν `openings ‖ top ‖ base` |

### Tests
- NEW `bim-3d/converters/__tests__/wall-base-attach-consumers.test.ts` — **8/8**: 3D flat-lowered/σκαλωτό/κεκλιμένο/πρέκι-σταθερό· 2D yMin@cut· BOQ top−base (17.5m²).
- UPDATED `wall-opening-pieces.test.ts` + `wall-stepped-solid.test.ts` (rename `zBotM`→`zBotAM`/`zBotBM`).

**Verify:** `npx jest src/subapps/dxf-viewer/bim-3d/converters src/subapps/dxf-viewer/bim-3d/2d-section src/subapps/dxf-viewer/bim/geometry` → 607/607.

---

## 2. ⚠️ ΚΡΙΣΙΜΑ ΣΗΜΕΙΑ

- **Σημασιολογία πάτου:** μόνο jamb/ποδιά ακολουθούν τη βάση. Το **πρέκι (lintel) ΟΧΙ** — μένει σταθερό στο floor-relative ύψος ανοίγματος (`() => topM` στο `computeWallOpeningPieces`). Revit parity: το άνοιγμα μετριέται από το floor level, όχι από τη μετακινημένη βάση.
- **Σκαλωτή βάση vs κεκλιμένη:** πολλά flat θεμέλια σε διαφορετικά ύψη → upper-envelope σπάει σε **πολλά κομμάτια** (κάθε ένα flat bottom, μέσω break στα base breakpoints), ΟΧΙ ένα κεκλιμένο. Κεκλιμένο `zBotAM≠zBotBM` μόνο από genuinely tilted host topside.
- **Units:** profiles σε **απόλυτα mm**· LocalFn → τοπικά m = `(z_mm − FFL_mm)·0.001` (μπορεί <0 για θεμέλιο). BOQ feed περνά floorElevationMm=0 → absolute mm == floor-relative mm.
- **⚠️ orchestrator (workflow) = ΑΝΑΞΙΟΠΙΣΤΟΣ στα internal code details** (λάθος shapes/line-refs στο γ1). Καλός για breadth/mapping. **ΠΑΝΤΑ re-read το αληθινό αρχείο πριν edit.**

---

## 3. ΕΠΟΜΕΝΟ — Φάση γ3 (base-attach υπόλοιπο)

**(α) ETICS dual-band** — base sibling του `bim/geometry/envelope-wall-top.ts`. Σήμερα το ETICS Z1 κέλυφος (B3b) έχει **μεταβλητή κορυφή** (`resolveEnvelopeEdgeTops` lower-envelope). Χρειάζεται **μεταβλητή βάση** (base-attach upper-envelope) → το κέλυφος ντύνει και το κατέβασμα του τοίχου στο θεμέλιο. Mirror:
- NEW `resolveEnvelopeEdgeBases(chain, wallRefs, floorElevationMm)` (sibling του `resolveEnvelopeEdgeTops`, καταναλώνει `WallBaseProfile`/`evaluateWallBaseAt`).
- `EnvelopeToThree`: το band πρέπει να έχει **και** μεταβλητή κορυφή **και** μεταβλητή βάση (dual-band) — επέκταση του `addVariableTopBand` → variable bottom.
- `BimSceneLayer.addEnvelopeShell`: `buildEnvelopeWallBaseRefs` παράλληλα με top refs.
- BOQ `envelope-boq-sync`: area = top − base.

**(β) DOCS (N.15)** — ADR-401 **§2.x base** prose (νέα ενότητα για base-attach, mirror της top §2.2/§2.3/§2.4) + §1 παράδειγμα + adr-index.md status (το §8 changelog ΗΔΗ ενημερώθηκε στο γ2).

**(γ) Tests που λείπουν:**
- `AttachWallsBaseCommand.test.ts` (mirror `AttachWallsTopCommand.test.ts`).
- coordinator base-gate matrix: `findWallsToAutoAttachBaseToHost` (foundation-below→attach / ceiling-above→skip — inverted του top).
- schema base-refinement (`attachBaseToIds` superRefine: attached⇔non-empty).

**Μετά το γ3:** E-rest (ribbon για manual attach/detach top+base + wall-top/base vertical grip + manual-edit-breaks-attach) → F (column mirror).

---

## 4. ΚΑΝΟΝΕΣ
- **N.(-1):** ΟΧΙ commit/push χωρίς ρητή εντολή Giorgio. Όλα γ1+γ2 pending.
- **Pre-commit CHECK 6B/6D:** όταν αγγίξεις BimToThreeConverter/EnvelopeToThree/section/BimSceneLayer → **stage ADR-401 + ADR-369**.
- **ΟΧΙ `git add -A`** — specific files μόνο (multi-agent race).
- **Memory:** `project_adr401_wall_top_constraints.md` (state, όχι log). **Master ref:** ADR-401 §8 + git.
- 🎯 Πρότεινε μοντέλο πριν ξεκινήσεις (γ3 αγγίζει envelope 3D/BOQ + docs = πιθανό **Opus**).
