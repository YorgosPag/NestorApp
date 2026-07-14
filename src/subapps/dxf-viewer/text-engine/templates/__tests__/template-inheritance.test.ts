/**
 * ADR-651 Φάση Θ — tests της κληρονομιάς προτύπων (Δρόμος 1: αναφορά ή απόσπαση).
 *
 * Το κρίσιμο σενάριο που καρφώνεται εδώ είναι η **παγίδα του `updatedAt`**: αν η ερώτηση
 * ήταν «ο γονιός είναι νεότερος από το παιδί;», τότε μια οποιαδήποτε αλλαγή στο παιδί θα
 * έσβηνε την ειδοποίηση και η διόρθωση του γραφείου θα χανόταν **σιωπηλά** — μέσα σε σχέδιο
 * που κατατίθεται. Η σωστή ερώτηση είναι «άλλαξε ο γονιός **μετά τον τελευταίο συγχρονισμό**;»
 */

import type { DxfTextNode } from '../../types/text-ast.types';
import type { TextTemplate } from '../template.types';
import {
  buildDetachPayload,
  buildPullPayload,
  canDetachFrom,
  findParentTemplate,
  isParentUpdateAvailable,
} from '../template-inheritance';

const CONTENT = { paragraphs: [{ id: 'p1' }] } as unknown as DxfTextNode;
const PARENT_CONTENT = { paragraphs: [{ id: 'parent' }] } as unknown as DxfTextNode;

function template(overrides: Partial<TextTemplate> & Pick<TextTemplate, 'id'>): TextTemplate {
  return {
    companyId: 'comp_1',
    name: 'Πινακίδα',
    category: 'title-block',
    content: CONTENT,
    placeholders: [],
    isDefault: false,
    scope: 'company',
    projectId: null,
    parentId: null,
    parentSyncedAt: null,
    createdAt: new Date(1_000),
    updatedAt: new Date(1_000),
    ...overrides,
  };
}

describe('isParentUpdateAvailable', () => {
  it('προτείνει ενημέρωση όταν ο γονιός άλλαξε μετά τον τελευταίο συγχρονισμό', () => {
    const parent = template({ id: 'p', updatedAt: new Date(5_000) });
    const child = template({ id: 'c', parentId: 'p', parentSyncedAt: 1_000 });

    expect(isParentUpdateAvailable(child, parent)).toBe(true);
  });

  it('ΔΕΝ ξεχνά την αλλαγή του γονιού επειδή ο χρήστης πείραξε μετά το παιδί (η παγίδα)', () => {
    const parent = template({ id: 'p', updatedAt: new Date(5_000) });
    // Το παιδί επεξεργάστηκε ΑΡΓΟΤΕΡΑ από την αλλαγή του γονιού — αλλά ποτέ δεν την τράβηξε.
    const child = template({
      id: 'c',
      parentId: 'p',
      parentSyncedAt: 1_000,
      updatedAt: new Date(9_000),
    });

    expect(isParentUpdateAvailable(child, parent)).toBe(true);
  });

  it('σιωπά όταν το παιδί είναι ήδη συγχρονισμένο με την τρέχουσα έκδοση του γονιού', () => {
    const parent = template({ id: 'p', updatedAt: new Date(5_000) });
    const child = template({ id: 'c', parentId: 'p', parentSyncedAt: 5_000 });

    expect(isParentUpdateAvailable(child, parent)).toBe(false);
  });

  it('σιωπά για built-in γονιό (δεν έχει `updatedAt` — δεν αλλάζει ποτέ)', () => {
    const parent = template({ id: 'builtin/title-block-el', isDefault: true, updatedAt: null });
    const child = template({ id: 'c', parentId: 'builtin/title-block-el', parentSyncedAt: 0 });

    expect(isParentUpdateAvailable(child, parent)).toBe(false);
  });

  it('σιωπά όταν το πρότυπο δεν είναι παιδί αυτού του γονιού', () => {
    const parent = template({ id: 'p', updatedAt: new Date(5_000) });
    const stranger = template({ id: 'c', parentId: 'other', parentSyncedAt: 0 });

    expect(isParentUpdateAvailable(stranger, parent)).toBe(false);
  });
});

