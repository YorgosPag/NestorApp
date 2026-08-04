/**
 * ADR-751 Φ7 — **η ένδειξη που διδάσκει τη χειρονομία.**
 *
 * Το κρίσιμο εδώ δεν είναι «εμφανίζεται» — είναι **πότε** εμφανίζεται. Το tooltip και ο
 * δείκτης έχουν σκόπιμα **διαφορετική** συνθήκη (§ κεφαλίδα του component):
 *
 *   tooltip → hover **χωρίς** modifier   (διδάσκει)
 *   δείκτης → hover **+ Ctrl**            (επιβεβαιώνει)
 *
 * Αν κάποιος αύριο τα «ενοποιήσει» για συνέπεια, το tooltip θα είναι ορατό μόνο σε όποιον
 * ήδη ξέρει τη χειρονομία — δηλαδή θα διδάσκει ακριβώς κανέναν, και **καμία** άλλη δοκιμασία
 * δεν θα γινόταν κόκκινη. Γι' αυτό κλειδώνεται εδώ ρητά.
 *
 * @see ui/table-cell-editor/TableCellLinkTooltip.tsx
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react';

/**
 * 🔴 Το mock διαβάζει τα **ΠΡΑΓΜΑΤΙΚΑ** ελληνικά locale, δεν επιστρέφει το κλειδί.
 *
 * Ένα mock που επιστρέφει `'tableCellLink.hint'` θα ήταν πράσινο ακόμα κι αν το κλειδί δεν
 * υπήρχε πουθενά — δηλαδή θα δοκίμαζε τη διακόσμηση και όχι το προϊόν. Έτσι, αν κάποιος
 * σβήσει ή μετονομάσει κλειδί, αυτή η σουίτα γίνεται κόκκινη **και** επαληθεύει ότι καμία
 * συμβολοσειρά δεν είναι καρφωμένη στο component (N.11).
 */
jest.mock('@/i18n/hooks/useTranslation', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const el = require('../../../../../i18n/locales/el/dxf-viewer.json');
  const lookup = (key: string): string =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], el) as string;
  return {
    useTranslation: () => ({
      t: (key: string, params?: Record<string, unknown>) => {
        const raw = lookup(key);
        if (typeof raw !== 'string') throw new Error(`ΛΕΙΠΕΙ κλειδί i18n: ${key}`);
        return params
          ? raw.replace(/\{(\w+)\}/g, (_m, name: string) => String(params[name] ?? `{${name}}`))
          : raw;
      },
    }),
  };
});

import { TableCellLinkTooltip } from '../TableCellLinkTooltip';
import {
  setHoveredCellLink,
  type HoveredCellLink,
} from '../../../state/table-cell-link-hover-store';
import type { TextLinkKind } from '@/lib/validation/text-link-segments';

/** Ένας σύνδεσμος στο store, όπως θα τον έγραφε το hover pass. */
function hover(kind: TextLinkKind, text: string, href: string): HoveredCellLink {
  return {
    entityId: 'ent_1',
    hit: {
      rowId: 'r1',
      colId: 'c1',
      span: { text, kind, href, offsetMm: 0, advanceMm: 10 },
    },
    clientX: 100,
    clientY: 200,
  };
}

afterEach(() => {
  act(() => setHoveredCellLink(null));
});

