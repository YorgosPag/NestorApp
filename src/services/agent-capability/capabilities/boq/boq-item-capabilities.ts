/**
 * Δυνατότητες BOQ σε επίπεδο **γραμμής** (ADR-734 §7, εργαλεία 2-5)
 *
 * `boq_search_items` · `boq_get_item` · `boq_get_variance` · `boq_get_baseline_drift`
 *
 * Τα τρία τελευταία περνούν υποχρεωτικά από το `withOwnedItem()` — τον έλεγχο
 * ιδιοκτησίας που κλείνει το κενό tenant isolation του `getById` (ADR-734 §7).
 *
 * @module services/agent-capability/capabilities/boq/boq-item-capabilities
 * @see ADR-734 §7
 */

import type { BOQItem } from '@/types/boq';
import type { BOQSearchFilters } from '@/services/measurements/contracts';
import { computeBaselineDrift, computeItemCost, computeVariance } from '@/services/measurements/cost-engine';
import { type AnyCapability, capabilityError, defineCapability, defineParams } from '../../registry';
import {
  BOQ_ITEM_ARRAY_SCHEMA,
  BOQ_ITEM_WITH_COST_SCHEMA,
  BASELINE_DRIFT_SCHEMA,
  VARIANCE_SCHEMA,
} from './boq-value-schemas';
import {
  BOQ_READ_ANNOTATIONS,
  BOQ_READ_POLICY,
  BUILDING_ID_PARAM,
  type BoqCapabilityDeps,
  CATEGORY_CODE_PARAM,
  ITEM_ID_PARAM,
  SCOPE_PARAM,
  SEARCH_TEXT_PARAM,
  STATUS_PARAM,
  envelopeOutcome,
  withOwnedItem,
} from './boq-capability-shared';

/**
 * Ανώτατο πλήθος γραμμών που επιστρέφει μια αναζήτηση.
 *
 * ⚠️ **Δεν κόβει σιωπηλά** — υπέρβαση σημαίνει σφάλμα με οδηγία. Μια περικομμένη
 * λίστα που ο πράκτορας αθροίζει νομίζοντας ότι είναι πλήρης παράγει **λάθος
 * ποσότητα**, όχι απλώς ελλιπή απάντηση. Για συνολικά μεγέθη υπάρχουν τα
 * `boq_get_summary` / `boq_get_statistics`, που αθροίζουν στο service.
 */
const BOQ_SEARCH_MAX_ITEMS = 200;

const SEARCH_PARAMS = defineParams({
  buildingId: BUILDING_ID_PARAM,
  categoryCode: CATEGORY_CODE_PARAM,
  status: STATUS_PARAM,
  scope: SCOPE_PARAM,
  searchText: SEARCH_TEXT_PARAM,
});

const ITEM_PARAMS = defineParams({ itemId: ITEM_ID_PARAM });

/** Χτίζει τα φίλτρα του service παραλείποντας ό,τι δεν δηλώθηκε. */
function toSearchFilters(args: {
  readonly categoryCode?: string;
  readonly status?: BOQItem['status'];
  readonly scope?: BOQItem['scope'];
  readonly searchText?: string;
}): BOQSearchFilters {
  return {
    ...(args.categoryCode !== undefined ? { categoryCode: args.categoryCode } : {}),
    ...(args.status !== undefined ? { status: args.status } : {}),
    ...(args.scope !== undefined ? { scope: args.scope } : {}),
    ...(args.searchText !== undefined ? { searchText: args.searchText } : {}),
  };
}

