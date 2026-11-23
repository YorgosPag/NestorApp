import 'server-only';

/**
 * @fileoverview **Ο ΠΑΡΑΓΩΓΟΣ ΤΟΥ PDF ΣΤΙΓΜΙΟΤΥΠΟΥ** — στιγμιότυπο → όψη → PDF με QR → συνημμένο περιεχόμενο → έλεγχος
 *               (ADR-947 Φ2β · Δ3).
 * @module services/pdf/renderers/objective-value/objective-value-pdf.server
 * @related objective-value-pdf-snapshot-view.ts · services/pdf/pdf-associated-file.ts ·
 *   app/api/objective-value/snapshots/[snapshotId]/pdf/route.ts
 *
 * 🏆 **Πέρα από το Πρωτόκολλο παράδοσης — το συνημμένο ΕΙΝΑΙ το αποτυπωμένο περιεχόμενο**: όχι μια περίληψη για τη μηχανή,
 *    αλλά **ακριβώς** τα bytes (`canonicalJson`) των οποίων το sha256 τυπώνεται στη σελίδα. Ο τρίτος δεν χρειάζεται ούτε
 *    εμάς ούτε δίκτυο: βγάζει το συνημμένο, το κατακερματίζει, συγκρίνει με το χαρτί (πρότυπο Git: περιεχόμενο-διεύθυνση).
 * 🔑 **Δύο έλεγχοι πριν φύγει**: (1) η ανάγνωση έχει ήδη ξαναϋπολογίσει το αποτύπωμα της εγγραφής
 *    (`readObjectiveValueSnapshotRecord`)· (2) εδώ ξαναδιαβάζεται το συνημμένο **από το τελικό PDF** — ό,τι θα έκανε ο
 *    τρίτος — και πρέπει να δίνει το ίδιο αποτύπωμα. Αλλιώς ονομασμένη άρνηση, ποτέ PDF που διαψεύδει τον εαυτό του.
 * 🔑 **Η γλώσσα είναι παράμετρος** (bundles, όχι i18next): δύο αιτήματα σε διαφορετική γλώσσα δεν μοιράζονται κατάσταση.
 */

import { createBundleTranslate } from '@/i18n/bundle-translate';
import type { HumanLanguage } from '@/i18n/languages';
import elDocumentRegistry from '@/i18n/locales/el/document-registry.json';
import elObjectiveValue from '@/i18n/locales/el/objective-value.json';
import elPropertiesEnums from '@/i18n/locales/el/properties-enums.json';
import elPropertyMarket from '@/i18n/locales/el/property-market.json';
import enDocumentRegistry from '@/i18n/locales/en/document-registry.json';
import enObjectiveValue from '@/i18n/locales/en/objective-value.json';
import enPropertiesEnums from '@/i18n/locales/en/properties-enums.json';
import enPropertyMarket from '@/i18n/locales/en/property-market.json';
import { sha256HexOfText } from '@/lib/hash/sha256';
import { publicUrl } from '@/lib/http/public-origin';
import { canonicalJson } from '@/lib/legal/canonical-json';
import { objectiveValueVerifyHref } from '@/lib/listings/listing-routes';
import {
  OBJECTIVE_VALUE_SNAPSHOT_SCHEMA,
  snapshotContentOf,
  type ObjectiveValueSnapshot,
} from '@/lib/objective-value/objective-value-snapshot';
import { qrPngDataUrl } from '@/lib/qr/qr-code';
import { readPdfAppLogo } from '@/services/pdf/pdf-app-logo.server';
import { attachPdfTextFile, readPdfTextFile } from '@/services/pdf/pdf-associated-file';

import type { PdfWords } from './objective-value-pdf-inputs';
import { renderObjectiveValuePdf } from './objective-value-pdf-renderer';
import { snapshotObjectiveValuePdfView, type ObjectiveValueSnapshotVerifyTarget } from './objective-value-pdf-snapshot-view';

/** Το όνομα του συνημμένου — σταθερό: ο τρίτος το ψάχνει με αυτό (το τυπώνει και η σελίδα). */
const OBJECTIVE_VALUE_SNAPSHOT_ATTACHMENT_NAME = 'objective-value-snapshot.json';

