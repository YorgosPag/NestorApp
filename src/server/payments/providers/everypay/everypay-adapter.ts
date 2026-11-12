import 'server-only';

/**
 * @fileoverview Ο adapter Everypay — υλοποίηση του `PaymentProvider` (ADR-ACC-030 §4–5)
 * @description
 *   - **Κάρτα + Apple Pay + Google Pay** ⇒ Payment Notification: hosted σελίδα του παρόχου (`payment_link_url`). Η
 *     σελίδα δείχνει τα πορτοφόλια που είναι ενεργά στον λογαριασμό εμπόρου· τα στοιχεία κάρτας δεν περνούν ποτέ
 *     από εμάς (PCI SAQ-A).
 *   - **IRIS** ⇒ IRIS Direct: συνεδρία στον διακομιστή, φόρμα POST στο payform, επιλογή τράπεζας / QR **στον
 *     πάροχο** (τα λογότυπα τραπεζών είναι δικά του), και η εξουσιοδοτημένη πηγή χρεώνεται από **εμάς**
 *     (`POST /payments`), μία φορά — το `41001` σημαίνει «έγινε ήδη».
 *   - **Αλήθεια** = `readSettlement`: διαβάζει την ειδοποίηση / πληρωμή / επιστροφές από το API, ποτέ από webhook.
 *
 * @see https://docs.everypay.gr/payment-notifications/api-integration-guide/ · …/other-payment-methods/iris-direct/
 */

import { plainRecordOrNull } from '@/lib/type-guards';

import type {
  CheckoutRequest,
  CheckoutSettlement,
  CheckoutSubject,
  PaymentProvider,
  ProviderMovement,
  ReturnVerdict,
  StartedCheckout,
  WebhookSignal,
  WebhookVerdict,
} from '../../payment-provider';
import { EverypayApiError, EVERYPAY_TOKEN_ALREADY_USED, everypayDateTime, everypayRequest } from './everypay-client';
import type { EverypayCredentials } from './everypay-config';
import {
  CAPTURED_PAYMENT_STATUSES,
  codeField,
  listItemsOrNull,
  movementOf,
  notificationPaymentReference,
  statusField,
  textField,
} from './everypay-readers';
import {
  EVERYPAY_SIGNATURE_HEADER,
  judgeEverypayBodySignature,
  judgeEverypayIrisHash,
  jsonObjectOrNull,
} from './everypay-signature';

/** Το όριο του παρόχου για την αιτιολογία της ειδοποίησης. */
const NOTIFICATION_DESCRIPTION_MAX = 200;

/** Μια σελίδα λίστας του παρόχου. Μορφή εκτός συμβολαίου ⇒ 502 (ο πάροχος ξαναδοκιμάζει), ποτέ σιωπηλό «τίποτα». */
async function listRequest(
  credentials: EverypayCredentials, path: '/payments' | '/refunds', query: Readonly<Record<string, string>>,
): Promise<Record<string, unknown>[]> {
  const items = listItemsOrNull(await everypayRequest(credentials, { method: 'GET', path, query }));
  if (items === null) throw new EverypayApiError(502, null, `List response without items: ${path}`);
  return items;
}

// ─── ΕΚΚΙΝΗΣΗ ────────────────────────────────────────────────────────────────

async function startCardCheckout(credentials: EverypayCredentials, request: CheckoutRequest): Promise<StartedCheckout> {
  const body = plainRecordOrNull(await everypayRequest(credentials, {
    method: 'POST',
    path: '/notifications',
    form: {
      amount: String(request.amountMinor),
      description: request.description.slice(0, NOTIFICATION_DESCRIPTION_MAX),
      skip_notify: '1',
      locale: request.locale,
      expiration_date: everypayDateTime(request.expiresAt),
    },
  }));
  const reference = textField(body, 'token');
  const url = textField(body, 'payment_link_url');
  if (reference === null || url === null) throw new EverypayApiError(502, null, 'Notification response without token/link');
  return { providerReference: reference, launch: { kind: 'redirect', url } };
}

