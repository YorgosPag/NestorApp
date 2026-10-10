/**
 * ⚓ Τα μηνύματα της στοίβας ορόφων — άρνηση μοναδικότητας ≠ σύγκρουση εκδόσεων, και οι υπάρχουσες συγκρούσεις
 * φαίνονται ως σφάλμα.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-10): κάθε `409` της επεξεργασίας ορόφου έβγαινε ως «κάποιος άλλος ενημέρωσε αυτόν τον
 * όροφο» — ακόμη κι όταν ο αριθμός ήταν απλώς πιασμένος. Και ένα κτίριο με δύο «Ισόγειο» δεν έδειχνε κανένα μήνυμα.
 */

import { ApiClientError } from '@/lib/api/enterprise-api-client';
import type { Translate } from '@/i18n/hooks/useTranslation';
import type { FloorSlotRow } from '@/lib/floor/floor-stack-integrity';
import {
  describeFloorStackConflicts,
  floorRemovalRefusalKey,
  floorSlotRefusalKey,
} from '../floor-stack-messages';

const t = ((key: string, params?: Record<string, unknown>) =>
  (params ? `${key}::${JSON.stringify(params)}` : key)) as unknown as Translate;

const refusal = (statusCode: number, errorCode?: string) => new ApiClientError('refused', statusCode, errorCode);

describe('floorSlotRefusalKey', () => {
  it('κάθε άρνηση μοναδικότητας έχει το ΔΙΚΟ της μήνυμα', () => {
    expect(floorSlotRefusalKey(refusal(409, 'FLOOR_NUMBER_TAKEN'))).toBe('tabs.floors.duplicateNumber');
    expect(floorSlotRefusalKey(refusal(409, 'FLOOR_NAME_TAKEN'))).toBe('tabs.floors.duplicateName');
    expect(floorSlotRefusalKey(refusal(409, 'FLOOR_KIND_TAKEN'))).toBe('tabs.floors.duplicateKind');
    expect(floorSlotRefusalKey(refusal(409, 'FLOOR_STOREY_TOO_LOW'))).toBe('tabs.floors.storeyTooLow');
  });
  it('🔴 σύγκρουση εκδόσεων (επίσης 409) ΔΕΝ είναι άρνηση μοναδικότητας', () => {
    expect(floorSlotRefusalKey(refusal(409, 'VERSION_CONFLICT'))).toBeNull();
    expect(floorSlotRefusalKey(refusal(409))).toBeNull();
  });
  it('άλλο status ή άγνωστο σφάλμα ⇒ null', () => {
    expect(floorSlotRefusalKey(refusal(422, 'FLOOR_NUMBER_TAKEN'))).toBeNull();
    expect(floorSlotRefusalKey(new Error('boom'))).toBeNull();
  });
});

describe('floorRemovalRefusalKey', () => {
  it('🔴 ο διακομιστής αρνείται διαγραφή ενδιάμεσου ⇒ το ΙΔΙΟ μήνυμα με τον τοπικό έλεγχο', () => {
    expect(floorRemovalRefusalKey(refusal(422, 'FLOOR_INTERMEDIATE'))).toBe('tabs.floors.deleteIntermediate');
  });
  it('άλλη άρνηση (εξαρτήσεις, χωρίς κωδικό, άλλο status) ⇒ null — η οθόνη δείχνει το μήνυμα του διακομιστή', () => {
    expect(floorRemovalRefusalKey(refusal(409, 'DELETION_BLOCKED'))).toBeNull();
    expect(floorRemovalRefusalKey(refusal(422))).toBeNull();
    expect(floorRemovalRefusalKey(refusal(409, 'FLOOR_INTERMEDIATE'))).toBeNull();
    expect(floorRemovalRefusalKey(new Error('boom'))).toBeNull();
  });
});

describe('describeFloorStackConflicts', () => {
  const incident: FloorSlotRow[] = [
    { id: 'a', number: 0, name: 'Ισόγειο', kind: 'standard' },
    { id: 'b', number: 0, name: 'Ισόγειο', kind: 'standard' },
    { id: 'c', number: 1, name: '1ος Όροφος', kind: 'standard' },
  ];

  it('🔴 το περιστατικό: ένα μήνυμα για τον αριθμό και ένα για το όνομα, με τους ορόφους ονομαστικά', () => {
    expect(describeFloorStackConflicts(incident, t)).toEqual([
      'tabs.floors.conflictDuplicateNumber::{"floors":"Ισόγειο (0), Ισόγειο (0)"}',
      'tabs.floors.conflictDuplicateName::{"floors":"Ισόγειο (0), Ισόγειο (0)"}',
    ]);
  });
  it('καθαρή στοίβα ⇒ κανένα μήνυμα', () => {
    expect(describeFloorStackConflicts(incident.slice(1), t)).toEqual([]);
  });
});

describe('όροφος χωρίς ύψος', () => {
  it('🔴 ίδιο υψόμετρο ⇒ μήνυμα ΣΦΑΛΜΑΤΟΣ με τους ορόφους ονομαστικά (ως τις 2026-10-10: προειδοποίηση)', () => {
    const rows: FloorSlotRow[] = [
      { id: 'a', number: 0, name: 'Ισόγειο', kind: 'ground', elevation: 0 },
      { id: 'b', number: 1, name: 'Ημιώροφος', kind: 'standard', elevation: 0 },
    ];
    expect(describeFloorStackConflicts(rows, t)).toEqual([
      'tabs.floors.conflictStoreyTooLow::{"floors":"Ισόγειο (0), Ημιώροφος (1)"}',
    ]);
  });
});
