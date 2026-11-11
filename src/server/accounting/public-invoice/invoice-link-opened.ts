import 'server-only';

/**
 * @fileoverview «Ο πελάτης άνοιξε τον σύνδεσμο πληρωμής» → ίχνος λογιστικής (ADR-ACC-018 §16)
 * @description Το «Viewed» του Stripe Invoicing, ως εγγραφή στο **αμετάβλητο** ίχνος λογιστικής
 *   (`INVOICE_PAYMENT_LINK_OPENED`) του τιμολογίου. Καλείται από την ειδοποίηση ανοίγματος της κοινοποίησης
 *   (`server/sharing/share-open-notice.ts`) **μόνο** στο πρώτο άνοιγμα και από **νέα** συσκευή. Η επαναφόρτωση
 *   της σελίδας δεν γράφει τίποτα.
 *
 *   Ο δράστης είναι ο **κάτοχος του συνδέσμου**, όχι ο δημιουργός του: `userId = share:<shareId>`. Το ίχνος δεν
 *   λέει ποτέ «ο Γιώργος άνοιξε το τιμολόγιο» όταν το άνοιξε ο πελάτης.
 */

export interface InvoiceLinkOpening {
  readonly companyId: string;
  readonly createdBy: string;
  readonly shareId: string;
  readonly invoiceId: string;
  /** 1 = πρώτο άνοιγμα, 2+ = νέα συσκευή. */
  readonly deviceOrdinal: number;
}

/** Ο δράστης ενός ανοίγματος: ο κάτοχος του συνδέσμου, ταυτοποιημένος από τον σύνδεσμο. */
export function linkHolderActor(shareId: string): string {
  return `share:${shareId}`;
}

export async function recordInvoiceLinkOpened(opening: InvoiceLinkOpening): Promise<void> {
  // Δυναμικά: η ειδοποίηση ανοίγματος (`share-open-notice`) δεν φορτώνει τη λογιστική για άλλα είδη.
  const [{ logAccountingEvent }, { createAccountingServices }] = await Promise.all([
    import('@/subapps/accounting/services/accounting-audit-service'),
    import('@/subapps/accounting/services/create-accounting-services'),
  ]);
  const { repository } = createAccountingServices({ companyId: opening.companyId, userId: opening.createdBy });
  await logAccountingEvent(repository, {
    eventType: 'INVOICE_PAYMENT_LINK_OPENED',
    entityType: 'invoice',
    entityId: opening.invoiceId,
    userId: linkHolderActor(opening.shareId),
    details: opening.deviceOrdinal === 1
      ? 'Payment link opened for the first time'
      : 'Payment link opened from a new device',
    metadata: { shareId: opening.shareId, deviceOrdinal: opening.deviceOrdinal },
  });
}
