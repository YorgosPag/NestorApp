/**
 * ADR-608 — **αμφίδρομος** χάρτης μεταξύ ΤΩΝ ΔΙΚΩΝ ΜΑΣ annotation symbols και των
 * **built-in συμβόλων του Τέκτονα** (`obj/symbols`, type-7 `<object>` `type_res` index).
 * SSoT και για τις δύο κατευθύνσεις:
 *   - **export** (`tekSymbolTypeRes`): δικό μας σύμβολο → `type_res` του Τέκτονα.
 *   - **import** (`tekSymbolFromTypeRes`): `type_res` → δικό μας σύμβολο (round-trip).
 *
 * Οι δείκτες προέρχονται από τον πραγματικό κατάλογο `Obj.inf` της εγκατάστασης
 * Fespa-Tekton v9.1 (obj/symbols). Η αντιστοίχιση περιορίζεται σε σύμβολα με ΔΙΚΟ ΜΑΣ
 * equivalent — index round-trip μόνο· καμία αντιγραφή της ιδιόκτητης `.asc` γεωμετρίας LH.
 *
 * Σύμβολα ΧΩΡΙΣ built-in equivalent (grid-bubble / detail-callout / revision-tag /
 * scale-bar) δεν έχουν `type_res` → ο exporter τα κρατά ως αυτούσια γεωμετρία. Αντίστροφα,
 * `type_res` του Τέκτονα χωρίς δικό μας σύμβολο (άνθρωποι/αυτοκίνητα/βέλη…) ταυτοποιούνται
 * ΟΝΟΜΑΣΤΙΚΑ μέσω `TEKTON_SYMBOL_NAMES` (warning αντί σιωπηλής απώλειας στο import).
 *
 * @see export/core/tek/dxf-to-tek.ts — collectTekObjects (export καταναλωτής)
 * @see io/tek/tek-object-to-scene.ts — tekObjectToEntity (import καταναλωτής)
 * @see docs/centralized-systems/reference/adrs/ADR-608-vector-pdf-export.md
 */

import type { AnnotationSymbolKind } from '../../../types/annotation-symbol';

/**
 * Μία αντιστοιχισμένη εγγραφή (δικό μας σύμβολο ↔ Tekton `type_res`). ΕΝΑ SSoT — από αυτό
 * παράγονται και οι δύο κατευθύνσεις. Η σειρά ορίζει την «canonical» επιλογή στο reverse
 * (όταν δύο δικά μας `symbolId` δείχνουν στον ίδιο `type_res`, νικά το πρώτο).
 */
interface TekSymbolMatch {
  /** Το δικό μας catalog id (`config/annotation-symbol-catalog.ts`). */
  readonly symbolId: string;
  /** Η οικογένεια συμβόλου. */
  readonly kind: AnnotationSymbolKind;
  /** Ο Tekton catalog index (`type_res`) από το `Obj.inf` (obj/symbols). */
  readonly typeRes: number;
}

/** Το SSoT των αντιστοιχισμένων συμβόλων (export + import παράγονται από εδώ). */
const MATCHED_SYMBOLS: readonly TekSymbolMatch[] = [
  { symbolId: 'northArrowSimple', kind: 'north-arrow', typeRes: 51 }, // Βορράς 1
  { symbolId: 'northArrowStar', kind: 'north-arrow', typeRes: 124 }, // Βορράς 2
  { symbolId: 'northArrowCircledN', kind: 'north-arrow', typeRes: 127 }, // Βορράς 3
  { symbolId: 'northArrowCompass', kind: 'north-arrow', typeRes: 137 }, // Βορράς 4 (ροζέτα)
  { symbolId: 'sectionMarkArrow', kind: 'section-mark', typeRes: 383 }, // Σύμβολο τομής
  { symbolId: 'sectionMarkSplit', kind: 'section-mark', typeRes: 383 }, // Σύμβολο τομής (ίδιο native)
  { symbolId: 'elevationLevel', kind: 'elevation-mark', typeRes: 123 }, // Σήμα στάθμης 1
  { symbolId: 'elevationTag', kind: 'elevation-mark', typeRes: 125 }, // Σήμα στάθμης 2
  // ADR-608 Φ-import-glyphs — βέλη (δικά μας «πιστά» σύμβολα· import fidelity).
  { symbolId: 'directionArrowSingle', kind: 'direction-arrow', typeRes: 380 }, // Βέλος φοράς 1
  { symbolId: 'directionArrowDouble', kind: 'direction-arrow', typeRes: 381 }, // Βέλος φοράς 2
  { symbolId: 'directionArrowOutline', kind: 'direction-arrow', typeRes: 382 }, // Βέλος φοράς 3
  { symbolId: 'entranceArrow', kind: 'direction-arrow', typeRes: 126 }, // Βέλος εισόδου
  // ADR-608 Φ-import-svg — άνθρωποι (SVG glyphs· πρωτότυπα σχέδια χρήστη).
  { symbolId: 'personFamily', kind: 'person', typeRes: 52 }, // Άνθρωποι 1 → οικογένεια
];

/** Ανά-`symbolId` override (πιο συγκεκριμένο του kind· παράγεται από το SSoT). */
const TYPE_RES_BY_SYMBOL_ID: Readonly<Record<string, number>> = Object.fromEntries(
  MATCHED_SYMBOLS.map((m) => [m.symbolId, m.typeRes]),
);

/** Fallback ανά `kind` όταν λείπει override συγκεκριμένου `symbolId` (πρώτο ανά kind). */
const TYPE_RES_BY_KIND: Partial<Readonly<Record<AnnotationSymbolKind, number>>> = (() => {
  const byKind: Partial<Record<AnnotationSymbolKind, number>> = {};
  for (const m of MATCHED_SYMBOLS) if (byKind[m.kind] === undefined) byKind[m.kind] = m.typeRes;
  return byKind;
  // grid-bubble / detail-callout / revision-tag → κανένα built-in → αυτούσια γεωμετρία.
})();

