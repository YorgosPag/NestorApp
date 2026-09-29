/**
 * @jest-environment jsdom
 */
/**
 * ADR-884 Φ2ζ ζ3 · §4.15 — **«Σημεία που ετοιμάζονται ξανά» με το ΟΝΟΜΑ του σημείου** (εύρημα της ζωντανής «Εφαρμογής»: η στήλη
 * έγραφε «Λήψη 27/09/2026» για το «Γραφείο» — ο υπεύθυνος δεν αναγνώριζε ποιο σημείο θόλωσε).
 *
 * - **Ο** — σημείο με χώρο ⇒ το όνομα του χώρου, με την **ίδια** αρίθμηση όμοιων με τον γράφο («Γραφείο 2»).
 * - **Η** — σημείο χωρίς χώρο ή ορφανή λήψη ⇒ η ημερομηνία της λήψης («Σημείο N» δεν υπάρχει εκτός γράφου).
 */

import { render, screen, within } from '@testing-library/react';

import { CAPTURE } from '@/lib/spatial-tour/__tests__/spatial-tour-fixtures';
import { buildTourEditorModel } from '@/lib/spatial-tour/tour-editor-model';
import type { TourCapture, TourNode } from '@/types/spatial-tour';

import { TourEditorRail } from '../TourEditorRail';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join('|')}` : key),
    isNamespaceReady: true,
  }),
}));

const L0 = { kind: 'local', ordinal: 0 } as const;
const LEVELS = [{ key: L0, label: null, ordinal: 0 }];
const READY = { state: 'ready', contentHash: 'h', faceSize: 1024 } as const;
const REBAKING = { state: 'pending', contentHash: 'k2', faceSize: null, retiredKeys: ['h'] } as const;
const OFFICE = { types: ['office'], label: null, source: 'manual' } as const;

const node = (id: string, room?: TourNode['room']): TourNode => ({ id, levelKey: L0, position: null, links: [], ...(room ? { room } : {}) });
const capture = (id: string, nodeId: string, extra: Partial<TourCapture> = {}): TourCapture =>
  ({ ...CAPTURE, id, nodeId, capturedAt: '2026-09-27T10:00:00.000Z', tileset: READY, ...extra });
const blurred = (id: string, nodeId: string) => capture(id, nodeId, { tileset: REBAKING, originalHash: 'h' });

function rebakingRow(nodes: readonly TourNode[], captures: readonly TourCapture[]): string {
  const model = buildTourEditorModel({ nodes, levels: LEVELS }, captures);
  render(<TourEditorRail model={model} selection={null} onSelect={() => undefined} />);
  const section = screen.getByRole('heading', { name: 'spatial-tour:editor.blur.rebakingSection' }).closest('section');
  if (section === null) throw new Error('rebaking section missing');
  return within(section).getAllByRole('button')[0]?.textContent ?? '';
}

describe('Ο — όνομα χώρου', () => {
  it('δεύτερο «Γραφείο» του ορόφου που ξαναψήνεται ⇒ «Γραφείο 2», όχι ημερομηνία', () => {
    const text = rebakingRow([node('a', OFFICE), node('b', OFFICE)], [capture('ca', 'a'), blurred('cb', 'b')]);
    expect(text).toBe('spatial-tour:rooms.numbered:spatial-tour:rooms.types.office|2');
  });
});

describe('Η — πτώση στην ημερομηνία', () => {
  it('σημείο χωρίς χώρο ⇒ ημερομηνία λήψης', () => {
    expect(rebakingRow([node('a')], [blurred('ca', 'a')])).toMatch(/capturedAt/);
  });

  it('ορφανή λήψη (κόμβος εκτός γράφου) ⇒ ημερομηνία λήψης', () => {
    expect(rebakingRow([], [blurred('ca', 'gone')])).toMatch(/capturedAt/);
  });
});
