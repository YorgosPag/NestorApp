/**
 * ADR-833 §5.7 — **`#RRGGBB` → `AARRGGBB`**, το χρώμα όπως το θέλει το OOXML.
 *
 * ## Γιατί δικό του αρχείο και όχι δύο γραμμές μέσα στον γραφέα
 * Επειδή τους γραφείς είναι **τρεις** (κελί, περίγραμμα, γέμισμα) και όλοι ρωτούν το ίδιο. Δύο
 * αντίγραφα του `padStart(6, '0')` θα ήταν το ακριβές σχήμα που πιάνει το CHECK 3.28 (jscpd) —
 * και το τρίτο θα γεννιόταν στη Φάση 7.
 *
 * ⚠️ **Δεν γεννιέται δεύτερος αναλυτής hex**: το `#RGB`/`#RRGGBB` το διαβάζει ήδη το
 * `utils/dxf-true-color.ts` (ο **αμφίδρομος** SSoT του DXF true-color), και εδώ γίνεται μόνο η
 * προσθήκη του καναλιού διαφάνειας. Ένα δεύτερο `RegExp` θα σήμαινε ότι το ίδιο `#abc` μπορεί
 * να διαβαστεί αλλιώς σε DXF και αλλιώς σε `.xlsx`, μέσα στο ίδιο σχέδιο.
 *
 * @module subapps/dxf-viewer/bim/table/export/table-xlsx-color
 * @see utils/dxf-true-color.ts — ο ΕΝΑΣ αναλυτής hex
 */

import { hexToTrueColor } from '../../../utils/dxf-true-color';

/** Πλήρως αδιαφανές — το OOXML γράφει το άλφα **πρώτο**, σε αντίθεση με το CSS. */
const OPAQUE_ALPHA = 'FF';

/**
 * `#RRGGBB` → `FFRRGGBB`.
 *
 * Άγνωστο ή κακοσχηματισμένο hex ⇒ **μαύρο**, ίδιο fallback με το `hexToTrueColor`: ένα
 * `undefined` που ταξίδευε ως χρώμα θα έκανε το `exceljs` να γράψει άκυρο στυλ, και το Excel
 * θα αρνιόταν να ανοίξει **ολόκληρο** το βιβλίο για ένα κελί.
 */
export function hexToArgb(hex: string): string {
  const rgb = hexToTrueColor(hex);
  return OPAQUE_ALPHA + rgb.toString(16).padStart(6, '0').toUpperCase();
}
