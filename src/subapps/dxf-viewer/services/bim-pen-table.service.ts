'use client';

/**
 * ADR-375 Phase C.1 — BIM Pen Table Service.
 *
 * Persists per-company pen table overrides to
 * `dxf_viewer_pen_tables/{companyId}` (singleton doc per company).
 *
 * Only changed cells are stored (sparse). Absent cells fall back to
 * `PEN_TABLE_MM` defaults via `buildEffectivePenTable`.
 */
import {
  doc,
  getDoc,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { nowISO } from '@/lib/date-local';
import type { PenTableOverrides } from '../config/bim-pen-table-types';

export interface PenTableDoc {
  companyId: string;
  overrides: PenTableOverrides;
  activePresetName: string;
  updatedAt: string;
}

function penTableRef(companyId: string) {
  return doc(db, COLLECTIONS.DXF_VIEWER_PEN_TABLES, companyId);
}

/** One-shot read — returns null if no overrides saved yet. */
export async function loadPenTableOverridesOnce(
  companyId: string,
): Promise<PenTableOverrides | null> {
  const snap = await getDoc(penTableRef(companyId));
  if (!snap.exists()) return null;
  return (snap.data() as PenTableDoc).overrides ?? null;
}

/**
 * Persist overrides + active preset name for the given company.
 * Pass empty object to clear all overrides (preserves doc existence).
 */
export async function savePenTableOverrides(
  companyId: string,
  overrides: PenTableOverrides,
  activePresetName = 'construction',
): Promise<void> {
  await setDoc(penTableRef(companyId), {
    companyId,
    overrides,
    activePresetName,
    updatedAt: nowISO(),
  });
}

export interface PenTableSnapshot {
  overrides: PenTableOverrides | null;
  activePresetName: string | null;
}

/** Real-time listener — fires immediately with current value, then on changes. */
export function subscribePenTableOverrides(
  companyId: string,
  onChange: (snapshot: PenTableSnapshot) => void,
): Unsubscribe {
  return firestoreQueryService.subscribeDoc<PenTableDoc>(
    'DXF_VIEWER_PEN_TABLES',
    companyId,
    (document) => {
      if (!document) {
        onChange({ overrides: null, activePresetName: null });
        return;
      }
      onChange({
        overrides: document.overrides ?? null,
        activePresetName: document.activePresetName ?? null,
      });
    },
    (error) => {
      // eslint-disable-next-line no-console
      console.error('[bim-pen-table] subscribe error', error);
      onChange({ overrides: null, activePresetName: null });
    },
  );
}
