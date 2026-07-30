/**
 * Δυνατότητες BOQ σε επίπεδο **συνόλου** (ADR-734 §7, εργαλεία 1, 6, 7)
 *
 * `boq_get_summary` · `boq_get_statistics` · `boq_list_categories`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΔΙΑΒΑΖΟΝΤΑΙ ΟΙ ΓΡΑΜΜΕΣ ΕΝΩ ΤΟ SERVICE ΕΠΙΣΤΡΕΦΕΙ ΗΔΗ ΤΟ ΑΘΡΟΙΣΜΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο φάκελος VQE **παράγει** βάση μέτρησης, διακυβέρνηση και απόκλιση baseline
 * από τα ίδια τα items (ADR-734 §6.5 #1) — δεν τα δέχεται ως δήλωση, ακριβώς
 * γιατί ό,τι δηλώνεται μπορεί να δηλωθεί λάθος. Ένα άθροισμα χωρίς τις γραμμές
 * του δεν μπορεί να απαντήσει «είναι υπογράψιμο;» ούτε «είναι ενιαία η μονάδα;».
 *
 * Τίμημα: μία επιπλέον ανάγνωση ανά κλήση (μόνο ανάγνωση, καμία εγγραφή). Η
 * εναλλακτική — να αναπαράγουμε εδώ την ενορχήστρωση του `getBuildingSummary` —
 * θα ήταν διπλότυπο υπολογιστικής λογικής, δηλαδή ακριβώς αυτό που απαγορεύει
 * το ADR-734 §9. Το χρέος («μία μέθοδος service που επιστρέφει άθροισμα *και*
 * γραμμές») είναι καταγεγραμμένο για τη Φάση 3.
 *
 * @module services/agent-capability/capabilities/boq/boq-aggregate-capabilities
 * @see ADR-734 §6.5, §7, §9
 */

import { type AnyCapability, capabilityError, defineCapability, defineParams } from '../../registry';
import { BOQ_CATEGORY_ARRAY_SCHEMA, BOQ_STATS_SCHEMA, BOQ_SUMMARY_SCHEMA } from './boq-value-schemas';
import {
  BOQ_READ_ANNOTATIONS,
  BOQ_READ_POLICY,
  BUILDING_ID_PARAM,
  type BoqCapabilityDeps,
  envelopeOutcome,
} from './boq-capability-shared';

const BUILDING_PARAMS = defineParams({ buildingId: BUILDING_ID_PARAM });

