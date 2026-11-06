'use client';

/**
 * ProcurementSectionShell — το **ΕΝΑ** κέλυφος της ενότητας προμηθειών (ADR-928 §5.24 · ζωντανός έλεγχος, εύρημα #1).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ, ΜΕΤΡΗΜΕΝΟ (2026-11-06): το `PageContainer` + `ProcurementSubNav` γραφόταν **με το χέρι σε 7 σελίδες**
 *    (rfqs · analytics · hub · αρχική · βιβλιοθήκη · συγγραφή ρήτρας · επεξεργαστής προτύπου), σε **τρεις** παραλλαγές
 *    (`div` / `header`, πάνω / κάτω από την κεφαλίδα). Οι δύο σελίδες κύριων συμβάσεων (Φ3γ-3) το **ξέχασαν** — και
 *    κανένα εργαλείο δεν μπορούσε να το πει, γιατί «η σελίδα βάζει μόνη της την υποπλοήγηση» είναι ανάθεση, όχι κανόνας.
 * 🔑 Η απόφαση «πού και πώς μπαίνει η υποπλοήγηση» ζει **εδώ**. Κάθε σελίδα της ενότητας, λίστα **και** λεπτομέρεια,
 *    φορά αυτό το κέλυφος (απόφαση Giorgio 2026-11-06, «παντού στην ενότητα»: η ενεργή καρτέλα λέει πού βρίσκεσαι, όπως
 *    οι καρτέλες αποθετηρίου του GitHub μέσα σε ένα issue).
 * ⚠️ ΓΙΑΤΙ ΟΧΙ `procurement/layout.tsx` (που είναι το πρότυπο του App Router): ο γεννήτορας του κελύφους i18n (ADR-744,
 *    CHECK 3.34) μετρά **κάθε** `src/app/**\/layout.tsx` ως καθολικό κέλυφος ⇒ το namespace `procurement` θα ταξίδευε σε
 *    **κάθε** διαδρομή της εφαρμογής (20ό namespace, πλήθος που μόνο μειώνεται)· η μεταφορά των ετικετών στο `navigation`
 *    θα έσπαγε το ταβάνι του (14.443 + 422 > 14.500 bytes). Όταν ο γεννήτορας αποκτήσει slices ανά τμήμα για τα ένθετα
 *    layouts, αυτό το κέλυφος μετακομίζει σε `layout.tsx` αυτούσιο.
 *
 * `scroll`:
 *   · `'self'` (προεπιλογή) — το σώμα κρατά δική του κύλιση (master-detail, επεξεργαστές, `ListContainer`).
 *   · `'shell'` — έγγραφο που ρέει: το κέλυφος δίνει **μία** περιοχή κύλισης κάτω από την υποπλοήγηση, που μένει ορατή.
 *
 * @module subapps/procurement/components/ProcurementSectionShell
 */

import type { ReactNode } from 'react';
import { PageContainer } from '@/core/containers';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';

export type ProcurementSectionScroll = 'self' | 'shell';

export interface ProcurementSectionShellProps {
  /** Το όνομα της περιοχής της σελίδας (συνήθως ο τίτλος της). */
  readonly ariaLabel: string;
  readonly scroll?: ProcurementSectionScroll;
  readonly children: ReactNode;
}

export function ProcurementSectionShell({ ariaLabel, scroll = 'self', children }: ProcurementSectionShellProps) {
  return (
    <PageContainer ariaLabel={ariaLabel}>
      <header className="mt-2 shrink-0 px-2">
        <ProcurementSubNav className="mb-0" />
      </header>
      {scroll === 'shell' ? <div className="min-h-0 flex-1 overflow-y-auto">{children}</div> : children}
    </PageContainer>
  );
}
