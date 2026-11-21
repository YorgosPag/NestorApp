/**
 * sRGB transfer functions (IEC 61966-2-1) — ΕΝΑ primitive, ΜΙΑ σταθερά (ADR-694 Φ10).
 *
 * Μετακόμισε **αυτούσιο** από το `dxf-viewer/config/color-math.ts` (ADR-920 Β6.1): η υψομετρική κλίμακα
 * του εδάφους (`@/lib/terrain/elevation-ramp`) χρειάζεται την ίδια μεταφορά **έξω** από το subapp, όπου ο
 * δημόσιος κώδικας εισάγει από το `lib`, όχι από τον viewer (ADR-920 Α1 · CHECK 3.62). Το `color-math` την
 * επανεξάγει, άρα κανένας εισαγωγέας δεν άλλαξε (ίδια συνταγή με το `planar-polygon`).
 *
 * Pure — zero DOM/React/store. Μονάδες: 0..1.
 */

import { clamp01 } from '@/lib/geometry/scalar';

// ⚠️ ΣΧΟΛΙΟ-ΦΡΟΥΡΟΣ — **ΜΗΝ** «διορθώσεις» το `0.04045` σε `0.03928`.
//
// Το `0.03928` κυκλοφορεί ακόμη σε αμέτρητα snippets ως «η τιμή του WCAG». **Δεν είναι.** Ήταν
// τυπογραφικό λάθος παλιάς έκδοσης του sRGB spec που είχε αντιγραφεί αυτούσιο στο WCAG, και
// **το ίδιο το W3C το απέσυρε τον Μάιο 2021**:
//
//   «Before May 2021 the value of 0.04045 in the definition was different (0.03928).
//    It was taken from an older version of the specification and has been updated.»
//   — https://www.w3.org/WAI/WCAG22/Understanding/relative-luminance.html
//
// Άρα **δεν** υπάρχουν «δύο σωστά πρότυπα»: υπάρχει το IEC 61966-2-1 (`0.04045`) και ένα
// διορθωμένο λάθος. Ένα primitive, μία σταθερά — ακριβώς όπως το colorjs.io (των editors του
// CSS Color spec) και το three.js, που επίσης χτίζουν το WCAG luminance **πάνω** στο EOTF
// αντί να κρατούν δεύτερο αντίγραφο των ίδιων μαθηματικών.
//
// **Μετρημένο (ADR-694 Φ10):** για ακέραια κανάλια `0..255` οι δύο σταθερές δίνουν
// **bit-for-bit ταυτόσημο** αποτέλεσμα — το byte 10 (`0.03922`) πέφτει κάτω **κι από τα δύο**
// κατώφλια, το byte 11 (`0.04314`) πάνω **κι από τα δύο**· κανένα byte δεν πέφτει ανάμεσά τους.
// Το κλειδώνει εκτελεστικά το `dxf-viewer/config/__tests__/color-math-srgb-transfer.test.ts`.
//
// **Δύο ΣΤΡΩΜΑΤΑ, ένα math** — γι' αυτό μένουν χωριστές συναρτήσεις:
//   · `srgbToLinearUnit` / `linearToSrgbUnit` = **χρωματομετρία** («τι φως ανακλάται στ' αλήθεια»).
//     Δεν αλλάζει ποτέ — το IEC 61966-2-1 δεν αλλάζει.
//   · `srgbRelativeLuminance` / `contrastRatio` (στο `color-math`) = **WCAG αναγνωσιμότητα**. Αν αύριο
//     περάσουμε σε APCA (WCAG 3) αλλάζουν **αυτά**, με το EOTF άθικτο.

/**
 * Clamp στο `0..1` με `NaN → 0`. Reuse του `clamp01` (SSoT, ADR-071) + **μόνο** ο NaN φρουρός:
 * ένα `NaN` εδώ θα διέρρεε αθόρυβα μέχρι το hex και θα έβγαζε άκυρο χρώμα, ενώ το `0` είναι η
 * ασφαλής τιμή. `±Infinity` πέφτει φυσιολογικά στα άκρα μέσω του `clamp01`.
 */
function clampUnit(value: number): number {
  return Number.isNaN(value) ? 0 : clamp01(value);
}

/**
 * **EOTF** — sRGB κωδικοποιημένη τιμή (0..1) → **γραμμική ένταση φωτός** (0..1).
 * IEC 61966-2-1: `c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`.
 *
 * Το sRGB **δεν είναι γραμμικό**: το `128` δεν είναι «μισό φως» αλλά **~21.6%**. Κάθε πράξη που
 * μέσο-όρου (blend, resize, μέσο χρώμα υφής) πάνω σε ωμές sRGB τιμές βγάζει συστηματικά
 * σκουρότερο/λασπωμένο αποτέλεσμα· ο σωστός κύκλος είναι πάντα `sRGB → linear → πράξη → sRGB`.
 *
 * **Γιατί ακριβής και όχι `pow(x, 2.2)`:** η προσέγγιση `2.2` αστοχεί αισθητά στα σκοτεινά (η
 * πραγματική sRGB έχει **γραμμικό** τμήμα κάτω από το κατώφλι) — ακριβώς εκεί που οι υφές έχουν
 * τις σκιές τους.
 */
export function srgbToLinearUnit(component: number): number {
  const c = clampUnit(component);
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * **OETF** — γραμμική ένταση φωτός (0..1) → sRGB κωδικοποιημένη τιμή (0..1). Η αντίστροφη του
 * {@link srgbToLinearUnit}. IEC 61966-2-1: `l ≤ 0.0031308 ? l*12.92 : 1.055·l^(1/2.4) − 0.055`.
 */
export function linearToSrgbUnit(component: number): number {
  const l = clampUnit(component);
  return l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
}
