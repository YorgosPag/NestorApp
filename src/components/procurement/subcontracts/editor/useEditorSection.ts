'use client';

/**
 * **Ποια ενότητα του επεξεργαστή είναι ανοιχτή** (ADR-928 §5.23) — ένας κάτοχος για τις καρτέλες της φόρμας και τον
 * συγχρονισμό της προεπισκόπησης.
 *
 * 🔑 Η κατάσταση ζει στο **hash** (`#editor-lines`), όπως οι καρτέλες του Procore ζουν στη διεύθυνση: ανανέωση ή
 *    σύνδεσμος ανοίγει την ίδια καρτέλα. Το hash είναι **ίδιο** με το `id` της επικεφαλίδας κάθε ενότητας, άρα οι
 *    υπάρχοντες σύνδεσμοι μέσα στη φόρμα (π.χ. «Αλλαγή στους όρους» → `#editor-plan`) **αλλάζουν καρτέλα** χωρίς
 *    καμία αλλαγή στους ίδιους.
 * 🔑 Η επιλογή καρτέλας γράφει με το SSoT `replaceUrlFragment` (`lib/url-query-state`) — όχι νέα εγγραφή ιστορικού ανά κλικ (το «Πίσω» βγάζει από τη
 *    σελίδα, όπως στο Gmail), και όχι πλοήγηση του Next (καμία επαναφόρτωση δεδομένων).
 * 🔑 **Αίτημα κύλισης της προεπισκόπησης** (`previewRequest`) μόνο όταν η αλλαγή ήρθε από τη **φόρμα**: όταν ήρθε από το
 *    μολύβι του **εγγράφου**, ο άνθρωπος κοιτά ήδη εκεί — αν η προεπισκόπηση πηδούσε στην αρχή της ενότητας, θα έχανε τη
 *    ρήτρα που μόλις πάτησε. Αύξων αριθμός, ώστε δύο αιτήματα για την ίδια ενότητα να είναι δύο αιτήματα.
 * 🔑 Ενότητα που ο επεξεργαστής δεν έχει (π.χ. `#editor-parties` στο πρότυπο) ⇒ η πρώτη· ποτέ κενή φόρμα.
 */

import { useCallback, useEffect, useState } from 'react';
import { replaceUrlFragment } from '@/lib/url-query-state';
import { sectionHash, sectionOfHash, type EditorSection, type EditorSectionMap } from './editor-sections';

export type SectionOrigin = 'form' | 'document';

export interface PreviewScrollRequest {
  readonly section: EditorSection;
  readonly seq: number;
}

export interface EditorSectionState {
  readonly section: EditorSection;
  readonly previewRequest: PreviewScrollRequest | null;
  readonly select: (section: EditorSection, origin?: SectionOrigin) => void;
}

function currentHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/**
 * Το αρχικό αίτημα: καρτέλα που ήρθε από τη **διεύθυνση** (ανανέωση, σύνδεσμος) ⇒ και το έγγραφο ανοίγει εκεί.
 * 🔴 Ζωντανός έλεγχος §5.23: μετά την ανανέωση στο `#editor-clauses` η καρτέλα επανερχόταν, η προεπισκόπηση όμως έμενε
 *    στην κορυφή — φόρμα και έγγραφο έδειχναν διαφορετικές ενότητες.
 */
function initialRequestOf(section: EditorSection, map: EditorSectionMap): PreviewScrollRequest | null {
  return section === map.sections[0] ? null : { section, seq: 1 };
}

export function useEditorSection(map: EditorSectionMap): EditorSectionState {
  const [section, setSection] = useState<EditorSection>(() => sectionOfHash(currentHash(), map) ?? map.sections[0]);
  const [previewRequest, setPreviewRequest] = useState<PreviewScrollRequest | null>(() => initialRequestOf(section, map));

  const open = useCallback((next: EditorSection, origin: SectionOrigin) => {
    setSection(next);
    if (origin === 'form') setPreviewRequest((previous) => ({ section: next, seq: (previous?.seq ?? 0) + 1 }));
  }, []);

  useEffect(() => {
    const follow = () => {
      const next = sectionOfHash(currentHash(), map);
      if (next) open(next, 'form');
    };
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [map, open]);

  const select = useCallback((next: EditorSection, origin: SectionOrigin = 'form') => {
    open(next, origin);
    replaceUrlFragment(sectionHash(next));
  }, [open]);

  return { section, previewRequest, select };
}
