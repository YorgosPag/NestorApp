/**
 * Το σύνορο δημιουργίας RFQ — ADR-330 §5.1 S3.2
 *
 * 🔴 Το `z.object` ΠΕΤΑ σιωπηλά ό,τι δεν δηλώνει. Το `CreateRfqSchema` δεν δήλωνε `boqItemIds` /
 * `adHocLines` / `invitedVendorIds` / `sourcingEventId` ⇒ κάθε RFQ της φόρμας γραφόταν με 201 και
 * ΧΩΡΙΣ γραμμές, προμηθευτές, πακέτο. Επαληθεύτηκε ζωντανά (Firestore: `lines: []`, άδεια υποσυλλογή).
 * Η άγκυρα ρωτά τη ΔΟΜΗ: κάθε κλειδί του `CreateRfqDTO` είναι κλειδί του schema — όχι «περνά ένα δείγμα».
 */

import { CreateRfqSchema } from '../rfq-schemas';
import { RFQ_FROM_BOQ_MAX_ITEMS, type CreateRfqDTO } from '@/subapps/procurement/types/rfq';

/** Νέο πεδίο στο DTO χωρίς γραμμή εδώ ⇒ σφάλμα τύπου· χωρίς δήλωση στο schema ⇒ κόκκινο test. */
const DTO_KEYS = {
  projectId: true, buildingId: true, title: true, description: true, lines: true, deadlineDate: true,
  awardMode: true, reminderTemplate: true, comparisonTemplateId: true, invitedVendorIds: true,
  sourcingEventId: true, boqItemIds: true, adHocLines: true, responseLock: true,
} satisfies Record<keyof CreateRfqDTO, true>;

/** Ό,τι στέλνει το `RfqBuilder` για μικτή φόρμα (γραμμή BOQ + χειροκίνητη) με προμηθευτή και πακέτο. */
const builderPayload = {
  projectId: 'proj_1',
  title: 'RFQ — ΟΙΚ-1',
  description: null,
  deadlineDate: '2026-11-15',
  awardMode: 'whole_package',
  reminderTemplate: 'standard',
  lines: [],
  boqItemIds: ['boq_1'],
  adHocLines: [{
    source: 'ad_hoc', description: 'Σκυρόδεμα C25/30', trade: 'concrete',
    categoryCode: 'ΟΙΚ-2', quantity: 12, unit: 'm3', notes: null,
  }],
  sourcingEventId: 'sev_1',
  invitedVendorIds: ['cont_1'],
};

describe('CreateRfqSchema — δεν πετά τίποτα από όσα διαβάζει το createRfq', () => {
  it('κάθε κλειδί του CreateRfqDTO είναι δηλωμένο στο schema', () => {
    expect(Object.keys(CreateRfqSchema.shape).sort()).toEqual(Object.keys(DTO_KEYS).sort());
  });

  it('το φορτίο του RfqBuilder περνά ΑΚΕΡΑΙΟ (γραμμές, προμηθευτές, πακέτο, προθεσμία)', () => {
    const parsed = CreateRfqSchema.parse(builderPayload);
    expect(parsed.boqItemIds).toEqual(['boq_1']);
    expect(parsed.adHocLines).toHaveLength(1);
    expect(parsed.invitedVendorIds).toEqual(['cont_1']);
    expect(parsed.sourcingEventId).toBe('sev_1');
    expect(parsed.deadlineDate).toBe('2026-11-15');
  });

  it('το όριο εργασιών BOQ είναι το ΕΝΑ όριο του τομέα — πάνω από αυτό απορρίπτεται, δεν κόβεται σιωπηλά', () => {
    const ids = Array.from({ length: RFQ_FROM_BOQ_MAX_ITEMS + 1 }, (_, i) => `boq_${i}`);
    expect(CreateRfqSchema.safeParse({ ...builderPayload, boqItemIds: ids }).success).toBe(false);
    expect(CreateRfqSchema.safeParse({ ...builderPayload, boqItemIds: ids.slice(1) }).success).toBe(true);
  });

  it('γραμμή BOQ δεν μπαίνει ως ad-hoc (η προέλευση ταξιδεύει μόνο ως boqItemIds)', () => {
    const smuggled = { ...builderPayload, adHocLines: [{ ...builderPayload.adHocLines[0], source: 'boq' }] };
    expect(CreateRfqSchema.safeParse(smuggled).success).toBe(false);
  });
});
