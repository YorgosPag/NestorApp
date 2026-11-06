/**
 * @jest-environment jsdom
 *
 * ADR-929 Φ5.3β — το τμήμα «Ανάγνωση κειμένων με AI» του πάνελ:
 *   · ποτέ αποστολή χωρίς πακέτο **και** «επιτρέπεται»·
 *   · η μικρογραφία είναι το URL του **ίδιου** πακέτου, με το πλήρες sha256 δίπλα·
 *   · κάθε λόγος άρνησης έχει δικό του κείμενο + «συνεχίζει μόνο με γεωμετρία»·
 *   · η αναντιστοιχία παραλαβής φαίνεται ως σφάλμα, όχι ως επιτυχία.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import type { PlanReadingUnavailableReason } from '../../../../bim/plan-recognition/plan-recognition-types';
import type { PlanReadingPacket, PlanReadingReview } from '../../../../systems/plan-recognition/plan-recognition-store';
import { PlanReadingSection, type PlanReadingActions } from '../PlanReadingSections';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, currentLanguage: 'el' }),
}));

const t = (key: string, params?: Record<string, string | number>): string => (params ? `${key}${JSON.stringify(params)}` : key);

const VIEW = { crop: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, redacted: [] };
const PACKET: PlanReadingPacket = {
  view: VIEW, segments: [], blob: new Blob(['x']), previewUrl: 'blob:preview-1', sha256: 'a'.repeat(64), widthPx: 2000, heightPx: 1500,
};

function review(next: Partial<PlanReadingReview> = {}): PlanReadingReview {
  return { proposed: VIEW, view: VIEW, tool: 'select', packet: null, preflight: { status: 'idle' }, send: { status: 'idle' }, ...next };
}

function actions(): jest.Mocked<PlanReadingActions> {
  return { onBegin: jest.fn(), onEnd: jest.fn(), onToggleAddRegion: jest.fn(), onReset: jest.fn(), onPrepare: jest.fn(), onSend: jest.fn() };
}

const ALLOWED = { status: 'done', result: { status: 'allowed', model: 'm', estimateUsd: 0.04, remainingUsd: 9.5, monthlyCapUsd: 10 } } as const;

function renderSection(r: PlanReadingReview | null, available = true) {
  const a = actions();
  const view = render(<PlanReadingSection available={available} review={r} actions={a} t={t} />);
  return { ...view, a };
}

describe('PlanReadingSection (ADR-929 Φ5.3β)', () => {
  it('χωρίς αποτέλεσμα γεωμετρίας δεν εμφανίζεται· χωρίς όψη, μόνο το «Ανάγνωση κειμένων»', () => {
    expect(renderSection(null, false).container.textContent).toBe('');
    const { getByTestId, queryByTestId, a } = renderSection(null);
    expect(queryByTestId('mfd-reading-send')).toBeNull();
    fireEvent.click(getByTestId('mfd-reading-begin'));
    expect(a.onBegin).toHaveBeenCalledTimes(1);
  });

  it('η αποστολή μένει κλειστή χωρίς πακέτο, ακόμα κι αν επιτρέπεται', () => {
    const { getByTestId } = renderSection(review({ preflight: ALLOWED }));
    expect(getByTestId('mfd-reading-send')).toBeDisabled();
  });

  it('με πακέτο + «επιτρέπεται»: μικρογραφία από το ΙΔΙΟ URL, πλήρες sha256, εκτίμηση, και ενεργή αποστολή', () => {
    const { getByTestId, a } = renderSection(review({ preflight: ALLOWED, packet: PACKET }));
    expect(getByTestId('mfd-reading-preview')).toHaveAttribute('src', 'blob:preview-1');
    expect(getByTestId('mfd-reading-sha').textContent).toBe(PACKET.sha256);
    expect(getByTestId('mfd-reading-estimate').textContent).toContain('modelFromDrawing.image.reading.estimate');
    fireEvent.click(getByTestId('mfd-reading-send'));
    expect(a.onSend).toHaveBeenCalledTimes(1);
  });

  it.each<PlanReadingUnavailableReason>([
    'ai-disabled-for-company', 'ai-legal-disclosure-pending', 'allowance-exhausted', 'allowance-unverifiable',
    'page-cost-exceeds-cap', 'cost-unknown', 'reader-unconfigured', 'reading-in-progress', 'reader-failed',
  ])('άρνηση «%s»: δικό της κείμενο, «μόνο γεωμετρία», αποστολή κλειστή', (reason) => {
    const { getByTestId } = renderSection(review({ packet: PACKET, preflight: { status: 'done', result: { status: 'unavailable', reason } } }));
    const refusal = getByTestId('mfd-reading-refusal');
    expect(refusal.textContent).toContain(`modelFromDrawing.image.reading.reason.${reason}`);
    expect(refusal.textContent).toContain('modelFromDrawing.image.reading.geometryOnly');
    expect(getByTestId('mfd-reading-send')).toBeDisabled();
  });

  it('προέλεγχος που απέτυχε ⇒ fail-closed', () => {
    const { getByTestId } = renderSection(review({ packet: PACKET, preflight: { status: 'failed' } }));
    expect(getByTestId('mfd-reading-send')).toBeDisabled();
  });

  it('απόδειξη παραλαβής: επιτυχία vs αναντιστοιχία', () => {
    const ok = renderSection(review({ send: { status: 'read', cacheHit: true, counts: { texts: 9, dimensions: 4, rooms: 2, openings: 3 } } }));
    expect(ok.getByTestId('mfd-reading-result').textContent).toContain('modelFromDrawing.image.reading.receiptOk');
    expect(ok.getByTestId('mfd-reading-result').textContent).toContain('modelFromDrawing.image.reading.cacheHit');
    ok.unmount();
    const bad = renderSection(review({ send: { status: 'receipt-mismatch' } }));
    expect(bad.getByTestId('mfd-reading-mismatch')).toHaveAttribute('role', 'alert');
  });

  it('εργαλεία σήμανσης: «Προσθήκη περιοχής» είναι διακόπτης· όσο στέλνεται, όλα κλειστά', () => {
    const adding = renderSection(review({ tool: 'add-redaction' }));
    expect(adding.getByTestId('mfd-reading-add-region')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(adding.getByTestId('mfd-reading-add-region'));
    expect(adding.a.onToggleAddRegion).toHaveBeenCalledTimes(1);
    adding.unmount();
    const sending = renderSection(review({ packet: PACKET, preflight: ALLOWED, send: { status: 'sending' } }));
    for (const id of ['mfd-reading-add-region', 'mfd-reading-reset', 'mfd-reading-prepare', 'mfd-reading-send', 'mfd-reading-close']) {
      expect(sending.getByTestId(id)).toBeDisabled();
    }
  });
});
