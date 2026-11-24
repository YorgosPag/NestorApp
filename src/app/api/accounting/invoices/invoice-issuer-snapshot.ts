/**
 * @fileoverview Τα πεδία εκδότη που γράφει ο server — οδηγίες πληρωμής + λογότυπο: **ζωντανά** όσο το τιμολόγιο είναι
 *   πρόχειρο, **παγωμένα** από την έκδοση
 * @description Πρότυπο Stripe (draft → finalize): όσο το παραστατικό αλλάζει ακόμη (`draft` · `rejected`), οι
 *   λογαριασμοί και το λογότυπό του είναι **προβολή** των σημερινών πηγών — αλλιώς ένα πρόχειρο της Δευτέρας θα έβγαινε
 *   την Πέμπτη με BIC/λογαριασμό που διορθώθηκε στο μεταξύ (περιστατικό Α-7, `PIABORAA`, 2026-11-10) ή με λογότυπο που
 *   άλλαξε. Από τη διαβίβαση και μετά (`IMMUTABLE_STATUSES`) τα αποθηκευμένα `issuer.bankAccounts` / `issuer.logo` είναι
 *   **το** έγγραφο και δεν ξαναγράφονται ποτέ.
 *
 *   Ο ΕΝΑΣ συνθέτης (`liveInvoiceIssuer`) τρέχει σε κάθε σημείο — ό,τι στέλνει ο browser στο `issuer.bankAccounts` ή
 *   στο `issuer.logo` αγνοείται (ADR-ACC-003 §22):
 *   - **γέννηση** — repository `createInvoice`·
 *   - **PATCH πρόχειρου** που αγγίζει `issuer` · `paymentMethod` · `type` — {@link withServerIssuerSnapshotOnUpdate}·
 *   - **ανάγνωση / αποστολή** πρόχειρου (GET, email, δημόσια σελίδα) — {@link withCurrentIssuerSnapshot}·
 *   - **διαβίβαση** (draft/rejected → sent): ο γραφέας της ΠΡΕΠΕΙ να παγώσει το αποτέλεσμα του
 *     {@link withCurrentIssuerSnapshot} στην ίδια εγγραφή που αλλάζει την κατάσταση (ADR-ACC-018 §15.2 · §17.3 —
 *     ο γραφέας αυτός **δεν υπάρχει ακόμη** στον κώδικα, 2026-11-24).
 *
 * @see ADR-ACC-018 §15 · §15.2 · §17.3 · ADR-ACC-003 §22
 */

import 'server-only';

import type { IAccountingRepository } from '@/subapps/accounting/types/interfaces';
import type { Invoice, InvoiceIssuer } from '@/subapps/accounting/types';
import { liveInvoiceIssuer } from '@/subapps/accounting/services/issuer/live-invoice-issuer.server';
import { IMMUTABLE_STATUSES } from './invoice-schemas';

/** Ό,τι διαβάζεται από το σώμα PATCH — όλα προαιρετικά, το σχήμα είναι `.passthrough()`. */
interface InvoiceBodyIssuerFields {
  readonly type?: unknown;
  readonly paymentMethod?: unknown;
  readonly issuer?: unknown;
}

function isIssuer(value: unknown): value is InvoiceIssuer {
  return typeof value === 'object' && value !== null && typeof (value as { name?: unknown }).name === 'string';
}

/** Ζωντανά πεδία εκδότη (πρόχειρο / απορριφθέν) ή παγωμένα (διαβιβασμένο · αποδεκτό · ακυρωμένο); */
export function hasLiveIssuerSnapshot(invoice: Invoice): boolean {
  const status = invoice.mydata?.status;
  return status === undefined || !IMMUTABLE_STATUSES.has(status);
}

/** Ξαναχτίζει τα πεδία του server όταν η αλλαγή αγγίζει ό,τι τα καθορίζει· αλλιώς επιστρέφει την αλλαγή αμετάβλητη. */
export async function withServerIssuerSnapshotOnUpdate<T extends InvoiceBodyIssuerFields>(
  repository: IAccountingRepository, companyId: string, updates: T, existing: Invoice,
): Promise<T> {
  const touches = updates.issuer !== undefined || updates.paymentMethod !== undefined || updates.type !== undefined;
  if (!touches) return updates;
  const issuer = await liveInvoiceIssuer(isIssuer(updates.issuer) ? updates.issuer : existing.issuer, {
    readAccounts: () => repository.getBankAccounts(),
    companyId,
    subject: { type: updates.type ?? existing.type, paymentMethod: updates.paymentMethod ?? existing.paymentMethod },
  });
  return { ...updates, issuer };
}

/**
 * Το τιμολόγιο με τους λογαριασμούς και το λογότυπο που **θα** τύπωνε σήμερα: πρόχειρο ⇒ από τις πηγές του χώρου·
 * εκδομένο ⇒ αμετάβλητο (το στιγμιότυπο της έκδοσης). Καθαρή ανάγνωση — δεν γράφει· όποιος θέλει να το κρατήσει, το
 * γράφει ο ίδιος.
 */
export async function withCurrentIssuerSnapshot(
  repository: IAccountingRepository, companyId: string, invoice: Invoice,
): Promise<Invoice> {
  if (!hasLiveIssuerSnapshot(invoice)) return invoice;
  const issuer = await liveInvoiceIssuer(invoice.issuer, {
    readAccounts: () => repository.getBankAccounts(),
    companyId,
    subject: invoice,
  });
  return { ...invoice, issuer };
}
