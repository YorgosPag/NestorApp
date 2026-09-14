'use client';

/**
 * @fileoverview **ΜΙΑ ΓΡΑΜΜΗ «ΕΤΙΚΕΤΑ → ΤΙΜΗ»** της δημόσιας βιτρίνας.
 * @related ADR-841 §7 Α6 · ADR-846 Φ3 · components/mandate/AgencyProfileContent
 * @module components/mandate/AgencyFact
 *
 * 🔑 **ΓΙΑΤΙ ΒΓΗΚΕ ΣΕ ΔΙΚΟ ΤΟΥ ΑΡΧΕΙΟ** *(Φ3)*: ζούσε μέσα στο `AgencyProfileContent`,
 * και ο τέταρτος καταναλωτής — η γραμμή της **δηλωμένης εμβέλειας** — έπρεπε κι αυτός
 * να φύγει από εκεί *(το αρχείο ακουμπούσε το όριο των 500 γραμμών, N.7.1)*. Ένα
 * `export` του `Fact` **από** το `AgencyProfileContent` **προς** τη γραμμή εμβέλειας θα
 * ήταν **κυκλική εισαγωγή**: η σελίδα εισάγει τη γραμμή, η γραμμή τη σελίδα.
 *
 * ⚠️ **Μετακόμισε, δεν αντιγράφηκε** — δεύτερο `Fact` θα ήταν ακριβώς το δίδυμο που
 * κυνηγά το CHECK 3.28, και θα απέκλινε στο πρώτο restyle.
 */

import React from 'react';

/**
 * Μία μικρή, ονομασμένη γραμμή «ετικέτα → τιμή».
 *
 * ⚠️ **Το `children` μπαίνει ΜΕΣΑ στο `<dd>`, όχι δίπλα του** — και είναι κανόνας HTML,
 * όχι γούστο: μέσα σε `<dl>` ένα `<div>` επιτρέπεται να περιέχει **μόνο** `<dt>` και
 * `<dd>`. Ένας χάρτης «δίπλα στην τιμή» θα ήταν **άκυρο έγγραφο** — και η δημόσια
 * βιτρίνα είναι ακριβώς η σελίδα που διαβάζουν αναγνώστες οθόνης και μηχανές.
 */
export function Fact({
  label,
  value,
  hint,
  children,
}: {
  readonly label: string;
  /** Προαιρετικό (Α21.17): η γραμμή «Επικοινωνία» είναι **πράξεις** (κουμπιά, σύνδεσμοι), όχι κείμενο. */
  readonly value?: string;
  readonly hint?: string;
  readonly children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="m-0 text-sm font-medium text-foreground">{label}</dt>
      <dd className="m-0 flex flex-col gap-2 text-sm text-muted-foreground">
        {value !== undefined ? <span>{value}</span> : null}
        {/* 🧹 **Boy scout (N.0.2)**: το `hint` ήταν `<p>` **αδελφός** του `<dd>` — δηλαδή
            ακριβώς η άκυρη δομή που περιγράφει το σχόλιο παραπάνω, στο ίδιο component
            που τη γράφει. Μπήκε μέσα στο `<dd>`, όπου του επιτρέπεται να ζει. */}
        {hint !== undefined ? <span className="text-xs">{hint}</span> : null}
        {children}
      </dd>
    </div>
  );
}
