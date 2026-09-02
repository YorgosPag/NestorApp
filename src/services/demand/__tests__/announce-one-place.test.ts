/**
 * @fileoverview **Η ΜΙΑ ΕΙΔΟΠΟΙΗΣΗ, ΕΚΤΕΛΕΣΜΕΝΗ** — η άγκυρα που έλειπε από το
 * `announceOnePlace`.
 * @related services/demand/interest-notifier.service · services/demand/announcement-pass
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΡΕΙΣ ΠΡΑΣΙΝΕΣ SUITES ΠΑΝΩ ΑΠΟ ΣΩΜΑ ΠΟΥ ΔΕΝ ΕΚΤΕΛΕΙΤΑΙ ΠΟΤΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο **2026-09-02**: το `announceOnePlace` αποδομούσε `propertyId` /
 * `propertyTitle` από το όρισμά του, και **το σώμα του διάβαζε `property.title` και
 * `property.id`** — αναγνωριστικό που **δεν δηλώνεται, δεν εισάγεται και δεν είναι
 * καθολικό**. Δηλαδή **κάθε** ανακοίνωση ζήτησης πετούσε
 * `ReferenceError: property is not defined`, σε **ζωντανή** διαδρομή
 * (`announcement-pass.ts:112`).
 *
 * 🔑 **ΚΑΙ ΟΛΕΣ ΟΙ SUITES ΤΟΥ ΦΑΚΕΛΟΥ ΗΤΑΝ ΠΡΑΣΙΝΕΣ** — επειδή και οι **τρεις**
 * (`company-interest-notifier` · `listing-match-notifier` · `place-interest-custody`)
 * κάνουν `jest.fn()` **ακριβώς αυτή** τη συνάρτηση. Ο έλεγχος σταματούσε στο σύνορο
 * *«κλήθηκε;»* και δεν περνούσε ποτέ μέσα. Το εύρημα το έδωσε ο **μεταγλωττιστής**
 * (TS2552 ×3), όχι τα tests.
 *
 * ⇒ Είναι κατά λέξη το *«φρουρός χωρίς απόδειξη ζωής»* του ADR-749 §5, σε επίπεδο
 * **συνάρτησης**: η γραμμή που θα κοκκίνιζε **δεν εκτελούνταν από καμία διαδρομή**.
 *
 * ⚠️ **Γι' αυτό εδώ ΔΕΝ γίνεται mock το `announceOnePlace`.** Το μόνο που κόβεται είναι
 * ο **διανομέας ειδοποιήσεων** — το πραγματικό σύνορο I/O. Ό,τι είναι πιο μέσα
 * **εκτελείται**.
 */

// ⚠️ Το πρόθεμα `mock` **δεν** είναι στιλ: το εργοστάσιο του `jest.mock` ανυψώνεται πάνω
// από κάθε δήλωση, και το jest απορρίπτει αναφορά σε μεταβλητή εκτός εμβέλειας εκτός αν
// το όνομά της ξεκινά έτσι.
const mockDispatchNotification = jest.fn();

jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: (...args: readonly unknown[]) => mockDispatchNotification(...args),
}));

import { announceOnePlace } from '@/services/demand/interest-notifier.service';
import { announcementEventId } from '@/lib/demand/demand-announcement';

const ANNOUNCEMENT = {
  propertyId: 'ownp_42',
  propertyTitle: 'Διαμέρισμα στη Θεσσαλονίκη',
  recipientId: 'user_owner',
  tenantId: 'user_owner',
  band: 'few',
  count: 3,
} as const;

type Announcement = Parameters<typeof announceOnePlace>[0];

beforeEach(() => {
  mockDispatchNotification.mockReset();
  mockDispatchNotification.mockResolvedValue({ success: true, skipped: false });
});

describe('Ε — η ειδοποίηση ζήτησης ΕΚΤΕΛΕΙΤΑΙ, δεν απλώς καλείται', () => {
  it('🔴 Ε1 — δεν πετά: το σώμα διαβάζει ΤΟ ΟΡΙΣΜΑ ΤΟΥ, όχι ανύπαρκτο `property`', async () => {
    await expect(announceOnePlace(ANNOUNCEMENT as Announcement)).resolves.toBe('announced');
    expect(mockDispatchNotification).toHaveBeenCalledTimes(1);
  });

  it('Ε2 — ο ΤΙΤΛΟΣ που φτάνει στην ειδοποίηση είναι ο τίτλος που δόθηκε', async () => {
    await announceOnePlace(ANNOUNCEMENT as Announcement);

    expect(mockDispatchNotification.mock.calls[0][0]).toMatchObject({
      titleParams: { count: '3', title: ANNOUNCEMENT.propertyTitle },
    });
  });

  /**
   * 🔑 **Η ΤΑΥΤΟΤΗΤΑ ΕΙΝΑΙ ΤΟ ΑΝΤΙ-SPAM.** Το `eventId` παράγεται από
   * `(propertyId, band)` και είναι **ο μόνος** λόγος που η επανάληψη είναι δομικά
   * αδύνατη. Ένα `undefined` εκεί θα ένωνε **όλα** τα ακίνητα σε ένα συμβάν — δηλαδή ο
   * δεύτερος ιδιοκτήτης δεν θα ειδοποιούνταν **ποτέ**, σιωπηλά.
   */
  it('🔴 Ε3 — η ΤΑΥΤΟΤΗΤΑ του συμβάντος δένεται στο ακίνητο, όχι σε `undefined`', async () => {
    await announceOnePlace(ANNOUNCEMENT as Announcement);

    expect(mockDispatchNotification.mock.calls[0][0]).toMatchObject({
      eventId: announcementEventId(ANNOUNCEMENT.propertyId, ANNOUNCEMENT.band),
      entityId: ANNOUNCEMENT.propertyId,
    });
  });
});
