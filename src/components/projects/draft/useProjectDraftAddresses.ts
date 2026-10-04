/**
 * =============================================================================
 * SSoT: **ΟΙ ΔΙΕΥΘΥΝΣΕΙΣ ΤΟΥ ΕΡΓΟΥ ΠΟΥ ΔΕΝ ΑΠΟΘΗΚΕΥΤΗΚΕ ΑΚΟΜΗ** («Fill then Create»)
 * =============================================================================
 *
 * Το «Νέο έργο» ανοίγει κενή φόρμα με ψευδο-ταυτότητα (`lib/draft-entity-id`) και η εγγραφή
 * γεννιέται μόνο στην αποθήκευση. Ως τις 2026-10-04 η καρτέλα «Διευθύνσεις» έστελνε
 * `PATCH /api/projects/__new__` ⇒ 500 ⇒ **η διεύθυνση χανόταν**.
 *
 * 🔑 **Το πρότυπο** (SAP Fiori «draft handling», AWS Cloudscape «sub-resource create»): τα
 * εξαρτημένα στοιχεία ενός γονέα που δεν υπάρχει ακόμη **κρατιούνται στο πρόχειρο** και
 * γράφονται **μαζί** του, σε **μία** πράξη — ποτέ «αποθήκευσε πρώτα, μετά ξαναέλα».
 *
 * **Ένας ιδιοκτήτης, δύο καρτέλες**: η «Διευθύνσεις» **γράφει** εδώ, η «Γενικά» **διαβάζει**
 * τη στιγμή της δημιουργίας. Το κρατά το `ProjectDetails`, που είναι ο κοινός γονέας και των
 * δύο εισόδων δημιουργίας (σελίδα έργων · `ProjectQuickCreateSheet`).
 *
 * 🔑 **Το πρόχειρο ΑΝΗΚΕΙ σε μία ταυτότητα** (`belongsTo`). Στη δημιουργία **μεταβιβάζεται**
 * στην πραγματική (`commit`), μαζί με ό,τι **έγραψε** ο διακομιστής — η σύνοψη της λίστας δεν
 * έχει ακόμη διευθύνσεις, οπότε η καρτέλα θα άδειαζε τη στιγμή που το έργο αποθηκεύτηκε. Μόλις
 * το `ProjectDetails` δείξει **άλλη** ταυτότητα, το πρόχειρο αδειάζει: δεν μπορεί να διαρρεύσει
 * σε άλλο έργο ούτε να μείνει μπαγιάτικο.
 *
 * ⚠️ **Ref, όχι state — επίτηδες**: η τιμή διαβάζεται **σε χρόνο πράξης** (αποθήκευση), όχι
 * σε χρόνο απόδοσης. Ως state θα ξανα-απέδιδε και τις 21 καρτέλες σε κάθε προσθήκη· η
 * καρτέλα «Διευθύνσεις» κρατά ήδη το δικό της ορατό αντίγραφο.
 *
 * @module components/projects/draft/useProjectDraftAddresses
 */

import { useMemo, useRef } from 'react';
import type { ProjectAddress } from '@/types/project/addresses';
import { isDraftEntityId } from '@/lib/draft-entity-id';

export interface ProjectDraftAddresses {
  /** Κρατά το πρόχειρο διευθύνσεις για **αυτή** την ταυτότητα; Αλλιώς ισχύει ό,τι λέει το έργο. */
  readonly belongsTo: (projectId: string | null | undefined) => boolean;
  readonly get: () => ProjectAddress[];
  readonly set: (next: ProjectAddress[]) => void;
  /** Το έργο γεννήθηκε: το πρόχειρο περνά στην πραγματική ταυτότητα, με ό,τι έγραψε ο διακομιστής. */
  readonly commit: (projectId: string, written: ProjectAddress[]) => void;
}

/** @param projectId Η ταυτότητα του έργου που δείχνει αυτή τη στιγμή το `ProjectDetails`. */
export function useProjectDraftAddresses(projectId: string | null | undefined): ProjectDraftAddresses {
  const addressesRef = useRef<ProjectAddress[]>([]);
  const ownerRef = useRef<string | null>(isDraftEntityId(projectId) ? (projectId ?? null) : null);
  const lastIdRef = useRef(projectId);

  // Κατά την απόδοση και όχι σε effect: τα παιδιά διαβάζουν το πρόχειρο στο ΔΙΚΟ τους mount,
  // που προηγείται των effects του γονέα. Ιδεμποτικό ⇒ ασφαλές και στη διπλή απόδοση του StrictMode.
  if (lastIdRef.current !== projectId) {
    lastIdRef.current = projectId;
    // Νέο «Νέο» ⇒ καθαρό πρόχειρο. Άλλη ταυτότητα από αυτήν που το κατέχει ⇒ δεν αφορά κανέναν.
    if (isDraftEntityId(projectId)) {
      addressesRef.current = [];
      ownerRef.current = projectId ?? null;
    } else if (projectId !== ownerRef.current) {
      addressesRef.current = [];
      ownerRef.current = null;
    }
  }

  return useMemo(
    () => ({
      belongsTo: (id) => id !== null && id !== undefined && id === ownerRef.current,
      get: () => addressesRef.current,
      set: (next) => {
        addressesRef.current = next;
      },
      commit: (id, written) => {
        ownerRef.current = id;
        addressesRef.current = written;
      },
    }),
    [],
  );
}