describe('πότε εμφανίζεται', () => {
  it('🔴 ΧΩΡΙΣ Ctrl — αλλιώς δεν θα δίδασκε κανέναν', () => {
    render(<TableCellLinkTooltip />);
    // Καμία αναφορά σε modifier: το component δεν ρωτά ποτέ το `CtrlKeyTracker`.
    act(() => setHoveredCellLink(hover('email', 'info@a.gr', 'mailto:info@a.gr')));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('κρύβεται όταν ο δείκτης φύγει από τον σύνδεσμο', () => {
    render(<TableCellLinkTooltip />);
    act(() => setHoveredCellLink(hover('email', 'info@a.gr', 'mailto:info@a.gr')));
    act(() => setHoveredCellLink(null));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('δεν εμφανίζεται σε άδειο store', () => {
    render(<TableCellLinkTooltip />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('τι λέει — η ΕΝΕΡΓΕΙΑ, όχι το ωμό href', () => {
  it.each([
    ['email' as const, 'info@a.gr', 'mailto:info@a.gr'],
    ['phone' as const, '2310-788493', 'tel:2310788493'],
    ['url' as const, 'www.nestorconstruct.gr', 'https://www.nestorconstruct.gr'],
  ])('%s: δείχνει το κείμενο του κελιού και τη συντόμευση', (kind, text, href) => {
    render(<TableCellLinkTooltip />);
    act(() => setHoveredCellLink(hover(kind, text, href)));

    const tip = screen.getByRole('status');
    // Ο προορισμός που βλέπει ο χρήστης είναι το ΚΕΙΜΕΝΟ του κελιού…
    expect(tip).toHaveTextContent(text);
    // …ποτέ το σχήμα: `tel:2310788493` δεν λέει τίποτα σε κανέναν.
    expect(tip.textContent).not.toContain('tel:');
    expect(tip.textContent).not.toContain('mailto:');
    // Και πάντα η χειρονομία.
    expect(tip.textContent).toContain('Ctrl');
  });

  it('🔴 κάθε είδος δίνει ΔΙΑΦΟΡΕΤΙΚΗ ενέργεια — όχι ένα γενικό «άνοιγμα»', () => {
    const labels = new Set<string>();
    for (const [kind, text, href] of [
      ['email', 'a@b.gr', 'mailto:a@b.gr'],
      ['phone', '2310788493', 'tel:2310788493'],
      ['url', 'www.b.gr', 'https://www.b.gr'],
    ] as const) {
      const { unmount } = render(<TableCellLinkTooltip />);
      act(() => setHoveredCellLink(hover(kind, text, href)));
      labels.add(screen.getByRole('status').textContent ?? '');
      unmount();
      act(() => setHoveredCellLink(null));
    }
    expect(labels.size).toBe(3);
  });
});

describe('δεν κόβει το κλικ που διαφημίζει', () => {
  it('είναι pointer-events-none', () => {
    render(<TableCellLinkTooltip />);
    act(() => setHoveredCellLink(hover('email', 'info@a.gr', 'mailto:info@a.gr')));
    expect(screen.getByRole('status').className).toContain('pointer-events-none');
  });

  it('κάθεται στην παγωμένη άγκυρα του store', () => {
    render(<TableCellLinkTooltip />);
    act(() => setHoveredCellLink(hover('email', 'info@a.gr', 'mailto:info@a.gr')));
    const style = screen.getByRole('status').getAttribute('style') ?? '';
    expect(style).toContain('116px'); // clientX 100 + 16
    expect(style).toContain('218px'); // clientY 200 + 18
  });
});

describe('🔴 η άγκυρα ΠΑΓΩΝΕΙ όσο ο δείκτης μένει στον ίδιο σύνδεσμο', () => {
  it('δεύτερη γραφή με άλλη θέση αλλά ίδιο σύνδεσμο δεν μετακινεί το tooltip', () => {
    render(<TableCellLinkTooltip />);
    act(() => setHoveredCellLink(hover('email', 'info@a.gr', 'mailto:info@a.gr')));
    act(() =>
      setHoveredCellLink({
        ...hover('email', 'info@a.gr', 'mailto:info@a.gr'),
        clientX: 400,
        clientY: 400,
      }),
    );
    // Ίδια ταυτότητα ⇒ ο φύλακας `equals` απορρίπτει τη γραφή ⇒ καμία μετακίνηση, καμία
    // επανασχεδίαση. Δες το σχόλιο του `clientX` στο store για το γιατί είναι σκόπιμο.
    expect(screen.getByRole('status').getAttribute('style') ?? '').toContain('116px');
  });

  it('αλλαγή προορισμού ΜΕΤΑΚΙΝΕΙ το tooltip — άλλος σύνδεσμος, νέα άγκυρα', () => {
    render(<TableCellLinkTooltip />);
    act(() => setHoveredCellLink(hover('email', 'info@a.gr', 'mailto:info@a.gr')));
    act(() =>
      setHoveredCellLink({
        ...hover('phone', '2310788493', 'tel:2310788493'),
        clientX: 400,
        clientY: 400,
      }),
    );
    expect(screen.getByRole('status').getAttribute('style') ?? '').toContain('416px');
  });
});
