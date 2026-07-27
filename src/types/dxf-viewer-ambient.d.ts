/**
 * Bridge ορατότητας: ambient module declarations που ζουν **μέσα** στο
 * `src/subapps/dxf-viewer/` αλλά πρέπει να φαίνονται στο root TypeScript program.
 *
 * ## Γιατί χρειάζεται
 *
 * Το root `tsconfig.json` δηλώνει `include` για κάθε `.d.ts` του `src/`, αλλά
 * ταυτόχρονα `exclude: "src/subapps/dxf-viewer/**"` — και το `exclude`
 * **φιλτράρει** τα αποτελέσματα του `include`. Τα κανονικά αρχεία του subapp
 * μπαίνουν παρ' όλα αυτά στο program, γιατί τα τραβά το import-chain από το
 * `src/app/**`. Οι **ambient** δηλώσεις όμως δεν εισάγονται ποτέ από κανέναν —
 * δεν υπάρχει import να τις τραβήξει — άρα μένουν οριστικά εκτός και ο compiler
 * βγάζει TS7016 «could not find a declaration file» για πακέτα που **είναι**
 * ήδη τυποποιημένα μέσα στο subapp.
 *
 * Ένα triple-slash reference directive προσθέτει το αρχείο στο program **ρητά**,
 * παρακάμπτοντας το `exclude` — χωρίς να αντιγράψει ούτε έναν τύπο και χωρίς να
 * αγγίξει το `tsconfig.json`.
 *
 * ## SSoT
 *
 * Οι δηλώσεις μένουν **δίπλα στον καταναλωτή τους**, εκεί που ανήκουν. Αυτό το
 * αρχείο δεν περιέχει τύπους· είναι μόνο ο δείκτης ορατότητας. Νέο untyped
 * πακέτο στο subapp → η δήλωσή του δίπλα στον καταναλωτή, μία γραμμή εδώ.
 *
 * ⚠️ **ΜΗΝ** προσθέσεις εδώ reference προς τις δηλώσεις του subapp για
 * `opentype.js` / `utif` / `@jest/globals` και το GCS storage SDK: υπάρχουν ήδη
 * χειρόγραφα **αντίγραφα** αυτών των δηλώσεων στο `src/types/` και δύο ambient
 * δηλώσεις για το ίδιο module name συγκρούονται. Η εξάλειψη των αντιγράφων
 * (αντικατάστασή τους με reference εδώ) είναι καταγεγραμμένη εκκρεμότητα στο
 * `.claude-rules/pending-ratchet-work.md`.
 *
 * @module types/dxf-viewer-ambient
 * @see docs/centralized-systems/reference/adrs/ADR-650-topographic-survey-and-contours.md
 */

/** `cdt2d` (MIT) — Constrained Delaunay για το TIN. Καταναλωτής: `systems/topography/tin-builder.ts`. */
/// <reference path="../subapps/dxf-viewer/systems/topography/cdt2d.d.ts" />
