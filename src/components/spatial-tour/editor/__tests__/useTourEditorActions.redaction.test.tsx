/**
 * @jest-environment jsdom
 */
/**
 * ADR-884 Φ2ζ ζ3 · §4.15 — **«Εφαρμογή» και «Αναίρεση» του θολώματος μέσα από τις πράξεις της οθόνης**.
 *
 * - **Ε** — η δέσμη φεύγει ως **μία** εντολή `redactions`, με το μήνυμα «εφαρμόστηκε».
 * - **Ν** — η «Αναίρεση» της ειδοποίησης στέλνει **μία** δέσμη που γυρίζει στο «πριν» — από τις περιοχές που **έβλεπε η οθόνη**
 *   (χωρίς αυτή τη σύνδεση `inverseOf` δεν έχει «πριν» ⇒ καμία αναίρεση).
 */

import { act, renderHook } from '@testing-library/react';

import { CAPTURE } from '@/lib/spatial-tour/__tests__/spatial-tour-fixtures';
import type { TourGraphCommand } from '@/lib/spatial-tour/tour-graph-edit';
import { editTourGraphFromScreen } from '@/services/spatial-tour/spatial-tour-graph.client';
import type { TourRedaction, TourSubject } from '@/types/spatial-tour';

import { TOUR_REDACTION_KEYS } from '../tour-redaction-labels';
import { useTourEditorActions } from '../useTourEditorActions';
import type { TourEditorDataHandle } from '../useTourEditorData';

jest.mock('@/services/spatial-tour/spatial-tour-graph.client', () => ({ editTourGraphFromScreen: jest.fn() }));
const mockSuccess = jest.fn();
const mockError = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ success: mockSuccess, error: mockError }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }) }));

const edit = editTourGraphFromScreen as jest.MockedFunction<typeof editTourGraphFromScreen>;
const SUBJECT: TourSubject = { kind: 'company-property', id: 'prop_1' };
const R1 = 'tred_00000000-0000-4000-8000-000000000001';
const REGION = { yawRad: 0.5, pitchRad: 0.1, radiusRad: 0.2 };
const APPLIED: TourRedaction = { id: R1, ...REGION, source: 'auto', createdBy: 'system', createdAt: '2026-09-28T10:00:00.000Z' };

function handle(): TourEditorDataHandle {
  return {
    load: { kind: 'loaded', data: { nodes: [], levels: [], captures: [{ ...CAPTURE, id: 'tcap_1', redactions: [APPLIED] }] } },
    reload: jest.fn(async () => undefined),
    poll: jest.fn(),
    setGraph: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  edit.mockResolvedValue({ kind: 'ok', value: { changed: true, revision: 2 } });
});

it('Ε — μία εντολή `redactions` · μήνυμα «εφαρμόστηκε»', async () => {
  const { result } = renderHook(() => useTourEditorActions(SUBJECT, handle()));
  await act(async () => { await result.current.redactions('tcap_1', [{ op: 'unredact', redactionId: R1 }]); });
  expect(edit).toHaveBeenCalledTimes(1);
  expect(edit.mock.calls[0]?.[1]).toEqual({ op: 'redactions', captureId: 'tcap_1', edits: [{ op: 'unredact', redactionId: R1 }] });
  expect(mockSuccess.mock.calls[0]?.[0]).toBe(TOUR_REDACTION_KEYS.applied);
});

it('Ν — «Αναίρεση» = μία δέσμη που ξαναγεννά τον κύκλο στο ΙΔΙΟ id, από τις περιοχές της οθόνης', async () => {
  const { result } = renderHook(() => useTourEditorActions(SUBJECT, handle()));
  await act(async () => { await result.current.redactions('tcap_1', [{ op: 'unredact', redactionId: R1 }]); });
  const undo = mockSuccess.mock.calls[0]?.[1]?.actions?.[0]?.onClick as (() => void) | undefined;
  expect(undo).toBeDefined();
  await act(async () => { undo?.(); await Promise.resolve(); });
  const sent = edit.mock.calls[1]?.[1] as TourGraphCommand;
  expect(sent).toEqual({ op: 'redactions', captureId: 'tcap_1', edits: [{ op: 'redact', redactionId: R1, mode: 'create', region: REGION }] });
});

it('id νέου κύκλου = πρόθεμα `tred_` (N.6)', () => {
  const { result } = renderHook(() => useTourEditorActions(SUBJECT, handle()));
  expect(result.current.newRedactionId()).toMatch(/^tred_/);
});
