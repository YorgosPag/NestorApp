/**
 * @fileoverview **Το εμβαδόν που δείχνουμε για ένα ακίνητο — ΜΕ ΤΟ ΕΙΔΟΣ ΤΟΥ** (ADR-777 §8.100).
 * @module lib/properties/property-display-area
 * @related lib/properties/display-area-label.ts (κείμενο οθόνης) · lib/properties/property-areas.ts (`measuredAreaOrNull`)
 *
 * 🧹 Η ίδια αλυσίδα `areas?.gross || areas?.net || area` ήταν γραμμένη αυτούσια σε **έξι** αρχεία (καρτέλα Μονάδων κτιρίου ×4,
 * κάρτα ακινήτου, πλέγμα, γρήγορη προβολή, κοινοποίηση). Εδώ ζει **μία** φορά (ADR-898 Φ4β — η εξαγωγή XLSX χρειαζόταν
 * πέμπτη). Το 2026-11-11 (ADR-777 §8.100) πέρασαν και οι υπόλοιπες έντεκα οθόνες, με **τρεις** διαφορετικές παραλλαγές
 * (`??` · `||` · μόνο μικτό) — και η `??` έκρυβε το εμβαδόν στον τίτλο της σελίδας ακινήτου όταν το μικτό ήταν `0`.
 *
 * 🔑 **ΔΥΟ ερωτήσεις, ΔΥΟ συναρτήσεις — ποτέ μία που κάνει και τα δύο** (ADR-777 §8.100):
 *   - {@link resolveDisplayArea} — «τι δείχνω σε άνθρωπο;» μικτό → καθαρό → παλιό `area`, **με είδος** ⇒ «108 m² καθαρά».
 *   - {@link resolveGrossBasisArea} — «με τι συγκρίνω/υπολογίζω;» μικτό → παλιό `area`, **ποτέ** καθαρό (Idealista:
 *     *construidos* κύριο, *útiles* χωριστά· RESO: *LivingArea* ≠ *BuildingAreaTotal*). Δημόσια αγγελία (`areaSqm`),
 *     αντικειμενική, αγορά €/m², ζήτηση.
 *   Ως τις 2026-11-11 υπήρχε μόνο σκέτος αριθμός ⇒ το καθαρό δημοσιευόταν σιωπηλά ως «Εμβαδόν» και γινόταν βάση **κάθε**
 *   σύγκρισης της αγγελίας.
 *
 * 🔑 **ΜΙΑ σημασιολογία για οθόνη ΚΑΙ δημόσια αγγελία** (ADR-777 §8.96.5, απόφαση Giorgio 2026-10-14): ίδιος κανόνας
 * «μετρήθηκε;», ίδια σειρά. Η αγγελία δείχνει το καθαρό **ονομασμένο** μέσω του `netAreaSqm` ({@link resolveListingDisplayArea}).
 *
 * ⚠️ `0` σημαίνει **«δεν μετρήθηκε»**, όχι «μηδέν τετραγωνικά» — η αλυσίδα προχωρά στο επόμενο. Η απουσία επιστρέφεται ως
 * `null`: κενό κελί, ποτέ «0 m²» (και ποτέ μέρος αθροίσματος).
 * ⚠️ **Ανεκτικός αναγνώστης**: καλείται και πάνω σε ωμό έγγραφο Firestore (προβολή · server routes) ⇒ μετρά **μόνο**
 * θετικός πεπερασμένος αριθμός (συμβολοσειρά, αρνητικό, `Infinity` ⇒ «δεν μετρήθηκε»).
 */

import { measuredAreaOrNull } from '@/lib/properties/property-areas';
import { isPlainRecord } from '@/lib/type-guards';

export interface DisplayAreaSource {
  readonly areas?: unknown;
  readonly area?: unknown;
}

/**
 * **Το είδος της μέτρησης** — ταξιδεύει ΠΑΝΤΑ μαζί με την τιμή.
 * - `gross` — μικτό (`areas.gross`)· η βάση της αγοράς (Idealista *m² construidos*).
 * - `net` — καθαρό (`areas.net`)· δείχνεται **ονομασμένο**, ποτέ ως «το εμβαδόν» σκέτο.
 * - `unspecified` — το παλιό επίπεδο `area`: η βάση δεν δηλώθηκε, καμία ετικέτα (δεν ισχυριζόμαστε ό,τι δεν ξέρουμε).
 */
export const DISPLAY_AREA_KINDS = ['gross', 'net', 'unspecified'] as const;
export type DisplayAreaKind = (typeof DISPLAY_AREA_KINDS)[number];

export interface DisplayArea {
  readonly value: number;
  readonly kind: DisplayAreaKind;
}

/** Τα είδη που επιτρέπονται ως **βάση σύγκρισης** — όλα εκτός από το καθαρό. */
export type GrossBasisAreaKind = Exclude<DisplayAreaKind, 'net'>;

