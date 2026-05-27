/**
 * BimPersistenceStateStore — single source of truth για το persistence result
 * των BIM entities που έχουν δύο mount sites (Host always-on + Sidebar
 * PropertiesTab per-selection).
 *
 * Πρόβλημα: το `use*Persistence` hook έχει internal side-effects (Firestore
 * subscribe, debounced auto-save, soft-lock acquire/release, EventBus listener
 * για `drawing:entity-created` / `bim:entity-restore-requested`). Όταν τρέχει
 * σε 2 instances παράλληλα παράγονται:
 *   • διπλά writes στο Firestore (idempotent setDoc same-id, αλλά τα audit
 *     events ΔΕΝ είναι idempotent — βλέπε ADR-380 carryover 2026-05-27 όπου
 *     ίδιο stair έγραψε 2× 'created' + 2× 'deleted' στο `entity_audit_trail`)
 *   • διπλά soft-lock acquire/release calls
 *   • διπλά Firestore subscriptions (2 listeners ίδιο collection)
 *
 * Fix: το hook τρέχει μόνο στο always-on Host (single instance). Ο Host
 * γράφει το persistence result στο store. Το per-selection PropertiesTab
 * διαβάζει από το store αντί να καλεί ξανά το hook.
 *
 * Scope: μόνο τα entities που έχουν dedicated `*PropertiesTab` (Wall + Stair
 * το 2026-05-27). Αν προστεθεί νέο PropertiesTab για άλλο BIM entity, ο
 * αντίστοιχος Host πρέπει να γράφει εδώ και το Tab να διαβάζει.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 * @see docs/centralized-systems/reference/adrs/ADR-380-stair-slab-opening-audit-coverage.md
 */

'use client';

import { create } from 'zustand';

import type { UseWallPersistenceResult } from '../../hooks/data/useWallPersistence';
import type { UseStairPersistenceResult } from '../hooks/use-stair-persistence';

interface BimPersistenceStateStore {
  readonly wall: UseWallPersistenceResult | null;
  readonly stair: UseStairPersistenceResult | null;
  readonly setWall: (value: UseWallPersistenceResult | null) => void;
  readonly setStair: (value: UseStairPersistenceResult | null) => void;
}

export const useBimPersistenceStateStore = create<BimPersistenceStateStore>((set) => ({
  wall: null,
  stair: null,
  setWall: (wall) => set({ wall }),
  setStair: (stair) => set({ stair }),
}));
