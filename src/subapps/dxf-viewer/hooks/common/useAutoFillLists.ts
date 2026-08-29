/**
 * 🔴 ADR-828 Φ4β — **ΟΙ ΠΡΟΣΑΡΜΟΣΜΕΝΕΣ ΛΙΣΤΕΣ, ΓΙΑ ΤΗ ΔΙΕΠΑΦΗ.**
 *
 * Η αντιδραστική πλευρά της ίδιας αλήθειας που το {@link autoFillListCandidates} διαβάζει
 * σύγχρονα τη στιγμή της χειρονομίας. **Δεν είναι δεύτερη κατάσταση**: και τα δύο ρωτούν το
 * `userSettingsRepository`, που κάνει την ενημέρωση **αισιόδοξα και σύγχρονα** — ο άνθρωπος
 * που πατά «Προσθήκη» και τραβά τη λαβή στο επόμενο δευτερόλεπτο βλέπει τη λίστα του, χωρίς
 * να περιμένει γύρο Firestore.
 *
 * ## Γιατί ΔΕΝ αντιγράφει το `useCadToggles`
 * Εκείνο κουβαλά έναν **κοινό store** (`cadToggleState`) επειδή έχει ~6 ζωντανά στιγμιότυπα
 * και μια μπαγιάτικη τιμή του ενός θα πατούσε τη ζωντανή του άλλου. Εδώ υπάρχει **ένας**
 * καταναλωτής (η καρτέλα ρυθμίσεων) και οι μη-React αναγνώστες ρωτούν το repository
 * απευθείας. Ένας store θα ήταν λύση σε πρόβλημα που δεν υπάρχει, και μια ακόμη κατάσταση
 * που μπορεί να μείνει πίσω.
 *
 * @module subapps/dxf-viewer/hooks/common/useAutoFillLists
 * @see settings/auto-fill-lists.ts — η σύγχρονη πλευρά, για τη στιγμή της χειρονομίας
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §4
 */

import { useCallback, useEffect, useState } from 'react';
import { userSettingsRepository, AUTO_FILL_LIST_LIMITS } from '@/services/user-settings';
import type { AutoFillList } from '@/services/user-settings';
import { useAuth } from '@/auth/contexts/AuthContext';

/** Γιατί μια λίστα δεν έγινε δεκτή — **ποτέ σιωπηλή αποκοπή** (ADR-828 §5). */
export type AutoFillListRejection =
  | 'empty-name'
  | 'duplicate-name'
  | 'name-too-long'
  | 'too-few-entries'
  | 'too-many-entries'
  | 'entry-too-long'
  | 'too-many-lists';

export interface AutoFillListsApi {
  readonly lists: readonly AutoFillList[];
  /**
   * Αποθηκεύει μια λίστα — νέα, ή αντικατάσταση εκείνης με το **παλιό** όνομα.
   *
   * Επιστρέφει `null` σε επιτυχία, αλλιώς **τον λόγο**. Δεν πετά και δεν κόβει: ο καλών
   * είναι διεπαφή και ο λόγος πρέπει να φτάσει στα μάτια του ανθρώπου.
   */
  readonly save: (list: AutoFillList, replacing?: string) => AutoFillListRejection | null;
  readonly remove: (name: string) => void;
}

const EMPTY: readonly AutoFillList[] = [];

/**
 * 🔴 **Η ΕΠΙΚΥΡΩΣΗ ΖΕΙ ΕΔΩ ΕΠΕΙΔΗ ΕΔΩ ΥΠΑΡΧΕΙ ΑΝΘΡΩΠΟΣ ΝΑ ΤΗΝ ΑΚΟΥΣΕΙ.**
 *
 * Το σχήμα Zod απορρίπτει το ίδιο πράγμα μια στάθμη πιο κάτω, και αυτό **δεν** είναι
 * διπλότυπο: εκείνο φυλάει το **έγγραφο** από ό,τι φτάνει εκτός εφαρμογής και απαντά με
 * εξαίρεση· αυτό εδώ φυλάει τον **άνθρωπο** από το να χάσει ό,τι πληκτρολόγησε και απαντά με
 * λόγο. Τα όρια είναι **τα ίδια** — μία σταθερά, δύο αναγνώστες, καμία ευκαιρία απόκλισης.
 */
