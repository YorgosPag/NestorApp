# HANDOFF — CAD-grade απόδοση γραμματοσειρών στον κύριο καμβά (glyph-renderer wiring)

**Ημερομηνία:** 2026-06-25
**ADR:** ΝΕΟ (επόμενο ελεύθερο — όχι ADR-526· αυτό αφορά rendering, όχι import). Πάρε τον επόμενο σειριακό από `adr-index.md`.
**Ποιότητα:** **Revit-grade, FULL ENTERPRISE + FULL SSOT.** ΠΡΙΝ γράψεις κώδικα → **πραγματικό SSoT audit (grep)**.

---

## 0. ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ (διάβασέ τους ΠΡΩΤΑ)
- **Απαντάς ΕΛΛΗΝΙΚΑ** πάντα.
- **ΟΧΙ commit / ΟΧΙ push** — ο Giorgio κάνει commit, όχι εσύ (N.(-1)). Ετοίμασε, μην committάρεις.
- **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** Άγγιξε ΜΟΝΟ τα αρχεία αυτού του task. Μην πειράξεις άσχετες uncommitted αλλαγές.
- **N.17 — ΕΝΑ tsc τη φορά** (έλεγξε `Get-CimInstance Win32_Process … *tsc*` πριν τρέξεις· background, μη μπλοκάρεις).
- **ADR-040 — performance-critical (ΚΡΙΣΙΜΟ εδώ):** αγγίζεις τον text render path του κύριου καμβά. ΔΙΑΒΑΣΕ `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` ΠΡΙΝ. Stage το ADR-040 σε commit (CHECK 6B/6D μπλοκάρουν αλλιώς). Μηδέν `useSyncExternalStore` σε orchestrators· micro-leaf pattern· bitmap cache key.
- **N.5 — LICENSE:** ΜΟΝΟ MIT/Apache/BSD/**OFL**. **ΑΠΑΓΟΡΕΥΕΤΑΙ GPL** (οι LibreCAD LFF γραμματοσειρές είναι GPL → ΟΧΙ) και ιδιόκτητες (Autodesk ISOCP/RomanS → ΟΧΙ).
- **SSoT πρώτα:** grep ΠΡΙΝ γράψεις. Reuse τα ΥΠΑΡΧΟΝΤΑ glyph/font building blocks (§3) — ΜΗΝ ξαναγράψεις renderer/parser/loader.

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ (Revit-grade faithful font rendering)
Ο κύριος 2D καμβάς του DXF viewer αποδίδει **ΟΛΑ** τα κείμενα μέσω **CSS** (`ctx.font` + `ctx.fillText`) → μόνο **system γραμματοσειρές**. Δεν αναπαράγει τις πραγματικές CAD γραμματοσειρές των σχεδίων.

**Παράδειγμα-αφορμή (Giorgio):** εισαγωγή κάτοψης Τέκτονα· τα κείμενα στον Τέκτονα είναι σε **«PC απλό»** (εσωτερική vector CAD γραμματοσειρά), στον Νέστορα εμφανίζονται **Arial**. Ο Giorgio θέλει **πιστή απόδοση όπως Revit/AutoCAD** — που ζωγραφίζουν την πραγματική γραμματοσειρά (vector SHX / embedded TrueType) μέσω glyph/vector renderer, ΟΧΙ substitute σε μία system font.

**Στόχος:** σύνδεση του **υπάρχοντος** glyph-renderer (SHX/OTF → Path2D) στον κύριο καμβά, ώστε τα κείμενα να αποδίδονται με την πραγματική/CAD γραμματοσειρά τους (με fallback σε CSS όταν δεν υπάρχει font).

---

## 2. ΚΡΙΣΙΜΟ ΠΡΟΑΠΑΙΤΟΥΜΕΝΟ — FONT ASSET (blocker)
Ο glyph-renderer ζωγραφίζει γλύφους **από αρχείο γραμματοσειράς**. Στο repo **ΔΕΝ υπάρχει κανένα CAD font asset** (`find src public -iname "*.shx" -o -iname "*.lff"` → κενό· `public/fonts/` έχει μόνο `Roboto-Regular.ttf` [Apache 2.0] + `helvetiker_*.json` [three.js/3D]).

**Πριν αποδώσει κάτι το wiring χρειάζεσαι ένα open-license CAD/technical font:**
- Ο Giorgio θα τοποθετήσει ένα **OFL/MIT/Apache** `.ttf`/`.otf` στο `public/fonts/` (π.χ. τεχνική γραμματοσειρά τύπου ISOCPEUR-look· καθαρισμένη άδεια). **Ρώτησέ τον αν δεν υπάρχει ακόμα.**
- Εναλλακτικά (πρώτη φάση): η `Roboto-Regular.ttf` (ήδη bundled, Apache 2.0) ως απόδειξη-έννοιας του glyph path — αλλά ΔΕΝ είναι CAD font (≈ Arial). Χρήσιμη μόνο για να επιβεβαιώσεις ότι το pipeline δουλεύει.

---

## 3. SSoT AUDIT — ΥΠΑΡΧΟΝΤΑ building blocks (ΕΠΑΛΗΘΕΥΣΕ ΜΕ GREP, reuse — ΜΗΝ διπλασιάσεις)
Όλα στο `src/subapps/dxf-viewer/text-engine/fonts/` (barrel: `fonts/index.ts`):
- **`glyph-renderer.ts`**: `glyphToPath2D(...)`, `stringToPath2D(...)`, `measureText(font, text, size)`, `interface TextMetrics`. → OTF/TTF γλύφοι (opentype.js) → `Path2D`.
- **`shx-parser/shx-renderer.ts`**: `shxGlyphToPath2D(...)`, `shxStringToPath2D(...)`, `measureShxText(...)`. → SHX vector fonts → `Path2D`.
- **`font-loader.ts`**: `loadFontFromBuffer(buffer, cacheName)`, `loadFont(url, cacheName)`, `buildMissingFontReport(...)`, `MissingFontReport`/`CompanyFontMeta`.
- **`font-cache.ts`**: `FontCache`, `fontCache` (singleton).
- **`font-substitution-table.ts`**: `FONT_SUBSTITUTION_TABLE`, `lookupSubstitute(shxName)` → substitute family (romans→Liberation Sans, isocpeur→ISO 3098, txt→Liberation Mono, …).
- **`font-manager/`**: `CompanyFontRecord`, `FontFormat` (company-uploaded fonts).

**Δηλαδή το ΟΛΟΚΛΗΡΟ glyph pipeline ΥΠΑΡΧΕΙ — απλώς ΔΕΝ είναι συνδεδεμένο στον κύριο καμβά.** (grep: `glyph-renderer|GlyphRenderer|shxStringToPath2D` εμφανίζεται ΜΟΝΟ σε `text-engine/`, ΠΟΥΘΕΝΑ σε `rendering/` ή `canvas-v2/`.)

### Πού αποδίδεται σήμερα το κείμενο (ο στόχος του wiring):
- **`rendering/entities/TextRenderer.ts`** — `renderTextContent()` γρ.~107: `this.ctx.font = buildUIFont(screenHeight, fontFamily, weight, italic)` → `this.ctx.fillText(...)` (γρ.125/135). **ΕΔΩ μπαίνει το glyph branch** (αν υπάρχει loaded font για το family → `stringToPath2D`/`shxStringToPath2D` + `ctx.fill(path)`· αλλιώς fallback στο υπάρχον `fillText`).
- Καλείται από **`rendering/core/EntityRendererComposite.ts`** (γρ.101 `new TextRenderer(this.ctx)`).
- Το font διαβάζεται ΜΟΝΟ από `entity.textStyle?.fontFamily` (default `'arial'`) — βλ. `getRichStyle()`.
- **`buildUIFont`** + `TEXT_FONTS` στο `config/text-rendering-config.ts` (`DEFAULT_FAMILY:'Arial'`, `FALLBACK_STACK`).
- **ΔΕΝ υπάρχει κανένα `@font-face`** στην app (grep `@font-face|FontFace(` → κενό). Αν επιλέξεις CSS-web-font διαδρομή (αντί glyph paths) θα χρειαστεί νέο `@font-face` (νέο pattern).

### Δύο αρχιτεκτονικές επιλογές για το wiring (απόφασε στο Plan):
1. **Glyph-path rendering (Revit-grade, συνιστώμενο):** φόρτωσε το CAD font (opentype/SHX) → `stringToPath2D` → `ctx.fill`. Πιστό, vector, ανεξάρτητο system fonts. ⚠️ Perf: path-ανά-string αντί `fillText` → μέτρα FPS, σεβάσου bitmap cache (ADR-040), ίσως cache τα Path2D ανά (glyph,size).
2. **CSS `@font-face` web font:** φόρτωσε το OFL CAD font ως `@font-face`, κράτα `ctx.fillText`. Απλούστερο/γρήγορο, αλλά λιγότερο «CAD-grade» (εξαρτάται από browser hinting) και νέο pattern.

---

## 4. ΚΑΤΑΣΤΑΣΗ Φ5a (Tekton import — ΕΤΟΙΜΗ, UNCOMMITTED· ΜΗΝ το μπλέξεις)
ADR-526 Φ5a (import 2Δ + κείμενα από `.tek`) είναι **code-complete, browser-verified από Giorgio, tsc clean, ~29 jest GREEN**. Αρχεία: `io/tek/*` (νέα: `tek-primitive-extract.ts`, `tek-scene-extract.ts`, `tek-primitive-to-scene.ts`), `tek-import-types.ts`, `tek-scene-builder.ts`, `tek-import.ts`, `hooks/scene/useSceneState.ts`, `config/file-upload-config.ts`, `hooks/canvas/dxf-scene-entity-converter.ts` (text fontFamily passthrough), i18n, ADR-526. **Εκκρεμεί commit (Giorgio).** Το τρέχον font fix θέτει `TextEntity.fontFamily` από `<ttfont><name>` (Arial) — παραμένει χρήσιμο ως CSS fallback. **Μην το χαλάσεις.**

---

## 5. TEST PLAN
- **Unit:** glyph branch του `TextRenderer` (mock font → επιστρέφει Path2D, fallback σε `fillText` όταν δεν υπάρχει font). `lookupSubstitute` mapping. Font-load cache hit.
- **Perf (ADR-040):** μέτρα FPS με πολλά κείμενα (π.χ. το ΚΑΤΟΨΗ έχει 9· φόρτωσε σχέδιο με 100+). Bitmap cache δεν πρέπει να rebuild-άρει ανά frame.
- **Browser (Giorgio):** εισαγωγή `.tek` → κείμενα με CAD γραμματοσειρά (όχι Arial), σωστή θέση/μέγεθος/χρώμα.
- tsc (N.17, background).

## 6. ΑΝΟΙΧΤΕΣ ΑΠΟΦΑΣΕΙΣ (ρώτα Giorgio)
1. **Ποιο open-license CAD font** θα μπει στο `public/fonts/`; (OFL/MIT/Apache — όχι GPL/proprietary).
2. **Glyph-path vs `@font-face`** (§3) — προτεινόμενο glyph-path για Revit-grade πιστότητα· επιβεβαίωσε perf.
3. Πόσο γενικό; (μόνο Tekton-imported κείμενα, ή ΟΛΑ τα κείμενα/DXF — το πραγματικό Revit-grade είναι ΟΛΑ, με per-entity font resolution).

## 7. ΓΡΗΓΟΡΕΣ ΕΝΤΟΛΕΣ / ANCHORS
- glyph API: `src/subapps/dxf-viewer/text-engine/fonts/{glyph-renderer,font-loader,font-cache,font-substitution-table}.ts` + `shx-parser/shx-renderer.ts`
- main-canvas text: `src/subapps/dxf-viewer/rendering/entities/TextRenderer.ts` (`renderTextContent`), `rendering/core/EntityRendererComposite.ts`
- config: `src/subapps/dxf-viewer/config/text-rendering-config.ts` (`buildUIFont`, `TEXT_FONTS`)
- ADR-040: `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md`
- δείγμα `.tek` με κείμενα: `C:\Users\user\Downloads\ΚΑΤΟΨΗ.tek.txt` (9 texts), `Θέρμη. Πρόταση 4 δωματίων…tek` (room labels «ΚΟΥΖΙΝΑ»), `Πρόταση 2.tek`
