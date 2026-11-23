/**
 * @fileoverview **Η ΟΨΗ ΤΟΥ ΣΤΙΓΜΙΟΤΥΠΟΥ** — αμετάβλητο στιγμιότυπο → η ΙΔΙΑ όψη με τον ζωντανό υπολογισμό, συν κωδικό,
 *               αποτύπωμα και επαλήθευση (ADR-947 Φ2β · Δ3).
 * @module services/pdf/renderers/objective-value/objective-value-pdf-snapshot-view
 * @related objective-value-pdf-view.ts (το κοινό σώμα) · objective-value-pdf.server.ts (QR + συνημμένο)
 *
 * 🔑 **Από την εγγραφή, ποτέ από ζωντανά δεδομένα** (Stripe: το PDF του τιμολογίου αποδίδεται από την κλειδωμένη εγγραφή):
 *    ό,τι τυπώνεται βγαίνει από το περιεχόμενο που καλύπτει το αποτύπωμα — η τρέχουσα ζώνη ή μηχανή **δεν** μπαίνουν εδώ·
 *    η απόκλιση είναι δουλειά της σελίδας επαλήθευσης (Φ2γ), που ρωτά **τώρα**.
 * 🔑 **Το στιγμιότυπο δεν κρατά λέξεις**, μόνο κλειδιά λεξιλογίου: το ίδιο έγγραφο αποδίδεται σε οποιαδήποτε γλώσσα, και
 *    οι δύο αποδόσεις λένε **το ίδιο** — όπως το τιμολόγιο του Stripe στη γλώσσα του παραλήπτη.
 */

import { ISSUER_QUALIFICATION_LABEL_KEYS } from '@/components/document-registry/document-registry-labels';
import { PRODUCT_NAME } from '@/constants/product-identity';
import { snapshotEffectiveDraft, type ObjectiveValueSnapshot } from '@/lib/objective-value/objective-value-snapshot';
import { formatOperatorDate, formatOperatorDateTime } from '@/lib/operator-time-format';
import { pdfAppBrand } from '@/services/pdf/pdf-app-logo';
import { chunkText, type PdfFlowPair } from '@/services/pdf/pdf-flow';

import type { PdfWords } from './objective-value-pdf-inputs';
import {
  objectiveValuePdfBody,
  objectiveValuePdfPageLabel,
  type ObjectiveValuePdfCalculation,
  type ObjectiveValuePdfVerification,
  type ObjectiveValuePdfView,
} from './objective-value-pdf-view';

const NS = 'objective-value';

/** Πού επαληθεύεται — ό,τι **τυπώνεται** (χωρίς αποτύπωμα) και ό,τι **κωδικοποιεί το QR** (με αποτύπωμα στο fragment). */
export interface ObjectiveValueSnapshotVerifyTarget {
  readonly printed: string;
  /** `null` ⇒ ο server δεν ξέρει τη δημόσια διεύθυνσή του ⇒ κανένα QR, μόνο η τυπωμένη διαδρομή. */
  readonly qr: string | null;
}

interface ObjectiveValueSnapshotPdfSource {
  readonly snapshot: ObjectiveValueSnapshot;
  readonly verify: ObjectiveValueSnapshotVerifyTarget;
  /** Το όνομα του συνημμένου με το περιεχόμενο — τυπώνεται, ώστε ο τρίτος να ξέρει τι να ψάξει. */
  readonly attachmentName: string;
  /** Η αρχική της εφαρμογής, για τη σφραγίδα της κεφαλίδας — `null` ⇒ χωρίς σύνδεσμο. */
  readonly appHref: string | null;
}

/** **Στιγμιότυπο → υπολογισμός** — το ΕΝΑ σχήμα της όψης. Το πρόχειρο όπως το είδε η μηχανή, με τον ΕΝΑ κανόνα. */
function snapshotPdfCalculation(snapshot: ObjectiveValueSnapshot): ObjectiveValuePdfCalculation {
  const { zone } = snapshot;
  return {
    valuationDate: snapshot.valuationDate,
    draft: snapshotEffectiveDraft(snapshot.draft, zone),
    result: snapshot.result,
    provenance: snapshot.provenance,
    engine: snapshot.engine,
    zone: zone.kind === 'valueZones'
      ? { fromSource: true, validFrom: zone.validFrom, table: zone.table }
      : { fromSource: false, validFrom: null, table: null },
  };
}

function snapshotFacts(words: PdfWords, snapshot: ObjectiveValueSnapshot): PdfFlowPair[] {
  const { t, language } = words;
  const { issuer } = snapshot;
  const facts: PdfFlowPair[] = [
    [t(`${NS}:pdf.facts.valuationDate`), formatOperatorDate(snapshot.valuationDate, language)],
    [t(`${NS}:pdf.facts.subject`), snapshot.subject.label],
    [t(`${NS}:pdf.facts.issuer`), issuer.name],
    [t(`${NS}:pdf.facts.qualification`), t(ISSUER_QUALIFICATION_LABEL_KEYS[issuer.qualification])],
  ];
  if (issuer.registryNumber !== null) facts.push([t(`${NS}:pdf.facts.registryNumber`), issuer.registryNumber]);
  facts.push([t(`${NS}:pdf.facts.createdAt`), formatOperatorDateTime(snapshot.createdAt, language)]);
  return facts;
}

function snapshotVerification(words: PdfWords, source: ObjectiveValueSnapshotPdfSource): ObjectiveValuePdfVerification {
  const { t } = words;
  const { snapshot, verify } = source;
  return {
    heading: t(`${NS}:pdf.verifyHeading`),
    rows: [
      [t(`${NS}:pdf.code`), snapshot.id],
      [t(`${NS}:pdf.digest`), chunkText(snapshot.digest, 32)],
      [t(`${NS}:pdf.verifyLink`), verify.printed],
    ],
    notes: [t(`${NS}:pdf.verifyNote`), t(`${NS}:pdf.attachmentNote`, { name: source.attachmentName })],
    qrPayload: verify.qr,
  };
}

/** **Η όψη του στιγμιοτύπου** — κοινό σώμα + στοιχεία εκδότη + επαλήθευση· ντετερμινιστική ταυτότητα από `id` και `createdAt`. */
export function snapshotObjectiveValuePdfView(words: PdfWords, source: ObjectiveValueSnapshotPdfSource): ObjectiveValuePdfView {
  const { t, language } = words;
  const { snapshot } = source;
  const body = objectiveValuePdfBody(words, snapshotPdfCalculation(snapshot));
  const notice = t(`${NS}:pdf.snapshotNotice`);
  return {
    ...body,
    language,
    brand: pdfAppBrand(source.appHref),
    notice,
    facts: snapshotFacts(words, snapshot),
    subject: null,
    verification: snapshotVerification(words, source),
    footer: { center: snapshot.id, timestamp: formatOperatorDateTime(snapshot.createdAt, language), pageLabel: objectiveValuePdfPageLabel(words) },
    identity: { id: snapshot.id, issuedAt: snapshot.createdAt },
    properties: { title: `${body.title} — ${snapshot.id}`, subject: notice, author: snapshot.issuer.name, creator: PRODUCT_NAME },
  };
}