/** Αντίστροφος χάρτης `type_res` → canonical δικό μας σύμβολο (πρώτη εγγραφή ανά `type_res`). */
const SYMBOL_BY_TYPE_RES: Readonly<Record<number, { symbolId: string; kind: AnnotationSymbolKind }>> =
  (() => {
    const byRes: Record<number, { symbolId: string; kind: AnnotationSymbolKind }> = {};
    for (const m of MATCHED_SYMBOLS) {
      if (byRes[m.typeRes] === undefined) byRes[m.typeRes] = { symbolId: m.symbolId, kind: m.kind };
    }
    return byRes;
  })();

/**
 * Ο Tekton `type_res` για ένα δικό μας σύμβολο, ή `undefined` αν δεν υπάρχει built-in
 * equivalent (→ ο exporter το αποδομεί σε αυτούσια γεωμετρία). Προτεραιότητα στο `symbolId`
 * override, μετά στο `kind`.
 */
export function tekSymbolTypeRes(
  kind: AnnotationSymbolKind, symbolId: string | undefined,
): number | undefined {
  if (symbolId && symbolId in TYPE_RES_BY_SYMBOL_ID) return TYPE_RES_BY_SYMBOL_ID[symbolId];
  return TYPE_RES_BY_KIND[kind];
}

/**
 * Αντίστροφο του `tekSymbolTypeRes` (import): ο Tekton `type_res` → το δικό μας canonical
 * σύμβολο (`symbolId` + `kind`), ή `undefined` αν δεν υπάρχει δικό μας equivalent (τότε ο
 * mapper το ταυτοποιεί ονομαστικά μέσω `tektonSymbolName` + warning).
 */
export function tekSymbolFromTypeRes(
  typeRes: number,
): { readonly symbolId: string; readonly kind: AnnotationSymbolKind } | undefined {
  return SYMBOL_BY_TYPE_RES[typeRes];
}

/**
 * Το Ελληνικό όνομα ενός Tekton `type_res` από τον κατάλογο `obj/symbols` του `Obj.inf`
 * (μόνο ονόματα — index↔label· ΚΑΜΙΑ γεωμετρία LH). Χρήση: ονομαστική ταυτοποίηση συμβόλων
 * χωρίς δικό μας equivalent στο import warning. `undefined` αν ο index δεν είναι σύμβολο.
 */
export function tektonSymbolName(typeRes: number): string | undefined {
  return TEKTON_SYMBOL_NAMES[typeRes];
}

/**
 * Πλήρης πίνακας `type_res` → Ελληνικό όνομα για τα 53 σύμβολα σχεδίασης (`obj/symbols`)
 * της εγκατάστασης Fespa-Tekton v9.1. Data-only (index↔label) — νομικά καθαρό· καμία
 * ιδιόκτητη γεωμετρία. Πηγή: `Obj.inf`.
 */
export const TEKTON_SYMBOL_NAMES: Readonly<Record<number, string>> = {
  45: 'Ανελκυστήρας 140Χ170',
  46: 'Ανελκυστήρας 170Χ190',
  51: 'Βορράς 1',
  52: 'Άνθρωποι 1',
  54: 'Αυτοκίνητο 1',
  123: 'Σήμα στάθμης 1',
  124: 'Βορράς 2',
  125: 'Σήμα στάθμης 2',
  126: 'Βέλος εισόδου',
  127: 'Βορράς 3',
  128: 'Άνθρωπος κάτοψη',
  129: 'Άνθρωποι 3',
  130: 'Άνθρωποι 4',
  131: 'Άνθρωποι 5',
  132: 'Άνθρωποι 6',
  133: 'Άνθρωποι 7',
  134: 'Γυναίκα κάτοψη',
  135: 'Άνδρας κάτοψη',
  136: 'Άνδρας κάτοψη',
  137: 'Βορράς 4',
  138: 'Φορτηγό όψη',
  141: 'Πλάγια όψη φορτηγού',
  142: 'Πλάγια όψη λεωφορείου',
  143: 'Πίσω όψη λεωφορείου',
  144: 'Αυτοκίνητο όψη',
  145: 'Αυτοκίνητο όψη',
  157: 'Τηλέφωνο 1',
  158: 'Τηλέφωνο 2',
  380: 'Βέλος φοράς 1',
  381: 'Βέλος φοράς 2',
  382: 'Βέλος φοράς 3',
  383: 'Σύμβολο τομής',
  384: 'Αναπηρική καρέκλα',
  385: 'Πλήθος',
  386: 'Ζεύγος',
  387: 'Γυναίκα',
  388: 'Γυναίκα-παιδί',
  389: 'Γυναίκα',
  390: 'Όψη επιβατικού 1',
  391: 'Πλάγια όψη αυτοκινήτου',
  392: 'Κάτοψη επιβατικό',
  393: 'Πλάγια όψη αυτοκινήτου 1',
  394: 'Κάτοψη αυτοκινήτου 2',
  395: 'Πλάγια όψη 3',
  396: 'Κάτοψη αυτοκινήτου 3',
  397: 'Κάτοψη μικρού φορτηγού',
  398: 'Όψη μικρού φορτηγού',
  399: 'Μεγάλο φορτηγό κάτοψη',
  400: 'Μεγάλο φορτηγό όψη',
  401: 'Όψη φορτηγού 2',
  402: 'Κάτοψη φορτηγού 2',
  403: 'Βαν όψη',
  404: 'Βαν κάτοψη',
};
