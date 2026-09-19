/**
 * =============================================================================
 * SALES SPACE PAGE — SSoT για ό,τι μοιράζονται οι σελίδες βοηθητικών χώρων
 * =============================================================================
 *
 * Οι σελίδες στάθμευσης και αποθηκών δεν είναι απλώς «παρόμοιες»: τρέχουν πάνω
 * στο ΙΔΙΟ generic `useSalesSpaceViewerState` και ταΐζουν το ΙΔΙΟ
 * `SalesSpaceSidebar`. Άρα το πέρασμα κατάστασης→sidebar, η τιμολόγηση της
 * κάρτας και η αντιστοίχιση των κοινών φίλτρων είναι μία απόφαση, όχι δύο.
 *
 * Εδώ ζει ΜΟΝΟ αυτό το κοινό. Ό,τι ανήκει σε έναν χώρο (η ζώνη του parking, το
 * εμβαδόν της αποθήκης) μένει στη σελίδα του.
 *
 * @module components/sales/shared/sales-space-page
 * @see @/hooks/sales/useSalesSpaceViewerState — η κοινή κατάσταση (ADR-199)
 * @see SalesSpaceSidebar.tsx — το κοινό sidebar που δέχεται αυτά τα props
 */

import { useCallback, useMemo } from 'react';
import { pricePerSqmAmount } from '@/domain/cards/property/property-card-shared';
import {
  pricePerAreaLabel,
  resolvedPriceLabel,
  type PriceLabelT,
} from '@/lib/listings/listing-price-label';
import { EMPTY_PRICE_RANGE, type RolePriceRange } from '@/lib/properties/price-range';
import { resolveDisplayPrice, type PricedPropertyLike } from '@/lib/properties/price-resolver';
import type { SalesSpaceFilterState, SalesSpaceItem } from '@/types/sales-shared';

