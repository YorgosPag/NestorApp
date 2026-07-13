'use client';

/**
 * ADR-651 Φάση Ε — hook του διαλόγου σφραγίδας μηχανικού.
 *
 * SSoT reuse (μοτίβο `useHatchImageUploads`): companyId/userId από το ΙΔΙΟ auth context
 * (`useCompanyId` / `useAuth`)· το upload/remove καλεί τον thin `engineer-stamp.service`
 * (validate → Storage → user doc → in-session scope patch). Τα σφάλματα επιστρέφονται ως
 * i18n key suffix κάτω από `titleBlockStamp.errors` (N.11 — μηδέν hardcoded string).
 *
 * Η υπηρεσία ενημερώνει το scope cache (singleton, όχι React) ⇒ ο hook κρατά **τοπικό**
 * state για το preview, αρχικοποιημένο από το cache και ενημερωμένο μετά από upload/remove,
 * ώστε ο διάλογος να δείχνει αμέσως τη νέα σφραγίδα.
 *
 * @see ../../../text-engine/title-block/engineer-stamp.service.ts — ο thin orchestrator
 */

import { useCallback, useState } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { getPlaceholderScopeSources } from '../../../text-engine/templates/resolver/placeholder-scope-client';
import {
  EngineerStampError,
  removeEngineerStamp,
  uploadEngineerStamp,
} from '../../../text-engine/title-block/engineer-stamp.service';

export interface UseEngineerStampUploadResult {
  /** Το download URL της τρέχουσας σφραγίδας, ή `null`. */
  readonly stampUrl: string | null;
  readonly upload: (file: File) => Promise<void>;
  readonly remove: () => Promise<void>;
  readonly uploading: boolean;
  readonly removing: boolean;
  /** i18n key suffix κάτω από `titleBlockStamp.errors`, ή `null`. */
  readonly errorKey: string | null;
}

/** Failure → `titleBlockStamp.errors` key suffix. */
function errorToKey(err: unknown, fallback: string): string {
  return err instanceof EngineerStampError ? err.code : fallback;
}

export function useEngineerStampUpload(): UseEngineerStampUploadResult {
  const { user } = useAuth();
  const companyId = useCompanyId()?.companyId;
  const userId = user?.uid;

  const [stampUrl, setStampUrl] = useState<string | null>(
    () => getPlaceholderScopeSources().user?.stampImageUrl ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!companyId || !userId) {
        setErrorKey('notReady');
        return;
      }
      setUploading(true);
      setErrorKey(null);
      try {
        const url = await uploadEngineerStamp({ file, companyId, userId });
        setStampUrl(url);
      } catch (err) {
        setErrorKey(errorToKey(err, 'failed'));
      } finally {
        setUploading(false);
      }
    },
    [companyId, userId],
  );

  const remove = useCallback(async () => {
    if (!userId) {
      setErrorKey('notReady');
      return;
    }
    if (!stampUrl) return;
    setRemoving(true);
    setErrorKey(null);
    try {
      await removeEngineerStamp(userId, stampUrl);
      setStampUrl(null);
    } catch (err) {
      setErrorKey(errorToKey(err, 'removeFailed'));
    } finally {
      setRemoving(false);
    }
  }, [userId, stampUrl]);

  return { stampUrl, upload, remove, uploading, removing, errorKey };
}
