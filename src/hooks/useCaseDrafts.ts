'use client';

/**
 * ADR-901 Φ4.4 — τα **πρόχειρα** του επαγγελματία για μία γραμμή της υπόθεσης: αρχεία στον **δικό του** προσωπικό
 * χώρο (`files_personal`, `entityType: 'conveyance_case'`, `entityId: <caseId>`), που **δεν** τα βλέπει κανείς άλλος
 * μέχρι να σταλούν (Α24).
 *
 * - Λίστα: `useEntityFiles` με κάτοχο `{ userId }`, realtime — το νέο ανέβασμα εμφανίζεται χωρίς ανανέωση.
 *   Το `purpose` φιλτράρεται στον client (κανένας νέος δείκτης). Ό,τι αντικαταστάθηκε (αρχειοθετημένο) **δεν** φαίνεται:
 *   η λίστα δείχνει μόνο κεφαλές στοιβών (`isVisibleInActiveLists`).
 * - Ανέβασμα: η **υπάρχουσα** ροή (`validateCustodyUploadAuth` → `uploadEntityFile`), ίδια με τον φάκελο ακινήτου —
 *   το entry point της γραμμής ορίζει `domain` · `category` · `purpose`. Καμία δεύτερη ροή ανεβάσματος.
 * - Φ4.5 — **νέα έκδοση**: το ίδιο ανέβασμα + η **ΜΙΑ** πόρτα διαδοχής (`supersedeFileRecord` → `POST /cde` →
 *   `transitionContainer`). Ο server **αποδεικνύει** ότι είναι το ίδιο δοχείο (ίδια θέση = ίδιο entry point) — ο client
 *   μόνο ζητά. Κανένας δεύτερος γραφέας διαδοχής.
 *
 * @module hooks/useCaseDrafts
 */

import { useCallback, useMemo, useState } from 'react';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { entryPointUploadTitle } from '@/config/upload-entry-points/entry-point-title';
import type { UploadEntryPoint } from '@/config/upload-entry-points/types';
import { useEntityFiles } from '@/components/shared/files/hooks/useEntityFiles';
import { normalizeToISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { supersedeFileRecord } from '@/services/file-record-lifecycle';
import type { SupersedeOutcome } from '@/services/filesystem/container-transition.client';
import { validateCustodyUploadAuth } from '@/services/filesystem/file-mutation-gateway';
import { uploadEntityFile } from '@/services/filesystem/upload-entity-file';

const logger = createModuleLogger('useCaseDrafts');

interface CaseDraft {
  readonly fileId: string;
  readonly displayName: string;
  readonly createdAt: string | null;
}

type DraftUploadState =
  | { readonly state: 'idle' }
  | { readonly state: 'uploading'; readonly fileName: string }
  | { readonly state: 'failed'; readonly fileName: string };

/**
 * Η έκβαση της «νέας έκδοσης» — **ονομασμένη**: ανέβηκε ή όχι, και τι είπε ο κριτής διαδοχής.
 * ⚠️ `uploaded` με άρνηση διαδοχής ⇒ το αρχείο **υπάρχει** ως ανεξάρτητο πρόχειρο — δεν χάθηκε, απλώς δεν είναι έκδοση.
 */
export type CaseVersionUpload =
  | { readonly kind: 'upload-failed' }
  | { readonly kind: 'uploaded'; readonly fileId: string; readonly succession: SupersedeOutcome };

interface CaseDraftUploadApi {
  readonly upload: DraftUploadState;
  /** Ανεβάζει στον δικό μου χώρο — επιστρέφει το `fileId`, ή `null` σε αποτυχία. */
  readonly uploadDraft: (file: File) => Promise<string | null>;
  /** Φ4.5 — ανεβάζει και ζητά από τον ΕΝΑ γραφέα να το δέσει ως διάδοχο του `predecessorFileId`. */
  readonly uploadVersion: (file: File, predecessorFileId: string) => Promise<CaseVersionUpload>;
}

interface CaseDraftsApi extends Pick<CaseDraftUploadApi, 'upload' | 'uploadDraft'> {
  readonly drafts: readonly CaseDraft[];
}

/** Το ανέβασμα στον προσωπικό χώρο της υπόθεσης — χωρίς λίστα (ο διάλογος νέας έκδοσης δεν τη χρειάζεται). */
export function useCaseDraftUpload(caseId: string, uid: string, entryPoint: UploadEntryPoint): CaseDraftUploadApi {
  const [upload, setUpload] = useState<DraftUploadState>({ state: 'idle' });

  const uploadDraft = useCallback(async (file: File): Promise<string | null> => {
    setUpload({ state: 'uploading', fileName: file.name });
    try {
      const custody = { userId: uid } as const;
      await validateCustodyUploadAuth(custody);
      const uploaded = await uploadEntityFile({
        custody,
        entityType: ENTITY_TYPES.CONVEYANCE_CASE,
        entityId: caseId,
        domain: entryPoint.domain,
        category: entryPoint.category,
        purpose: entryPoint.purpose,
        // Ο τίτλος από το entry point (ίδιος κανόνας με τον φάκελο) — αλλιώς ωμό κλειδί σκοπού στο όνομα.
        customTitle: entryPointUploadTitle(entryPoint),
        createdBy: uid,
      }, file);
      setUpload({ state: 'idle' });
      return uploaded.fileId;
    } catch (cause) {
      logger.warn('Το πρόχειρο της υπόθεσης δεν ανέβηκε', { caseId, error: cause instanceof Error ? cause.message : String(cause) });
      setUpload({ state: 'failed', fileName: file.name });
      return null;
    }
  }, [caseId, entryPoint, uid]);

  const uploadVersion = useCallback(async (file: File, predecessorFileId: string): Promise<CaseVersionUpload> => {
    const fileId = await uploadDraft(file);
    if (fileId === null) return { kind: 'upload-failed' };
    // 🔑 Await, όχι fire-and-forget: η αποστολή που ακολουθεί διαβάζει την κεφαλή της στοίβας — πρέπει να υπάρχει ο δεσμός.
    const succession = await supersedeFileRecord(predecessorFileId, fileId, 'personal');
    return { kind: 'uploaded', fileId, succession };
  }, [uploadDraft]);

  return { upload, uploadDraft, uploadVersion };
}

export function useCaseDrafts(caseId: string, uid: string, entryPoint: UploadEntryPoint): CaseDraftsApi {
  const { upload, uploadDraft } = useCaseDraftUpload(caseId, uid, entryPoint);
  const { files } = useEntityFiles({
    entityType: ENTITY_TYPES.CONVEYANCE_CASE,
    entityId: caseId,
    custody: { userId: uid },
    purpose: entryPoint.purpose,
    realtime: true,
  });

  const drafts = useMemo<readonly CaseDraft[]>(() => files
    .filter((file) => file.status === 'ready')
    .map((file) => ({ fileId: file.id, displayName: file.displayName || file.id, createdAt: normalizeToISO(file.createdAt) })),
  [files]);

  return { drafts, upload, uploadDraft };
}
