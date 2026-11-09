/**
 * @fileoverview Ψεύτικο κανάλι διαβίβασης — **μόνο για tests**, χωρίς δίκτυο.
 * @module subapps/accounting/services/mydata/__tests__/fake-transmission-channel
 *
 * Ντετερμινιστικό: ίδιο κλειδί ιδεμποτίας ⇒ **ίδιο** αποτέλεσμα, χωρίς δεύτερη «καταχώριση».
 * Έτσι θα δοκιμάζεται η ροή διαβίβασης (ουρά, επανάληψη) στη φάση σύνδεσης χωρίς την ΑΑΔΕ.
 * Ζει στο `__tests__/`: ο κώδικας παραγωγής δεν το εισάγει ποτέ (εκτός γράφου knip).
 */

import type { MyDataInvoicePayload } from '../mydata-payload.types';
import type {
  CancellationOutcome,
  InvoiceTransmissionChannel,
  InvoiceTransmissionChannelKind,
  TransmissionOutcome,
} from '../transmission-channel';

type Scripted = (payload: MyDataInvoicePayload) => TransmissionOutcome;

const MARK_BASE = 400000000000000;

export class FakeTransmissionChannel implements InvoiceTransmissionChannel {
  private readonly submissions = new Map<string, TransmissionOutcome>();
  private readonly cancellations = new Map<string, CancellationOutcome>();
  private registrations = 0;

  constructor(
    readonly kind: InvoiceTransmissionChannelKind = 'mydata_direct',
    private readonly script: Scripted | null = null,
  ) {}

  /** Πόσες **πραγματικές** καταχωρίσεις έγιναν (οι επαναλήψεις με ίδιο κλειδί δεν μετρούν). */
  get registrationCount(): number {
    return this.registrations;
  }

  async submit(payload: MyDataInvoicePayload, idempotencyKey: string): Promise<TransmissionOutcome> {
    const previous = this.submissions.get(idempotencyKey);
    if (previous) return previous;
    const outcome = this.script ? this.script(payload) : this.accept();
    if (outcome.status === 'accepted') this.registrations += 1;
    // Η «άγνωστη» έκβαση δεν δεσμεύει το κλειδί: η επανάληψη πρέπει να μπορεί να ξαναπροσπαθήσει.
    if (outcome.status !== 'unavailable') this.submissions.set(idempotencyKey, outcome);
    return outcome;
  }

  async cancel(mark: string, idempotencyKey: string): Promise<CancellationOutcome> {
    const previous = this.cancellations.get(idempotencyKey);
    if (previous) return previous;
    const outcome: CancellationOutcome = { status: 'cancelled', cancellationMark: `${mark}-C` };
    this.cancellations.set(idempotencyKey, outcome);
    return outcome;
  }

  private accept(): TransmissionOutcome {
    return {
      status: 'accepted',
      mark: String(MARK_BASE + this.registrations + 1),
      uid: null,
      authenticationCode: null,
      qrCodeUrl: null,
    };
  }
}
