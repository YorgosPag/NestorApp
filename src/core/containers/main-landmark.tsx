'use client';

/**
 * 🧭 **Ο ΕΝΑΣ ΚΡΙΤΗΣ ΤΟΥ ΟΡΟΣΗΜΟΥ `main`**: «είμαι ήδη μέσα σε `<main>`;» (ADR-939 §6.1 Γ2).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΕΛΥΣΕ
 * ────────────────────────────────────────────────────────────────────────────
 * Το `ErrorFallbackUI` (κοινή οθόνη σφάλματος, ~56 `error.tsx` + `global-error.tsx`)
 * απέδιδε **πάντα** `<main>`. Μετρημένο 2026-11-12: **52** από τους καταναλωτές του
 * ζουν στο `(app)`, όπου το κέλυφος δίνει ήδη `<main>` (`MainContentBridge` →
 * `ShellSurface as="main"`). Αποτέλεσμα: **διπλό** ορόσημο `main`. Αντίστροφα, το
 * `BackendUnavailableFallback` δεν απέδιδε κανένα, οπότε στην `(link)` η σελίδα
 * έμενε **χωρίς** `main`. Το ίδιο component χρειάζεται `main` σε ένα σημείο και
 * `div` σε άλλο. Ο φάκελος δεν το ξέρει. Το ξέρει **μόνο το δέντρο**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ CONTEXT ΚΑΙ ΟΧΙ PROP ΣΤΟΥΣ 56 ΚΑΤΑΝΑΛΩΤΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 * Ένα prop `landmark` θα ήταν **56 χειρόγραφες δηλώσεις** που επαναλαμβάνουν κάτι
 * που ήδη καθορίζει ο φάκελος. Θα έσπαγε σιωπηλά με κάθε μετακόμιση σελίδας από
 * group σε group (ακριβώς ό,τι έγινε με τη μετακόμιση στην `(link)`). Εδώ ο
 * **ιδιοκτήτης** του `<main>` το δηλώνει **μία** φορά (`ShellSurface as="main"`),
 * και κάθε περιεχόμενο από κάτω **ρωτά**. Το ίδιο σχήμα με το `HeadingLevel` του
 * React Aria και τα «automatic heading levels» των design systems: το ορόσημο
 * προκύπτει από τη θέση, δεν γράφεται με το χέρι.
 *
 * ⚠️ **ΜΗΝ** χρησιμοποιήσεις το `MainLandmark` για το κύριο `<main>` μιας σελίδας
 * που το **κατέχει**. Εκεί το σωστό είναι `ShellSurface as="main"` ή ωμό `<main>`.
 * Το `MainLandmark` είναι για περιεχόμενο που **δεν ξέρει πού θα αποδοθεί**
 * (οθόνες σφάλματος, εφεδρείες).
 *
 * ⚠️ Ένα ωμό `<main>` γραμμένο με το χέρι **δεν** δηλώνει πεδίο: το context το
 * γεννά μόνο το `ShellSurface as="main"` ή το ίδιο το `MainLandmark`.
 *
 * @module core/containers/main-landmark
 */

import * as React from 'react';

const WithinMainLandmarkContext = React.createContext<boolean>(false);

/** Δηλώνει ότι τα παιδιά αποδίδονται **μέσα** σε ορόσημο `main`. */
export function MainLandmarkScope({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  return <WithinMainLandmarkContext.Provider value>{children}</WithinMainLandmarkContext.Provider>;
}

/** `true` όταν κάποιος πρόγονος έχει ήδη αποδώσει (και δηλώσει) `<main>`. */
function useIsWithinMainLandmark(): boolean {
  return React.useContext(WithinMainLandmarkContext);
}

interface MainLandmarkProps {
  readonly children: React.ReactNode;
  readonly className?: string;
}

/**
 * `<main>` όταν δεν υπάρχει ήδη, αλλιώς `<div>`, με την **ίδια** διάταξη και στις
 * δύο περιπτώσεις. Όταν αποδίδει `main`, δηλώνει και το πεδίο για ό,τι είναι από κάτω.
 */
export function MainLandmark({ children, className }: MainLandmarkProps): React.ReactElement {
  if (useIsWithinMainLandmark()) return <div className={className}>{children}</div>;
  return (
    <main className={className}>
      <MainLandmarkScope>{children}</MainLandmarkScope>
    </main>
  );
}
