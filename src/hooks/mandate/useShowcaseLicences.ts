'use client';

/**
 * @fileoverview **Η αποθήκευση των αδειών της βιτρίνας** — `PUT /api/agency-profile/licences` (ADR-915 §21).
 * @related app/api/agency-profile/licences/route.ts · hooks/mandate/useShowcaseCard.ts (το ίδιο ιδίωμα)
 * @module hooks/mandate/useShowcaseLicences
 *
 * 🔑 **Καμία ανάγνωση εδώ**: οι άδειες είναι δημόσιες μέσα στη βιτρίνα, που η σελίδα ήδη διαβάζει ζωντανά
 *    (`useAgencyShowcase`) — μετά την αποθήκευση το ίδιο έγγραφο ξαναφτάνει, χωρίς δεύτερη πηγή αλήθειας.
 */

import { useCallback, useState } from 'react';

import type { ShowcaseLicencesWire } from '@/lib/agency/showcase-wire';
import type { ShowcaseLicenceRejection } from '@/lib/agency/showcase-licence';

export type ShowcaseLicencesFailure =
  | { readonly kind: 'rejected'; readonly reason: ShowcaseLicenceRejection }
  | { readonly kind: 'failed' };

export interface ShowcaseLicencesApi {
  readonly busy: boolean;
  readonly failure: ShowcaseLicencesFailure | null;
  readonly saved: boolean;
  readonly save: (wire: ShowcaseLicencesWire) => Promise<void>;
}

const ENDPOINT = '/api/agency-profile/licences' as const;

interface LicencesBody {
  readonly error?: string;
  readonly reason?: ShowcaseLicenceRejection;
}

/** Η απάντηση της πόρτας → λόγος αποτυχίας — **με όνομα**, ποτέ σκέτο «απέτυχε». */
function failureOf(body: LicencesBody | null): ShowcaseLicencesFailure {
  return body?.error === 'INVALID_LICENCES' && body.reason !== undefined
    ? { kind: 'rejected', reason: body.reason }
    : { kind: 'failed' };
}

export function useShowcaseLicences(): ShowcaseLicencesApi {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ShowcaseLicencesFailure | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useCallback(async (wire: ShowcaseLicencesWire) => {
    setBusy(true);
    setFailure(null);
    setSaved(false);
    try {
      const response = await fetch(ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wire),
      });
      if (response.ok) {
        setSaved(true);
      } else {
        setFailure(failureOf((await response.json().catch(() => null)) as LicencesBody | null));
      }
    } catch {
      setFailure({ kind: 'failed' });
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, failure, saved, save };
}
