/**
 * Ο **ΕΝΑΣ** τρόπος να φορτωθεί ένα από τα δύο μητρώα της κορδέλας μέσα σε jest.
 *
 * ## Γιατί δυναμικό import και όχι static
 * Και τα δύο μητρώα τραβούν εκατοντάδες modules (~90 widgets, ~60 δηλώσεις καρτελών), και
 * κάποια από αυτά φτάνουν ως το `platform_node`, που καλεί `fetch` κατά την **αρχικοποίηση**
 * του module — API που δεν υπάρχει στο node test environment. Με static import το suite
 * περνά ή σκάει ανάλογα με το **ποιο άλλο test έτρεξε πρώτο στον ίδιο worker**: πράσινο που
 * δεν σημαίνει τίποτα.
 *
 * Τα stubs **δεν καλούνται ποτέ** — πετούν αν κληθούν. Υπάρχουν μόνο για να μη σκάσει η
 * αρχικοποίηση, ώστε το test να ρωτήσει το **πραγματικό** μητρώο.
 *
 * ## Γιατί εδώ και όχι αντιγραμμένο ανά test
 * Το σώμα ήταν γραμμένο **δύο** φορές (`insert-tab-table-button` · `contextual-table-tabs`)
 * και το τρίτο αντίγραφο ερχόταν με τον έλεγχο των `widgetId` των καρτελών πίνακα (N.0.2 /
 * N.18). Ένα σημείο: αν αύριο λείψει τέταρτο Web API, το μαθαίνουν όλα τα tests μαζί.
 *
 * ⚠️ **ΜΗΝ** το αντικαταστήσεις με χειρόγραφο `Set` έγκυρων `widgetId`: γίνεται δεύτερη
 * αλήθεια που παλιώνει σιωπηλά και ελέγχει τον εαυτό της αντί για το μητρώο.
 *
 * @module subapps/dxf-viewer/ui/ribbon/data/__tests__/ribbon-registry-test-loader
 */

import type React from 'react';
import type { RibbonCommand, RibbonTab } from '../../types/ribbon-types';

/**
 * Κάθε `RibbonCommand` ενός συνόλου καρτελών — μαζί με τα `variants` των split buttons και τα
 * φωλιασμένα `subVariants` (ADR-419).
 *
 * ⚠️ Η διάσχιση ζει **μία** φορά: ήταν γραμμένη μέσα στο `ribbon-quantity-kind-coverage` και
 * το δεύτερο αντίγραφο ερχόταν με το `ribbon-label-key-coverage`. Δύο walkers σημαίνει ότι ο
 * ένας θα ξεχάσει κάποτε τα `subVariants` — και θα δείξει **πράσινο** για ό,τι δεν διάβασε.
 */
export function collectRibbonCommands(tabs: readonly RibbonTab[]): RibbonCommand[] {
  const out: RibbonCommand[] = [];
  const push = (cmd: RibbonCommand): void => {
    out.push(cmd);
    for (const sub of cmd.subVariants ?? []) push(sub);
  };
  for (const tab of tabs) {
    for (const panel of tab.panels) {
      for (const row of panel.rows) {
        for (const button of row.buttons) {
          push(button.command);
          for (const variant of button.variants ?? []) push(variant);
        }
      }
    }
  }
  return out;
}

type GlobalWithWebApis = typeof globalThis & Record<string, unknown>;

/** Τα Web API που λείπουν από το node environment, ως εκρηκτικά stubs. */
export function stubWebApis(): void {
  const g = globalThis as GlobalWithWebApis;
  const unavailable = (): never => {
    throw new Error('Web API δεν καλείται σε αυτό το test');
  };
  for (const name of ['fetch', 'Response', 'Request', 'Headers']) {
    if (typeof g[name] === 'undefined') g[name] = unavailable;
  }
}

/**
 * Ο **πραγματικός** `renderRibbonWidget`.
 *
 * Επιστρέφει `null` σε άγνωστο `widgetId` — δηλαδή ένα ορθογραφικό λάθος είναι **αόρατο
 * κουμπί χωρίς σφάλμα**. Αυτός ο loader υπάρχει για να γίνεται αυτό κόκκινο test.
 */
export async function loadWidgetRenderer(): Promise<(id: string | undefined) => React.ReactNode> {
  stubWebApis();
  const registry = await import('../../components/ribbon-widget-registry');
  return registry.renderRibbonWidget;
}

/** Οι ακατέργαστες contextual καρτέλες, όπως τις βλέπει η κορδέλα πριν το lead panel. */
export async function loadContextualTabs(): Promise<readonly RibbonTab[]> {
  stubWebApis();
  const registry = await import('../contextual-tabs-registry');
  return registry.RAW_RIBBON_CONTEXTUAL_TABS;
}
