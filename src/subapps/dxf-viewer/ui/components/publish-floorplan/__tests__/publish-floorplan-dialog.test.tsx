/**
 * ADR-909 Β2.5 — ΑΓΚΥΡΕΣ της **προεπισκόπησης** και των **μηνυμάτων** του διαλόγου «Δημοσίευση κάτοψης».
 *
 *   Β1  🏆 η προεπισκόπηση δείχνει ΤΟ ΙΔΙΟ αντικείμενο `Blob` που θα σταλεί — όχι δεύτερη απόδοση
 *   Β2  αλλαγή επίπλωσης ⇒ νέα εικόνα · το παλιό object URL ανακαλείται
 *   Β3  νέο snapshot των `collectDeps` ΔΕΝ ξαναβγάζει την εικόνα (ούτε αλλάζει το κλειδί της)
 *   Β4  άρνηση λήψης ⇒ καμία εικόνα, ο λόγος με το όνομά του
 *   Μ1  «ανέβηκε» ≠ «το βλέπει το κοινό»: η δήλωση προηγείται της αγγελίας, και μόνο `published` λέει «δημοσιεύτηκε»
 */

import { renderHook, waitFor } from '@testing-library/react';

import type { ExportDeps } from '../../../../export/types';
import {
  prepareFloorplanPublication,
  type PreparedFloorplan,
} from '../../../../io/floorplan-publish/publish-floorplan-to-property';
import { floorplanOutcomeMessageOf } from '../floorplan-publish-messages';
import { usePublishFloorplanPreview } from '../usePublishFloorplanPreview';

jest.mock('../../../../io/floorplan-publish/publish-floorplan-to-property', () => ({
  prepareFloorplanPublication: jest.fn(),
}));

const prepare = prepareFloorplanPublication as jest.Mock;

const preparedOf = (tag: string): PreparedFloorplan =>
  ({
    blob: new Blob([tag], { type: 'image/png' }),
    recipe: { widthPx: 4096, heightPx: 2048 },
    levelId: 'lvl_1',
    idempotencyKey: `idk_${tag}`,
    unruledTypes: [],
    fidelity: [],
  }) as unknown as PreparedFloorplan;

const DEPS = { activeLevelId: 'lvl_1' } as unknown as ExportDeps;

let createObjectURL: jest.Mock;
let revokeObjectURL: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  createObjectURL = jest.fn((blob: Blob) => `blob:preview/${blob.size}/${createObjectURL.mock.calls.length}`);
  revokeObjectURL = jest.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
});

describe('Β — η προεπισκόπηση', () => {
  it('Β1 🏆 δείχνει ΤΟ ΙΔΙΟ αντικείμενο `Blob` που θα σταλεί', async () => {
    const image = preparedOf('plain');
    prepare.mockResolvedValue({ ok: true, prepared: image });

    const { result } = renderHook(() => usePublishFloorplanPreview(() => DEPS, false));
    expect(result.current.status).toBe('preparing');
    await waitFor(() => expect(result.current.status).toBe('ready'));

    if (result.current.status !== 'ready') throw new Error('expected a ready preview');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    // Το `<img>` διαβάζει το URL αυτού του αντικειμένου· η αποστολή στέλνει το `prepared.blob`. Ένα και το αυτό.
    expect(createObjectURL.mock.calls[0][0]).toBe(image.blob);
    expect(result.current.prepared.blob).toBe(image.blob);
    expect(result.current.prepared.idempotencyKey).toBe('idk_plain');
  });

  it('Β2 αλλαγή επίπλωσης ⇒ νέα εικόνα · το παλιό object URL ανακαλείται', async () => {
    prepare.mockResolvedValueOnce({ ok: true, prepared: preparedOf('plain') });
    prepare.mockResolvedValueOnce({ ok: true, prepared: preparedOf('furnished') });

    const { result, rerender } = renderHook(
      ({ furniture }) => usePublishFloorplanPreview(() => DEPS, furniture),
      { initialProps: { furniture: false } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const firstUrl = result.current.status === 'ready' ? result.current.url : '';

    rerender({ furniture: true });
    await waitFor(() => expect(result.current.status === 'ready' && result.current.prepared.idempotencyKey).toBe('idk_furnished'));

    expect(prepare).toHaveBeenLastCalledWith(DEPS, { furniture: true });
    expect(revokeObjectURL).toHaveBeenCalledWith(firstUrl);
  });

  it('Β3 νέο snapshot των `collectDeps` ΔΕΝ ξαναβγάζει την εικόνα', async () => {
    prepare.mockResolvedValue({ ok: true, prepared: preparedOf('plain') });

    const { result, rerender } = renderHook(
      ({ collect }) => usePublishFloorplanPreview(collect, false),
      { initialProps: { collect: () => DEPS } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ collect: () => DEPS });
    rerender({ collect: () => DEPS });

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('Β4 άρνηση λήψης ⇒ καμία εικόνα, ο λόγος με το όνομά του', async () => {
    prepare.mockResolvedValue({ ok: false, refusal: 'no-geometry' });

    const { result } = renderHook(() => usePublishFloorplanPreview(() => DEPS, false));
    await waitFor(() => expect(result.current.status).toBe('refused'));

    expect(result.current).toStrictEqual({ status: 'refused', refusal: 'no-geometry' });
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe('Μ — τι λέμε μετά τη δημοσίευση', () => {
  it.each([
    ['declared', 'published', 'published'],
    ['already', 'published', 'published'],
    ['declared', 'withdrawn', 'uploaded-not-listed'],
    ['declared', 'absent', 'uploaded-not-listed'],
    ['declared', 'unknown', 'uploaded-not-listed'],
    ['unknown', 'published', 'published'],
    ['declared', 'failed', 'listing-failed'],
    // 🔑 Η δήλωση προηγείται: αγγελία που «δημοσιεύτηκε» ΧΩΡΙΣ αυτή την κάτοψη δεν είναι επιτυχία.
    ['full', 'published', 'declared-full'],
    ['failed', 'published', 'declared-failed'],
    ['full', 'failed', 'declared-full'],
  ] as const)('Μ1 declared=%s · listing=%s ⇒ %s', (declared, listing, expected) => {
    expect(floorplanOutcomeMessageOf(declared, listing)).toBe(expected);
  });
});
