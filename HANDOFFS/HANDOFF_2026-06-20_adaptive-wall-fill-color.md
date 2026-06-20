# HANDOFF — Background-adaptive wall **fill** (σκούρος τοίχος σε μαύρο φόντο)

**Ημ/νία:** 2026-06-20 · **Μοντέλο προηγ. session:** Opus 4.8 · **Commit:** ΤΟΝ ΚΑΝΕΙ Ο GIORGIO (όχι ο agent)
**⚠️ Working tree μοιράζεται με άλλον agent** (ADR-398 §3.7 column ghost + structural). Stage ΜΟΝΟ δικά σου αρχεία.

---

## 🎯 ΤΟ ΠΡΟΒΛΗΜΑ (Giorgio, 2 φορές το ανέφερε)

Στον `/dxf/viewer`, ο **τοίχος φαίνεται σκούρος πάνω σε μαύρο/σκούρο φόντο** — δεν ξεχωρίζει.

**ΡΙΖΑ (επιβεβαιωμένη, ΟΧΙ υπόθεση):** Ο τοίχος ζωγραφίζεται με 2 μέρη στο
`src/subapps/dxf-viewer/bim/renderers/WallRenderer.ts`:
- **Περίγραμμα** (γρ. ~260-271): ΗΔΗ διορθώθηκε στο προηγ. session (background-adaptive, γίνεται ανοιχτό). Αλλά είναι **λεπτή γραμμή**.
- **Γέμισμα σώματος** (γρ. **254**): `this.ctx.fillStyle = resolveVgFillTint('wall', _cutState, _styles) ?? WALL_CATEGORY_FILL[cat];`
  = **διάφανο tint** `rgba(120,144,156,0.18)` (από `WALL_CATEGORY_FILL`, `bim/walls/wall-render-palette.ts`).

Πάνω σε **μαύρο** φόντο, ένα διάφανο ανοιχτό tint στο **18% alpha** → composited ≈ `rgb(22,26,28)` = **σχεδόν μαύρο**.
**ΑΥΤΟ είναι ο «σκούρος τοίχος»** — το **γεμισμένο σώμα**, ΟΧΙ το περίγραμμα. Ο adaptive resolver (ADR-509) που
έφτιαξα **δεν** το πιάνει γιατί τα rgba (διάφανα) περνούν αυτούσια (σχεδιάστηκε να μην αγγίζει fills).

**Δηλαδή η προηγ. διόρθωση ήταν ΣΩΣΤΗ αλλά ΑΝΕΠΑΡΚΗΣ** — έπρεπε να προσαρμοστεί ΚΑΙ το γέμισμα.

---

## 📦 ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (UNCOMMITTED — ADR-509, προηγ. session)

NEW (μην τα ξαναφτιάξεις — **επέκτεινέ τα**):
- `src/subapps/dxf-viewer/config/color-math.ts` — SSoT color math: `parseHex`, `rgbToHex`, `channelToHex`,
  `luminance601`, `srgbRelativeLuminance` (WCAG), `contrastRatio`, `mixHex`. (Το `print-color-policy.ts` reuse-άρει
  ΗΔΗ τα `parseHex`/`luminance601`/`channelToHex` — de-dup έγινε.)
