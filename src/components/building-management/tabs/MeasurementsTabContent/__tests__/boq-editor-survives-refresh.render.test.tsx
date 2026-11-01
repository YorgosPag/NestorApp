/**
 * 🔴 Ο επεξεργαστής αντέχει την ανανέωση της λίστας (ADR-923 §5.12, ζωντανό εύρημα βήματος 8).
 *
 * Μετρημένο στην παραγωγή: «Εφαρμογή στη γραμμή» → η ανανέωση σήκωνε `loading` → ο επεξεργαστής ξαναγεννιόταν από το αντίγραφο του κλικ →
 * «Αποθήκευση» έγραφε 0 και έκοβε τον δεσμό. Τιμή 1.050 € έγινε 0 €, χωρίς μήνυμα. Εδώ εκτελείται η πραγματική ροή του `useBOQItems`.
 */

import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';

const mockGetByBuilding = jest.fn();
jest.mock('@/services/measurements', () => ({
  boqService: { getByBuilding: (...args: unknown[]) => mockGetByBuilding(...args) },
  computeBuildingSummary: () => ({}),
  derivedSummaryCosts: () => new Map(),
}));
jest.mock('@/services/measurements/boq-mutation-gateway', () => ({
  createBOQItemWithPolicy: jest.fn(),
  deleteBOQItemWithPolicy: jest.fn(),
  transitionBOQItemWithPolicy: jest.fn(),
  updateBOQItemWithPolicy: jest.fn(),
}));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'user_1' } }) }));
jest.mock('@/hooks/useCompanyId', () => ({ useCompanyId: () => ({ companyId: 'comp_b' }) }));
jest.mock('@/hooks/useIconSizes', () => ({ useIconSizes: () => ({ sm: 'sm' }) }));
jest.mock('@/hooks/useConfirmDialog', () => ({ useConfirmDialog: () => ({ confirm: jest.fn(), dialogProps: {} }) }));
jest.mock('@/hooks/useFullscreen', () => ({ useFullscreen: () => ({ isFullscreen: false, toggle: jest.fn() }) }));
jest.mock('@/lib/workspace/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/navigation/procurement-urls', () => ({ getNewRfqUrl: () => '/rfq' }));
jest.mock('@/ui-adapters/react/useSemanticColors', () => ({ useSemanticColors: () => ({ text: { muted: 'muted', error: 'error' } }) }));
jest.mock('@/lib/design-system', () => ({}));
jest.mock('@/components/ui/button', () => ({ Button: () => null }));
jest.mock('@/components/ui/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
jest.mock('@/components/ui/spinner', () => ({ Spinner: () => <output data-testid="spinner" /> }));
jest.mock('@/core/containers/FullscreenOverlay', () => ({
  FullscreenOverlay: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  FullscreenToggleButton: () => null,
}));

jest.mock('../BOQSummaryCards', () => ({ BOQSummaryCards: () => null }));
jest.mock('../BOQCoverageIndicator', () => ({ BOQCoverageIndicator: () => null }));
jest.mock('../BOQPriceReviewPanel', () => ({ BOQPriceReviewPanel: () => null }));
jest.mock('../BOQFilterBar', () => ({ BOQFilterBar: () => null }));

interface RowProps { readonly filteredItems?: unknown; readonly items?: readonly { readonly id: string }[]; readonly onEdit: (item: unknown) => void }
jest.mock('../BOQCategoryAccordion', () => ({
  getFloorGroupKeys: () => [],
  BOQCategoryAccordion: ({ items, onEdit }: RowProps) => <button type="button" onClick={() => onEdit(items?.[0])}>edit</button>,
}));

const mockPanelMounted = jest.fn();
jest.mock('../BOQSupplierPriceReviewPanel', () => {
  const { useEffect } = jest.requireActual<typeof React>('react');
  return { BOQSupplierPriceReviewPanel: ({ onApplied }: { onApplied: () => Promise<void> }) => {
    useEffect(() => { mockPanelMounted(); }, []);
    return <button type="button" onClick={() => void onApplied()}>panel-refresh</button>;
  } };
});

const mockEditorMounted = jest.fn();
interface EditorProps { readonly item: { readonly materialUnitCost: number } | null; readonly open: boolean; readonly onPriceApplied?: () => Promise<void> }
jest.mock('../BOQItemEditor', () => {
  const { useEffect } = jest.requireActual<typeof React>('react');
  return { BOQItemEditor: ({ item, open, onPriceApplied }: EditorProps) => {
    useEffect(() => { mockEditorMounted(); }, []);
    return open ? <aside><output data-testid="live">{String(item?.materialUnitCost)}</output><button type="button" onClick={() => void onPriceApplied?.()}>applied</button></aside> : null;
  } };
});

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι οθόνες */
import type { Building } from '@/types/building/contracts';
import type { BOQItem } from '@/types/boq';
import { useBOQItems } from '@/hooks/useBOQItems';
import { MeasurementsTabContent } from '../../MeasurementsTabContent';
import { liveEditedItem } from '../useBOQEditorState';
/* eslint-enable import/first */

const line = (materialUnitCost: number) => ({ id: 'boq_1', materialUnitCost }) as unknown as BOQItem;
const building = (id: string) => ({ id, projectId: 'proj_1' }) as unknown as Building;

/** Κάθε σουίτα σε δικό της κτίριο: η μνήμη `boqItemsCache` ζει όσο το module. */
async function openEditor(buildingId: string) {
  mockGetByBuilding.mockResolvedValue([line(0)]);
  render(<MeasurementsTabContent building={building(buildingId)} />);
  fireEvent.click(await screen.findByRole('button', { name: 'edit' }));
  mockEditorMounted.mockClear();
  mockPanelMounted.mockClear();
}

beforeEach(() => mockGetByBuilding.mockReset());

describe('η ανανέωση της λίστας', () => {
  it('🔴 ο επεξεργαστής μένει ανοιχτός, δεν ξαναγεννιέται, και βλέπει τη νέα τιμή', async () => {
    await openEditor('bldg_editor');
    let answer: (rows: BOQItem[]) => void = () => undefined;
    mockGetByBuilding.mockReturnValue(new Promise<BOQItem[]>((resolve) => { answer = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'applied' }));
    expect(screen.queryByTestId('spinner')).toBeNull();
    await act(async () => { answer([line(100)]); });
    await waitFor(() => expect(screen.getByTestId('live').textContent).toBe('100'));
    // Η φόρμα γεμίζει στο mount: χωρίς νέο mount, κρατά το στιγμιότυπο που της έδωσε η εφαρμογή.
    expect(mockEditorMounted).not.toHaveBeenCalled();
  });

  it('🔴 το μαζικό πάνελ δεν χάνει την κατάστασή του στη μέση της ροής', async () => {
    await openEditor('bldg_panel');
    mockGetByBuilding.mockResolvedValue([line(100)]);
    fireEvent.click(screen.getByRole('button', { name: 'panel-refresh' }));
    await waitFor(() => expect(screen.getByTestId('live').textContent).toBe('100'));
    expect(mockPanelMounted).not.toHaveBeenCalled();
  });
});

describe('useBOQItems', () => {
  it('🔴 το πρώτο φόρτωμα δείχνει `loading`, η ανανέωση ποτέ', async () => {
    mockGetByBuilding.mockResolvedValue([line(0)]);
    const { result } = renderHook(() => useBOQItems('bldg_hook', 'proj_1', 'comp_b', 'user_1'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    let answer: (rows: BOQItem[]) => void = () => undefined;
    mockGetByBuilding.mockReturnValue(new Promise<BOQItem[]>((resolve) => { answer = resolve; }));
    let done: Promise<void> = Promise.resolve();
    act(() => { done = result.current.refreshItems(); });
    expect(result.current.loading).toBe(false);
    await act(async () => { answer([line(100)]); await done; });
    expect(result.current.items[0]?.materialUnitCost).toBe(100);
  });
});

describe('liveEditedItem', () => {
  it('η λίστα νικά το αντίγραφο του κλικ, και βρίσκει την ΙΔΙΑ γραμμή', () => {
    const other = { id: 'boq_0', materialUnitCost: 5 } as unknown as BOQItem;
    expect(liveEditedItem([other, line(100)], line(0))?.materialUnitCost).toBe(100);
  });

  it('γραμμή που έφυγε από τη λίστα: μένει το αντίγραφο, η φόρμα δεν γίνεται «νέα γραμμή»', () => {
    expect(liveEditedItem([], line(7))?.materialUnitCost).toBe(7);
  });

  it('κανένα αντίγραφο ⇒ νέα γραμμή, ακόμη κι αν η λίστα έχει στοιχεία', () => {
    expect(liveEditedItem([line(100)], null)).toBeNull();
  });
});