/** Τα τρία εργαλεία επιπέδου συνόλου. */
export function createBoqAggregateCapabilities(deps: BoqCapabilityDeps): readonly AnyCapability[] {
  return [
    defineCapability({
      name: 'boq_get_summary',
      domain: 'boq',
      title: 'Αθροιστική σύνοψη επιμετρήσεων κτιρίου',
      description:
        'Επιστρέφει το συνολικό εκτιμώμενο και πραγματικό κόστος ενός κτιρίου, αναλυμένο ανά κατηγορία ΑΤΟΕ. '
        + 'Είναι το ΠΡΩΤΟ εργαλείο για ερωτήσεις τύπου «πόσο κοστίζει», «πόσο σκυρόδεμα», «τι ποσοστό είναι '
        + 'εγκεκριμένο». Επιστρέφει null όταν το κτίριο δεν έχει καμία γραμμή επιμέτρησης. Δεν τροποποιεί τίποτα.',
      params: BUILDING_PARAMS,
      valueSchema: BOQ_SUMMARY_SCHEMA,
      policy: BOQ_READ_POLICY,
      annotations: BOQ_READ_ANNOTATIONS,
      async handler(args, ctx) {
        const items = await deps.boq.getByBuilding(ctx.companyId, args.buildingId);
        const params = { companyId: ctx.companyId, buildingId: args.buildingId };

        if (items.length === 0) {
          // Κενό σύνολο: ο φάκελος το δηλώνει με `no_source_items`. ΔΕΝ
          // επιστρέφεται ψεύτικο μηδέν — «δεν υπάρχουν γραμμές» και «το κόστος
          // είναι 0» δεν είναι η ίδια πρόταση.
          return envelopeOutcome({
            value: null,
            sourceItems: [],
            computedBy: 'cost-engine.computeBuildingSummary',
            params,
          });
        }

        const summary = await deps.boq.getBuildingSummary(ctx.companyId, args.buildingId);
        if (summary === null) {
          // Υπάρχουν γραμμές αλλά η σύνοψη απέτυχε (το service καταπίνει το
          // σφάλμα και επιστρέφει null). Φάκελος με `value: null` εδώ θα ήταν
          // ψέμα: θα διαβαζόταν ως «κτίριο χωρίς επιμετρήσεις».
          return {
            ok: false,
            error: capabilityError('INTERNAL', 'Building summary could not be computed.', {
              buildingId: args.buildingId,
              itemCount: String(items.length),
            }),
          };
        }

        return envelopeOutcome({
          value: summary,
          sourceItems: items,
          computedBy: 'cost-engine.computeBuildingSummary',
          params,
        });
      },
    }),

    defineCapability({
      name: 'boq_get_statistics',
      domain: 'boq',
      title: 'Πλήθη γραμμών ανά κατάσταση έγκρισης',
      description:
        'Επιστρέφει πόσες γραμμές επιμέτρησης βρίσκονται σε κάθε κατάσταση του κύκλου έγκρισης '
        + '(draft / submitted / approved / certified / locked) και το συνολικό εκτιμώμενο κόστος. Χρησιμοποίησέ το '
        + 'για ερωτήσεις προόδου και ωριμότητας, όχι για ανάλυση κόστους ανά κατηγορία. Δεν τροποποιεί τίποτα.',
      params: BUILDING_PARAMS,
      valueSchema: BOQ_STATS_SCHEMA,
      policy: BOQ_READ_POLICY,
      annotations: BOQ_READ_ANNOTATIONS,
      async handler(args, ctx) {
        const items = await deps.boq.getByBuilding(ctx.companyId, args.buildingId);
        const stats = await deps.boq.getStatistics(ctx.companyId, args.buildingId);

        return envelopeOutcome({
          value: stats,
          sourceItems: items,
          computedBy: 'boq-service.getStatistics',
          params: { companyId: ctx.companyId, buildingId: args.buildingId },
        });
      },
    }),

    defineCapability({
      name: 'boq_list_categories',
      domain: 'boq',
      title: 'Κατηγορίες ΑΤΟΕ του πελάτη',
      description:
        'Επιστρέφει τον κατάλογο κατηγοριών ΑΤΟΕ (κωδικός, ελληνική/αγγλική ονομασία, επιτρεπόμενες μονάδες, '
        + 'προεπιλεγμένη φύρα). Είναι ΑΝΑΦΟΡΙΚΑ δεδομένα, όχι μετρήσεις: ο φάκελος επιστρέφει κενή βάση μέτρησης '
        + 'και μη υπογράψιμη κατάσταση, κατά κανόνα. Χρησιμοποίησέ το για να μεταφράσεις όνομα κατηγορίας σε '
        + 'κωδικό πριν καλέσεις boq_search_items. Δεν τροποποιεί τίποτα.',
      params: defineParams({}),
      valueSchema: BOQ_CATEGORY_ARRAY_SCHEMA,
      policy: BOQ_READ_POLICY,
      annotations: BOQ_READ_ANNOTATIONS,
      async handler(_args, ctx) {
        const categories = await deps.boq.getCategories(ctx.companyId);

        return envelopeOutcome({
          value: categories,
          sourceItems: [],
          computedBy: 'boq-service.getCategories',
          params: { companyId: ctx.companyId },
        });
      },
    }),
  ];
}
