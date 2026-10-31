/**
 * 🔒 **Το φράγμα του §12** ως καθαρή κρίση (ADR-923 §5.6): μπορεί αυτός ο τιμοκατάλογος να τυπωθεί γι' αυτόν τον θεατή;
 * Μόνο λίστα **πώλησης** (ποτέ `cost`, το εσωτερικό κόστος του χώρου), και ο θεατής να **καλύπτεται** από το κοινό της:
 * συνταγή «λιανική» πάνω σε λίστα «χονδρική» θα τύπωνε τις τιμές ενός κοινού για άλλο κοινό.
 * @module subapps/catalog/publishing/publication-price-fence
 */

import { audienceCovers } from '../pricing/price-audience';
import type { PriceListDefinition, PricingViewer } from '../types/price-list';

export function publicationListMayServe(list: Pick<PriceListDefinition, 'kind' | 'audience'>, viewer: PricingViewer): boolean {
  return list.kind === 'sales' && list.audience !== null && audienceCovers(list.audience, viewer);
}

/** Μόνο αμετάβλητη, αποδείξιμη έκδοση τυπώνεται: δημοσιευμένη ή αντικατεστημένη, με ισχύ και σφραγίδα. */
export function publicationVersionPrintable(version: { readonly status: string; readonly validFrom: string | null; readonly seal: object | null }): boolean {
  return (version.status === 'published' || version.status === 'superseded') && version.validFrom !== null && version.seal !== null;
}
