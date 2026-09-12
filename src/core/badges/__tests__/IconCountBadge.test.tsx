/**
 * ΑΓΚΥΡΕΣ ADR-854 — `IconCountBadge`
 *
 * Κάθε ομάδα εδώ υπάρχει για ΜΙΑ συγκεκριμένη μετάλλαξη. Ένα test που περνά επειδή
 * «δεν κοίταξε» είναι χειρότερο από κανένα test — γι' αυτό:
 *
 * ⛔ ΤΟ `useSemanticColors` ΔΕΝ ΕΙΝΑΙ MOCKED, ΕΠΙΤΗΔΕΣ. Η Ομάδα 5 ελέγχει ΠΟΙΟ token
 * ζητά κάθε τόνος· με mock θα έλεγχε τη δική της σταθερά και θα ήταν μονίμως πράσινη
 * ενώ το προϊόν θα είχε ξαναγυρίσει στο `--bg-error` (το σφάλμα που γέννησε το ADR).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { IconCountBadge, formatCount } from '../IconCountBadge';

// Το t() επιστρέφει «key|count» ώστε να ΑΠΟΔΕΙΚΝΥΕΤΑΙ ποιος αριθμός έφτασε στη μετάφραση.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { ns?: string; count?: number }) =>
      `${opts?.ns ?? ''}:${key}|${opts?.count ?? ''}`,
  }),
}));

const BADGE = 'count-badge';
const badge = () => screen.queryByTestId(BADGE);

describe('ADR-854 · Ομάδα 1 — όριο cutoff', () => {
  // Μετάλλαξη που πρέπει να ρίξει: `>` → `>=` στο formatCount.
  it.each([
    [98, 99, '98'],
    [99, 99, '99'],
    [100, 99, '99+'],
    [127, 9, '9+'],
    [9, 9, '9'],
  ])('count=%i max=%i → «%s»', (count, max, expected) => {
    expect(formatCount(count, max)).toBe(expected);
  });

  it('η προεπιλογή είναι 99 (σύμβαση MD3/MUI), όχι 9 ούτε άπειρο', () => {
    render(<IconCountBadge count={100} data-testid={BADGE} />);
    expect(badge()).toHaveTextContent('99+');
  });
});

describe('ADR-854 · Ομάδα 2 — κατώφλι εμφάνισης', () => {
  // Μετάλλαξη που πρέπει να ρίξει: `count <= 0` → `count < 0` (θα έδειχνε άδειο «0»).
  it.each([0, -1, Number.NaN])('count=%p δεν αποδίδεται καθόλου', (count) => {
    render(<IconCountBadge count={count} data-testid={BADGE} />);
    expect(badge()).toBeNull();
  });

  it('count=1 αποδίδεται — το κατώφλι δεν είναι off-by-one', () => {
    render(<IconCountBadge count={1} data-testid={BADGE} />);
    expect(badge()).toHaveTextContent('1');
  });
});

describe('ADR-854 · Ομάδα 3 — το aria-hidden είναι ΣΤΑΘΕΡΑ', () => {
  // Μετάλλαξη που πρέπει να ρίξει: κάποιος το κάνει prop-driven «για ευκολία».
  it.each([
    ['χωρίς announce', undefined],
    ['με announce', true as const],
  ])('%s → aria-hidden="true"', (_label, announce) => {
    render(<IconCountBadge count={5} announce={announce} data-testid={BADGE} />);
    expect(badge()).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ADR-854 · Ομάδα 4 — ανακοίνωση', () => {
  // Μετάλλαξη που πρέπει να ρίξει: διπλός sr-only κόμβος / ανακοίνωση του κομμένου αριθμού.
  it('χωρίς announce δεν υπάρχει κρυφός κόμβος (τον αριθμό τον λέει ο γονέας)', () => {
    const { container } = render(<IconCountBadge count={5} data-testid={BADGE} />);
    expect(container.querySelectorAll('.sr-only')).toHaveLength(0);
  });

  it('με announce υπάρχει ΑΚΡΙΒΩΣ ΕΝΑΣ κρυφός κόμβος', () => {
    const { container } = render(<IconCountBadge count={5} announce data-testid={BADGE} />);
    expect(container.querySelectorAll('.sr-only')).toHaveLength(1);
  });

  it('ανακοινώνεται ο ΠΡΑΓΜΑΤΙΚΟΣ αριθμός, όχι το κομμένο «99+»', () => {
    const { container } = render(<IconCountBadge count={127} announce data-testid={BADGE} />);
    expect(badge()).toHaveTextContent('99+');
    expect(container.querySelector('.sr-only')?.textContent).toContain('|127');
  });

  it('το δικό σου κλειδί υπερισχύει του προεπιλεγμένου', () => {
    const { container } = render(
      <IconCountBadge count={3} announce={{ ns: 'contacts', key: 'trash.count' }} data-testid={BADGE} />,
    );
    expect(container.querySelector('.sr-only')?.textContent).toBe('contacts:trash.count|3');
  });

  it('live=true κάνει τον κόμβο polite· χωρίς αυτό δεν υπάρχει live region', () => {
    const { container, unmount } = render(<IconCountBadge count={3} announce live />);
    expect(container.querySelector('.sr-only')).toHaveAttribute('aria-live', 'polite');
    unmount();

    const plain = render(<IconCountBadge count={3} announce />);
    expect(plain.container.querySelector('.sr-only')).not.toHaveAttribute('aria-live');
  });
});

describe('ADR-854 · Ομάδα 5 — ΤΟ ΖΕΥΓΟΣ ΤΟΥ ΤΟΝΟΥ (η ρίζα του ADR)', () => {
  // Μετάλλαξη που πρέπει να ρίξει: επιστροφή σε --bg-error/--destructive, ή «λευκό
  // μελάνι παντού για συνέπεια» (που ρίχνει το success στα 2,30:1).
  it.each([
    ['urgent', '--status-error', 'text-white'],
    ['count', '--status-info', 'text-white'],
    ['success', '--status-success', 'text-black'],
    ['warning', '--status-warning', 'text-black'],
  ] as const)('tone=%s → %s + %s', (tone, fillToken, inkClass) => {
    render(<IconCountBadge count={7} tone={tone} data-testid={BADGE} />);
    const cls = badge()?.className ?? '';

    expect(cls).toContain(fillToken);
    expect(cls).toContain(inkClass);
  });

  it.each(['urgent', 'count', 'success', 'warning'] as const)(
    'tone=%s ΔΕΝ ζητά ποτέ soft surface ούτε --destructive',
    (tone) => {
      render(<IconCountBadge count={7} tone={tone} data-testid={BADGE} />);
      const cls = badge()?.className ?? '';

      // --bg-* είναι υπόβαθρα πλαισίων (red-50). Με λευκό μελάνι δίνουν 1,02:1.
      expect(cls).not.toMatch(/--bg-(error|success|warning|info)/);
      // --destructive είναι επιφάνεια κουμπιού· στο φωτεινό θέμα δίνει 3,59:1 στα 10px.
      expect(cls).not.toMatch(/bg-destructive|--destructive/);
    },
  );
});

describe('ADR-854 · Ομάδα 6 — μέγεθος & λογική θέση', () => {
  // Μετάλλαξη που πρέπει να ρίξει: σιωπηλή μετακίνηση από «απλοποίηση» του πίνακα.
  it('προεπιλογή = sm + top-end', () => {
    render(<IconCountBadge count={3} data-testid={BADGE} />);
    const cls = badge()?.className ?? '';
    expect(cls).toContain('h-4');
    expect(cls).toContain('-end-1');
  });

  it('md μεγαλώνει το σήμα', () => {
    render(<IconCountBadge count={3} size="md" data-testid={BADGE} />);
    expect(badge()?.className).toContain('h-5');
  });

  it('top-start αντιστρέφει τη ΛΟΓΙΚΗ πλευρά, όχι τη φυσική', () => {
    render(<IconCountBadge count={3} placement="top-start" data-testid={BADGE} />);
    const cls = badge()?.className ?? '';
    expect(cls).toContain('-start-1');
    expect(cls).not.toContain('-end-1');
  });

  it.each(['sm', 'md'] as const)('size=%s χρησιμοποιεί min-w (ο τριψήφιος δεν κόβεται)', (size) => {
    render(<IconCountBadge count={100} size={size} data-testid={BADGE} />);
    const cls = badge()?.className ?? '';
    expect(cls).toMatch(/min-w-\d/);
    // `w-4` σταθερό ήταν το σφάλμα του header-custom-actions: έκοβε το «99+».
    expect(cls).not.toMatch(/(^|\s)w-\d/);
  });

  it('ο αριθμός είναι tabular — ο δίσκος δεν χοροπηδά σε 8→9→10', () => {
    render(<IconCountBadge count={8} data-testid={BADGE} />);
    expect(badge()?.className).toContain('tabular-nums');
  });
});
