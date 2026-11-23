/**
 * @jest-environment jsdom
 *
 * ADR-920 §14.11 Ζ4 — `usePlotDrawingImport`: σχέδιο → υποψήφια → επιλογή → επιβεβαίωση.
 * Άγκυρες: Π = πρόταση (ποτέ σιωπηλή επιλογή) · Μ = μονάδα DXF · Α = αρνήσεις με όνομα · Κ = κλειδί ανά πρόθεση ·
 * Ε = η έκβαση ανήκει στην πρόθεση που έφυγε · Δ = αγώνας δρόμου (μετρά το τελευταίο αρχείο).
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { buildPlotDrawingTrashPreview } from '@/services/property-dossier/plot-drawing-trash-preview';
import type { OwnerTerrainTarget, PreparedPlotOutlineConfirmation } from '@/services/listings/plot-outline.client';

import { surveyFileOf } from './terrain-survey-file-fixture';
import { usePlotDrawingImport } from '../usePlotDrawingImport';

const confirmPlotOutline = jest.fn();
jest.mock('@/services/listings/plot-outline.client', () => ({
  ...jest.requireActual('@/services/listings/plot-outline.client'),
  confirmPlotOutline: (...args: unknown[]) => confirmPlotOutline(...args),
}));
jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: {} }));
jest.mock('@/components/file-manager/pdf-device-pages', () => ({ readPdfPagesOnDevice: jest.fn(async () => null) }));

const TARGET: OwnerTerrainTarget = { kind: 'owner-property', ownerPropertyId: 'ownp_1' };

const lw = (handle: string, layer: string, coords: readonly (readonly [number, number])[]): string[] => [
  '0', 'LWPOLYLINE', '5', handle, '8', layer, '90', String(coords.length), '70', '1',
  ...coords.flatMap(([x, y]) => ['10', String(x), '20', String(y)]),
];
const dxf = (insunits: number | null, ...entities: string[][]): string => [
  ...(insunits === null ? [] : ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', String(insunits), '0', 'ENDSEC']),
  '0', 'SECTION', '2', 'ENTITIES', ...entities.flat(), '0', 'ENDSEC', '0', 'EOF',
].join('\n');

const PLOT = lw('P', 'ΟΡΙΟ', [[0, 0], [30, 0], [30, 20], [0, 20]]);
const HOUSE = lw('H', 'ΚΤΙΡΙΑ', [[10, 5], [20, 5], [20, 12], [10, 12]]);
const TWIN_A = lw('A', 'L1', [[0, 0], [10, 0], [10, 10], [0, 10]]);
const TWIN_B = lw('B', 'L2', [[50, 0], [60, 0], [60, 10], [50, 10]]);

/** Το jsdom δεν έχει `File.arrayBuffer` — το κοινό ψευδο-αρχείο των tests εδάφους, ως `File` για τον τύπο του hook. */
const fileOf = (name: string, content: string | Uint8Array, gate?: Promise<void>): File =>
  surveyFileOf(name, content, gate) as unknown as File;

const onConfirmed = jest.fn();
const mount = (listingAreaM2: number | null = 600) =>
  renderHook(() => usePlotDrawingImport(TARGET, listingAreaM2, onConfirmed));

beforeEach(() => {
  jest.clearAllMocks();
  confirmPlotOutline.mockResolvedValue({ ok: true, drawingFileId: 'file_d', areaM2: 600, coverage: null, listing: null });
});

describe('Π — πρόταση', () => {
  it('το «ΟΡΙΟ» με το εμβαδόν της αγγελίας προεπιλέγεται· Π9 ξεκινά ΑΤΣΕΚΑΡΙΣΤΟ', async () => {
    const { result } = mount();
    await act(async () => { await result.current.loadFile(fileOf('topo.dxf', dxf(6, PLOT, HOUSE))); });
    expect(result.current.candidates?.ranking.ranked).toHaveLength(2);
    expect(result.current.selectedId).toBe('dxf:P');
    expect(result.current.showInListing).toBe(false);
    expect(result.current.canConfirm).toBe(true);
  });

  it('🔴 ισοβαθμία ⇒ ΚΑΜΙΑ προεπιλογή και το κουμπί κλειστό, ώσπου να διαλέξει ο άνθρωπος', async () => {
    const { result } = mount(null);
    await act(async () => { await result.current.loadFile(fileOf('topo.dxf', dxf(6, TWIN_A, TWIN_B))); });
    expect(result.current.candidates?.ranking.proposedId).toBeNull();
    expect(result.current.selectedId).toBeNull();
    expect(result.current.canConfirm).toBe(false);
    act(() => result.current.select('dxf:B'));
    expect(result.current.selectedId).toBe('dxf:B');
    expect(result.current.canConfirm).toBe(true);
  });
});

describe('Μ — μονάδα DXF', () => {
  it('χωρίς $INSUNITS: κανένα υποψήφιο ώσπου να διαλέξει — και η μονάδα ταξιδεύει στην πόρτα', async () => {
    const { result } = mount();
    await act(async () => { await result.current.loadFile(fileOf('topo.dxf', dxf(null, PLOT))); });
    expect(result.current.needsUnit).toBe(true);
    expect(result.current.candidates).toBeNull();
    act(() => result.current.setUnit('m'));
    expect(result.current.needsUnit).toBe(false);
    expect(result.current.asksUnit).toBe(true);
    expect(result.current.selectedId).toBe('dxf:P');
    await act(async () => { await result.current.confirm(); });
    expect((confirmPlotOutline.mock.calls[0][1] as PreparedPlotOutlineConfirmation).drawingUnit).toBe('m');
  });

  it('με $INSUNITS: ο άνθρωπος δεν ρωτιέται και η πόρτα δεν παίρνει μονάδα', async () => {
    const { result } = mount();
    await act(async () => { await result.current.loadFile(fileOf('topo.dxf', dxf(6, PLOT))); });
    expect(result.current.asksUnit).toBe(false);
    await act(async () => { await result.current.confirm(); });
    expect((confirmPlotOutline.mock.calls[0][1] as PreparedPlotOutlineConfirmation).drawingUnit).toBeNull();
  });
});

