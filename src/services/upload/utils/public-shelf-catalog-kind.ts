/**
 * @fileoverview **Η ΓΡΑΜΜΗ ΤΟΥ ΡΑΦΙΟΥ ΓΙΑ ΤΑ ΜΕΣΑ ΤΗΣ ΒΙΤΡΙΝΑΣ** (ADR-923 §5.13 Σ3 · ADR-841 §7 Α21).
 * @related services/upload/utils/public-shelf-kinds · server/catalog/public/public-model-writer.server
 * @module services/upload/utils/public-shelf-catalog-kind
 *
 * 🔑 Ιδιωτικό αρχείο σε δημόσια διαδρομή ήταν ο κίνδυνος του Σ3· γι' αυτό **κανένα δεύτερο ράφι**: η ίδια μηχανή καθαρίζει
 *    EXIF/GPS και κάνει το πρόθεμα ακριβώς ίσο με το επιθυμητό σύνολο, άρα ό,τι πάψει να επιτρέπεται σβήνεται μόνο του.
 * 🔒 Υποκείμενο = το **μοντέλο**, ώστε η απόσυρση να είναι τοπική. Τα ids του καταλόγου δεν περιέχουν ούτε μοιάζουν με
 *    ταυτότητα μισθωτή.
 */

import { FRAMING_AS_GIVEN } from './public-shelf-encoding';
import type { RasterShelfKind } from './public-shelf-kinds';

/** Η ρίζα στον δημόσιο κάδο: ονομάζει τι δημοσιεύεται, όχι πού αποθηκεύεται η δήλωση. */
export const PUBLIC_SHELF_CATALOG_ROOT = 'catalog-models';

/** Το ράφι κουβαλά το μέσο και δεν το ερμηνεύει: το `published[i]` δεν είναι το `sources[i]`. */
export interface CatalogShelfMaterial {
  readonly assetId: string;
}

const CATALOG_SUBJECT = /^(cpmod|cprod|cspro)_[A-Za-z0-9-]+$/;

/** Αποδεκτό υποκείμενο: ρίζα καταλόγου ή προφίλ παρόχου (§22 Υ8). Το μοτίβο αποκλείει ήδη `/`, `.` και κενό. */
export function isPublicShelfCatalogSubject(value: string): boolean {
  return CATALOG_SUBJECT.test(value);
}

/** Η γραμμή: προϊόν σε καρέ ή κάρτα. Άνω όριο 2048, όσο η απόδοση web· καμία εστίαση, καμία αποκοπή. */
export const CATALOG_MODEL_SHELF: RasterShelfKind<CatalogShelfMaterial> = {
  root: PUBLIC_SHELF_CATALOG_ROOT,
  acceptsSubject: isPublicShelfCatalogSubject,
  encoding: { kind: 'raster', widths: [640, 1280, 2048], quality: 82, preset: 'photo' },
  framingOf: () => FRAMING_AS_GIVEN,
  detectsFocalPoint: () => false,
};