describe('findParentTemplate', () => {
  it('βρίσκει τον άμεσο γονιό — βάθος 1, καμία αναδρομή', () => {
    const parent = template({ id: 'p' });
    const child = template({ id: 'c', parentId: 'p' });

    expect(findParentTemplate(child, [parent, child])).toBe(parent);
  });

  it('επιστρέφει null όταν ο γονιός έχει διαγραφεί (ορφανή παραλλαγή — ποτέ crash)', () => {
    const orphan = template({ id: 'c', parentId: 'deleted' });

    expect(findParentTemplate(orphan, [orphan])).toBeNull();
  });

  it('επιστρέφει null για πρότυπο χωρίς γονιό', () => {
    const root = template({ id: 'r' });

    expect(findParentTemplate(root, [root])).toBeNull();
  });

  it('ένας κύκλος A→B→A δεν κρεμάει: η αναζήτηση είναι βάθους 1', () => {
    const a = template({ id: 'a', parentId: 'b' });
    const b = template({ id: 'b', parentId: 'a' });

    expect(findParentTemplate(a, [a, b])).toBe(b);
    expect(findParentTemplate(b, [a, b])).toBe(a);
  });
});

describe('canDetachFrom', () => {
  it('απαγορεύει την αυτο-γονεϊκότητα', () => {
    const self = template({ id: 'x' });

    expect(canDetachFrom(self, 'x')).toBe(false);
    expect(canDetachFrom(self, 'other')).toBe(true);
    expect(canDetachFrom(self)).toBe(true);
  });
});

describe('buildDetachPayload', () => {
  it('αντιγράφει ΟΛΟ το περιεχόμενο του γονιού και κρατά την προέλευση', () => {
    const parent = template({
      id: 'master',
      content: PARENT_CONTENT,
      updatedAt: new Date(7_000),
      titleBlock: { withStampBox: true, stampLabel: 'ΣΦΡΑΓΙΔΑ' },
    });

    const payload = buildDetachPayload(parent, {
      scope: 'project',
      projectId: 'prj_1',
      name: 'Παραλλαγή',
    });

    expect(payload).toEqual({
      name: 'Παραλλαγή',
      category: 'title-block',
      content: PARENT_CONTENT,
      scope: 'project',
      projectId: 'prj_1',
      parentId: 'master',
      parentSyncedAt: 7_000,
      titleBlock: { withStampBox: true, stampLabel: 'ΣΦΡΑΓΙΔΑ' },
    });
  });

  it('η ολόφρεσκη παραλλαγή γεννιέται ΕΝΗΜΕΡΩΜΕΝΗ (καμία ψεύτικη ειδοποίηση)', () => {
    const parent = template({ id: 'master', updatedAt: new Date(7_000) });
    const payload = buildDetachPayload(parent, { scope: 'project', projectId: 'p', name: 'v' });

    const child = template({
      id: 'c',
      parentId: payload.parentId,
      parentSyncedAt: payload.parentSyncedAt,
    });

    expect(isParentUpdateAvailable(child, parent)).toBe(false);
  });
});

describe('buildPullPayload', () => {
  it('τραβά περιεχόμενο + σφραγίδα του γονιού και ΔΕΝ αγγίζει όνομα/εμβέλεια του παιδιού', () => {
    const parent = template({
      id: 'master',
      name: 'Master γραφείου',
      scope: 'company',
      content: PARENT_CONTENT,
      updatedAt: new Date(9_000),
      titleBlock: { withStampBox: false, stampLabel: '' },
    });

    const payload = buildPullPayload(parent);

    expect(payload).toEqual({
      content: PARENT_CONTENT,
      parentSyncedAt: 9_000,
      titleBlock: { withStampBox: false, stampLabel: '' },
    });
    expect(payload).not.toHaveProperty('name');
    expect(payload).not.toHaveProperty('scope');
  });

  it('είναι idempotent: μετά το pull, το παιδί σιωπά', () => {
    const parent = template({ id: 'master', updatedAt: new Date(9_000) });
    const payload = buildPullPayload(parent);
    const synced = template({ id: 'c', parentId: 'master', parentSyncedAt: payload.parentSyncedAt });

    expect(isParentUpdateAvailable(synced, parent)).toBe(false);
    expect(buildPullPayload(parent)).toEqual(payload);
  });
});