/** Η ετικέτα σχήματος του συνημμένου — ακολουθεί την έκδοση σχήματος του εγγράφου, όχι της μηχανής. */
const OBJECTIVE_VALUE_SNAPSHOT_ATTACHMENT_SCHEME = `nestor.objective-value-snapshot/v${OBJECTIVE_VALUE_SNAPSHOT_SCHEMA}`;

/** Πλάτος του QR σε pixels — αρκετό για εκτύπωση 26 mm σε 300 dpi (ίδιο με το Πρωτόκολλο παράδοσης). */
const QR_WIDTH_PX = 320;

const NS = 'objective-value';

/** Τα bundles ανά γλώσσα — `Record` ⇒ νέα γλώσσα δεν μεταγλωττίζεται χωρίς τα δικά της. */
const BUNDLES: Readonly<Record<HumanLanguage, Readonly<Record<string, unknown>>>> = {
  el: { [NS]: elObjectiveValue, 'properties-enums': elPropertiesEnums, 'document-registry': elDocumentRegistry, 'property-market': elPropertyMarket },
  en: { [NS]: enObjectiveValue, 'properties-enums': enPropertiesEnums, 'document-registry': enDocumentRegistry, 'property-market': enPropertyMarket },
};

function objectiveValuePdfWords(language: HumanLanguage): PdfWords {
  return { t: createBundleTranslate(BUNDLES[language], NS, language), language };
}

type ObjectiveValueSnapshotPdfOutcome =
  | { readonly ok: true; readonly pdf: Uint8Array; readonly fileName: string }
  | { readonly ok: false; readonly reason: 'attachment-mismatch' };

/** Τυπωμένη διαδρομή (χωρίς αποτύπωμα) και QR (με αποτύπωμα στο fragment, βλ. `objectiveValueVerifyHref`). */
function verifyTargetOf(snapshot: ObjectiveValueSnapshot): ObjectiveValueSnapshotVerifyTarget {
  const path = objectiveValueVerifyHref(snapshot.id);
  return { printed: publicUrl(path) ?? path, qr: publicUrl(objectiveValueVerifyHref(snapshot.id, snapshot.digest)) };
}

/** **Παράγει το PDF του στιγμιοτύπου.** Ποτέ δεν επιστρέφει PDF του οποίου το συνημμένο δεν δίνει το τυπωμένο αποτύπωμα. */
export async function produceObjectiveValueSnapshotPdf(
  snapshot: ObjectiveValueSnapshot,
  language: HumanLanguage,
): Promise<ObjectiveValueSnapshotPdfOutcome> {
  const words = objectiveValuePdfWords(language);
  const verify = verifyTargetOf(snapshot);
  const view = snapshotObjectiveValuePdfView(words, { snapshot, verify, attachmentName: OBJECTIVE_VALUE_SNAPSHOT_ATTACHMENT_NAME });
  const [qrPng, logo] = await Promise.all([
    verify.qr === null ? null : qrPngDataUrl(verify.qr, 'print', QR_WIDTH_PX),
    readPdfAppLogo(),
  ]);
  const rendered = await renderObjectiveValuePdf(view, { qrPng, logo });
  const pdf = await attachPdfTextFile(rendered, {
    name: OBJECTIVE_VALUE_SNAPSHOT_ATTACHMENT_NAME,
    text: canonicalJson(snapshotContentOf(snapshot)),
    mimeType: 'application/json',
    description: OBJECTIVE_VALUE_SNAPSHOT_ATTACHMENT_SCHEME,
    at: new Date(snapshot.createdAt),
  });
  const readBack = await readPdfTextFile(pdf, OBJECTIVE_VALUE_SNAPSHOT_ATTACHMENT_NAME);
  if (readBack === null || (await sha256HexOfText(readBack)) !== snapshot.digest) return { ok: false, reason: 'attachment-mismatch' };
  return { ok: true, pdf, fileName: `${words.t(`${NS}:pdf.fileName`, { date: snapshot.valuationDate })}-${snapshot.id}.pdf` };
}
