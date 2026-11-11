/**
 * @fileoverview **Το εμβαδόν που δείχνουμε → ΚΕΙΜΕΝΟ ΟΘΟΝΗΣ, με το είδος του.** Ένα σημείο (ADR-777 §8.100).
 * @related lib/properties/property-display-area.ts (τιμή + είδος) · lib/listings/listing-price-label.ts (€/m²) ·
 *   lib/properties/area-totals.ts (σύνολα ανά είδος → {@link areaTotalsView}) ·
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
import { AREA_TOTAL_KINDS, type AreaTotalsByKind } from '@/lib/properties/area-totals';
import { EMPTY_STAT_VALUE, type StatBreakdownRow, type StatBreakdownView } from '@/types/stat-breakdown';

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

// ============================================================================
// ΣΥΝΟΛΑ ΑΝΑ ΕΙΔΟΣ → ΚΑΡΤΑ ΣΤΑΤΙΣΤΙΚΟΥ (ADR-777 §8.101)
// ============================================================================

/** Η κλάση μιας γραμμής υποσυνόλου εμβαδού — τα είδη, και η απουσία ως **κλάση** (τελευταία). */
export type AreaTotalClass = DisplayAreaKind | 'unmeasured';

/** «Μικτά · 12 ακίνητα» — κάθε κλειδί κυριολεκτικό (CHECK 3.34 G), όλα στο `common:` (CHECK 3.34 F). */
function areaSectionLabel(t: PriceLabelT, heading: AreaTotalClass, count: number): string {
  switch (heading) {
    case 'gross':
      return t('common:areaSection.gross', { count });
    case 'net':
      return t('common:areaSection.net', { count });
    case 'unspecified':
      return t('common:areaSection.unspecified', { count });
    case 'unmeasured':
      return t('common:areaSection.unmeasured', { count });
  }
}

/**
 * **Υποσύνολα εμβαδού ανά είδος → κάρτα στατιστικού.** Ο ΕΝΑΣ δρόμος για κάθε «Συνολικό Εμβαδόν».
 *
 * 🔑 Ίδιος κανόνας με το `priceTotalsView`: **ένα** είδος χωρίς απουσίες ⇒ ένα μέγεθος, **με το είδος του**
 *    («1.450 m² μικτά» — η ετικέτα εδώ είναι η μόνη διάκριση, §8.100)· αλλιώς υποσύνολα, κάθε γραμμή με το πλήθος
 *    της, και οι μονάδες χωρίς εμβαδόν **ονομασμένες** στο τέλος — ποτέ σιωπηλά έξω από τον αριθμό.
 */
export function areaTotalsView(t: PriceLabelT, totals: AreaTotalsByKind): StatBreakdownView {
  const present = AREA_TOTAL_KINDS.filter((kind) => totals.byKind[kind].measuredCount > 0);
  if (present.length === 0) return { value: EMPTY_STAT_VALUE, breakdown: [] };
  if (present.length === 1 && totals.unmeasuredCount === 0) {
    const kind = present[0];
    return { value: displayAreaLabel(t, { value: totals.byKind[kind].total, kind }), breakdown: [] };
  }

  const rows: StatBreakdownRow[] = present.map((kind) => ({
    key: kind,
    label: areaSectionLabel(t, kind, totals.byKind[kind].measuredCount),
    value: t('common:displayArea.sqm', { value: formatAreaValue(totals.byKind[kind].total) }),
  }));
  if (totals.unmeasuredCount > 0) {
    rows.push({ key: 'unmeasured', label: areaSectionLabel(t, 'unmeasured', totals.unmeasuredCount), value: null });
  }
  return { value: '', breakdown: rows };
}
