/**
 * useStableFileCustody — ο κάτοχος αρχείων ως **σταθερή ταυτότητα** για dependencies (ADR-866 §5.2).
 *
 * 🔴 Οι καλούντες γράφουν `custody={{ companyId }}` — **νέο** αντικείμενο σε κάθε render. Ως
 * dependency θα ξανάστηνε κάθε ακροατή Firestore και κάθε ανάγνωση **σε κάθε render** (βρόχος,
 * ίδιο σχήμα με το «selector `?? []` = νέος πίνακας»). Εδώ η ταυτότητα αλλάζει **μόνο** όταν
 * αλλάξει ο κάτοχος.
 *
 * 🔑 Η κρίση «ακριβώς ένας κάτοχος» **δεν** ξαναγράφεται: ρωτιέται το κοινό σύνορο ανάγνωσης.
 *
 * @module components/shared/files/hooks/useStableFileCustody
 */

import { useMemo } from 'react';

import type { FileCustody } from '@/lib/files/file-custody';
import { custodyScopeFromData } from '@/lib/workspace/custody-scope';

export function useStableFileCustody(custody: FileCustody | undefined): FileCustody | undefined {
  const companyId = custody?.companyId;
  const userId = custody?.userId;
  return useMemo(
    () => custodyScopeFromData({ companyId, userId }) ?? undefined,
    [companyId, userId],
  );
}
