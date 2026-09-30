/**
 * @fileoverview **Το ζωγράφισμα του χωροπληθή χάρτη τιμών** (ADR-890 §14 · §15) — εκφράσεις `feature-state` και το
 * μοτίβο διαγράμμισης. **Δύο χάρτες, ένα ζωγράφισμα**: ο χάρτης της αναζήτησης και ο χάρτης σύγκρισης της σελίδας Δήμου.
 * @related `lib/market/price-map-view.ts` (`PriceMapFeatureState`: `c` κλάση · `k` είδος · `s` επιλεγμένη) ·
 *   `components/market/map-ramp.ts` (τα χρώματα) · `choropleth-sync.ts` (ο συγχρονισμός)
 * @module components/market/choropleth/price-map-paint
 *
 * 🔑 **Η γεωμετρία δεν ξέρει τιμές**: κάθε χρώμα διαβάζεται από την κατάσταση της περιοχής. Αλλαγή πηγής ή τμήματος
 * ξαναγράφει ~1.000 καταστάσεις — **καμία** επαναφόρτωση ή επανατεμαχισμός γεωμετρίας.
 *
 * 🔑 **Διαγράμμιση = δεύτερο κανάλι** (CHECK 3.41): «τιμή Δήμου» και «λίγα δεδομένα» διαβάζονται χωρίς χρώμα.
 *
 * 🔴 **Διαφάνεια ΑΝΑ ΘΕΜΑ ΥΠΟΒΑΘΡΟΥ** (μετρημένο ζωντανά 2026-09-28): ο χάρτης αναζήτησης έχει **σκούρο** υπόβαθρο στο
 * σκούρο θέμα (ADR-891). Με την αδιαφάνεια των ζωνών (0,55–0,6) οι σκουρότερες κλάσεις **χάνονταν** μέσα στο φόντο και
 * το χρώμα του χάρτη δεν έμοιαζε με το (αδιαφανές) δείγμα του υπομνήματος. Η παλέτα `--map-seq-*` είναι ίδια στα δύο
 * θέματα επειδή η σελίδα περιοχής έχει ανοιχτό υπόβαθρο — εδώ αυτό δεν ισχύει, και το διορθώνει η διαφάνεια.
 */

import { readFullRamp, readThemeColor } from '@/components/market/map-ramp';
import type { BasemapScheme } from '@/lib/maps/basemap-catalog';
import type { FillLayerSpecification, LineLayerSpecification, SymbolLayerSpecification } from '@/lib/maps/maplibre';

type FillPaint = NonNullable<FillLayerSpecification['paint']>;
type LinePaint = NonNullable<LineLayerSpecification['paint']>;
type SymbolLayout = NonNullable<SymbolLayerSpecification['layout']>;

/** Το όνομα της εικόνας του μοτίβου — **ανά θέμα**: η γραμμή έχει το χρώμα κειμένου του θέματος. */
export function priceMapHatchImage(scheme: BasemapScheme): string {
  return `price-map-hatch-${scheme}`;
}

const TRANSPARENT = 'rgba(0,0,0,0)';

/** Δική τιμή · τιμή Δήμου · λίγα — αρκετά διαφανές για δρόμους/ονόματα, αρκετά αδιαφανές για να διαβάζεται η κλάση. */
const OPACITY: Readonly<Record<BasemapScheme, readonly [number, number, number]>> = {
  light: [0.6, 0.45, 0.3],
  dark: [0.85, 0.65, 0.35],
};

const STATE_CLASS = ['coalesce', ['feature-state', 'c'], -2];
const STATE_KIND = ['coalesce', ['feature-state', 'k'], -1];
const SELECTED = ['boolean', ['feature-state', 's'], false];

export function priceMapFillPaint(scheme: BasemapScheme): FillPaint {
  const ramp = readFullRamp();
  const stops = ramp.flatMap((color, index) => [index, color]);
  const [own, inherited, few] = OPACITY[scheme];
  return {
    'fill-color': ['match', STATE_CLASS, ...stops, -1, readThemeColor('--muted'), TRANSPARENT],
    'fill-opacity': ['match', STATE_KIND, 0, own, 1, inherited, 2, few, 0],
  } as FillPaint;
}

/** Το μοτίβο φαίνεται μόνο εκεί όπου η περιοχή **δεν** έχει δική της τιμή. */
export function priceMapHatchPaint(scheme: BasemapScheme): FillPaint {
  return {
    'fill-pattern': priceMapHatchImage(scheme),
    'fill-opacity': ['match', STATE_KIND, 1, 0.8, 2, 0.6, 0],
  } as FillPaint;
}

