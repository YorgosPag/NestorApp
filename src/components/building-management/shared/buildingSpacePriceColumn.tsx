/**
 * @fileoverview **Η στήλη «Τιμή» των πινάκων χώρων κτιρίου** — κελί ΜΕ μονάδα, σειρά ΣΕ ΟΜΑΔΕΣ.
 * @related ADR-777 §8.60.14.14 · lib/properties/price-class-sections.ts · lib/listings/listing-price-label.ts
 * @module components/building-management/shared/buildingSpacePriceColumn
 *
 * 🔴 **ΤΟ ΕΥΡΗΜΑ (2026-09-18).** Οι καρτέλες «Θέσεις» και «Αποθήκες» κτιρίου έγραφαν την ίδια
 * στήλη δύο φορές: κελί `formatCurrencyWhole(priceSortKey(x))` — **«900 €» για μηνιαίο
 * ενοίκιο** — και σειρά `sortValue: priceSortKey`, δηλαδή `60 €/μήνα` και `18.000 €` σε **έναν**
 * άξονα. Ο ρόλος ήταν στον επιλυτή και **πετιόταν**.
 *
 * 🏆 **Revit Schedule**: `Sort By` = η **κλάση** (με Header) → `Then By` = η **τιμή**. Εδώ: μια
 * ομάδα γραμμών (`<tbody>` + `<th scope="rowgroup">`) ανά μονάδα, ταξινομημένη μέσα της, και
 * **μία** ομάδα ⇒ **καμία** επικεφαλίδα (ο πίνακας μένει ο σημερινός, με τη μονάδα γραμμένη).
 *
 * ⛔ **Μηδέν νέα κρίση**: κλάση/ποσό από τον ΕΝΑ επιλυτή, διαμέριση από την ΕΝΑ μηχανή
 * (`partitionByPriceClass`), κείμενο από τον ΕΝΑ μορφοποιητή (`priceCellLabel` ·
 * `priceSectionLabel`). Εδώ μόνο **συναρμολογούνται** — μία φορά, για όλες τις καρτέλες.
 */

import { compareByNameThenId } from '@/lib/ordering/total-name-order';
import {
  priceCellLabel,
  priceSectionLabel,
  type PriceLabelT,
} from '@/lib/listings/listing-price-label';
import { PRICE_RANGE_ROLE_KEY } from '@/lib/listings/listing-price-keys';
import { partitionByPriceClass } from '@/lib/properties/price-class-sections';
import { resolveDisplayPrice, type PricedPropertyLike } from '@/lib/properties/price-resolver';
import type { SortDirection } from '@/lib/array-utils';
import type { SpaceColumn, SpaceSortGroup } from './types';

/** Ό,τι χρειάζεται η στήλη από κάθε γραμμή: τα πεδία του επιλυτή + ταυτότητα για ολική σειρά. */
export type PricedSpaceRow = PricedPropertyLike & { readonly id: string };

/**
 * Οι γραμμές σε **ομάδες ανά μονάδα τιμής**, με την επιγραφή «Πώληση · 3 ακίνητα».
 *
 * @param nameOf — το όνομα που βλέπει ο άνθρωπος (κωδικός/αριθμός) — ισοπαλίες και απουσία
 *   τιμής παίρνουν **ολική** σειρά όνομα → `id`, ώστε ίδια δεδομένα ⇒ ίδια σειρά.
 */
export function priceSortGroups<T extends PricedSpaceRow>(
  t: PriceLabelT,
  nameOf: (item: T) => string,
) {
  return (items: readonly T[], direction: SortDirection): readonly SpaceSortGroup<T>[] =>
    partitionByPriceClass(items, {
      direction,
      tieBreak: (a, b) => compareByNameThenId(nameOf(a), a.id, nameOf(b), b.id),
    }).map((section) => ({
      key: section.heading ?? 'all',
      label: section.heading === null ? null : priceSectionLabel(t, section.heading, section.items.length),
      items: section.items,
    }));
}

/**
 * **Το κελί τιμής** — ποσό **με** τη μονάδα του. Ένα: η στήλη το ζωγραφίζει, και η γραμμή επεξεργασίας επί τόπου (όπου η
 * τιμή δεν αλλάζει) το δείχνει στη θέση του, ώστε τα κελιά να μένουν κάτω από τις επικεφαλίδες τους.
 */
export function SpacePriceCell({ item, t }: { readonly item: PricedPropertyLike; readonly t: PriceLabelT }) {
  return <span className="font-mono text-xs">{priceCellLabel(t, resolveDisplayPrice(item))}</span>;
}

/**
 * **Η στήλη «Τιμή»** ενός πίνακα χώρων — `sortGroups`, **ποτέ** `sortValue`: μια επίπεδη σειρά
 * κατά ποσό δεν είναι δυνατό να εκφραστεί από αυτή τη στήλη.
 */
function buildPriceColumn<T extends PricedSpaceRow>(
  label: string,
  t: PriceLabelT,
  nameOf: (item: T) => string,
): SpaceColumn<T> {
  return {
    key: 'price',
    label,
    width: 'w-28',
    render: (item) => <SpacePriceCell item={item} t={t} />,
    sortGroups: priceSortGroups(t, nameOf),
  };
}

/** Το ποσό της κύριας τιμής ως **αριθμός** — `null` όταν η οθόνη γράφει «—». */
function headlineAmountOf(item: PricedSpaceRow): number | null {
  const price = resolveDisplayPrice(item);
  return price.kind === 'priced' ? price.headline.amount : null;
}

/** Η μονάδα της κύριας τιμής — «Τιμή πώλησης (€)» · «Ενοίκιο (€/μήνα)» · «Τιμή ανά νύχτα (€/νύχτα)». */
function headlineUnitOf(t: PriceLabelT, item: PricedSpaceRow): string | null {
  const price = resolveDisplayPrice(item);
  return price.kind === 'priced' ? t(PRICE_RANGE_ROLE_KEY[price.headline.role]) : null;
}

/**
 * **Οι στήλες τιμής — ΠΑΝΤΑ ζευγάρι** (ADR-898 Φ4β): στην οθόνη ένα κελί με τη μονάδα του («900 €/μήνα»)· στο αρχείο
 * **ποσό** (νόμισμα) **και** «Μονάδα τιμής» (`exportOnly`). Πώληση, €/μήνα και €/νύχτα **δεν** είναι ένας άξονας —
 * σκέτη αριθμητική στήλη θα άφηνε το Excel να τα αθροίσει. Γι' αυτό το ποσό **δεν** εξάγεται ποτέ χωρίς τη μονάδα του,
 * και η στήλη **δεν** αθροίζεται στη γραμμή συνόλου.
 */
export function buildPriceColumns<T extends PricedSpaceRow>(
  labels: { readonly price: string; readonly unit: string },
  t: PriceLabelT,
  nameOf: (item: T) => string,
): readonly [SpaceColumn<T>, SpaceColumn<T>] {
  return [
    { ...buildPriceColumn<T>(labels.price, t, nameOf), exportCell: headlineAmountOf, exportFormat: 'currency' },
    { key: 'priceUnit', label: labels.unit, exportOnly: true, render: () => null, exportCell: (item) => headlineUnitOf(t, item) },
  ];
}