describe('Α — αρνήσεις με όνομα', () => {
  it('DWG ⇒ «dwg», τίποτα να επιβεβαιωθεί', async () => {
    const { result } = mount();
    const dwg = new Uint8Array([0x41, 0x43, 0x31, 0x30, 0x33, 0x32, 0, 0, 0, 0, 0, 0, 0]);
    await act(async () => { await result.current.loadFile(fileOf('topo.dwg', dwg)); });
    expect(result.current.read).toEqual({ kind: 'refused', refusal: 'dwg' });
    expect(result.current.canConfirm).toBe(false);
  });

  it('PDF που ο browser δεν ανοίγει ⇒ «unreadable»', async () => {
    const { result } = mount();
    await act(async () => { await result.current.loadFile(fileOf('topo.pdf', '%PDF-1.7\n')); });
    expect(result.current.read).toEqual({ kind: 'refused', refusal: 'unreadable' });
  });
});

describe('Κ · Ε — κλειδί ανά πρόθεση, έκβαση της πρόθεσης', () => {
  it('ίδια πρόθεση δύο φορές ⇒ ΙΔΙΟ κλειδί· άλλο Π9 ⇒ νέο κλειδί και η παλιά έκβαση σβήνει', async () => {
    const { result } = mount();
    await act(async () => { await result.current.loadFile(fileOf('topo.dxf', dxf(6, PLOT))); });
    await act(async () => { await result.current.confirm(); });
    expect(result.current.submission.kind).toBe('confirmed');
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.confirm(); });
    const key = (n: number) => (confirmPlotOutline.mock.calls[n][1] as PreparedPlotOutlineConfirmation).idempotencyKey;
    expect(key(1)).toBe(key(0));

    act(() => result.current.setShowInListing(true));
    expect(result.current.submission.kind).toBe('idle');
    await act(async () => { await result.current.confirm(); });
    expect(key(2)).not.toBe(key(0));
    expect((confirmPlotOutline.mock.calls[2][1] as PreparedPlotOutlineConfirmation).showInListing).toBe(true);
  });

  it('άρνηση της πόρτας ⇒ «refused» με τον κωδικό της, χωρίς onConfirmed', async () => {
    confirmPlotOutline.mockResolvedValue({ ok: false, refusal: 'TERRAIN_PLOT_OUTLINE_DISJOINT' });
    const { result } = mount();
    await act(async () => { await result.current.loadFile(fileOf('topo.dxf', dxf(6, PLOT))); });
    await act(async () => { await result.current.confirm(); });
    expect(result.current.submission).toEqual({ kind: 'refused', refusal: 'TERRAIN_PLOT_OUTLINE_DISJOINT' });
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});

describe('Δ — αγώνας δρόμου', () => {
  it('δεύτερο αρχείο πριν διαβαστεί το πρώτο ⇒ μετρά ΜΟΝΟ το τελευταίο', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { result } = mount();
    let slow: Promise<void> = Promise.resolve();
    act(() => { slow = result.current.loadFile(fileOf('slow.dxf', dxf(6, TWIN_A), gate)); });
    await act(async () => { await result.current.loadFile(fileOf('fast.dxf', dxf(6, PLOT))); });
    await act(async () => { release(); await slow; });
    await waitFor(() => expect(result.current.file?.name).toBe('fast.dxf'));
    expect(result.current.selectedId).toBe('dxf:P');
  });
});

describe('Κάδος σχεδίου — ο διάλογος ενημερώνει (Revit/Civil 3D/Figma: το παράγωγο μένει)', () => {
  const t = (key: string, options?: Record<string, unknown>) => `${key}${options ? ` ${JSON.stringify(options)}` : ''}`;
  const plotOutline = {
    version: 1, ring: [{ x: 0, y: 0 }, { x: 30000, y: 0 }, { x: 30000, y: 20000 }], showInListing: true, areaM2: 300,
    candidateId: 'dxf:P', origin: { source: 'dxf', handle: 'P', layer: 'ΟΡΙΟ', closure: 'flag' }, drawingUnit: null,
    drawingSha256: 'a'.repeat(64),
  } as const;

  it('σχέδιο με επιβεβαιωμένο περίγραμμα ⇒ διάλογος με προέλευση, ΟΧΙ καταστροφικός', () => {
    const preview = buildPlotDrawingTrashPreview(
      { publicationIdentity: 'terrain/plot-drawing', plotOutline, displayName: 'Τοπογραφικό' }, t,
    );
    expect(preview?.variant).toBe('default');
    expect(preview?.title).toBe('fileMutationPreview.plotDrawing.title');
    expect(preview?.description).toContain('Τοπογραφικό');
    expect(preview?.description).toContain('originDxf');
  });

  it('οποιοδήποτε άλλο αρχείο, ή σχέδιο χωρίς αναγνώσιμο περίγραμμα ⇒ κανένας διάλογος', () => {
    expect(buildPlotDrawingTrashPreview({ publicationIdentity: undefined, plotOutline, displayName: 'x' }, t)).toBeNull();
    expect(buildPlotDrawingTrashPreview({ publicationIdentity: 'terrain/plot-drawing', plotOutline: undefined, displayName: 'x' }, t)).toBeNull();
  });
});