function reject(
  list: AutoFillList,
  existing: readonly AutoFillList[],
  replacing?: string,
): AutoFillListRejection | null {
  const name = list.name.trim();
  if (name === '') return 'empty-name';
  if (name.length > AUTO_FILL_LIST_LIMITS.maxNameLength) return 'name-too-long';
  if (existing.some((other) => other.name === name && other.name !== replacing)) {
    return 'duplicate-name';
  }
  if (list.entries.length < AUTO_FILL_LIST_LIMITS.minEntries) return 'too-few-entries';
  if (list.entries.length > AUTO_FILL_LIST_LIMITS.maxEntries) return 'too-many-entries';
  if (list.entries.some((e) => e.trim().length > AUTO_FILL_LIST_LIMITS.maxEntryLength)) {
    return 'entry-too-long';
  }
  if (replacing === undefined && existing.length >= AUTO_FILL_LIST_LIMITS.maxLists) {
    return 'too-many-lists';
  }
  return null;
}

export function useAutoFillLists(): AutoFillListsApi {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const companyId = user?.companyId ?? null;
  const [lists, setLists] = useState<readonly AutoFillList[]>(EMPTY);

  useEffect(() => {
    if (!userId || !companyId) return;
    userSettingsRepository.bind(userId, companyId);
    return userSettingsRepository.subscribeSlice('dxfViewer.autoFillLists', (remote) => {
      setLists(remote?.lists ?? EMPTY);
    });
  }, [userId, companyId]);

  const save = useCallback(
    (list: AutoFillList, replacing?: string): AutoFillListRejection | null => {
      // Η **ζωντανή** τιμή του αποθετηρίου, όχι το `lists` του render: ανάμεσα στο render και
      // στο πάτημα μπορεί να έχει έρθει ενημέρωση από άλλη καρτέλα του ίδιου ανθρώπου.
      const current = userSettingsRepository.getSlice('dxfViewer.autoFillLists')?.lists ?? EMPTY;
      const reason = reject(list, current, replacing);
      if (reason !== null) return reason;

      const cleaned: AutoFillList = {
        name: list.name.trim(),
        entries: list.entries.map((entry) => entry.trim()).filter((entry) => entry !== ''),
      };
      // Ξανα-έλεγχος **μετά** το καθάρισμα: γραμμές που ήταν μόνο κενά έφυγαν, και μια λίστα
      // που έμεινε με μία εγγραφή δεν έχει «επόμενο». Χωρίς αυτό θα αποθηκευόταν κάτι που
      // ο ανιχνευτής θα αγνοούσε σιωπηλά — δηλαδή λίστα που «δεν δουλεύει» χωρίς εξήγηση.
      if (cleaned.entries.length < AUTO_FILL_LIST_LIMITS.minEntries) return 'too-few-entries';

      const target = replacing ?? cleaned.name;
      const index = current.findIndex((other) => other.name === target);
      const next = index === -1
        ? [...current, cleaned]
        : current.map((other, i) => (i === index ? cleaned : other));
      userSettingsRepository.updateSlice('dxfViewer.autoFillLists', { lists: next });
      return null;
    },
    [],
  );

  const remove = useCallback((name: string): void => {
    const current = userSettingsRepository.getSlice('dxfViewer.autoFillLists')?.lists ?? EMPTY;
    userSettingsRepository.updateSlice('dxfViewer.autoFillLists', {
      lists: current.filter((other) => other.name !== name),
    });
  }, []);

  return { lists, save, remove };
}