/** Τα τέσσερα εργαλεία επιπέδου γραμμής. */
export function createBoqItemCapabilities(deps: BoqCapabilityDeps): readonly AnyCapability[] {
  return [
    defineCapability({
      name: 'boq_search_items',
      domain: 'boq',
      title: 'Αναζήτηση γραμμών επιμέτρησης',
      description:
        'Επιστρέφει τις γραμμές επιμέτρησης (BOQ) ενός κτιρίου, προαιρετικά φιλτραρισμένες κατά κατηγορία ΑΤΟΕ, '
        + 'κατάσταση έγκρισης, εύρος εφαρμογής ή ελεύθερο κείμενο. Χρησιμοποίησέ το όταν χρειάζεσαι τις ΕΠΙΜΕΡΟΥΣ '
        + 'γραμμές. Για συνολικά κόστη ή πλήθη προτίμησε boq_get_summary / boq_get_statistics — είναι φθηνότερα και '
        + 'δεν κινδυνεύουν από πολύ μεγάλο αποτέλεσμα. Δεν τροποποιεί τίποτα.',
      params: SEARCH_PARAMS,
      valueSchema: BOQ_ITEM_ARRAY_SCHEMA,
      policy: BOQ_READ_POLICY,
      annotations: BOQ_READ_ANNOTATIONS,
      async handler(args, ctx) {
        const filters = toSearchFilters(args);
        const items = await deps.boq.search(ctx.companyId, args.buildingId, filters);

        if (items.length > BOQ_SEARCH_MAX_ITEMS) {
          return {
            ok: false,
            error: capabilityError(
              'INVALID_ARGUMENT',
              `Query matched ${items.length} items (limit ${BOQ_SEARCH_MAX_ITEMS}). Narrow the filters, or use boq_get_summary / boq_get_statistics for aggregates.`,
              { matched: String(items.length), limit: String(BOQ_SEARCH_MAX_ITEMS) },
            ),
          };
        }

        return envelopeOutcome({
          value: items,
          sourceItems: items,
          computedBy: 'boq-service.search',
          params: { companyId: ctx.companyId, buildingId: args.buildingId, filters },
        });
      },
    }),

    defineCapability({
      name: 'boq_get_item',
      domain: 'boq',
      title: 'Γραμμή επιμέτρησης με ανάλυση κόστους',
      description:
        'Επιστρέφει μία γραμμή επιμέτρησης μαζί με την πλήρη ανάλυση κόστους της (μικτή ποσότητα μετά τη φύρα, '
        + 'κόστος υλικών / εργασίας / εξοπλισμού, μοναδιαίο και συνολικό κόστος). Η ανάλυση υπολογίζεται κάθε φορά '
        + 'από τη μηχανή κόστους — δεν είναι αποθηκευμένη. Δεν τροποποιεί τίποτα.',
      params: ITEM_PARAMS,
      valueSchema: BOQ_ITEM_WITH_COST_SCHEMA,
      policy: BOQ_READ_POLICY,
      annotations: BOQ_READ_ANNOTATIONS,
      handler: (args, ctx) =>
        withOwnedItem(deps, ctx, args.itemId, 'cost-engine.computeItemCost', (item) => ({
          item,
          cost: computeItemCost(item),
        })),
    }),

    defineCapability({
      name: 'boq_get_variance',
      domain: 'boq',
      title: 'Απόκλιση εκτίμησης vs πραγματικών',
      description:
        'Συγκρίνει την προϋπολογιστική ποσότητα μιας γραμμής με την πραγματική (as-built) και επιστρέφει τη '
        + 'διαφορά σε μονάδες, σε ποσοστό και σε κόστος. Επιστρέφει null όταν η γραμμή ΔΕΝ έχει ακόμη καταχωρημένη '
        + 'πραγματική ποσότητα — αυτό δεν είναι σφάλμα. Δεν τροποποιεί τίποτα.',
      params: ITEM_PARAMS,
      valueSchema: VARIANCE_SCHEMA,
      policy: BOQ_READ_POLICY,
      annotations: BOQ_READ_ANNOTATIONS,
      handler: (args, ctx) =>
        withOwnedItem(deps, ctx, args.itemId, 'cost-engine.computeVariance', computeVariance),
    }),

    defineCapability({
      name: 'boq_get_baseline_drift',
      domain: 'boq',
      title: 'Απόκλιση ζωντανού μοντέλου από το υπογεγραμμένο baseline',
      description:
        'Συγκρίνει την ποσότητα του ΖΩΝΤΑΝΟΥ BIM μοντέλου με την ΠΑΓΩΜΕΝΗ υπογεγραμμένη ποσότητα της γραμμής '
        + '(ADR-674). Απαντά στο ερώτημα «άλλαξε το σχέδιο μετά την υπογραφή;» — διαφορετικό από το boq_get_variance, '
        + 'που συγκρίνει εκτίμηση με πραγματική εκτέλεση. Επιστρέφει null όταν η γραμμή δεν παρακολουθείται ή δεν '
        + 'αποκλίνει. Δεν τροποποιεί τίποτα.',
      params: ITEM_PARAMS,
      valueSchema: BASELINE_DRIFT_SCHEMA,
      policy: BOQ_READ_POLICY,
      annotations: BOQ_READ_ANNOTATIONS,
      handler: (args, ctx) =>
        withOwnedItem(deps, ctx, args.itemId, 'cost-engine.computeBaselineDrift', computeBaselineDrift),
    }),
  ];
}