async function startIrisCheckout(credentials: EverypayCredentials, request: CheckoutRequest): Promise<StartedCheckout> {
  const amount = String(request.amountMinor);
  const body = plainRecordOrNull(await everypayRequest(credentials, {
    method: 'POST',
    path: '/iris/sessions',
    form: {
      amount, currency: request.currency, country: 'GR', uuid: request.checkoutId,
      callback_url: request.returnUrl, md: request.checkoutId, webhook_url: request.webhookUrl,
    },
  }));
  const signature = textField(body, 'signature');
  if (signature === null) throw new EverypayApiError(502, null, 'IRIS session response without signature');
  return {
    providerReference: null,
    launch: {
      kind: 'form-post',
      url: new URL('/api/payment-methods/iris', credentials.endpoints.payform).toString(),
      fields: {
        flow: 'direct', token: signature, pk: credentials.publicKey, amount,
        currency: request.currency, uuid: request.checkoutId, callback_url: request.returnUrl,
      },
    },
  };
}

// ─── ΑΛΗΘΕΙΑ ─────────────────────────────────────────────────────────────────

/** Πληρωμή + επιστροφές της, από το API. `null` όταν η πληρωμή δεν εισπράχθηκε (αποτυχία / εκκρεμότητα). */
async function settledMovements(credentials: EverypayCredentials, paymentReference: string): Promise<CheckoutSettlement> {
  const payment = plainRecordOrNull(await everypayRequest(credentials, {
    method: 'GET', path: `/payments/${encodeURIComponent(paymentReference)}`,
  }));
  const status = statusField(payment);
  if (status === 'failed') return { state: 'closed', reason: 'failed' };
  const charged = payment === null || status === null || !CAPTURED_PAYMENT_STATUSES.has(status) ? null : movementOf(payment, 'payment');
  if (charged === null) return { state: 'open' };
  const refunds = await listRequest(credentials, '/refunds', { payment: paymentReference });
  const refundMovements = refunds
    .filter((refund) => statusField(refund) === 'captured')
    .map((refund) => movementOf(refund, 'refund'))
    .filter((movement): movement is ProviderMovement => movement !== null);
  return { state: 'settled', paymentReference, movements: [charged, ...refundMovements] };
}

async function readCardSettlement(credentials: EverypayCredentials, subject: CheckoutSubject): Promise<CheckoutSettlement> {
  if (subject.providerReference === null) return { state: 'open' };
  const notification = plainRecordOrNull(await everypayRequest(credentials, {
    method: 'GET', path: `/notifications/${encodeURIComponent(subject.providerReference)}`,
  }));
  const status = statusField(notification);
  if (status === 'expired' || status === 'canceled' || status === 'cancelled') {
    return { state: 'closed', reason: status === 'expired' ? 'expired' : 'canceled' };
  }
  const paymentReference = notificationPaymentReference(notification);
  return status === 'paid' && paymentReference !== null ? settledMovements(credentials, paymentReference) : { state: 'open' };
}

async function readIrisSettlement(credentials: EverypayCredentials, subject: CheckoutSubject): Promise<CheckoutSettlement> {
  const payments = await listRequest(credentials, '/payments', { merchant_ref: subject.checkoutId });
  const captured = payments.find((payment) => CAPTURED_PAYMENT_STATUSES.has(statusField(payment) ?? ''));
  const reference = captured ? textField(captured, 'token') : null;
  return reference === null ? { state: 'open' } : settledMovements(credentials, reference);
}

// ─── WEBHOOK / ΕΠΙΣΤΡΟΦΗ ─────────────────────────────────────────────────────

/**
 * Το υπογεγραμμένο JSON του IRIS ⇒ σήμα. Όλα τα πεδία διαβάζονται **μόνο** από το υπογεγραμμένο περιεχόμενο: το
 * `md` φτάνει **και** ως χωριστό, ανυπόγραφο πεδίο (docs «IRIS Direct», παράδειγμα αποτυχίας), που δεν το
 * εμπιστευόμαστε — αλλιώς μια έγκυρη υπογραφή άλλης συνεδρίας θα σημάδευε ξένη συνεδρία ως αποτυχημένη.
 * Αποτυχία ⇒ `authorization-failed` (καμία χρέωση· η συνεδρία μένει ανοιχτή — ADR-ACC-030 §5.3).
 */
function irisSignalOf(payload: Record<string, unknown>): WebhookSignal {
  if (payload.error_status !== undefined || payload.error_code !== undefined) {
    return {
      kind: 'authorization-failed',
      checkoutId: textField(payload, 'md'),
      providerCode: codeField(payload, 'error_code'),
      signedFields: Object.keys(payload).sort(),
    };
  }
  const checkoutId = textField(payload, 'md');
  const sourceToken = textField(payload, 'token');
  return checkoutId === null || sourceToken === null
    ? { kind: 'ignored', reason: 'iris-payload-incomplete' }
    : { kind: 'authorized-source', checkoutId, sourceToken };
}

