'use client';

/**
 * **Οι δύο πόρτες της οθόνης 1 — «Ζητώ» και «Προσφέρω»**, ως κάρτες δίπλα-δίπλα, αμέσως
 * κάτω από τον ήρωα (ADR-777 §8.79).
 *
 * @related SearchLandingContent · SPEC-777-RESEARCH §12.2 · §12.6 · §17.1 · §25.8
 *
 * 🔑 **ΓΙΑΤΙ ΑΝΕΒΗΚΑΝ ΠΑΝΩ ΑΠΟ ΤΗ ΒΙΤΡΙΝΑ.** Ήταν στοιβαγμένα κουμπιά στο τέλος της
 * σελίδας, ενώ το §12.6 λέει ότι η ζήτηση *«λύνει το κοτόπουλο και το αυγό, ανάποδα από
 * όλους»*: με λίγες αγγελίες, το «πες μας τι ψάχνεις» αξίζει **περισσότερο** από την
 * αναζήτηση. Η θέση του πρέπει να το λέει.
 *
 * ⚠️ **ΤΟ ΚΕΙΜΕΝΟ ΒΟΗΘΕΙΑΣ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟ** (§12.2 · §17.1): χωρίς αυτό το «Ζητώ»
 *    διαβάζεται ως «φόρμα επικοινωνίας» και το «Προσφέρω» ως «ανέβασε φωτογραφία και
 *    τηλέφωνο» — ακριβώς οι δύο αναγνώσεις που απαγορεύονται.
 *
 * ⚠️ **ΚΑΤΑΛΟΓΟΣ, ΟΧΙ ΦΟΡΜΑ** (Α8 · Α14): οι σύνδεσμοι δείχνουν `/demands` και `/offers`.
 *    Ο `(me)/layout.tsx` ζητά ταυτότητα, οπότε ο ανώνυμος περνά από τη σύνδεση **μία**
 *    φορά και προσγειώνεται εκεί που θέλει.
 *
 */

import React from 'react';
import { HandHelping, KeyRound, type LucideIcon } from 'lucide-react';
import { Link } from '@/lib/workspace/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { MY_DEMANDS_ROUTE } from '@/lib/demand/demand-routes';
import { MY_OFFERS_ROUTE } from '@/lib/owner-property/owner-property-routes';

interface DoorCardProps {
  readonly href: typeof MY_DEMANDS_ROUTE | typeof MY_OFFERS_ROUTE;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly hint: string;
}

/** Όλη η κάρτα είναι ο σύνδεσμος — ένας στόχος αφής. */
function DoorCard({ href, icon: Icon, label, hint }: DoorCardProps) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full items-start gap-4 rounded-lg border border-border bg-card p-5 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
        <span className="flex flex-col gap-1">
          <span className="text-lg font-semibold">{label}</span>
          <span className="text-sm text-muted-foreground">{hint}</span>
        </span>
      </Link>
    </li>
  );
}

export function LandingDoors() {
  const { t } = useTranslation(['property-market']);

  // ⚠️ **ΡΗΤΑ ΚΛΕΙΔΙΑ, ΟΧΙ ΠΙΝΑΚΑΣ ΜΕ `t(key)`**: το component ζει στο κέλυφος, και ο
  //    γεννήτορας του shell slice (ADR-744) **αρνείται** δυναμική `t()` — δεν μπορεί να
  //    ξέρει ποια κλειδιά να φορτώσει.
  return (
    <nav>
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
        <DoorCard
          href={MY_DEMANDS_ROUTE}
          icon={HandHelping}
          label={t('property-market:demand.door.label')}
          hint={t('property-market:demand.door.hint')}
        />
        <DoorCard
          href={MY_OFFERS_ROUTE}
          icon={KeyRound}
          label={t('property-market:offer.door.label')}
          hint={t('property-market:offer.door.hint')}
        />
      </ul>
    </nav>
  );
}
