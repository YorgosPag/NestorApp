'use client';

/**
 * ADR-901 Φ4 · Φ4.4 — ανοίγει/κατεβάζει ένα τεκμήριο της υπόθεσης: ο επαγγελματίας (μέσω της συμμετοχής του) **ή**
 * ο οικοδεσπότης (μέσω της υπόθεσής του — και ό,τι του στάλθηκε). Ίδια συμπεριφορά, άλλη πόρτα.
 *
 * 🔑 Ο server δίνει σύνδεσμο 15′ και γράφει το ίχνος. Η **λήψη** πλοηγεί στον σύνδεσμο (`navigateDocument`):
 *    φέρει ήδη `Content-Disposition: attachment`, άρα η σελίδα **μένει** και το αρχείο κατεβαίνει, χωρίς blob
 *    στη μνήμη και χωρίς CORS (το πρότυπο του `mandate-evidence.client`). Η **προβολή** κρατά τον σύνδεσμο για τον
 *    διάλογο προεπισκόπησης.
 * 🔑 Ένα αίτημα ανά αρχείο τη φορά: δεύτερο κλικ όσο τρέχει το πρώτο δεν γράφει δεύτερο ίχνος.
 *
 * @module hooks/useCaseFileOpener
 */

import { useCallback, useRef, useState } from 'react';
import { navigateDocument } from '@/lib/browser/document-navigation';
import { openEngagedCaseFile, openHostCaseFile, type CaseFileLink } from '@/services/conveyance/conveyance-engagement-gateway';
import type { CaseFileMode } from '@/lib/conveyance/case-activity';
import type { EvidenceFile } from '@/types/conveyance-case';

export type CaseFileOpenOutcome = 'opened' | 'unavailable';

/** **Μέσω τίνος** ανοίγει: της δικής μου συμμετοχής ή της υπόθεσης του χώρου μου (οικοδεσπότης). */
export type CaseFileTarget =
  | { readonly kind: 'engagement'; readonly engagementId: string }
  | { readonly kind: 'host'; readonly caseId: string };

function requestLink(target: CaseFileTarget, fileId: string, mode: CaseFileMode): Promise<CaseFileLink> {
  return target.kind === 'engagement'
    ? openEngagedCaseFile(target.engagementId, fileId, mode)
    : openHostCaseFile(target.caseId, fileId, mode);
}

/** Το τεκμήριο σε προεπισκόπηση **και** ο σύνδεσμός του: η «Λήψη» από τον διάλογο ξέρει ρητά ποιο αρχείο είναι. */
export interface CaseFilePreview {
  readonly file: EvidenceFile;
  readonly link: CaseFileLink;
}

interface UseCaseFileOpenerReturn {
  /** `null` ⇒ κλειστός διάλογος. */
  readonly preview: CaseFilePreview | null;
  readonly busyFileId: string | null;
  readonly open: (file: EvidenceFile, mode: CaseFileMode) => Promise<CaseFileOpenOutcome>;
  readonly closePreview: () => void;
}

/** `target` πρέπει να είναι σταθερό ανάμεσα σε renders (`useMemo` στον καλούντα). */
export function useCaseFileOpener(target: CaseFileTarget): UseCaseFileOpenerReturn {
  const [preview, setPreview] = useState<CaseFilePreview | null>(null);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);

  const open = useCallback(async (file: EvidenceFile, mode: CaseFileMode): Promise<CaseFileOpenOutcome> => {
    if (inFlight.current !== null) return 'opened';
    inFlight.current = file.fileId;
    setBusyFileId(file.fileId);
    try {
      const link = await requestLink(target, file.fileId, mode);
      if (mode === 'download') navigateDocument(link.url);
      else setPreview({ file, link });
      return 'opened';
    } catch {
      return 'unavailable';
    } finally {
      inFlight.current = null;
      setBusyFileId(null);
    }
  }, [target]);

  const closePreview = useCallback(() => setPreview(null), []);
  return { preview, busyFileId, open, closePreview };
}