/** Το σώμα ενός υπογεγραμμένου webhook ⇒ σήμα, από το πρόθεμα του token (`pnt_` ειδοποίηση · `pmt_` πληρωμή). */
function bodySignalOf(payload: Record<string, unknown>): WebhookSignal {
  const token = textField(payload, 'token');
  if (token?.startsWith('pnt_')) return { kind: 'checkout-reference', providerReference: token };
  if (token?.startsWith('pmt_')) return { kind: 'payment-reference', paymentReference: token };
  return { kind: 'ignored', reason: 'unrecognised-event' };
}

function judgeWebhookWith(credentials: EverypayCredentials, rawBody: string, headers: Headers): WebhookVerdict {
  const iris = jsonObjectOrNull(rawBody);
  if (typeof iris?.hash === 'string') {
    const verdict = judgeEverypayIrisHash(iris.hash, credentials.secretKey);
    return verdict.valid ? { valid: true, signal: irisSignalOf(verdict.payload) } : verdict;
  }
  const verdict = judgeEverypayBodySignature(rawBody, headers.get(EVERYPAY_SIGNATURE_HEADER), credentials.secretKey);
  return verdict.valid ? { valid: true, signal: bodySignalOf(verdict.payload) } : verdict;
}

function judgeReturnWith(credentials: EverypayCredentials, fields: URLSearchParams): ReturnVerdict {
  const verdict = judgeEverypayIrisHash(fields.get('hash'), credentials.secretKey);
  return verdict.valid ? { valid: true, signal: irisSignalOf(verdict.payload) } : verdict;
}

// ─── ΧΡΕΩΣΗ ΠΗΓΗΣ / ΑΚΥΡΩΣΗ ──────────────────────────────────────────────────

async function captureSource(credentials: EverypayCredentials, subject: CheckoutSubject, sourceToken: string): Promise<void> {
  try {
    await everypayRequest(credentials, {
      method: 'POST',
      path: '/payments',
      form: { token: sourceToken, amount: String(subject.amountMinor), merchant_ref: subject.checkoutId },
    });
  } catch (error) {
    if (error instanceof EverypayApiError && error.providerCode === EVERYPAY_TOKEN_ALREADY_USED) return;
    throw error;
  }
}

/**
 * Κάρτα: `DELETE /notifications/{id}` — δεκτό μόνο όσο είναι Pending, άρα επιτυχία = εγγύηση ότι δεν θα πληρωθεί.
 * Άρνηση 4xx = ήδη πληρωμένη / ληγμένη ⇒ `false` (η συμφιλίωση αποφασίζει). IRIS: η συνεδρία δεν ακυρώνεται στον
 * πάροχο (ο πελάτης μπορεί να είναι ήδη στην τράπεζα) ⇒ `false`.
 */
async function cancelWith(credentials: EverypayCredentials, subject: CheckoutSubject): Promise<boolean> {
  if (subject.method !== 'card' || subject.providerReference === null) return false;
  try {
    await everypayRequest(credentials, {
      method: 'DELETE', path: `/notifications/${encodeURIComponent(subject.providerReference)}`,
    });
    return true;
  } catch (error) {
    if (error instanceof EverypayApiError && error.httpStatus < 500) return false;
    throw error;
  }
}

// ─── Ο ΠΑΡΟΧΟΣ ───────────────────────────────────────────────────────────────

export function createEverypayProvider(credentials: EverypayCredentials): PaymentProvider {
  return {
    id: 'everypay',
    methods: ['card', 'iris'],
    startCheckout: (request) => (request.method === 'iris'
      ? startIrisCheckout(credentials, request)
      : startCardCheckout(credentials, request)),
    readSettlement: (subject) => (subject.method === 'iris'
      ? readIrisSettlement(credentials, subject)
      : readCardSettlement(credentials, subject)),
    captureAuthorizedSource: (subject, sourceToken) => captureSource(credentials, subject, sourceToken),
    cancelCheckout: (subject) => cancelWith(credentials, subject),
    judgeWebhook: (rawBody, headers) => judgeWebhookWith(credentials, rawBody, headers),
    judgeReturn: (fields) => judgeReturnWith(credentials, fields),
  };
}
