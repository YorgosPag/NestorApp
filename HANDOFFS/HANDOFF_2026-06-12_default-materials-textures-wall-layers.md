# HANDOFF — Default Materials/Textures (foundation+structural concrete) + Default Wall Layer Compositions (Revit-grade)

**Ημερομηνία:** 2026-06-12
**Από:** Opus session (ADR-446 Visual Styles) → **Προς:** νέο session
**Working tree:** SHARED με άλλον agent. **Commit:** ΜΟΝΟ ο Giorgio. Ποτέ `git add -A`, ποτέ `--no-verify`. Απαντήσεις ΠΑΝΤΑ στα Ελληνικά.
**Quality bar:** FULL ENTERPRISE + FULL SSOT, όπως Revit. Παίρνεις εσύ τις professional αποφάσεις, ζητάς μόνο έγκριση plan (Plan Mode).

---

## ΜΕΡΟΣ Α — ΠΡΟΗΓΟΥΜΕΝΗ ΔΟΥΛΕΙΑ (uncommitted, περιμένει commit Giorgio)

**ADR-446 — 3D Visual Styles Manager — DONE + BROWSER-VERIFIED (Giorgio: «λειτουργεί σωστά»).**
Revit «Visual Style» dropdown «Στυλ Προβολής» (View tab) σε 2 άξονες FACES×EDGES, 8 presets (Συρμάτινο/Κρυφή Γραμμή/Σκιασμένο±Ακμές/Συνεπή Χρώματα±Ακμές/Ρεαλιστικό±Ακμές). SSoT στο per-view `bim-render-settings-store` (υποτάχθηκε το `realisticMaterials` ADR-413). 106/106 jest PASS, tsc καθαρό στα δικά μου. **🔴 Εκκρεμεί commit (Giorgio)** — δες `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή ADR-446) + `ADR-446-3d-visual-styles-manager.md`.

**Κρίσιμη γνώση για το ΜΕΡΟΣ Β (κληρονομιά ADR-446):**
- Το realistic mode (faceMode `realistic`) δίνει **textured PBR** υλικά μέσω `MaterialCatalog3D.ts`. Το `withFaceMode` wrapper εφαρμόζει τον face axis σε ΟΛΑ τα entry points. Οι **κολώνες ήδη δείχνουν υφή σκυροδέματος** στο realistic → το ΜΕΡΟΣ Β γενικεύει αυτό σε όλα τα δομικά + ορίζει default DNA τοίχων.
- Faces materials SSoT = `bim/materials/material-catalog-defs.ts` (`MATERIAL_DEFS` + `resolveMaterialKey` + `DEFAULT_MATERIAL_KEY='mat-concrete'`).
- Textured resolution = `bim-3d/materials/MaterialCatalog3D.ts` (`getMaterial3D` DNA-based, `getElementMaterial3D('column'|'beam'|'slab'|'foundation-pad'|'foundation-strip'|'foundation-tie-beam'|'foundation'|…)` → key `elem-<type>` → `resolveTexturedMaterial` → υφή αν `textureSlugForKey(key)` υπάρχει).
- Texture slugs SSoT = `bim/materials/bim-texture-registry.ts` (`textureSlugForKey`).

---

## ΜΕΡΟΣ Β — ΝΕΟ TASK (2 υπο-features, κοινό νήμα: «προεπιλεγμένα υλικά/υφές χωρίς να τα δηλώνει ο χρήστης»)

### Β.1 — Default υφή ΣΚΥΡΟΔΕΜΑΤΟΣ σε ΟΛΑ τα δομικά/θεμελίωσης (Revit «category material»)

**Τι ζητά ο Giorgio:** Στο realistic (σκέτο ή με ακμές), τα στοιχεία θεμελίωσης + δομικά να δείχνουν **αυτόματα υφή σκυροδέματος** — όπως ΗΔΗ οι κολώνες — χωρίς ο χρήστης να δηλώνει υλικό κάθε φορά. Στοιχεία:
- **Θεμελίωση:** πέδιλα (foundation-pad), πεδιλοδοκοί (foundation-strip), συνδετήριες/tie-beam, εδαφόπλακα/κοιτόστρωση (slab-based foundation).
- **Δομικά:** κολόνες (✅ ήδη), δοκάρια (beam), δάπεδο οροφής (slab/ceiling), πλάκα δαπέδου (slab).

**Revit semantics:** κάθε Category έχει default **Material** (Structural Foundations → Concrete, Structural Columns/Framing → Concrete). Εμείς: ίδια λογική = ανά element-type default material key με texture slug.

**Phase 1 — βρες (Grep/Read):**
1. Πώς το `elem-column` δίνει υφή ΣΗΜΕΡΑ: `material-catalog-defs.ts` (`elem-column`→ ποιο key/χρώμα), `bim-texture-registry.ts` (ποιο slug → concrete texture), `MaterialCatalog3D.resolveTexturedMaterial`.
2. Ελεγξε αν υπάρχουν `elem-foundation-pad/-strip/-tie-beam`, `elem-slab`, `elem-beam` defs ΚΑΙ αν έχουν texture slug. **Υπόθεση:** λείπει το concrete slug σε κάποια → γι' αυτό δεν δείχνουν υφή ενώ οι κολώνες ναι.
3. Ποιες συγκεκριμένες CC0 concrete υφές υπάρχουν ήδη (ADR-413/409 texture library) — REUSE, μην ανεβάσεις νέες.

**Λύση (SSoT):** σε ΕΝΑ σημείο (`material-catalog-defs` + `bim-texture-registry`) δήλωσε ότι τα `elem-foundation-*` / `elem-slab` / `elem-beam` resolve-άρουν στο ΙΔΙΟ concrete material+slug με τις κολώνες. ΜΗΝ αγγίξεις per-converter render — όλα περνούν από `getElementMaterial3D`. Πρόσεξε ADR-445 (per-category χρώματα 2Δ) να μη χαλάσει — εδώ μιλάμε ΜΟΝΟ για 3Δ faces texture.

### Β.2 — Default ΣΤΡΩΣΕΙΣ τοίχων (WallDna presets) ανά πάχος (Revit «Wall Type» / Edit Structure)

**Τι ζητά ο Giorgio:** Προκαθορισμένες στρώσεις (DNA layers) ώστε ο χρήστης να μη δηλώνει κάθε φορά. **ΠΑΝΤΑ κόκκινα διάτρητα τούβλα** στον πυρήνα. Στρώσεις (από έξω → μέσα):
- **Εξωτ. τοίχος:** εξωτερικός σοβάς (τσιμεντοκονία) | **κόκκινο τούβλο** (πυρήνας) | εσωτερικός σοβάς **Knauf** (γυψοσοβάς).
- **Παραλλαγή με θερμοπρόσοψη:** + **διογκωμένη πολυστερίνη (EPS) 10cm** στην ΕΞΩΤΕΡΙΚΗ παρειά (έξω από τον σοβά).
- **Εσωτ. διαχωριστικός 10cm:** Knauf | κόκκινο τούβλο | Knauf (σοβάς και στις 2 πλευρές).

### 📐 RESEARCH — ΕΥΡΗΜΑΤΑ ΑΓΟΡΑΣ (έγινε σε αυτό το session, 2026-06-12)

**Διαστάσεις κόκκινων διάτρητων οπτόπλινθων (Ελλ. αγορά):**
- Μικρά (εξάοπα): **6×9×19**, **9×9×19**, **12×9×19** cm (το 1ο νούμερο = πλάτος/πάχος τοίχου: 6, 9 ή 12 cm).
- Μεγάλα μπλόκια: **15×18×25**, **15×18×30** cm (πλάτος 15 cm).
- **Δρομικός τοίχος** = πλάτος **9 cm**. **Μπατικός** = πλάτος **19 cm** (το τούβλο κατά μήκος, διπλή σειρά).

**Πάχη επιχρισμάτων:**
- **Εσωτερικός γυψοσοβάς Knauf MP 75 L** (μηχανής): πάχος εφαρμογής **έως 50 mm**· τυπικό λείο εσωτερικό ≈ **15 mm**.
- **Εξωτερικός σοβάς** (τσιμεντοκονία, 3 στρώσεις: πεταχτό+λάσπωμα+τριπτό): **20–30 mm** ανά τοίχο (τυπικό **25 mm**).
- **EPS θερμοπρόσοψη:** 100 mm (δοσμένο από Giorgio).

### 🎯 ΠΡΟΤΕΙΝΟΜΕΝΑ DEFAULTS (αγκυρωμένα σε STANDARD τούβλα — ο σοβάς απορροφά το υπόλοιπο)
> Μηχανική αρχή: το τούβλο = σταθερή εργοστασιακή διάσταση· ο σοβάς = field-applied μεταβλητός. Άρα κλειδώνουμε standard τούβλο και ρυθμίζουμε το πάχος σοβά ώστε το σύνολο = στόχος.

| Τοίχος (τελικό) | Από έξω → μέσα | Άθροισμα |
|---|---|---|
| **Εξωτ. 25 cm** | εξωτ. σοβάς **35 mm** · **κόκκινο τούβλο μπατικό 190 mm** (9×19×24-τύπου) · Knauf **25 mm** | 250 mm ✓ |
| **Εξωτ. 25 cm + θερμοπρόσοψη** | **EPS 100 mm** · εξωτ. σοβάς 35 · τούβλο 190 · Knauf 25 | 350 mm |
| **Εξωτ. 20 cm** | εξωτ. σοβάς **30 mm** · **κόκκινο τούβλο 150 mm** (μπλόκι 15×18×25) · Knauf **20 mm** | 200 mm ✓ |
| **Εσωτ. 10 cm** | Knauf **20 mm** · **κόκκινο τούβλο 60 mm** (6×9×19) · Knauf **20 mm** | 100 mm ✓ |

**⚠️ Giorgio να ΕΠΙΒΕΒΑΙΩΣΕΙ** στο Plan Mode: (α) προτιμά να κλειδώσουμε standard τούβλο + μεταβλητό σοβά (παραπάνω), Ή σταθερό σοβά (Knauf 15 / εξωτ 25) + μη-standard τούβλο (210/160/70)· (β) ακριβές μπατικό τούβλο για τα 25cm (19cm vs μπλόκι)· (γ) αν το EPS μπαίνει ΕΞΩ από τον εξωτ. σοβά ή ΑΝΑΜΕΣΑ.

### Phase 1 — βρες (Grep/Read) για το Β.2:
1. **WallDna model:** `WallDnaEditor.tsx` + το type/schema των wall DNA layers (πεδία: material, thicknessMm, side/order). Πώς ορίζεται default wall type + πάχος.
2. **Wall type presets / «25αρης/20αρης»:** πού ζουν οι default τοίχοι (ADR-414 family types; ψάξε wall-type defs, `bim/walls/`). Υπάρχει ήδη preset σύστημα; → **επέκτεινε**, μη φτιάξεις παράλληλο.
3. **Materials για τούβλο/σοβά/EPS:** `material-catalog-defs.ts` + `bim-texture-registry.ts` — υπάρχουν keys/slugs για red-brick, gypsum/Knauf plaster, cement plaster, EPS; CC0 υφές διαθέσιμες (ADR-409/413); αλλιώς flat χρώμα fallback + flag για user-upload (ADR-413 §2D).
4. **2Δ↔3Δ parity:** οι DNA layers ζωγραφίζονται σε 2Δ τομή (poché) ΚΑΙ 3Δ sub-solids (`wallToMesh` per-DNA-layer, ADR-413 v1.0). Επιβεβαίωσε ότι τα νέα defaults τιμούνται και στα δύο.

---

## ΥΠΑΡΧΟΥΣΑ ΥΠΟΔΟΜΗ (κλειδιά — FULL SSOT = ΕΠΕΚΤΕΙΝΕ, ΜΗ διπλασιάσεις)
- **3Δ materials:** `bim-3d/materials/MaterialCatalog3D.ts` (getMaterial3D / getElementMaterial3D / withFaceMode), `bim/materials/material-catalog-defs.ts` (MATERIAL_DEFS/resolveMaterialKey), `bim/materials/bim-texture-registry.ts` (slugs), `bim-3d/materials/bim-texture-cache.ts` (async load).
- **User materials (ADR-413 §2D):** `bim-3d/materials/user-material-registry.ts` (bmat_*) — για future user-upload υφών.
- **Wall DNA:** `WallDnaEditor.tsx`, `bim/walls/*`, `wallToMesh` (per-DNA sub-solids).
- **Foundation:** ADR-436 (πέδιλα/πεδιλοδοκοί/εδαφόπλακα), `getElementMaterial3D('foundation-pad'|'foundation-strip'|'foundation-tie-beam')`.
- **Visual Style (ADR-446):** `config/bim-visual-style.ts`, `state/bim-render-settings-store.ts` (`visualStyle`/`faceMode`). Οι υφές φαίνονται όταν faceMode=`realistic`.

## ΕΚΤΕΛΕΣΗ
1. **PHASE 1 RECOGNITION** (N.0.1): διάβασε ADR-413 (PBR textures), ADR-445 (per-category χρώματα — μη χαλάσει 2Δ), ADR-436 (foundation), ADR-414 (family types/wall types αν υπάρχει), βρες next-free ADR από `adr-index.md` (ΜΗΝ μαντέψεις — highest ήταν 446 σε αυτό το session → επόμενο 447). Grep όλα τα παραπάνω.
2. **Plan Mode** → παρουσίασε αρχιτεκτονική (Β.1 concrete defaults + Β.2 wall DNA presets + texture/material mapping + ποιες CC0 υφές) στον Giorgio για έγκριση ΠΡΙΝ κώδικα. Στο plan ζήτησε ρητά την επιβεβαίωση των 3 σημείων (α/β/γ) παραπάνω.
3. **Μοντέλο:** cross-cutting (materials + walls + foundation + textures, 5+ αρχεία) → **Opus**, Plan Mode.

## ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- Ελληνικά πάντα. ΟΧΙ commit/push (Giorgio). ΟΧΙ `git add -A` (shared tree, stage ονομαστικά). ΟΧΙ `--no-verify`. ΕΝΑ tsc τη φορά (N.17). N.7.1 (40-line fns, 500-line files) + N.7.2 checklist. ADR-driven (code=SoT, ADR+ΕΚΚΡΕΜΟΤΗΤΕΣ ίδιο commit).

## Πηγές research (2026-06-12)
- [ΔΙΑΣΤΑΣΕΙΣ ΟΠΤΟΠΛΙΝΘΩΝ — oikodomiki.weebly.com](https://oikodomiki.weebly.com/deltaiotaalphasigmataualphasigmaepsiloniotasigma-omicronpitauomicronpilambdaiotanuthetaomeganu.html)
- [Τοιχοποιία είδη/διαστάσεις — e-oikodomos](http://e-oikodomos.blogspot.com/2011/05/blog-post_18.html)
- [Knauf MP 75 L — επίσημη σελίδα](https://knauf.com/el-GR/p/proion/mp-75-l-10257_0082)
- [Σοβάτισμα τεχνική/στρώσεις — omastoras.gr](https://www.omastoras.gr/%CF%83%CE%BF%CE%B2%CE%B1%CF%84%CE%B9%CF%83%CE%BC%CE%B1-%CF%83%CE%BF%CE%B2%CE%B1%CF%83/)
