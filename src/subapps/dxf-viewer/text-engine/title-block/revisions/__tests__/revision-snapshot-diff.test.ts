/**
 * ADR-651 Φάση Η — καθαρές συναρτήσεις αναθεώρησης: αρίθμηση / αποτύπωμα / σύγκριση.
 *
 * Το κρίσιμο συμβόλαιο: **ίδιο σχέδιο ⇒ ίδιο digest** (idempotency: δύο κλικ ≠ διπλή εγγραφή)
 * και **κάθε πραγματική αλλαγή φαίνεται** (αλλιώς η αυτόματη περιγραφή θα έλεγε ψέματα).
 */

import type { Entity } from '../../../../types/entities';
import { buildRevisionSnapshot, entitySignature, parseSignature } from '../revision-snapshot';
import { diffRevisionSnapshots } from '../revision-diff';
import { formatRevisionNumber, nextRevisionNumber } from '../revision-numbering';

function entity(id: string, type: string, x: number): Entity {
  return { id, type, layerId: 'lyr_1', start: { x, y: 0 }, end: { x: x + 10, y: 0 } } as unknown as Entity;
}

const sheet = (entities: readonly Entity[]) => [
  { levelId: 'lvl_1', title: 'Κάτοψη Ισογείου', entities },
];

describe('revision-numbering', () => {
  it('numbers deterministically from the history (max + 1)', () => {
    expect(nextRevisionNumber([])).toBe(1);
    expect(nextRevisionNumber([{ number: 1 }, { number: 2 }])).toBe(3);
    // Ανθεκτικό σε κενά της ιστορίας — ο επόμενος είναι πάντα μετά τον μεγαλύτερο.
    expect(nextRevisionNumber([{ number: 3 }, { number: 1 }])).toBe(4);
  });

  it('formats the number as the title block prints it', () => {
    expect(formatRevisionNumber(2, 'el')).toBe('2η');
    expect(formatRevisionNumber(2, 'en')).toBe('2');
  });
});

describe('revision-snapshot', () => {
  it('is stable: the same drawing yields the same digest (idempotency key)', () => {
    const a = buildRevisionSnapshot(sheet([entity('e1', 'line', 0), entity('e2', 'wall', 5)]));
    const b = buildRevisionSnapshot(sheet([entity('e2', 'wall', 5), entity('e1', 'line', 0)]));
    expect(b.digest).toBe(a.digest); // η σειρά των οντοτήτων δεν μετράει — μόνο το περιεχόμενο
  });

  it('changes the digest when the drawing actually changes', () => {
    const before = buildRevisionSnapshot(sheet([entity('e1', 'line', 0)]));
    const after = buildRevisionSnapshot(sheet([entity('e1', 'line', 99)]));
    expect(after.digest).not.toBe(before.digest);
  });

  it('ignores transient UI state (selection is not a design change)', () => {
    const plain = entity('e1', 'line', 0);
    const selected = { ...plain, selected: true, preview: true } as Entity;
    expect(entitySignature(selected)).toBe(entitySignature(plain));
  });

  it('carries id / content / type in every signature', () => {
    const parsed = parseSignature(entitySignature(entity('e1', 'wall', 0)));
    expect(parsed.type).toBe('wall');
    expect(parsed.id).toHaveLength(8);
    expect(parsed.content).toHaveLength(8);
  });
});

describe('revision-diff', () => {
  const previous = buildRevisionSnapshot(
    sheet([entity('e1', 'wall', 0), entity('e2', 'wall', 10), entity('e3', 'door', 20)]),
  );

  it('reports the first revision as the baseline', () => {
    const diff = diffRevisionSnapshots(null, previous);
    expect(diff.baseline).toBe(true);
    expect(diff.hasChanges).toBe(true);
  });

  it('detects nothing when nothing changed', () => {
    const diff = diffRevisionSnapshots(previous, previous);
    expect(diff.hasChanges).toBe(false);
  });

  it('separates added / removed / modified', () => {
    const next = buildRevisionSnapshot(
      sheet([
        entity('e1', 'wall', 0), // αμετάβλητο
        entity('e2', 'wall', 55), // ΜΕΤΑΚΙΝΗΘΗΚΕ — ίδιο πλήθος, άλλο περιεχόμενο
        entity('e4', 'window', 30), // νέο
        // e3 (door) αφαιρέθηκε
      ]),
    );
    const diff = diffRevisionSnapshots(previous, next);
    const sheetDiff = diff.sheets[0];

    expect(diff.hasChanges).toBe(true);
    expect(sheetDiff.added).toEqual({ window: 1 });
    expect(sheetDiff.removed).toEqual({ door: 1 });
    expect(sheetDiff.modified).toEqual({ wall: 1 });
    expect(sheetDiff.coarse).toBe(false);
  });

  it('flags a brand-new sheet and a removed sheet', () => {
    const next = buildRevisionSnapshot([
      { levelId: 'lvl_2', title: "Κάτοψη Α' Ορόφου", entities: [entity('e9', 'wall', 0)] },
    ]);
    const diff = diffRevisionSnapshots(previous, next);

    expect(diff.sheets[0].isNew).toBe(true);
    expect(diff.sheets[0].added).toEqual({ wall: 1 });
    expect(diff.removedSheets).toEqual(['Κάτοψη Ισογείου']);
    expect(diff.hasChanges).toBe(true);
  });
});
