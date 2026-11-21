/**
 * ADR-920 Β6.6 — η σκηνή «Ανάγλυφο» της δημόσιας αγγελίας: τι βλέπει ο επισκέπτης ΠΡΙΝ, ΟΤΑΝ και ΑΝ ΔΕΝ έρθει το
 * στιγμιότυπο.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - οι αριθμοί/ο τοπογράφος περιμένουν το δίκτυο (κρύβονται στη φόρτωση).
 * - άρνηση του αναγνώστη προσφέρει «Δοκιμή ξανά» (άχρηστη) · ή «δεν φόρτωσε» χωρίς επανάληψη.
 * - το αίτημα δεν ακυρώνεται όταν κλείσει η καρτέλα.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { PUBLISHED_TERRAIN_URL, REAL_PLANE, publishedTerrainOf } from '@/lib/terrain/publication/__tests__/fixtures/terrain-3d-fixtures';

import { ListingTerrainPanel } from '../ListingTerrainPanel';
import { elListingDetailT } from './fixtures/el-listing-detail-t';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: jest.requireActual<typeof import('./fixtures/el-listing-detail-t')>('./fixtures/el-listing-detail-t').elListingDetailT,
  }),
}));
jest.mock('@/lib/browser/webgl-support', () => ({ isWebGLAvailable: () => true }));
// Οι τεμπέλικες επιφάνειες (`terrain-surfaces`): η σκηνή του χάρτη αποδίδεται ΣΥΓΧΡΟΝΑ με το αληθινό της component (το
// test κρίνει τη ροή του panel, όχι το chunk)· ο θεατής 3Δ μένει δηλωτικό στέλεχος.
jest.mock('../terrain-surfaces', () => ({
  ...jest.requireActual<typeof import('../terrain-surfaces')>('../terrain-surfaces'),
  // `requireActual` τη στιγμή της απόδοσης, όχι μέσα στο factory: το `TerrainViewStage` εισάγει το ίδιο το μητρώο.
  LazyTerrainSnapshotStage: function TerrainSnapshotStageNow(props: import('../terrain-surface-props').TerrainSnapshotStageProps) {
    const Stage = jest.requireActual<typeof import('../TerrainSnapshotStage')>('../TerrainSnapshotStage').default;
    return <Stage {...props} />;
  },
  LazyTerrain3dCanvas: function Terrain3dCanvasStub() {
    return <output data-testid="terrain-3d-canvas" />;
  },
}));

const SNAPSHOT = REAL_PLANE();
const TERRAIN = publishedTerrainOf(SNAPSHOT);
const t = (key: string) => elListingDetailT(`listing-detail:terrain.panel.${key}`);

interface Pending {
  readonly init: RequestInit;
  readonly resolve: (reply: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
}

let pending: Pending[] = [];
const fetchMock = jest.fn((_url: string, init: RequestInit) => new Promise((resolve) => { pending.push({ init, resolve }); }));

function reply(index: number, body: unknown, status = 200): Promise<void> {
  return act(async () => {
    pending[index].resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
  });
}

beforeEach(() => {
  pending = [];
  fetchMock.mockClear();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('ListingTerrainPanel', () => {
  it('ζητά το στιγμιότυπο ΜΙΑ φορά στην προσάρτηση — και ο τοπογράφος + οι αριθμοί φαίνονται ΠΡΙΝ απαντήσει', () => {
    const { container } = render(<ListingTerrainPanel terrain={TERRAIN} />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(PUBLISHED_TERRAIN_URL);
    expect(screen.getByText(t('loading'))).toBeInTheDocument();
    expect(container.querySelector('[data-listing-terrain-survey]')).toHaveTextContent('Γ. Τοπογράφος');
    expect(container.querySelector('dl')).not.toBeNull();
    expect(container.querySelector('[data-terrain-view-stage]')).toBeNull();
  });

  it('στιγμιότυπο που διαβάζεται ⇒ «Κάτοψη | 3Δ» με τον χάρτη', async () => {
    const { container } = render(<ListingTerrainPanel terrain={TERRAIN} />);
    await reply(0, SNAPSHOT);
    expect(container.querySelector('[data-terrain-view-stage]')).not.toBeNull();
    expect(container.querySelector('[data-terrain-contour-map]')).not.toBeNull();
    expect(screen.queryByText(t('loading'))).toBeNull();
  });

  it('🔴 άρνηση του αναγνώστη ⇒ «δεν μπορεί να εμφανιστεί», ΧΩΡΙΣ «Δοκιμή ξανά»', async () => {
    render(<ListingTerrainPanel terrain={TERRAIN} />);
    await reply(0, { ...SNAPSHOT, version: SNAPSHOT.version + 1 });
    expect(screen.getByText(t('refused'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('retry') })).toBeNull();
  });

  it('🔴 δεν απάντησε (503) ⇒ «δεν φόρτωσε» + «Δοκιμή ξανά», που ξαναζητά και φέρνει τη σκηνή', async () => {
    const { container } = render(<ListingTerrainPanel terrain={TERRAIN} />);
    await reply(0, null, 503);
    expect(screen.getByText(t('unreachable'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('retry') }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText(t('loading'))).toBeInTheDocument();
    await reply(1, SNAPSHOT);
    await waitFor(() => expect(container.querySelector('[data-terrain-view-stage]')).not.toBeNull());
  });

  it('🔴 κλείσιμο της καρτέλας (αποπροσάρτηση) ⇒ το αίτημα ακυρώνεται', () => {
    const { unmount } = render(<ListingTerrainPanel terrain={TERRAIN} />);
    const signal = pending[0].init.signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
