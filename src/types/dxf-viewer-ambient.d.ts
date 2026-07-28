/**
 * Γέφυρα ορατότητας **root → subapp**: ambient module declarations που ζουν μέσα στο
 * `src/subapps/dxf-viewer/` και πρέπει να φαίνονται στο root TypeScript program.
 *
 * ## Γιατί χρειάζεται
 *
 * Το root `tsconfig.json` δηλώνει `include` για κάθε `.d.ts` του `src/`, αλλά
 * ταυτόχρονα `exclude: "src/subapps/dxf-viewer/**"` — και το `exclude` **φιλτράρει**
 * τα αποτελέσματα του `include`. Τα κανονικά αρχεία του subapp μπαίνουν παρ' όλα αυτά
 * στο program, γιατί τα τραβά το import-chain από το `src/app/**`. Οι **ambient**
 * δηλώσεις όμως δεν εισάγονται ποτέ από κανέναν — δεν υπάρχει import να τις τραβήξει —
 * άρα μένουν οριστικά εκτός και ο compiler βγάζει TS7016/TS2307 για πακέτα που
 * **είναι** ήδη τυποποιημένα μέσα στο subapp.
 *
 * Ένα triple-slash reference directive προσθέτει το αρχείο στο program **ρητά**,
 * παρακάμπτοντας το `exclude` — χωρίς να αντιγράψει ούτε έναν τύπο και χωρίς να
 * αγγίξει το `tsconfig.json`.
 *
 * ## Ο κανόνας ιδιοκτησίας (ADR-719)
 *
 * Κάθε πακέτο έχει **ακριβώς μία** δήλωση, σε **ακριβώς ένα** αρχείο, και ιδιοκτήτης
 * είναι το πλησιέστερο κοινό σημείο των καταναλωτών του:
 *
 * - καταναλώνεται **μόνο από το subapp** → η δήλωση ζει στο subapp, το root τη βλέπει
 *   από **εδώ**·
 * - καταναλώνεται **από το root** (ή και από τα δύο) → η δήλωση ζει στο `src/types/`,
 *   το subapp τη βλέπει από το `src/subapps/dxf-viewer/types/root-ambient.d.ts`.
 *
 * Αυτό το αρχείο **δεν περιέχει τύπους**· είναι μόνο δείκτης ορατότητας. Νέο untyped
 * πακέτο στο subapp → η δήλωσή του δίπλα στον καταναλωτή, **μία γραμμή εδώ**.
 *
 * ⚠️ **ΠΟΤΕ αντίγραφο.** Δύο ambient `declare module` για το ίδιο όνομα συγκρούονται·
 * η ορατότητα λύνεται με reference. Το φυλάει το
 * `src/types/__tests__/ambient-declaration-ssot.test.ts`.
 *
 * @module types/dxf-viewer-ambient
 * @see docs/centralized-systems/reference/adrs/ADR-719-ambient-declaration-ssot.md
 */

/** `cdt2d` (MIT) — Constrained Delaunay για το TIN. Καταναλωτής: `systems/topography/tin-builder.ts`. */
/// <reference path="../subapps/dxf-viewer/systems/topography/cdt2d.d.ts" />

/** `opentype.js` — γραμματοσειρές/glyph paths. Καταναλωτές: 8 αρχεία στο `text-engine/`. */
/// <reference path="../subapps/dxf-viewer/text-engine/fonts/opentype.d.ts" />

/** `nspell` — ορθογραφικός έλεγχος. Καταναλωτές: `text-engine/spell/{dictionary-loader,spell.worker}.ts`. */
/// <reference path="../subapps/dxf-viewer/text-engine/spell/nspell.d.ts" />

/** `utif` — TIFF decode. Καταναλωτής: `floorplan-background/providers/ImageProvider.ts`. */
/// <reference path="../subapps/dxf-viewer/floorplan-background/providers/utif.d.ts" />

/** `three/examples/jsm/lines/*` — fat lines. Καταναλωτές: 7 αρχεία σε `bim-3d/` + `canvas-v2/webgl-lines/`. */
/// <reference path="../subapps/dxf-viewer/types/three-examples-lines.d.ts" />

/** `three-gpu-pathtracer` — offline render. Καταναλωτής: `bim-3d/render/PathTracerRenderer.ts`. */
/// <reference path="../subapps/dxf-viewer/types/three-gpu-pathtracer.d.ts" />

/*
 * ── Σκοπίμως ΕΚΤΟΣ γέφυρας ───────────────────────────────────────────────────────
 *
 * `types/dxf-window.d.ts` — δεν είναι `declare module` αλλά **global augmentation**
 *   του `interface Window`, και επικαλύπτεται με το `src/types/window.d.ts` με
 *   **αποκλίνουσες υπογραφές** για τις ίδιες ιδιότητες (π.χ. `runLayeringWorkflowTest`:
 *   `(...args: any[]) => any` εδώ, `() => Promise<unknown>` εκεί). Αν γίνουν ορατά στο
 *   ίδιο program, το interface merging σκάει TS2717. Η συγχώνευσή τους είναι ξεχωριστή
 *   εργασία — απαιτεί έλεγχο κάθε καταναλωτή, όχι reference. Βλ. ADR-719 §7.
 *
 * `types/dxf-modules.d.ts` — περιέχει `declare module './ui/...'` με **σχετικές**
 *   διαδρομές· έχουν νόημα μόνο εντός του subapp program. Reference από εδώ δεν
 *   προσθέτει τίποτα.
 *
 * `next-env.d.ts` — παράγεται από το Next.js, δεν συντηρείται χειροκίνητα.
 */
