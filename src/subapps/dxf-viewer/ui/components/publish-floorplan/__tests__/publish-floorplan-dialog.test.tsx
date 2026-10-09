/**
 * ADR-909 Β2.5 — ΑΓΚΥΡΕΣ της **προεπισκόπησης** και των **μηνυμάτων** του διαλόγου «Δημοσίευση κάτοψης».
 *
 *   Β1  🏆 η προεπισκόπηση δείχνει ΤΟ ΙΔΙΟ αντικείμενο `Blob` που θα σταλεί — όχι δεύτερη απόδοση
 *   Β2  αλλαγή επιλογής ⇒ νέα εικόνα · το παλιό object URL ανακαλείται
 *   Β5  Β2.8 — ίδια επιλογή σε ΝΕΟ αντικείμενο ΔΕΝ ξαναβγάζει την εικόνα (ούτε αλλάζει το κλειδί της)
 *   Β6  Β2.8 — γρήγορες αλλαγές στη σειρά ⇒ ΜΙΑ λήψη, με την τελευταία επιλογή
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
import {
  DEFAULT_PUBLIC_FLOORPLAN_CHOICE as LISTING,
  type PublicFloorplanChoice,
} from '../../../../print/public-floorplan/public-floorplan-presets';
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
const FURNISHED: PublicFloorplanChoice = { groups: ['furniture', 'texts', 'hatches', 'orientation'], plotStyle: 'monochrome' };

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

    const { result } = renderHook(() => usePublishFloorplanPreview(() => DEPS, LISTING));
    expect(result.current.status).toBe('preparing');
    await waitFor(() => expect(result.current.status).toBe('ready'));

    if (result.current.status !== 'ready') throw new Error('expected a ready preview');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    // Το `<img>` διαβάζει το URL αυτού του αντικειμένου· η αποστολή στέλνει το `prepared.blob`. Ένα και το αυτό.
    expect(createObjectURL.mock.calls[0][0]).toBe(image.blob);
    expect(result.current.prepared.blob).toBe(image.blob);
    expect(result.current.prepared.idempotencyKey).toBe('idk_plain');
  });

  it('Β2 αλλαγή επιλογής ⇒ νέα εικόνα · το παλιό object URL ανακαλείται', async () => {
    prepare.mockResolvedValueOnce({ ok: true, prepared: preparedOf('plain') });
    prepare.mockResolvedValueOnce({ ok: true, prepared: preparedOf('furnished') });

    const { result, rerender } = renderHook(
      ({ choice }) => usePublishFloorplanPreview(() => DEPS, choice),
      { initialProps: { choice: LISTING } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const firstUrl = result.current.status === 'ready' ? result.current.url : '';

    rerender({ choice: FURNISHED });
    // 🔑 Όσο περιμένει τη νέα εικόνα, η παλιά ΔΕΝ είναι πια «έτοιμη»: το κουμπί «Δημοσίευση» σβήνει αμέσως.
    expect(result.current.status).toBe('preparing');
    await waitFor(() => expect(result.current.status === 'ready' && result.current.prepared.idempotencyKey).toBe('idk_furnished'));

    expect(prepare).toHaveBeenLastCalledWith(DEPS, FURNISHED);
    expect(revokeObjectURL).toHaveBeenCalledWith(firstUrl);
  });

  it('Β3 νέο snapshot των `collectDeps` ΔΕΝ ξαναβγάζει την εικόνα', async () => {
    prepare.mockResolvedValue({ ok: true, prepared: preparedOf('plain') });

    const { result, rerender } = renderHook(
      ({ collect }) => usePublishFloorplanPreview(collect, LISTING),
      { initialProps: { collect: () => DEPS } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ collect: () => DEPS });
    rerender({ collect: () => DEPS });

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('Β5 ίδια επιλογή σε ΝΕΟ αντικείμενο ΔΕΝ ξαναβγάζει την εικόνα', async () => {
    prepare.mockResolvedValue({ ok: true, prepared: preparedOf('plain') });

    const { result, rerender } = renderHook(
      ({ choice }) => usePublishFloorplanPreview(() => DEPS, choice),
      { initialProps: { choice: LISTING } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ choice: { plotStyle: LISTING.plotStyle, groups: [...LISTING.groups] } });

    expect(result.current.status).toBe('ready');
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('Β6 γρήγορες αλλαγές στη σειρά ⇒ ΜΙΑ λήψη, με την τελευταία επιλογή', async () => {
    prepare.mockResolvedValueOnce({ ok: true, prepared: preparedOf('plain') });
    prepare.mockResolvedValueOnce({ ok: true, prepared: preparedOf('last') });

    const { result, rerender } = renderHook(
      ({ choice }) => usePublishFloorplanPreview(() => DEPS, choice),
      { initialProps: { choice: LISTING } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ choice: FURNISHED });
    rerender({ choice: { ...FURNISHED, plotStyle: 'grayscale' } });
    rerender({ choice: { ...FURNISHED, plotStyle: 'colour' } });
    await waitFor(() => expect(result.current.status === 'ready' && result.current.prepared.idempotencyKey).toBe('idk_last'));

    expect(prepare).toHaveBeenCalledTimes(2);
    expect(prepare).toHaveBeenLastCalledWith(DEPS, { ...FURNISHED, plotStyle: 'colour' });
  });

  it('Β4 άρνηση λήψης ⇒ καμία εικόνα, ο λόγος με το όνομά του', async () => {
    prepare.mockResolvedValue({ ok: false, refusal: 'no-geometry' });

    const { result } = renderHook(() => usePublishFloorplanPreview(() => DEPS, LISTING));
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
