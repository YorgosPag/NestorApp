/**
 * GET /api/catalog/xchange-export/preview[?priceListId=…] — ο **προέλεγχος** της εξαγωγής ETIM xChange (ADR-923 §5.14.1 · Ε3):
 * πόσα προϊόντα θα γράφονταν για το κοινό, πόσα μένουν εκτός και γιατί, και τι θα έκανε την εξαγωγή να αρνηθεί. Χωρίς έγγραφο.
 *
 * 🔑 Η **ίδια** κρίση με την εξαγωγή (`judgeAudience`): ο αριθμός που βλέπει ο χρήστης πριν το κλικ είναι ο αριθμός του αρχείου.
 * 🔒 Ίδιος κριτής (`catalog:pricing:view`) και ίδιος αναγνώστης παραμέτρων με το αρχείο: οι μετρήσεις ανά τιμή είναι
 *    πληροφορία τιμών. Rate: standard.
 */

import 'server-only';

import { previewXChangeExport } from '@/server/catalog/xchange-export.server';
import { catalogReadRoute } from '../../_shared/catalog-route';
import { xchangeAudienceOf } from '../../_shared/xchange-export-params';

export const GET = catalogReadRoute({ category: 'STANDARD', authority: 'pricingView' }, (auth, _params, search) =>
  previewXChangeExport(auth, xchangeAudienceOf(search)),
);
