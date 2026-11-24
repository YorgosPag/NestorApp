'use client';

/**
 * @fileoverview Η **ΜΙΑ** πράξη «ξαναδιάβασε + ανανέωσε» ενός αρχείου (ADR-950 §8.12).
 * @module components/shared/files/ClassifyAgainProvider
 * @related components/shared/files/ClassifyAgainButton (το ΕΝΑ κουμπί) · hooks/useFileClassification (η κλήση AI)
 *
 * 🔴 2026-11-24 (ζωντανός έλεγχος): η «Νέα ανάγνωση» του πίνακα «Το έγγραφο λέει» ΔΕΝ ανανέωνε τη λίστα — η βάση είχε
 * ήδη τη νέα ανάγνωση, η οθόνη όχι, μέχρι το χειροκίνητο ↻. Το κουμπί της **λίστας** καλούσε `classifyFile` **και**
 * `onClassified` (εφάπαξ ανάγνωση)· το κουμπί του **πίνακα** μόνο το πρώτο. Δύο αντίγραφα της ίδιας πράξης, το ένα μισό.
 *
 * ⇒ Η πράξη ζει **εδώ**, μία φορά: ο πάροχος (στο `EntityFilesContent`, πάνω από λίστα **και** προεπισκόπηση) ξέρει
 * πώς ανανεώνεται η λίστα (`onRead` του κατόχου της)· κάθε κουμπί ζητά `classifyAgain(id)` και τίποτε άλλο.
 *
 * 🔑 Κατέχει **και** το «διαβάζεται τώρα» (`classifyingIds`): η λίστα και ο πίνακας βλέπουν την **ίδια** κατάσταση,
 * άρα το δεύτερο κουμπί κλειδώνει όσο τρέχει το πρώτο — καμία δεύτερη, παράλληλη κλήση AI για το ίδιο αρχείο.
 *
 * Χωρίς πάροχο (λίστα έξω από τον διαχειριστή αρχείων) ⇒ τοπική κατάσταση και **καμία** ανανέωση — ό,τι ίσχυε πάντα.
 * Αποσυρμένη μητρική εγγραφή ⇒ ο καταναλωτής περνά `onRead={undefined}` και δεν δείχνει κουμπί (ADR-329 §3.9).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import { useFileClassification } from './hooks/useFileClassification';

interface ClassifyAgain {
  /** «Ξαναδιάβασε» (`force`) και, όταν τελειώσει, ανανέωσε τη λίστα του κατόχου. */
  readonly classifyAgain: (fileId: string) => Promise<void>;
  /** Αρχεία που διαβάζονται **τώρα** — κοινά για κάθε κουμπί κάτω από τον πάροχο. */
  readonly classifyingIds: ReadonlySet<string>;
}

const ClassifyAgainContext = createContext<ClassifyAgain | null>(null);

/** Η πράξη με ανανέωση `onRead` (ή χωρίς, αν λείπει). Ο ΕΝΑΣ ορισμός — τον μοιράζονται πάροχος και εφεδρεία. */
function useClassifyAgainAction(onRead: (() => void) | undefined): ClassifyAgain {
  const { classifyFile, classifyingIds } = useFileClassification();
  // Ref: ο κάτοχος περνά συνήθως νέο βέλος σε κάθε render — η πράξη μένει σταθερή, η ανανέωση πάντα η τρέχουσα.
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; }, [onRead]);

  const classifyAgain = useCallback(async (fileId: string) => {
    await classifyFile(fileId, true);
    onReadRef.current?.();
  }, [classifyFile]);

  return useMemo(() => ({ classifyAgain, classifyingIds }), [classifyAgain, classifyingIds]);
}

export function ClassifyAgainProvider({ onRead, children }: {
  readonly onRead: (() => void) | undefined;
  readonly children: React.ReactNode;
}) {
  const value = useClassifyAgainAction(onRead);
  return <ClassifyAgainContext.Provider value={value}>{children}</ClassifyAgainContext.Provider>;
}

/** Η πράξη του πλησιέστερου παρόχου· χωρίς πάροχο, τοπική και χωρίς ανανέωση. */
export function useClassifyAgain(): ClassifyAgain {
  const shared = useContext(ClassifyAgainContext);
  const local = useClassifyAgainAction(undefined);
  return shared ?? local;
}
