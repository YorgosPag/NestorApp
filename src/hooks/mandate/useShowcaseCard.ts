'use client';

/**
 * @fileoverview **Η ΚΑΡΤΑ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ, ΑΠΟ ΤΗΝ ΟΘΟΝΗ ΡΥΘΜΙΣΕΩΝ** (ADR-841 §7 Α21.16 · Α21.20).
 * @related app/api/agency-profile/card/route.ts · hooks/mandate/useAgencyShowcase.ts
 * @module hooks/mandate/useShowcaseCard
 *
 * 🔴 **ΓΙΑΤΙ ΟΧΙ ΣΥΝΔΡΟΜΗ FIRESTORE, ΟΠΩΣ Η ΒΙΤΡΙΝΑ**: τα κανάλια ζουν σε `deny_all` συλλογή —
 * ούτε ο ιδιοκτήτης τα διαβάζει απευθείας. Άρα **μία** πόρτα (`GET /api/agency-profile/card`),
 * με ταυτότητα από τα claims.
 *
 * ⚠️ **`failed` ≠ «δεν έχεις κάρτα»** (N.12): μια βλάβη που διαβαζόταν ως κενή κάρτα θα έσπρωχνε
 * τον άνθρωπο να τη γράψει από την αρχή — και η αποθήκευση θα **έσβηνε** την αληθινή.
 */

import { useCallback, useState } from 'react';

import { useWorkspaceGet } from '@/hooks/mandate/useWorkspaceGet';

// 🔴 **Μέσω `apiClient`, ποτέ ωμό `fetch`** (ADR-787 §5.3 ζ): μόνο ο client δηλώνει τον χώρο — αλλιώς η κάρτα
//    διαβάζεται/γράφεται στην εταιρεία **του λογαριασμού**, όχι του χώρου που βλέπει ο άνθρωπος.
import { ApiClientError, apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import type { OwnedShowcaseLocation, ShowcaseCardWire, ShowcaseEmailReturn } from '@/types/showcase-card';

export type ShowcaseCardLoad =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'loaded';
      readonly locations: readonly OwnedShowcaseLocation[];
      readonly website: string | null;
      /** Α21.20 — email που επέστρεψαν οριστικά· `null` = δεν μάθαμε. */
      readonly emailReturns: readonly ShowcaseEmailReturn[] | null;
    }
  /** 🔴 Δεν μάθαμε — η φόρμα **κλειδώνει**, δεν δείχνει κενή κάρτα. */
  | { readonly phase: 'failed' };

export type ShowcaseCardFailure =
  | { readonly kind: 'rejected'; readonly reason: AgencyProfileRejection }
  | { readonly kind: 'place-not-found'; readonly locationIndex: number }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'failed' };

export interface ShowcaseCardApi {
  readonly load: ShowcaseCardLoad;
  readonly busy: boolean;
  readonly failure: ShowcaseCardFailure | null;
  readonly saved: boolean;
  readonly save: (wire: ShowcaseCardWire) => Promise<void>;
}

const ENDPOINT = '/api/agency-profile/card' as const;

interface CardBody {
  readonly locations?: readonly OwnedShowcaseLocation[];
  readonly website?: string | null;
  readonly emailReturns?: readonly ShowcaseEmailReturn[] | null;
  readonly error?: string;
  readonly reason?: AgencyProfileRejection;
  readonly locationIndex?: number;
}

/** Η άρνηση της πόρτας → λόγος αποτυχίας — **με όνομα**, ποτέ σκέτο «απέτυχε». Μη-`ApiClientError` = δίκτυο. */
function failureOf(error: unknown): ShowcaseCardFailure {
  const body = apiErrorBodyOf(error) as CardBody | null;
  const status = ApiClientError.isApiClientError(error) ? error.statusCode : null;
  switch (body?.error) {
    case 'INVALID_CARD':
      return body.reason !== undefined ? { kind: 'rejected', reason: body.reason } : { kind: 'failed' };
    case 'PLACE_NOT_FOUND':
      return { kind: 'place-not-found', locationIndex: body.locationIndex ?? 0 };
    case 'PLACE_UNVERIFIED':
      return { kind: 'unavailable' };
    default:
      return status === 503 ? { kind: 'unavailable' } : { kind: 'failed' };
  }
}

/**
 * Σώμα με κάρτα → φορτωμένη κατάσταση, αλλιώς `null`. ⚠️ Απών `emailReturns` ⇒ `null` («δεν μάθαμε»), ποτέ `[]`.
 */
function loadedOf(body: CardBody | null | undefined): ShowcaseCardLoad | null {
  if (!body?.locations) return null;
  return { phase: 'loaded', locations: body.locations, website: body.website ?? null, emailReturns: body.emailReturns ?? null };
}

const FAILED: ShowcaseCardLoad = { phase: 'failed' };

/** Σώμα χωρίς κάρτα ή οποιαδήποτε άρνηση ⇒ `failed` (ποτέ κενή κάρτα). Επίπεδο αρχείου ⇒ σταθερή ταυτότητα. */
const LOAD_INTERPRETER = {
  answered: (body: CardBody | null): ShowcaseCardLoad => loadedOf(body) ?? FAILED,
  refused: (): ShowcaseCardLoad => FAILED,
} as const;

export function useShowcaseCard(enabled: boolean): ShowcaseCardApi {
  // Μία ερώτηση (`retry: false`) μέσω `useWorkspaceGet`· το «δεν μάθαμε» κλειδώνει τη φόρμα.
  const [load, setLoad] = useWorkspaceGet<CardBody, ShowcaseCardLoad>(enabled, ENDPOINT, LOAD_INTERPRETER);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ShowcaseCardFailure | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useCallback(async (wire: ShowcaseCardWire) => {
    setBusy(true);
    setFailure(null);
    setSaved(false);
    try {
      const loaded = loadedOf(await apiClient.put<CardBody>(ENDPOINT, wire));
      if (loaded !== null) {
        setLoad(loaded);
        setSaved(true);
      } else {
        setFailure({ kind: 'failed' });
      }
    } catch (error) {
      setFailure(failureOf(error));
    } finally {
      setBusy(false);
    }
  }, []);

  return { load, busy, failure, saved, save };
}
