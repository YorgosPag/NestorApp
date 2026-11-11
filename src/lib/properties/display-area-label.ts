/**
 * @fileoverview **Το εμβαδόν που δείχνουμε → ΚΕΙΜΕΝΟ ΟΘΟΝΗΣ, με το είδος του.** Ένα σημείο (ADR-777 §8.100).
 * @related lib/properties/property-display-area.ts (τιμή + είδος) · lib/listings/listing-price-label.ts (€/m²) ·
 *   lib/listings/listing-area-label.ts (η ίδια ετικέτα στη μονάδα της δημόσιας αγγελίας)
 * @module lib/properties/display-area-label
 *
 * 🔑 «120 m² μικτά» · «108 m² καθαρά» · «95 m²» (παλιό `area`, άγνωστη βάση — δεν ισχυριζόμαστε ό,τι δεν ξέρουμε).
 *    Idealista γράφει *m² construidos* / *útiles* ονομασμένα· Revit/ArchiCAD κρατούν το *Area Type* με την τιμή.
 *    Εδώ η ετικέτα δεν είναι διακόσμηση: είναι η μόνη διάκριση ανάμεσα σε δύο αριθμούς με την ίδια μονάδα.
 *
 * 🔑 **Ο προσδιορισμός είδους είναι ΕΝΑΣ ({@link qualifiedAreaText}), η μονάδα ανήκει στην επιφάνεια**: η σελίδα της
 *    αγγελίας γράφει «τ.μ.» σε όλες τις γραμμές της, το γραφείο «m²» — ο προσδιορισμός μπαίνει ίδιος και στα δύο.
 *
 * 🔑 **Τιμή ανά m²**: μετριέται πάνω στο **ίδιο** εμβαδόν που δείχνουμε, και όταν η βάση είναι το καθαρό το λέει
 *    («4.500 €/m² καθαρά»). Το μικτό είναι η σύμβαση της αγοράς (Idealista: €/m² πάνω σε *construidos*) ⇒ δεν
 *    χρειάζεται προσδιορισμό· το `unspecified` δεν έχει γνωστή βάση ⇒ ούτε αυτό. Ποτέ σιωπηλή αλλαγή βάσης.
 *
 * ⚠️ **Κάθε κλειδί γράφεται ΚΥΡΙΟΛΕΚΤΙΚΑ** (ADR-744, CHECK 3.34 G): ο στατικός αναλυτής του κελύφους πρέπει να ξέρει
 *    ποια κλειδιά φορτώνει αυτό το module — ένα `t(πίνακας[kind])` είναι ανεπίλυτη δυναμική κλήση.
 * ⚠️ **Μόνο `common:`** — κανένα κλειδί άλλου namespace εδώ: όποιος εισάγει αυτό το module (π.χ. οι σελίδες πωλήσεων)
 *    θα κατέβαζε αλλιώς ολόκληρο το ξένο namespace (CHECK 3.34 F).
 */

import { formatNumber } from '@/lib/intl-formatting';
import {
  pricePerAreaLabel,
  pricePerSqmAmount,
  type PriceLabelT,
} from '@/lib/listings/listing-price-label';
import type { ResolvedPrice } from '@/lib/properties/price-resolver';
import type { DisplayArea, DisplayAreaKind } from '@/lib/properties/property-display-area';

/** Η λέξη του είδους — `null` για το `unspecified` (η βάση δεν δηλώθηκε, άρα δεν τη λέμε). */
function basisWord(t: PriceLabelT, kind: DisplayAreaKind): string | null {
  switch (kind) {
    case 'gross':
      return t('common:displayArea.basis.gross');
    case 'net':
      return t('common:displayArea.basis.net');
    case 'unspecified':
      return null;
  }
}

function qualify(t: PriceLabelT, text: string, basis: string | null): string {
  return basis === null ? text : t('common:displayArea.qualified', { text, basis });
}

/** Ο αριθμός του εμβαδού — έως δύο δεκαδικά, με τα διαχωριστικά της γλώσσας. */
export function formatAreaValue(value: number): string {
  return formatNumber(value, { maximumFractionDigits: 2 });
}

/** **Ο ΕΝΑΣ προσδιορισμός είδους** πάνω σε ήδη γραμμένο εμβαδόν της επιφάνειας («95 τ.μ.» ⇒ «95 τ.μ. μικτά»). */
export function qualifiedAreaText(t: PriceLabelT, text: string, kind: DisplayAreaKind): string {
  return qualify(t, text, basisWord(t, kind));
}

/** «120 m² μικτά» · «108 m² καθαρά» · «95 m²». */
export function displayAreaLabel(t: PriceLabelT, area: DisplayArea): string {
  return qualifiedAreaText(t, t('common:displayArea.sqm', { value: formatAreaValue(area.value) }), area.kind);
}

/**
 * Ένα παράγωγο ποσό (π.χ. €/m²) με τη βάση του **μόνο** όταν αυτή αποκλίνει από τη σύμβαση της αγοράς (το καθαρό) —
 * αλλιώς αυτούσιο.
 */
export function withStatedAreaBasis(t: PriceLabelT, text: string, kind: DisplayAreaKind): string {
  return kind === 'net' ? qualifiedAreaText(t, text, kind) : text;
}

/**
 * **Τιμή ανά m² πάνω στο εμβαδόν που δείχνουμε** — «2.450 €/m²» · «4.500 €/m² καθαρά» · `null` χωρίς εμβαδόν ή σε
 * ρόλο χωρίς τέτοια τιμή (διανυκτέρευση, `pricePerSqmAmount`). Ο ΕΝΑΣ δρόμος για κάθε επιφάνεια με €/m² ακινήτου.
 */
export function pricePerDisplayAreaLabel(
  t: PriceLabelT,
  price: Pick<ResolvedPrice, 'role' | 'amount'>,
  area: DisplayArea | null,
): string | null {
  if (area === null) return null;
  const amount = pricePerSqmAmount(price, area.value);
  if (amount === null) return null;
  return withStatedAreaBasis(t, pricePerAreaLabel(t, { role: price.role, amount }), area.kind);
}