export interface GrossBasisArea extends DisplayArea {
  readonly kind: GrossBasisAreaKind;
}

/** Τα τρία μετρημένα εμβαδά μιας πηγής, **ανεξάρτητα** — `null` για ό,τι δεν μετρήθηκε. */
export interface MeasuredAreas {
  readonly gross: number | null;
  readonly net: number | null;
  readonly legacy: number | null;
}

/**
 * Τα μετρημένα εμβαδά μιας πηγής — `null` για ό,τι δεν μετρήθηκε (`0` · άκυρο · απόν). Ο **ΕΝΑΣ** αναγνώστης: τον
 * διαβάζουν οι δύο επιλυτές εδώ **και** τα σύνολα ανά είδος (`area-totals.ts`), που χρειάζονται μικτό **και** καθαρό
 * της ίδιας μονάδας (ArchiCAD: δύο στήλες, όχι αλυσίδα).
 */
export function measuredAreasOf(source: DisplayAreaSource): MeasuredAreas {
  const areas = isPlainRecord(source.areas) ? source.areas : {};
  return {
    gross: measuredAreaOrNull(areas.gross),
    net: measuredAreaOrNull(areas.net),
    legacy: measuredAreaOrNull(source.area),
  };
}

/**
 * 🔑 **Το ΕΝΑ «ποιο εμβαδόν δείχνουμε»** — τιμή **και** είδος. Revit (*Area Type*) · ArchiCAD (Zone Gross/Net): η τιμή
 * δεν χωρίζεται ποτέ από τη βάση της.
 * ⚠️ Για **οθόνη** ανθρώπου. Ό,τι συγκρίνεται ή υπολογίζεται ⇒ {@link resolveGrossBasisArea}.
 */
export function resolveDisplayArea(source: DisplayAreaSource): DisplayArea | null {
  const { gross, net, legacy } = measuredAreasOf(source);
  if (gross !== null) return { value: gross, kind: 'gross' };
  if (net !== null) return { value: net, kind: 'net' };
  return legacy === null ? null : { value: legacy, kind: 'unspecified' };
}

/**
 * 🔑 **Το εμβαδόν-βάση σύγκρισης** — μικτό, αλλιώς το παλιό `area` (καθρέφτης του μικτού, ADR-249 §7.9)· **ΠΟΤΕ** το
 * καθαρό. Το διαβάζουν ως μικτό η δημόσια αγγελία (`areaSqm`), η αντικειμενική αξία, τα στατιστικά €/m² της αγοράς και
 * το ταίριασμα ζήτησης — ένα καθαρό εκεί αλλάζει σιωπηλά τη βάση **κάθε** σύγκρισης.
 */
export function resolveGrossBasisArea(source: DisplayAreaSource): GrossBasisArea | null {
  const { gross, legacy } = measuredAreasOf(source);
  if (gross !== null) return { value: gross, kind: 'gross' };
  return legacy === null ? null : { value: legacy, kind: 'unspecified' };
}

/** Μόνο η τιμή του {@link resolveDisplayArea} — για αθροίσματα/στήλες οθόνης. */
export function propertyDisplayArea(source: DisplayAreaSource): number | null {
  return resolveDisplayArea(source)?.value ?? null;
}

/** Ό,τι κρατά μια αγγελία για το εμβαδόν της: η βάση σύγκρισης με το είδος της, και το καθαρό ονομασμένο χωριστά. */
export interface ListingAreaFields {
  readonly areaSqm: number | null;
  readonly areaKind: GrossBasisAreaKind | null;
  readonly netAreaSqm: number | null;
}

/**
 * **Το εμβαδόν που δείχνει η αγγελία** — η βάση (μικτό · παλιό), αλλιώς το καθαρό **ονομασμένο** («108 m² καθαρά»).
 * Ίδια σειρά με το {@link resolveDisplayArea}, πάνω στα πεδία της δημόσιας προβολής.
 */
export function resolveListingDisplayArea(listing: ListingAreaFields): DisplayArea | null {
  const basis = measuredAreaOrNull(listing.areaSqm);
  if (basis !== null) return { value: basis, kind: listing.areaKind ?? 'unspecified' };
  const net = measuredAreaOrNull(listing.netAreaSqm);
  return net === null ? null : { value: net, kind: 'net' };
}

/**
 * **Ανεκτικός αναγνώστης είδους βάσης** από αποθηκευμένο έγγραφο: έγκυρο είδος μένει· εμβαδόν χωρίς (έγκυρο) είδος ⇒
 * `unspecified` («η βάση δεν είναι γνωστή» — ποτέ εικασία)· χωρίς εμβαδόν ⇒ `null` (ποτέ ορφανό είδος).
 */
export function readStoredGrossBasisKind(kind: unknown, areaSqm: unknown): GrossBasisAreaKind | null {
  if (measuredAreaOrNull(areaSqm) === null) return null;
  return kind === 'gross' || kind === 'unspecified' ? kind : 'unspecified';
}
