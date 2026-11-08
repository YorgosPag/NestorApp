/**
 * Συνημμένα xChange ⇒ `ExtractedAsset[]` (ADR-934 §5.2 Μ1 · Μ2 · στάδιο Μ-α). Καθαρό: χωρίς δίκτυο, χωρίς Firestore —
 * εδώ διαβάζεται μόνο **τι λέει** το αρχείο. Τη λήψη, την επαλήθευση περιεχομένου και τον αποδιπλασιασμό κατά sha256
 * τα κάνει το στάδιο Μ-β.
 *
 * 🔑 Πηγές: τα `ProductAttachments` του προϊόντος **και** τα `ItemAttachments` του **πρώτου** εμπορεύσιμου είδους — ίδιος
 *    κανόνας με τις τιμές και τα GTIN (τα επιπλέον είδη μετριούνται ήδη ως `extraTradeItems`).
 * 🔑 Ένα μέσο **ανά λεπτομέρεια** (ένα αρχείο η καθεμία)· ίδιο (ρόλος, κανονικό URI) στο ίδιο προϊόν ⇒ ένα μέσο.
 * 🔑 **Τίποτα σιωπηλά**: σύνδεσμος, τύπος χωρίς ρόλο, μικρογραφία, διεύθυνση που δεν κατεβαίνει, άκυρη ημερομηνία και
 *    συνημμένο που δεν διαβάζεται μετριούνται στην {@link XChangeAttachmentReport}.
 * @module subapps/catalog/interop/etim/xchange-attachments
 */

import { canonicalAssetUri } from '../../import/asset-uri';
import type { ExtractedAsset } from '../../types/catalog-import';
import type { CatalogAssetRole } from '../../vocabulary/asset-roles';
import { attachmentOutcomeOf, ETIM_THUMBNAIL_SPECIFICATION, isEtimAttachmentType, type EtimAttachmentType } from '../../vocabulary/etim-attachments';
import { readXChangeAttachment, type XChangeAttachment, type XChangeProduct } from './xchange-document';
import type { XChangeAttachmentReport } from './xchange-report';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type XChangeAttachmentDetail = XChangeAttachment['AttachmentDetails'][number];

/** Ο μετρητής ενός αρχείου xChange: ένας ανά ανάγνωση, γεμίζει όσο διαβάζονται τα προϊόντα. */
export class AttachmentTally {
  assets = 0;
  links = 0;
  thumbnails = 0;
  unreachableUris = 0;
  invalidDates = 0;
  unreadable = 0;
  readonly unsupported = new Set<string>();

  build(): XChangeAttachmentReport {
    return {
      assets: this.assets,
      links: this.links,
      unsupportedTypes: [...this.unsupported].sort(),
      thumbnails: this.thumbnails,
      unreachableUris: this.unreachableUris,
      invalidDates: this.invalidDates,
      unreadable: this.unreadable,
    };
  }
}

function dateOf(text: string | undefined, tally: AttachmentTally): string | null {
  if (text === undefined || text.trim() === '') return null;
  const value = text.trim();
  if (ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))) return value;
  tally.invalidDates += 1;
  return null;
}

const textOrNull = (text: string | undefined): string | null => (text !== undefined && text.trim() !== '' ? text.trim() : null);

/** `AttachmentOrder` ≥ 1 του σχήματος· οτιδήποτε άλλο ⇒ «η πηγή δεν λέει». */
const orderOf = (order: number | undefined): number | null => (order !== undefined && order >= 1 ? order : null);

interface AttachmentFacts {
  readonly role: CatalogAssetRole;
  readonly order: number | null;
  readonly atx: EtimAttachmentType | null;
}

function assetOfDetail(detail: XChangeAttachmentDetail, facts: AttachmentFacts, tally: AttachmentTally): ExtractedAsset | null {
  const uri = detail.AttachmentUri === undefined ? null : canonicalAssetUri(detail.AttachmentUri);
  if (uri === null) {
    tally.unreachableUris += 1;
    return null;
  }
  return {
    uri,
    role: facts.role,
    order: facts.order,
    filename: textOrNull(detail.AttachmentFilename),
    languages: [...new Set(detail.AttachmentLanguage)],
    issuedOn: dateOf(detail.AttachmentIssueDate, tally),
    expiresOn: dateOf(detail.AttachmentExpiryDate, tally),
    atx: facts.atx,
  };
}

function assetsOfAttachment(raw: unknown, tally: AttachmentTally): ExtractedAsset[] {
  const attachment = readXChangeAttachment(raw);
  if (attachment === null) {
    tally.unreadable += 1;
    return [];
  }
  if (attachment.AttachmentTypeSpecification === ETIM_THUMBNAIL_SPECIFICATION) {
    tally.thumbnails += 1;
    return [];
  }
  const outcome = attachmentOutcomeOf(attachment.AttachmentType);
  if (outcome.kind === 'link') {
    tally.links += 1;
    return [];
  }
  if (outcome.kind === 'unsupported') {
    tally.unsupported.add(attachment.AttachmentType);
    return [];
  }
  const atx = isEtimAttachmentType(attachment.AttachmentType) ? attachment.AttachmentType : null;
  const facts: AttachmentFacts = { role: outcome.role, order: orderOf(attachment.AttachmentOrder), atx };
  return attachment.AttachmentDetails.flatMap((detail) => assetOfDetail(detail, facts, tally) ?? []);
}

/** Τα μέσα ενός προϊόντος xChange (= μίας γραμμής SKU), αποδιπλασιασμένα κατά (ρόλος, κανονικό URI). */
export function assetsOfProduct(product: XChangeProduct, tally: AttachmentTally): readonly ExtractedAsset[] {
  const raws = [...product.ProductAttachments, ...(product.TradeItem[0]?.ItemAttachments ?? [])];
  const seen = new Set<string>();
  const assets: ExtractedAsset[] = [];
  for (const asset of raws.flatMap((raw) => assetsOfAttachment(raw, tally))) {
    const key = `${asset.role}\u0000${asset.uri}`;
    if (seen.has(key)) continue;
    seen.add(key);
    assets.push(asset);
  }
  tally.assets += assets.length;
  return assets;
}