/** Λεπτό λευκό όριο ανάμεσα σε περιοχές· η επιλεγμένη με παχιά γραμμή στο χρώμα του κειμένου. */
export function priceMapLinePaint(): LinePaint {
  return {
    'line-color': ['case', SELECTED, readThemeColor('--foreground'), readThemeColor('--background')],
    'line-width': ['case', SELECTED, 2.5, 0.6],
    'line-opacity': ['case', SELECTED, 1, 0.7],
  } as LinePaint;
}

/**
 * **Ετικέτα τιμής πάνω στην περιοχή** (ADR-890 §15): χρώμα κειμένου του θέματος με φωτοστέφανο του φόντου — διαβάζεται
 * πάνω σε **κάθε** κλάση της κλίμακας, από την ανοιχτότερη ως τη σκουρότερη, και στα δύο υπόβαθρα.
 */
export function priceMapLabelPaint(): { readonly color: string; readonly halo: string } {
  return { color: readThemeColor('--foreground'), halo: readThemeColor('--background') };
}

/**
 * **Η διάταξη της ετικέτας τιμής** (ADR-890 §17) — μία, για κάθε χάρτη που γράφει τιμή πάνω στην περιοχή. Διαβάζει τις
 * ιδιότητες `text` και `rank` του σημείου (`childLabelsOf`).
 *
 * Μετρημένο ζωντανά (Π.Ε. Θεσσαλονίκης, zoom 7,5, 14 Δήμοι): σταθερή άγκυρα **8/14** ορατές · με εναλλακτικές άγκυρες
 * **10/14** (Mapbox «variable label placement»). Η σύγκρουση ήταν **μόνο** ετικέτα-με-ετικέτα (ίδιο 8/14 χωρίς τα
 * ονόματα του υποβάθρου). Το `symbol-sort-key` κάνει την προτεραιότητα **δηλωμένη** αντί για τη σειρά του πίνακα.
 * ⛔ Όχι `text-allow-overlap`: 14 αριθμοί ο ένας πάνω στον άλλο δεν διαβάζονται — χειρότερο από το κρυμμένο, που
 * μένει στον πίνακα και στο πέρασμα.
 */
export function priceMapLabelLayout(font: readonly string[]): SymbolLayout {
  return {
    'text-field': ['get', 'text'],
    'text-font': [...font],
    'text-size': 13,
    'text-max-width': 8,
    'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
    'text-radial-offset': 0.5,
    'text-justify': 'auto',
    'symbol-sort-key': ['get', 'rank'],
  } as SymbolLayout;
}

/** Ο ελάχιστος χάρτης που χρειάζεται η εικόνα — ώστε το module να μη δένεται με τον τύπο του MapLibre. */
interface ImageHost {
  hasImage(id: string): boolean;
  addImage(id: string, image: ImageData, options?: { pixelRatio?: number }): void;
}

/** Πλευρά του πλακιδίου του μοτίβου σε pixels συσκευής (pixelRatio 2 ⇒ 8 CSS px). */
const HATCH_SIZE = 16;

/**
 * **Διαγώνιες γραμμές στο χρώμα του κειμένου του θέματος** — προστίθεται μία φορά ανά στυλ. Σχεδιάζεται σε canvas
 * (δέχεται το `hsl(...)` του θέματος αυτούσιο), ώστε το μοτίβο να ακολουθεί το θέμα χωρίς δεύτερο αρχείο εικόνας.
 */
export function ensurePriceMapHatch(map: ImageHost, scheme: BasemapScheme): void {
  const id = priceMapHatchImage(scheme);
  if (map.hasImage(id)) return;
  const canvas = document.createElement('canvas');
  canvas.width = HATCH_SIZE;
  canvas.height = HATCH_SIZE;
  const context = canvas.getContext('2d');
  if (context === null) return;
  context.strokeStyle = readThemeColor('--foreground');
  context.lineWidth = 2;
  context.beginPath();
  // Τρεις γραμμές ώστε το μοτίβο να «δένει» στις άκρες του πλακιδίου.
  for (const offset of [-HATCH_SIZE, 0, HATCH_SIZE]) {
    context.moveTo(offset, HATCH_SIZE);
    context.lineTo(offset + HATCH_SIZE, 0);
  }
  context.stroke();
  map.addImage(id, context.getImageData(0, 0, HATCH_SIZE, HATCH_SIZE), { pixelRatio: 2 });
}
