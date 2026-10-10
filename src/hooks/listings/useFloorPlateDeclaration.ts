'use client';

/**
 * @fileoverview **Η ΔΗΛΩΣΗ ΚΑΤΟΨΗΣ ΟΡΟΦΟΥ, ΑΠΟ ΤΗΝ ΟΘΟΝΗ ΤΟΥ ΧΩΡΟΥ** — ανάγνωση · υπογραφή · άρση (ADR-907 §11.10).
 * @related app/api/floors/[floorId]/floor-plate/route (η ΜΙΑ πόρτα) · lib/listings/floor-plate/floor-plate-refusal ·
 *   hooks/listings/usePublishedMediaAgreement (το ίδιο ιδίωμα)
 * @module hooks/listings/useFloorPlateDeclaration
 *
 * ⛔ **ΚΑΜΙΑ ΚΡΙΣΗ ΕΔΩ.** «Υπάρχει δήλωση;», «μπορώ να υπογράψω;», «βγαίνει ο όροφος στο κοινό;» τα απαντά ο
 * διακομιστής. Αυτό το hook είναι **μεταφορά δεδομένων**: ρωτά, δίνει, και κρατά την τελευταία απάντηση.
 *
 * ⚠️ **Δεν πετά ποτέ.** Ανάγνωση που απέτυχε ⇒ `status: null` (η οθόνη σιωπά). Πράξη που απέτυχε ⇒ `failure`:
 * είτε **ονομασμένη άρνηση** της κρίσης (ο άνθρωπος μαθαίνει τι να διορθώσει), είτε σκέτο «απέτυχε».
 */

import * as React from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { apiErrorBodyOf } from '@/lib/api/api-client-types';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  FloorPlateDeclarationStanding,
  FloorPlateDeclarationStatus,
} from '@/lib/listings/floor-plate/floor-plate-declaration';
import { readFloorPlateRefusal, type FloorPlateRefusalNotice } from '@/lib/listings/floor-plate/floor-plate-refusal';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFloorPlateDeclaration');

/** Γιατί η πράξη δεν έγινε — `refused` κουβαλά **τι να διορθωθεί**, `failed` όχι. */
export type FloorPlateDoorFailure =
  | { readonly kind: 'refused'; readonly notice: FloorPlateRefusalNotice }
  | { readonly kind: 'failed' };

export interface FloorPlateDeclarationDoor {
  /** `null` όσο ο διακομιστής δεν έχει απαντήσει (ή δεν απάντησε) — η οθόνη **σιωπά**, δεν μαντεύει. */
  readonly status: FloorPlateDeclarationStatus | null;
  readonly busy: boolean;
  /** Η έκβαση της **τελευταίας** πράξης, όταν δεν πέτυχε. Σβήνει στην επόμενη. */
  readonly failure: FloorPlateDoorFailure | null;
  /** Πόσες αγγελίες του ορόφου ξαναπροβλήθηκαν από την τελευταία επιτυχή πράξη· `null` πριν από κάθε πράξη. */
  readonly refreshedListings: number | null;
  readonly declare: (fileId: string) => void;
  readonly withdraw: () => void;
}

type State = Pick<FloorPlateDeclarationDoor, 'status' | 'busy' | 'failure' | 'refreshedListings'>;

const IDLE: State = { status: null, busy: false, failure: null, refreshedListings: null };

/** Ό,τι διαβάζει η οθόνη από την απάντηση μιας πράξης — η δήλωση που ισχύει, και πόσες αγγελίες άγγιξε. */
type ActedAnswer = FloorPlateDeclarationStanding & { readonly listings?: readonly unknown[] };

type ActOutcome =
  | { readonly ok: true; readonly answer: ActedAnswer }
  | { readonly ok: false; readonly failure: FloorPlateDoorFailure };

async function readStatus(floorId: string): Promise<FloorPlateDeclarationStatus | null> {
  try {
    return await apiClient.get<FloorPlateDeclarationStatus>(API_ROUTES.FLOORS.FLOOR_PLATE(floorId));
  } catch (error) {
    logger.warn('Η δήλωση κάτοψης ορόφου δεν διαβάστηκε — η οθόνη σιωπά', {
      floorId, error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** `fileId` ⇒ υπογραφή (`POST`)· `null` ⇒ άρση (`DELETE`). Η ίδια πόρτα, η ίδια ανάγνωση της έκβασης. */
async function act(floorId: string, fileId: string | null): Promise<ActOutcome> {
  const route = API_ROUTES.FLOORS.FLOOR_PLATE(floorId);
  try {
    const answer = fileId === null
      ? await apiClient.delete<ActedAnswer>(route)
      : await apiClient.post<ActedAnswer>(route, { fileId });
    return { ok: true, answer };
  } catch (error) {
    const notice = readFloorPlateRefusal(apiErrorBodyOf(error));
    if (notice !== null) return { ok: false, failure: { kind: 'refused', notice } };

    logger.warn('Η πράξη στη δήλωση κάτοψης ορόφου απέτυχε', {
      floorId, withdraw: fileId === null, error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, failure: { kind: 'failed' } };
  }
}

function settled(previous: State, outcome: ActOutcome): State {
  if (!outcome.ok) return { ...previous, busy: false, failure: outcome.failure };

  const { declaration, listings } = outcome.answer;
  return {
    // 🔑 Το `mayDeclare` δεν ξαναρωτιέται: όποιος μόλις έγραψε, μπορούσε.
    status: previous.status === null ? null : { ...previous.status, declaration: declaration ?? null },
    busy: false,
    failure: null,
    refreshedListings: listings?.length ?? 0,
  };
}

export function useFloorPlateDeclaration(floorId: string | null | undefined): FloorPlateDeclarationDoor {
  const [state, setState] = React.useState<State>(IDLE);
  // ⚠️ **Ακύρωση, όχι μόνο καθαρισμός**: αργοπορημένη απάντηση **άλλου** ορόφου δεν γράφεται πάνω στον τρέχοντα.
  const epoch = React.useRef(0);

  React.useEffect(() => {
    epoch.current += 1;
    const mine = epoch.current;
    setState(IDLE);
    if (!floorId) return;

    void readStatus(floorId).then((status) => {
      if (mine === epoch.current) setState({ ...IDLE, status });
    });
  }, [floorId]);

  const run = React.useCallback((fileId: string | null) => {
    if (!floorId) return;
    const mine = epoch.current;
    setState((previous) => ({ ...previous, busy: true, failure: null, refreshedListings: null }));

    void act(floorId, fileId).then((outcome) => {
      if (mine === epoch.current) setState((previous) => settled(previous, outcome));
    });
  }, [floorId]);

  const declare = React.useCallback((fileId: string) => run(fileId), [run]);
  const withdraw = React.useCallback(() => run(null), [run]);

  return { ...state, declare, withdraw };
}
