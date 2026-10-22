'use client';

/**
 * 🔗 **Η ενεργή καρτέλα της σελίδας έργου** (ADR-242 Βήμα 3) — η διεύθυνση (`?tab=`) είναι η ΜΙΑ πηγή της.
 *
 * Πριν: η καρτέλα ζούσε σε δύο αντίγραφα React state (`ProjectViewSwitch` + `ProjectDetails`) και το `?tab=` διαβαζόταν
 * μόνο στο άνοιγμα ⇒ το refresh, το «πίσω» από άλλη σελίδα και ο κοινόχρηστος σύνδεσμος έχαναν την καρτέλα.
 * Τώρα: ανάγνωση/εγγραφή μέσω του κοινού `useActiveUrlTab` (`replaceState`, η προεπιλογή σβήνει το κλειδί, άγνωστη τιμή
 * ⇒ προεπιλογή). Η καρτέλα επιβιώνει της αλλαγής έργου **δωρεάν**: η επιλογή γράφει μόνο το `projectId`.
 *
 * 🔑 **Το πρόχειρο δεν έχει διεύθυνση** — ίδια αρχή με την επιλογή (`useEntityPageState`: η ψευδο-ταυτότητα σβήνει το
 * `projectId`). Άρα ούτε η καρτέλα του ζει στο URL:
 * - «Νέο έργο» ⇒ ανοίγει ΠΑΝΤΑ στην προεπιλογή, όχι στην καρτέλα του έργου που κοιτούσε ο άνθρωπος (εκεί το πρόχειρο θα
 *   έλεγε μόνο «αποθηκεύστε πρώτα»)· κατά την απόδοση, ώστε το `ProjectDetails` του πρόχειρου να μη στηθεί ούτε μία
 *   φορά με την παλιά καρτέλα — και **χωρίς** εγγραφή στη διεύθυνση μέσα στο render.
 * - Το πρόχειρο **έγινε** έργο ⇒ η καρτέλα του **μεταφέρεται** στη διεύθυνση. Ώσπου να γραφτεί (effect), δείχνεται η
 *   μεταφερόμενη, ώστε το νέο `ProjectDetails` να μη στηθεί ούτε μία φορά με την παλιά καρτέλα της διεύθυνσης.
 * - «Ακύρωση» (καμία επιλογή) ⇒ καμία μεταφορά· η διεύθυνση μένει όπως ήταν.
 *
 * @module components/projects/hooks/useProjectActiveTab
 * @see ADR-242 Βήμα 3 · ADR-742 (`key` ανά ταυτότητα έργου)
 */

import { useEffect, useState } from 'react';

import { useActiveUrlTab, type ActiveUrlTab } from '@/hooks/useUrlTabParam';
import { getSelectableProjectTabIds } from '@/config/project-tabs-config';
import { PROJECT_TAB_PARAM } from '@/lib/navigation/project-urls';

/** Στατικό config ⇒ υπολογίζεται μία φορά· η πρώτη είναι η προεπιλογή. */
const PROJECT_TAB_IDS = getSelectableProjectTabIds();
const DEFAULT_PROJECT_TAB = PROJECT_TAB_IDS[0] ?? '';

export interface ProjectActiveTabInput {
  /** Η επιλογή είναι το πρόχειρο (`isDraftEntityId`). */
  readonly isCreateMode: boolean;
  /** Υπάρχει επιλεγμένο έργο — διακρίνει «δημιουργήθηκε» από «ακυρώθηκε» στην έξοδο από το πρόχειρο. */
  readonly hasSelection: boolean;
}

export function useProjectActiveTab({ isCreateMode, hasSelection }: ProjectActiveTabInput): ActiveUrlTab {
  const url = useActiveUrlTab(PROJECT_TAB_PARAM, PROJECT_TAB_IDS);
  const writeUrlTab = url.setActiveTab;

  const [draftTab, setDraftTab] = useState(DEFAULT_PROJECT_TAB);
  const [carriedTab, setCarriedTab] = useState<string | null>(null);

  // Μετάβαση κατά την απόδοση (React: «storing information from previous renders») — μόνο ΤΟΠΙΚΗ κατάσταση εδώ.
  // Οι τοπικές μεταβλητές κάνουν και την ΙΔΙΑ την απόδοση της μετάβασης συνεπή (όχι μόνο την επόμενη).
  const [wasCreateMode, setWasCreateMode] = useState(isCreateMode);
  let shownDraftTab = draftTab;
  let shownCarriedTab = carriedTab;
  if (wasCreateMode !== isCreateMode) {
    setWasCreateMode(isCreateMode);
    if (isCreateMode) {
      shownDraftTab = DEFAULT_PROJECT_TAB;
      setDraftTab(shownDraftTab);
    } else if (hasSelection) {
      shownCarriedTab = draftTab;
      setCarriedTab(shownCarriedTab);
    }
  }

  // Η μεταφορά γράφεται στη διεύθυνση ΕΚΤΟΣ render· μετά η διεύθυνση ξαναγίνεται η μόνη πηγή.
  useEffect(() => {
    if (carriedTab === null) return;
    writeUrlTab(carriedTab);
    setCarriedTab(null);
  }, [carriedTab, writeUrlTab]);

  if (isCreateMode) return { activeTab: shownDraftTab, setActiveTab: setDraftTab };
  return { activeTab: shownCarriedTab ?? url.activeTab, setActiveTab: writeUrlTab };
}
