'use client';

/**
 * ADR-655 — «Ποια asset packs δικαιούμαι;» Ο client ΔΕΝ το αποφασίζει· ρωτά τον server.
 *
 * Μία κλήση ανά session (module-level cache + in-flight de-dup): κάθε παλέτα που ανοίγει
 * ξαναχρησιμοποιεί το ίδιο Promise. Η απάντηση καθορίζει ΜΟΝΟ τι βλέπει το UI.
 *
 * ⚠️ ΑΥΤΟ ΔΕΝ ΕΙΝΑΙ Η ΑΣΦΑΛΕΙΑ — είναι η **ευγένεια**. Η πραγματική πύλη ζει στον proxy
 * (`/api/asset-packs/...`), που μπλοκάρει τα bytes ανεξάρτητα από το τι νομίζει ο client.
 * Ένας χρήστης που πειράξει το state του browser κερδίζει μια άδεια κάρτα, τίποτε άλλο.
 * Belt-and-suspenders (N.7.2 §4): το UI κρύβει, ο server επιβάλλει.
 *
 * @see src/app/api/asset-packs/route.ts — το endpoint
 * @see @/lib/asset-packs/asset-pack-guard.server — η πραγματική απόφαση
 */

import { useEffect, useState } from 'react';
import { ASSET_PACK_API_ROOT, type AssetPackId } from '@/lib/asset-packs/asset-pack-registry';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('asset-packs');

interface AccessiblePackDto {
  readonly id: AssetPackId;
}

/** Ένα Promise για όλη τη session — δεύτερη παλέτα δεν ξαναρωτά. */
let accessiblePacksPromise: Promise<ReadonlySet<string>> | null = null;

async function fetchAccessiblePacks(): Promise<ReadonlySet<string>> {
  try {
    // `credentials: 'include'` ⇒ ταξιδεύει το `__session` cookie (same-origin).
    const response = await fetch(ASSET_PACK_API_ROOT, { credentials: 'include' });
    if (!response.ok) return new Set();

    const payload: unknown = await response.json();
    const packs = (payload as { data?: { packs?: readonly AccessiblePackDto[] } })?.data?.packs;
    if (!Array.isArray(packs)) return new Set();

    return new Set(packs.map((pack) => pack.id));
  } catch (error) {
    // Fail-closed: αδυναμία επικοινωνίας ⇒ κανένα pack (ποτέ σιωπηλό ξεκλείδωμα).
    logger.warn('[asset-packs] αδυναμία ανάκτησης δικαιωμάτων — καμία βιβλιοθήκη δεν ξεκλειδώνει', {
      error,
    });
    return new Set();
  }
}

function loadAccessiblePacks(): Promise<ReadonlySet<string>> {
  accessiblePacksPromise ??= fetchAccessiblePacks();
  return accessiblePacksPromise;
}

export interface AssetPackAccessState {
  /** `true` όσο δεν έχει απαντήσει ο server (το UI δείχνει skeleton, όχι «κλειδωμένο»). */
  readonly loading: boolean;
  /** `true` μόνο όταν ο server επιβεβαίωσε πρόσβαση. */
  readonly accessible: boolean;
}

/** Έχει ο τρέχων χρήστης πρόσβαση σε αυτό το pack; */
export function useAssetPackAccess(packId: AssetPackId): AssetPackAccessState {
  const [state, setState] = useState<AssetPackAccessState>({ loading: true, accessible: false });

  useEffect(() => {
    let cancelled = false;
    void loadAccessiblePacks().then((packs) => {
      if (cancelled) return;
      setState({ loading: false, accessible: packs.has(packId) });
    });
    return () => {
      cancelled = true;
    };
  }, [packId]);

  return state;
}

/** Test-only: καθαρίζει το session cache. */
export function __resetAssetPackAccessForTests(): void {
  accessiblePacksPromise = null;
}
