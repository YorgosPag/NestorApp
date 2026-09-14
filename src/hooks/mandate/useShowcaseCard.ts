'use client';

/**
 * @fileoverview **Η ΚΑΡΤΑ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ, ΑΠΟ ΤΗΝ ΟΘΟΝΗ ΡΥΘΜΙΣΕΩΝ** (ADR-841 §7 Α21.16).
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

import { useCallback, useEffect, useState } from 'react';

import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import type { OwnedShowcaseLocation, ShowcaseCardWire } from '@/types/showcase-card';

export type ShowcaseCardLoad =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading' }
  | { readonly phase: 'loaded'; readonly locations: readonly OwnedShowcaseLocation[]; readonly website: string | null }
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
  readonly error?: string;
  readonly reason?: AgencyProfileRejection;
  readonly locationIndex?: number;
}

/** Η απάντηση της πόρτας → λόγος αποτυχίας — **με όνομα**, ποτέ σκέτο «απέτυχε». */
function failureOf(status: number, body: CardBody | null): ShowcaseCardFailure {
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

async function readBody(response: Response): Promise<CardBody | null> {
  return (await response.json().catch(() => null)) as CardBody | null;
}

export function useShowcaseCard(enabled: boolean): ShowcaseCardApi {
  const [load, setLoad] = useState<ShowcaseCardLoad>({ phase: 'idle' });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ShowcaseCardFailure | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLoad({ phase: 'idle' });
      return;
    }
    let cancelled = false;
    setLoad({ phase: 'loading' });
    void (async () => {
      try {
        const response = await fetch(ENDPOINT);
        const body = await readBody(response);
        if (cancelled) return;
        setLoad(
          response.ok && body?.locations
            ? { phase: 'loaded', locations: body.locations, website: body.website ?? null }
            : { phase: 'failed' },
        );
      } catch {
        if (!cancelled) setLoad({ phase: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const save = useCallback(async (wire: ShowcaseCardWire) => {
    setBusy(true);
    setFailure(null);
    setSaved(false);
    try {
      const response = await fetch(ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wire),
      });
      const body = await readBody(response);
      if (response.ok && body?.locations) {
        setLoad({ phase: 'loaded', locations: body.locations, website: body.website ?? null });
        setSaved(true);
      } else {
        setFailure(failureOf(response.status, body));
      }
    } catch {
      setFailure({ kind: 'failed' });
    } finally {
      setBusy(false);
    }
  }, []);

  return { load, busy, failure, saved, save };
}