/** Το κομμάτι της κατάστασης που ταΐζει το sidebar ενός βοηθητικού χώρου. */
export interface SalesSpaceSidebarState<TItem extends SalesSpaceItem> {
  filteredItems: TItem[];
  selectedItem: TItem | null;
  selectedItemId: string | null;
  handleSelectItem: (itemId: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
}

/** Το props contract που μοιράζονται `SalesParkingSidebar` και `SalesStorageSidebar`. */
export interface SalesSpaceSidebarProps<TItem extends SalesSpaceItem> {
  items: TItem[];
  selectedItem: TItem | null;
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
}

/** Κατάσταση → props sidebar. Μία μετονομασία, όχι δύο αντίγραφα. */
export function salesSpaceSidebarProps<TItem extends SalesSpaceItem>(
  state: SalesSpaceSidebarState<TItem>
): SalesSpaceSidebarProps<TItem> {
  return {
    items: state.filteredItems,
    selectedItem: state.selectedItem,
    onSelectItem: state.handleSelectItem,
    selectedItemId: state.selectedItemId,
    selectedStatus: state.selectedStatus,
    onStatusChange: state.setSelectedStatus,
    selectedType: state.selectedType,
    onTypeChange: state.setSelectedType,
  };
}

/**
 * Οι τιμές που δείχνει μια κάρτα πωλήσεων — **ήδη γραμμένες, με τη μονάδα τους**.
 * `null` ⇒ δεν υπάρχει ποσό (η κάρτα γράφει παύλα, ποτέ «0 €»).
 */
export interface SalesCardPricing {
  price: string | null;
  pricePerSqm: string | null;
}

/**
 * Τιμή και τιμή/m² μιας κάρτας πωλήσεων (θέση · αποθήκη · πωλημένο ακίνητο).
 *
 * 🔴 ADR-777 §8.60.14.14: ως τις 2026-09-18 επέστρεφε **αριθμούς** (`priceSortKey`) και κάθε
 * κάρτα τους έγραφε `formatCurrencyWhole(x)` / `${x}/m²` — δηλαδή «60 €» και «6 €/m²» για
 * θέση που **νοικιάζεται** 60 €/μήνα. Ο ρόλος λυνόταν και **πετιόταν**. Πλέον το κείμενο
 * γράφεται **εδώ, μία φορά**, από τους ΕΝΑ μορφοποιητές (`resolvedPriceLabel` ·
 * `pricePerAreaLabel`), με τη μονάδα του ρόλου — και η τιμή/m² υπάρχει μόνο όπου ο ρόλος
 * την ορίζει (`pricePerSqmAmount`: καμία «€/m²/νύχτα»).
 *
 * @see lib/properties/price-resolver — ο ΕΝΑΣ κανόνας τιμής
 */
export function salesCardPricing(
  item: PricedPropertyLike & { area?: number | null },
  t: PriceLabelT,
): SalesCardPricing {
  const price = resolveDisplayPrice(item);
  if (price.kind !== 'priced') return { price: null, pricePerSqm: null };

  const perSqm = pricePerSqmAmount(price.headline, item.area);
  return {
    price: resolvedPriceLabel(t, price.headline),
    pricePerSqm: perSqm === null ? null : pricePerAreaLabel(t, { role: price.headline.role, amount: perSqm }),
  };
}

// 🧹 Εδώ ζούσε το `salesSpaceStatusBadge` + `STATUS_VARIANT` πάνω στο παλιό ανάμεικτο `status`
// (ADR-777 §8.60.20): οι κάρτες ζωγραφίζουν πλέον τα σήματα του ΕΝΟΣ SSoT (`spaceStatusBadges`).

/**
 * Μια επιλογή του panel: **πίνακας** όταν ο πίνακας ξεκίνησε από πίνακα, **κείμενο** όταν ξεκίνησε
 * από κείμενο (το panel σέβεται τη μορφή της κατάστασης που του δόθηκε — και η σελίδα του δίνει
 * `'all'`).
 */
type SingleChoice = string | readonly string[];

/**
 * Η μία τιμή μιας επιλογής — `'all'` όταν δεν επιλέχθηκε τίποτα.
 *
 * 🔴 ADR-777 §8.60.14.14 (ζωντανή επαλήθευση): ο μεταφραστής έγραφε `adv.building?.[0]`, δηλαδή
 * υπέθετε **πίνακα**. Η σελίδα όμως δίνει στο panel **κείμενο** (`'all'`), και `'all'[0]` είναι
 * `'a'` ⇒ **κάθε** αλλαγή φίλτρου άδειαζε τη λίστα (κτίριο · όροφος · τύπος · κατάσταση = `'a'`).
 */
function singleChoice(value: SingleChoice | undefined): string {
  if (typeof value === 'string') return value || 'all';
  return value?.[0] ?? 'all';
}

/** Η μορφή των φίλτρων του `AdvancedFiltersPanel` που διαβάζουν και οι δύο χώροι. */
export interface SalesSpaceAdvancedFilters {
  searchTerm?: string;
  status?: SingleChoice;
  building?: SingleChoice;
  floor?: SingleChoice;
  type?: SingleChoice;
  ranges?: {
    priceRange?: RolePriceRange;
    areaRange?: { min?: number | null; max?: number | null };
  };
}

/**
 * Τα φίλτρα του panel (πολλαπλή επιλογή, εμφωλευμένα εύρη) → η κατάσταση της σελίδας.
 *
 * 🔴 ADR-777 §8.60.14.14: ως τις 2026-09-18 εδώ περνούσαν μόνο αναζήτηση/κτίριο/όροφος/τύπος·
 * τα εύρη **τιμής και εμβαδού πετιόνταν** — τα πεδία ζωγραφίζονταν, δέχονταν αριθμούς και
 * **δεν έκαναν τίποτα**. Το εύρος τιμής ταξιδεύει πλέον **με τη μονάδα του**.
 */
export function mapCommonSpaceFilters(adv: SalesSpaceAdvancedFilters) {
  return {
    searchTerm: adv.searchTerm || '',
    status: singleChoice(adv.status),
    building: singleChoice(adv.building),
    floor: singleChoice(adv.floor),
    type: singleChoice(adv.type),
    priceRange: adv.ranges?.priceRange ?? EMPTY_PRICE_RANGE,
    areaRange: { min: adv.ranges?.areaRange?.min ?? null, max: adv.ranges?.areaRange?.max ?? null },
  };
}

/**
 * Η κατάσταση της σελίδας → η μορφή του panel — **το αντίστροφο** του {@link mapCommonSpaceFilters}.
 * Χωρίς αυτό το panel διάβαζε `ranges.*` που η σελίδα δεν έχει: τα πεδία εύρους **άδειαζαν**
 * μόλις γράφονταν (ελεγχόμενο πεδίο χωρίς πηγή).
 */
export function spacePanelFilters<TFilters extends SalesSpaceFilterState>(filters: TFilters) {
  return {
    ...filters,
    ranges: {
      priceRange: filters.priceRange,
      areaRange: { min: filters.areaRange.min ?? undefined, max: filters.areaRange.max ?? undefined },
    },
  };
}

/**
 * **Η γέφυρα panel ⇄ σελίδα, ΜΙΑ φορά για θέσεις ΚΑΙ αποθήκες** (ADR-777 §8.60.14.14 · N.18).
 *
 * Οι δύο σελίδες έγραφαν η καθεμία τον δικό της μεταφραστή — και **απέκλιναν**: η σελίδα θέσεων
 * περνούσε την κατάσταση (status), η σελίδα αποθηκών **όχι**· καμία δεν περνούσε το εύρος τιμής.
 * Τώρα και οι δύο ρωτούν εδώ: το panel βλέπει τα εύρη εμφωλευμένα, η σελίδα τα παίρνει πίσω
 * **με τη μονάδα τους**.
 */
export function useSalesSpacePanelFilters<TFilters extends SalesSpaceFilterState>(
  filters: TFilters,
  onChange: (next: Partial<SalesSpaceFilterState>) => void,
) {
  const panelFilters = useMemo(() => spacePanelFilters(filters), [filters]);
  const onPanelFiltersChange = useCallback(
    (adv: SalesSpaceAdvancedFilters) => onChange(mapCommonSpaceFilters(adv)),
    [onChange],
  );
  return { panelFilters, onPanelFiltersChange };
}
