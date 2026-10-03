'use client';

/**
 * @fileoverview **Η ΕΠΑΛΗΘΕΥΣΗ ΚΑΤΟΧΗΣ ΑΠΟ ΤΗΝ ΟΘΟΝΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** — κατάσταση + «ανέβασε το ΠΚΑ σου».
 * @related ADR-900 §3.8 · app/api/owner-properties/[ownerPropertyId]/ownership-verification ·
 *   hooks/owner-property/useOwnerPropertyDossierFiles (ο ίδιος αγωγός ανεβάσματος)
 * @module hooks/owner-property/useOwnershipVerification
 *
 * 🔑 **Ένα κουμπί, δύο βήματα, μία πράξη για τον άνθρωπο** (σχήμα Zillow «Claim»): το ΠΚΑ ανεβαίνει στον
 * **φάκελο** του ακινήτου, στη θέση «Κτηματογράφηση» (`study-admin-cadastre` — το ΠΚΑ **είναι** πιστοποιητικό
 * κτηματογράφησης, όχι νέο είδος εγγράφου), από τον **κανονικό** αγωγό (`uploadEntityFile`), και αμέσως
 * υποβάλλεται για επαλήθευση. Το έγγραφο μένει στον φάκελο όπου ζει κάθε τίτλος.
 *
 * ⚠️ Η υποβολή περνά από τον `apiClient` (Idempotency-Key, CHECK 3.92): επανάληψη σε δίκτυο κινητού
 * **δεν** γεννά δεύτερη επαλήθευση.
 */

import { useCallback, useEffect, useState } from 'react';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import { createModuleLogger } from '@/lib/telemetry';
import { validateCustodyUploadAuth } from '@/services/filesystem/file-mutation-gateway';
import { uploadEntityFile } from '@/services/filesystem/upload-entity-file';
import type { OwnershipVerificationView } from '@/types/ownership-verification';
import { submitErrorCodeOf, type SubmitErrorCode } from '@/components/owner-property/ownership-verification-labels';

const logger = createModuleLogger('useOwnershipVerification');

/** Η θέση του φακέλου όπου ζει το ΠΚΑ — η **ίδια** ταυτότητα με τον κατάλογο (`entries-studies.ts`). */
const CADASTRE_SLOT = { domain: 'admin', category: 'documents', purpose: 'study-cadastre' } as const;

export type OwnershipVerificationState =
  | { readonly state: 'loading' }
  | { readonly state: 'unavailable' }
  | { readonly state: 'ready'; readonly verification: OwnershipVerificationView | null };

export type OwnershipSubmitState =
  | { readonly state: 'idle' }
  | { readonly state: 'submitting' }
  /** Κλειστός κωδικός άρνησης του διακομιστή (π.χ. `identity-incomplete`) ή `UNAVAILABLE`. */
  | { readonly state: 'failed'; readonly code: SubmitErrorCode };

export interface OwnershipVerificationApi {
  readonly status: OwnershipVerificationState;
  readonly submit: OwnershipSubmitState;
  readonly submitCertificate: (file: File) => Promise<void>;
}

const urlOf = (ownerPropertyId: string) =>
  `/api/owner-properties/${encodeURIComponent(ownerPropertyId)}/ownership-verification`;

function codeOf(error: unknown): SubmitErrorCode {
  if (!(error instanceof ApiClientError)) return 'UNAVAILABLE';
  const body = error.errorBody;
  return submitErrorCodeOf(typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : undefined);
}

export function useOwnershipVerification(
  ownerPropertyId: string,
  dossier: { readonly id: string; readonly userId: string; readonly label: string } | null,
): OwnershipVerificationApi {
  const [status, setStatus] = useState<OwnershipVerificationState>({ state: 'loading' });
  const [submit, setSubmit] = useState<OwnershipSubmitState>({ state: 'idle' });

  useEffect(() => {
    let alive = true;
    apiClient
      .get<{ verification: OwnershipVerificationView | null }>(urlOf(ownerPropertyId))
      .then((body) => alive && setStatus({ state: 'ready', verification: body.verification }))
      .catch(() => alive && setStatus({ state: 'unavailable' }));
    return () => {
      alive = false;
    };
  }, [ownerPropertyId]);

  const submitCertificate = useCallback(
    async (file: File): Promise<void> => {
      if (dossier === null) return;
      setSubmit({ state: 'submitting' });
      try {
        await validateCustodyUploadAuth({ userId: dossier.userId });
        const { fileId } = await uploadEntityFile(
          {
            custody: { userId: dossier.userId },
            entityType: ENTITY_TYPES.PROPERTY_DOSSIER,
            entityId: dossier.id,
            entityLabel: dossier.label,
            ...CADASTRE_SLOT,
            createdBy: dossier.userId,
          },
          file,
        );
        const body = await apiClient.post<{ verification: OwnershipVerificationView }>(urlOf(ownerPropertyId), { fileId });
        setStatus({ state: 'ready', verification: body.verification });
        setSubmit({ state: 'idle' });
      } catch (error) {
        logger.warn('Η επαλήθευση κατοχής δεν υποβλήθηκε', { ownerPropertyId, error: String(error) });
        setSubmit({ state: 'failed', code: codeOf(error) });
      }
    },
    [dossier, ownerPropertyId],
  );

  return { status, submit, submitCertificate };
}
