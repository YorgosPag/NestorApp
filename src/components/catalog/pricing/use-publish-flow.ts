'use client';

/**
 * @fileoverview **Ο οδηγός της μηχανής δημοσίευσης** — κάθε κατάσταση με δίκτυο εκτελεί το βήμα της **μία** φορά
 *   (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related publish-flow.ts (η καθαρή μηχανή — όλη η κρίση ζει εκεί) · PublishVersionDialog.tsx (η οθόνη)
 * @module components/catalog/pricing/use-publish-flow
 *
 * 🔑 **Ένα βήμα ανά κατάσταση, ποτέ δύο**: το StrictMode τρέχει το effect δύο φορές στο dev — μια δεύτερη δημοσίευση θα
 *    απαντούσε 409 και θα έκρυβε την επιτυχία της πρώτης. Ο φύλακας είναι η **ταυτότητα** της κατάστασης (`startedFor`).
 * 🔑 Αργή απάντηση μετά το κλείσιμο ⇒ αγνοείται (`mounted`)· αργή απάντηση **παλιού** βήματος ⇒ την αγνοεί η μηχανή
 *    (γεγονός εκτός σειράς).
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { useMountedRef } from '@/hooks/useMountedRef';
import { catalogFailureOf } from '@/services/catalog/catalog-failure';
import { previewPublication, publishVersion, setVersionValidFrom } from '@/services/catalog/catalog-pricing-api.client';
import { judgeVersionPublication } from '@/subapps/catalog/pricing/version-timeline';
import type { PriceListVersionWire } from '@/subapps/catalog/types/pricing-views';
import { publishFlowReducer, publishRequestOf, startPublishFlow, type PublishEvent, type PublishFlow } from './publish-flow';

export interface PublishFlowInput {
  readonly version: PriceListVersionWire;
  /** Όλες οι εκδόσεις της λίστας (η κρίση της ημερομηνίας θέλει τη χρονογραμμή). */
  readonly versions: readonly PriceListVersionWire[];
  /** Η όψη άλλαξε από αυτή την οθόνη (ημερομηνία · δημοσίευση) — ανανέωση στο παρασκήνιο. */
  readonly onChanged: () => void;
}

/** Το δικτυακό βήμα μιας κατάστασης — `null` για καταστάσεις που περιμένουν τον άνθρωπο. */
function stepOf(flow: PublishFlow, versionId: string, validFrom: string | null): (() => Promise<PublishEvent>) | null {
  if (flow.step === 'saving') {
    return async () => ({ type: 'saved', revision: (await setVersionValidFrom(versionId, flow.revision, validFrom)).revision });
  }
  if (flow.step === 'previewing') return async () => ({ type: 'previewLoaded', preview: await previewPublication(versionId) });
  const request = publishRequestOf(flow);
  if (request === null) return null;
  return async () => { await publishVersion(versionId, request); return { type: 'published' }; };
}

function useFlowDriver(flow: PublishFlow, dispatch: (event: PublishEvent) => void, versionId: string, validFrom: string | null, onChanged: () => void) {
  const mounted = useMountedRef();
  const startedFor = useRef<PublishFlow | null>(null);
  useEffect(() => {
    const step = stepOf(flow, versionId, validFrom);
    if (step === null || startedFor.current === flow) return;
    startedFor.current = flow;
    step().then(
      (event) => {
        if (!mounted.current) return;
        dispatch(event);
        if (event.type === 'saved' || event.type === 'published') onChanged();
      },
      (cause: unknown) => { if (mounted.current) dispatch({ type: 'failed', failure: catalogFailureOf(cause) }); },
    );
  }, [flow, versionId, validFrom, dispatch, mounted, onChanged]);
}

export function usePublishFlow({ version, versions, onChanged }: PublishFlowInput) {
  const [flow, dispatch] = useReducer(publishFlowReducer, version.revision, startPublishFlow);
  const [validFrom, setValidFrom] = useState<string | null>(version.validFrom);
  useFlowDriver(flow, dispatch, version.id, validFrom, onChanged);

  /** Η ημερομηνία κρίνεται **στον πελάτη** με την ΙΔΙΑ κρίση με τον γραφέα — γνωστή άρνηση δεν στέλνεται. */
  const judged = useMemo(
    () => judgeVersionPublication({ id: version.id, number: version.number, status: version.status, validFrom }, versions),
    [version, versions, validFrom],
  );
  const schedule = useCallback(() => {
    dispatch({ type: 'schedule', issue: judged, needsSave: validFrom !== version.validFrom });
  }, [judged, validFrom, version.validFrom]);
  // Το εύρημα φαίνεται μόνο αφού ο άνθρωπος ΠΡΟΣΠΑΘΗΣΕ (`flow.issue`), αλλά λέει την κρίση της **τρέχουσας** ημερομηνίας —
  // όχι το στιγμιότυπο του κλικ: αλλιώς μετά την επιλογή ημέρας έμενε «Ορίστε από πότε ισχύει» (Σ3, ζωντανά).
  const issue = flow.step === 'schedule' && flow.issue !== null ? judged : null;

  /** Νέα αρχή πάνω στη **ζωντανή** έκδοση (η όψη έχει ήδη ανανεωθεί από το σήμα). */
  const restart = useCallback((notice: 'changedMeanwhile' | null) => {
    setValidFrom(version.validFrom);
    dispatch({ type: 'restart', revision: version.revision, notice });
  }, [version]);

  return { flow, dispatch, validFrom, setValidFrom, issue, schedule, restart };
}