- `src/subapps/dxf-viewer/config/adaptive-entity-color.ts` — `adaptColorToBackground(color, bg, minContrast)` +
  `adaptEntityColorForCanvas(color)` (reads live `resolveDxfCanvasBackgroundHex`, memoized). `MIN_ENTITY_CONTRAST=3.0`.
  **ΔΕΧΕΤΑΙ ΜΟΝΟ HEX** — τα rgba επιστρέφονται αυτούσια (γι' αυτό το fill μένει σκούρο).
- `config/__tests__/adaptive-entity-color.test.ts` (14 jest).
- `docs/centralized-systems/reference/adrs/ADR-509-adaptive-entity-color.md`

MOD (ADR-509): `config/print-color-policy.ts` (de-dup), `bim/renderers/WallRenderer.ts` (περίγραμμα+hatch wired),
`canvas-v2/dxf-canvas/DxfRenderer.ts` (imported DXF, live branch wired), `WallRenderer-subcategory-wiring.test.ts` (updated).

**Αρχιτεκτονική απόφαση ADR-509 (ΤΗΡΗΣΕ ΤΗΝ):** η προσαρμογή είναι **2D-render-time**, ΟΧΙ μέσα στον κοινό
`resolveSubcategoryStyle` — γιατί τον μοιράζονται **3D edges** (ADR-446, άλλο bg) **+ print** (ADR-454, λευκό χαρτί).
Το ίδιο ισχύει για το fill: προσάρμοσέ το στους **2D renderers**, ενάντια στο **2D canvas bg**.

---

## ✅ Η ΔΟΥΛΕΙΑ ΣΟΥ — background-adaptive **fill tint** (Revit-grade poché)

Φτιάξε «βαμμένο» σώμα τοίχου που **διαβάζεται** σε κάθε φόντο, κρατώντας το CAD translucent feel:
- Σε **σκούρο** φόντο: το tint γίνεται αρκετά ανοιχτό/αδιαφανές ώστε το composited σώμα να είναι **ανοιχτό-γκρι** (όχι σχεδόν-μαύρο).
- Σε **ανοιχτό** φόντο: αντίστροφα (σκουραίνει), διατηρώντας ορατότητα.
- **Hue preservation** όσο γίνεται (slate παραμένει slate-ish).

**Revit reference (πώς το κάνουν οι μεγάλοι):** σε model/drafting view με σκούρο φόντο, οι filled regions /
material cut patterns (poché) χρησιμοποιούν χρώματα/αδιαφάνεια επιλεγμένα ώστε το composited αποτέλεσμα να
ξεχωρίζει από το background — όχι σταθερό light tint που υποθέτει λευκό χαρτί.

### Προτεινόμενη προσέγγιση (επικύρωσέ την με το audit):
Επέκτεινε το `adaptive-entity-color.ts` με `adaptFillTintForCanvas(fill: string, bg?: string): string`:
1. Parse rgba/hex → `{r,g,b,a}`.
2. **Composite over bg** (`out = tint*a + bg*(1-a)`) → effective color.
3. Αν το effective είναι πολύ κοντά στο bg (χαμηλό lightness/contrast delta), **boost**: αύξησε alpha ή/και
   ανέβασε το base προς το αντίθετο άκρο (λευκό σε σκούρο bg) ώσπου το composited να φτάσει target lightness/contrast.
4. Επέστρεψε rgba (διατήρησε translucency). Memoize ανά `fill|bg`.

Μετά **wire** στο `WallRenderer.ts:254` (το body fill). Σκέψου ΚΑΙ τα **fills άλλων BIM renderers** (slab/beam/column —
έχουν κι αυτά category fills; → «full adaptive ALL entities» που ζήτησε ο Giorgio· δες pending-ratchet ADR-509).

---

## 🚨 ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΩΤΟ ΒΗΜΑ: SSoT AUDIT (GREP) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Ο Giorgio απαιτεί **πραγματικό audit** — όχι δήλωση. Grep ΠΡΙΝ φτιάξεις οτιδήποτε:

1. **rgba parsing / hexToRgba** (ΥΠΑΡΧΕΙ ΔΙΠΛΟΤΥΠΟ — βρες το, μην προσθέσεις 3ο):
   - `bim/utils/bim-vg-fill-tint.ts` → `hexToRgba` · `bim/mep-systems/mep-system-color.ts` → `hexToRgba` (duplicate!)
   - `config/color-config.ts` → `withOpacity` · grep: `rgba(`, `hexToRgba`, `parseRgba`, `withOpacity`.
2. **Compositing / alpha-over-bg / lighten / darken / mix**: grep `composite`, `blend`, `over(`, `lighten`, `darken`,
   `mixHex` (ΥΠΑΡΧΕΙ στο color-math), `mix(`. **Reuse `mixHex`** για το compositing (mix tint→bg με t=1-a).
3. **Fill tint resolvers ανά κατηγορία**: grep `_CATEGORY_FILL`, `resolveVgFillTint`, `FillTint`, `fillStyle =`
   στους `bim/renderers/*Renderer.ts` → ποιοι έχουν translucent fills που χρειάζονται την ίδια θεραπεία.
4. **Background SSoT**: `config/color-config.ts` → `resolveDxfCanvasBackgroundHex()` (live 2D bg· ΗΔΗ χρησιμοποιείται).
5. **adaptive-entity-color.ts** — **ΕΠΕΚΤΕΙΝΕ ΤΟ** (μην φτιάξεις παράλληλο module). color-math.ts = το χρωματικό SSoT.

**Αν βρεις υπάρχον fill-adaptation/compositing → χρησιμοποίησέ το. Αν όχι → φτιάξε ΕΝΑ SSoT, reuse color-math.**

---

## ⚠️ ΠΕΡΙΟΡΙΣΜΟΙ / ΚΑΝΟΝΕΣ

- **ΟΧΙ commit/push** — ο Giorgio κάνει commit (N.(-1)). Εσύ: υλοποίηση + tests + tsc + ενημέρωση ΕΚΚΡΕΜΟΤΗΤΕΣ/ADR.
- **Shared tree** — άλλος agent δουλεύει (ADR-398 §3.7 column, structural). Άγγιξε ΜΟΝΟ color/render-fill αρχεία.
- **ADR-040 CHECK 6D**: ο `WallRenderer.ts` + `DxfRenderer.ts` είναι canvas-drawing → **stage ADR-509** μαζί (ή νέο ADR).
- **N.17 single tsc** — έλεγξε ότι δεν τρέχει άλλος tsc πριν ξεκινήσεις.
- **N.2** — μηδέν `any`/`as any`. **N.7.1** — αρχεία ≤500 γρ, συναρτήσεις ≤40.
- **i18n** — δεν χρειάζεται (visual only).

## ✅ VERIFICATION
1. jest: νέα fill-adapt tests + `adaptive-entity-color.test.ts` + `WallRenderer-subcategory-wiring.test.ts` πράσινα.
2. tsc clean (δικά σου αρχεία).
3. **Browser (Giorgio, μετά από commit ΤΟΥ):** εργαλείο Τοίχος → το **σώμα** του τοίχου ανοιχτό-γκρι ορατό σε μαύρο
   φόντο (όχι σχεδόν-μαύρο)· περίγραμμα ορατό· beam/column/slab αμετάβλητα· (αν αλλάξει bg σε λευκό → σκουραίνει σωστά).

## 📌 ΕΥΡΥΤΕΡΟ UNCOMMITTED CONTEXT (ίδιο working tree, ίδιο session)
- **ADR-508** (ενοποίηση τοίχου↔δοκαριού, 2-κλικ smart ghost) — uncommitted, browser-verify+commit pending.
- **ADR-509** (αυτό) — wall outline + DXF wired· **fill = η δουλειά σου**.
- Δες: `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, `.claude-rules/pending-ratchet-work.md` (ADR-509 on-touch renderers),
  memory `reference_unified_linear_member_framing.md`.
