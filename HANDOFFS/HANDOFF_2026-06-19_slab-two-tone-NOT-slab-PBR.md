# HANDOFF — Slab two-tone «μισή-μισή / μισή σιελ» από πάνω (συνέχεια· ADR-483 fix#3)

**Ημ/νία:** 2026-06-19 (απόγευμα) · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **Commit/push = ΜΟΝΟ ο Giorgio (N.-1).**
> ⚠️ **Shared working tree** με ADR-499 agent. `git add` **ΜΟΝΟ δικά σου**, **ΠΟΤΕ `git add -A`**. **ΜΗΝ αγγίξεις** `bim/structural/codes/*`, `sizing/*`, `AutoSizeMembersCommand.ts`, `member-auto-size-core.ts`, `bim/types/column-types.ts`, `bim/types/slab-types.ts`, `ADR-499-*.md`.
> ⚠️ Το shared tree **επαναφέρει αρχεία** (μου διέγραψε TEMP diagnostics στο `ColumnDiagram3DOverlay.tsx` 2× μέσα στη συνεδρία).

---

## 0. ΚΑΤΑΣΤΑΣΗ — ΑΛΥΤΟ. 3 υποθέσεις ΑΠΟΔΕΙΧΘΗΚΑΝ ΛΑΘΟΣ.

Σύμπτωμα: άνω παρειά πλάκας από **πάνω** δείχνει **μισή ένα χρώμα / μισή σιελ-μπεζ (textured/hatch)**, όριο **διαγώνιο** που **κινείται με το orbit**. Από κάτω ΟΚ. Στιγμιότυπο: `Στιγμιότυπο οθόνης 2026-06-19 151736.jpg` (root).

**Ο Giorgio λέει:** «έρχεται σε σύγκρουση με το **σιελ του ουρανού**· όταν τα διαγράμματα έχουν από πίσω οντότητα εμφανίζονται σωστά» → δηλ. το «άλλο μισό» = το **cyan** (sky background `0x87CEEB` ή env sky).

---

## 1. ΤΙ ΑΠΟΔΕΙΧΘΗΚΕ ΑΞΙΟΠΙΣΤΑ (μη επαναλάβεις)

| # | Εύρημα | Πώς |
|---|--------|-----|
| A | **Slab top = ΕΠΙΠΕΔΗ, uniform normal (0,1,0)** | **CODE-PROOF**: `bim-three-shape-helpers.ts` `extrudeAndRotate` → `ExtrudeGeometry` flat shape + `ROT_X_NEG_90`. Cap πάντα planar· transform διατηρεί planarity. ⇒ **ΑΔΥΝΑΤΟ** two-tone από normals/directional light. |
| B | **Geometry καθαρή** | read-only `slabGeomReport` (download): ExtrudeGeometry, 12 tris, non-indexed, **ΚΑΜΙΑ duplicate/coincident** (όχι self z-fight). map:false (όχι texture). side:DoubleSide. |
| C | **Material path = `elem-slab` via `buildMat`** | slab χρώμα `#b2a290` = `elem-slab` def· polygonOffset (1,1) = `FACE_POLYGON_OFFSET` του `MaterialCatalog3D.buildMat`. |
| D | **ΟΧΙ env/sun specular** | Έκανα `elem-slab/beam/column` **roughness→0.98, metalness→0** (ματ). **Restart dev server + hard refresh → ΠΑΛΙ ΤΑ ΙΔΙΑ.** ΑΝΑΙΡΕΘΗΚΕ (tree καθαρό τώρα). |
| E | **Coplanar framers υπάρχουν αλλά overlap ~3%** | zfight scan (download): slab/2col/beam όλα top Y=3.0, **ίδιο polygonOffset (1,1)** → z-fight ΟΠΟΥ overlap. ΑΛΛΑ overlap = λωρίδα 4.6×0.125 + 2 γωνίες 0.2×0.2 (~3% πλάκας) → **ΔΕΝ εξηγεί «μισή»**. |

**ΣΥΜΠΕΡΑΣΜΑ (κλειδί):** A+B+C+D ⇒ το two-tone **ΔΕΝ είναι το PBR shading της ίδιας της πλάκας** (ούτε normals, ούτε env/sun specular, ούτε material). Είναι **view-dependent** (κινείται με orbit) ⇒ σχεδόν σίγουρα **Z-FIGHTING με άλλη επιφάνεια** ή **clipping που δείχνει το cyan background**.

---

## 2. ΤΑ ΕΝΑΠΟΜΕΙΝΑΝΤΑ LEADS (από εδώ ξεκίνα — όλα ΑΞΙΟΠΙΣΤΑ, ΟΧΙ visibility tests)

