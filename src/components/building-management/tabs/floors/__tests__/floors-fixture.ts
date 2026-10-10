/**
 * Κοινή κατάσταση δοκιμής για τις δύο όψεις των ορόφων (ADR-912 §5) — ένα κτίριο με θεμελίωση, δύο ορόφους
 * και έναν όροφο **χωρίς ύψος** (ADR-910 §3.2), ώστε πίνακας και λίστα να δοκιμάζονται στα ίδια δεδομένα.
 */

import type { Building } from '@/types/building/contracts';

import type { FloorRecord } from '../../useFloorsTabState.types';
import type { FloorsTabState } from '../floor-row-model';

export const FIXTURE_FLOORS: FloorRecord[] = [
  { id: 'f-found', number: -1, name: 'Θεμελίωση', elevation: -4.2, height: 1.2, buildingId: 'b1', kind: 'foundation', hasFloorplan: true },
  { id: 'f-0', number: 0, name: 'Ισόγειο', elevation: 0, height: 9.99, buildingId: 'b1', units: 2, hasFloorplan: false },
  { id: 'f-1', number: 1, name: '1ος Όροφος', elevation: 3, height: 2.8, buildingId: 'b1', units: 4, hasFloorplan: true },
  { id: 'f-2', number: 2, name: '2ος Όροφος', elevation: 3, height: 3.4, buildingId: 'b1', hasFloorplan: true },
];

export const FIXTURE_BUILDING = { id: 'b1', projectId: 'p1', companyId: 'c1', name: 'ΔΟΡΚΑΣ' } as unknown as Building;

export function makeFloorsState(overrides: Partial<FloorsTabState> = {}): FloorsTabState {
  const base = {
    floors: FIXTURE_FLOORS,
    expandedFloorId: null,
    editingId: null,
    highlightedFloorId: null,
    deletingId: null,
    saving: false,
    editNumber: '0',
    editName: 'Ισόγειο',
    editElevation: '0',
    editHeight: '3.00',
    editNameMismatch: false,
    // Οι ενδιάμεσοι όροφοι έχουν παράγωγο ύψος· ο τελευταίος και η θεμελίωση ρητό (ADR-451 / ADR-461).
    heightDerivedFloorIds: new Set(['f-0', 'f-1']),
    // Ο 1ος έχει το ίδιο υψόμετρο με τον 2ο ⇒ δεν έχει ύψος.
    tooLowFloorIds: new Set(['f-1']),
    expandedFloorStairs: [],
    loadingStairs: false,
    formatElevation: (elevation: number | null | undefined) => (elevation == null ? '—' : `@${elevation.toFixed(2)}`),
    toggleFloorExpand: jest.fn(),
    registerFloorRowRef: jest.fn(),
    startEdit: jest.fn(),
    cancelEdit: jest.fn(),
    handleSaveEdit: jest.fn(),
    handleDelete: jest.fn(),
    handleEditNumberChange: jest.fn(),
    handleEditNameChange: jest.fn(),
    handleEditElevationChange: jest.fn(),
    handleEditHeightChange: jest.fn(),
  };
  return { ...base, ...overrides } as unknown as FloorsTabState;
}
