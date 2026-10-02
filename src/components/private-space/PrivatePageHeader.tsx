/**
 * @fileoverview **Η κεφαλίδα μιας σελίδας του προσωπικού χώρου** — τίτλος + εισαγωγή, γραμμένα μία φορά.
 * @related N.18 · CHECK 3.28 · components/private-space/OwnedListStatus.tsx (ίδιο σκεπτικό)
 * @module components/private-space/PrivatePageHeader
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΤΟ ΖΗΤΗΣΕ Η ΠΥΛΗ.** Η σελίδα «ενδιαφέρεται κάποιος;» (ADR-900) έγινε δίδυμο 7 γραμμών / 51
 * συμβόλων του `MyOwnerPropertiesContent` και η CHECK 3.28 την μπλόκαρε μέσα στο ίδιο diff. Το ίδιο σχήμα ζει και
 * σε άλλες σελίδες του `(me)` — η σύγκλισή τους είναι καταγεγραμμένη στο `.claude-rules/pending-ratchet-work.md`.
 *
 * Τα κείμενα **δίνονται ήδη μεταφρασμένα**: κάθε σελίδα έχει δικό της namespace.
 */

import React from 'react';

interface PrivatePageHeaderProps {
  readonly title: React.ReactNode;
  readonly lead: React.ReactNode;
}

export function PrivatePageHeader({ title, lead }: PrivatePageHeaderProps): React.ReactElement {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{lead}</p>
    </header>
  );
}