### Lead 1 (ΠΙΘΑΝΟΤΕΡΟ) — κρυμμένος z-fight partner που το scan ΜΟΥ έχασε
Το zfight scan μου έψαξε μόνο **coplanar-MAX-Y pairs**. Έναν partner που η top-Y του διαφέρει αλλά έχει **face στο Y≈3.0** πάνω από το footprint (π.χ. **finish/σοβάς οριζόντιο** `structural-finish-horizontal-3d.ts`, screed, slab build-up layer, ή **δεύτερη σκηνή** section composer) **δεν θα τον έπιανε**.
- **Νέο read-only scan**: για ΚΑΘΕ mesh, βρες αν έχει **οποιοδήποτε vertex** στο world-Y∈[2.99,3.01] **ΚΑΙ** XZ overlap με το slab footprint (X[11.31,16.31], Z[-16.85,-13.04]). Dump id/kind/color/material.
- Έλεγξε **δεύτερη σκηνή/pass**: `section-scene-controller.ts` έχει δικό του composer που τρέχει **κάθε frame** (`renderSceneFrame` → `sectionController.isStencilActive()`). Μήπως render-άρει 2ο αντίγραφο της πλάκας coplanar;

### Lead 2 — «μισή σιελ» = background μέσα από clipping
Ο Giorgio τονίζει το **cyan**. Μήπως μισή πλάκα **clip-άρεται** (renderer `clippingPlanes` / View-Range cut) και φαίνεται το `scene.background` (solid cyan); ΑΝΤΙΡΡΗΣΗ: world clip plane = view-independent (δεν «κινείται με orbit»). Έλεγξε αν ο cut είναι **camera/view-relative**. Grep `clippingPlanes`, `clipIntersection`, View-Range στο `bim-3d/scene/` + `section-scene-controller`.

### Lead 3 — οριστικό «είναι το slab mesh ή όχι;» test (ΑΞΙΟΠΙΣΤΟ, code-based)
**Force** το slab material σε `MeshBasicMaterial` (unlit, flat κόκκινο, depthTest/Write true) **στον converter** (προσωρινά) → hard refresh:
- two-tone **παραμένει** σε flat-unlit-κόκκινη πλάκα ⇒ **z-fight/clip** (άλλη επιφάνεια ή background ποκάρει) → Lead 1/2.
- γίνεται **ομοιόμορφη κόκκινη** ⇒ ήταν lighting/shadow path (ξαναεξέτασε σκιές — το shadow test μου ήταν ΑΚΥΡΟ, δες §3).

---

## 3. 🚨 ΕΡΓΑΛΕΙΑ — ΤΙ ΔΟΥΛΕΥΕΙ / ΤΙ ΟΧΙ (κρίσιμο — έχασα πολλά round-trips)

- ❌ **`o.visible=false` ΔΕΝ κρύβει** — γίνεται **reconcile per-frame** από `resolveIsEntityVisible` (`BimSceneLayer.ts:223`). **ΟΛΑ τα hide-tests μου ήταν ΑΚΥΡΑ** (framers + shadows + slab). ΜΗΝ βασιστείς σε visible toggles.
- ❌ **Console multi-line paste = corruption** στο setup του Giorgio (έσπασε `polygonOffsetUnits`→`nOffsetUnits`). Μόνο **single-line** ή **ονομαστικές κλήσεις**.
- ❌ **`window.__bimScene` flaky** — εκτίθεται μόνο όταν «Διαγράμματα M/V/N» **ON** (effect gated σε `group`). Σβήνει όταν OFF.
- ✅ **Read-only download-report = ΑΞΙΟΠΙΣΤΟ** (zfight scan, slabGeomReport δούλεψαν). Pattern: Blob + `<a download>` → ο Giorgio δίνει `C:\Users\user\Downloads\*.txt`, διαβάζεις με Read.
- ✅ **Material/scene PROPERTY changes** (όχι visibility) **δεν** γίνονται reconcile (π.χ. `scene.environment=null`, roughness).
- ✅ **Οπτική επαλήθευση** (reload + κοίτα) = 100% αξιόπιστο.
- ✅ **Data-file αλλαγή (material-catalog-defs) χρειάζεται dev-server RESTART** — HMR δεν την περνά.
- **ΣΥΣΤΑΣΗ:** Βάλε τα TEMP diagnostics σε σημείο που **ΔΕΝ** επαναφέρει το shared tree (π.χ. δικό σου νέο component always-mounted, ή κατευθείαν στο `ThreeJsSceneManager`), **ανεξάρτητα** του διαγραμμάτων-toggle, με `[managerRef, mode]` dep.

## 4. STATE / CLEANUP
- `material-catalog-defs.ts` → **ΑΝΑΙΡΕΘΗΚΕ** στις αρχικές τιμές (clean, κανένα δικό μου uncommitted).
- `ColumnDiagram3DOverlay.tsx` → τα TEMP μου τα **διέγραψε το shared tree** (clean).
- **Καμία εκκρεμής δική μου αλλαγή.** Το διάγραμμα κολώνας (αρχικό ADR-483 Slice 5) είχε λυθεί σε προηγούμενο handoff — **άσχετο** με αυτό το bug.

## 5. ΜΑΘΗΜΑΤΑ
- **ΜΗΝ εμπιστεύεσαι `visible=false`** σε αυτή την app (per-frame reconcile). Χρησιμοποίησε material/scene props ή code-based force.
- **CODE-PROOF > console** όταν τα tools είναι flaky: η planarity της πλάκας λύθηκε από τον κώδικα, όχι από console.
- Όταν **ματ material δεν αλλάζει view-dependent two-tone σε επίπεδη επιφάνεια** ⇒ δεν είναι PBR του mesh ⇒ **z-fight ή clip**, ψάξε ΔΕΥΤΕΡΗ επιφάνεια/σκηνή.
