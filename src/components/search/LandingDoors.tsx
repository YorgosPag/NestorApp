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
 * ➕ **Η ΤΡΙΤΗ ΠΟΡΤΑ (ADR-900 §3.7) ΕΙΝΑΙ ΦΟΡΜΑ, ΚΑΙ ΔΕΝ ΣΠΑΕΙ ΤΟΝ ΚΑΝΟΝΑ**: το Α8 απαγορεύει τη
 *    **βαριά** φόρμα καταχώρισης σε στενή οθόνη· εδώ υπάρχει ένα πεδίο διεύθυνσης, και ο προορισμός
 *    (`/interest-check`) δουλεύει σε κάθε συσκευή. Πιάνει όλο το πλάτος της λίστας (`sm:col-span-2`).
 */

import React from 'react';
import { HandHelping, KeyRound, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import { OwnerInterestEntry } from '@/components/demand/interest-check/OwnerInterestEntry';
import { PROSE_MEASURE_CLASS } from '@/components/shared/prose-measure';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { MY_DEMANDS_ROUTE, newDemandWithTimingHref } from '@/lib/demand/demand-routes';
import type { DemandTimingKind } from '@/types/property-demand';
import { MY_OFFERS_ROUTE } from '@/lib/owner-property/owner-property-routes';
import type { WorkspaceHref } from '@/lib/workspace/route-worlds';

interface DoorCardProps {
  readonly href: WorkspaceHref;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly hint: string;
  /**
   * Ζωντανό σήμα δίπλα στην ετικέτα (π.χ. αδιάβαστα μηνύματα) — ADR-820 §5.4.
   * Η **ίδια** κάρτα υπηρετεί τις πόρτες «Ζητώ · Προσφέρω» **και** τη λωρίδα
   * «Οι χώροι μου»· δεύτερη κάρτα θα ήταν δίδυμο (N.18 / CHECK 3.28).
   */
  readonly signal?: React.ReactNode;
  /**
   * `compact` = **μία γραμμή υπότιτλου** (ADR-820 §5.4): η λωρίδα «Οι χώροι μου» είναι
   * γρήγορη πρόσβαση πάνω από τον ήρωα, όχι διαφήμιση — δεν πρέπει να τον σπρώχνει κάτω.
   * `regular` (προεπιλογή) = οι πόρτες «Ζητώ · Προσφέρω», όπου το κείμενο **εξηγεί**.
   */
  readonly density?: 'regular' | 'compact';
  /**
   * Δευτερεύοντες σύνδεσμοι **μέσα** στο περίγραμμα της κάρτας, κάτω από τον κύριο (ADR-777 §8.99).
   * Ζουν **δίπλα** στον κύριο σύνδεσμο, όχι μέσα του: σύνδεσμος μέσα σε σύνδεσμο είναι άκυρη HTML.
   */
  readonly footer?: React.ReactNode;
}

/** Το κείμενο βοήθειας κρατά το μέτρο πρόζας (`PROSE_MEASURE_CLASS`, ADR-820 §5.4.1) — η κάρτα απλώνει, η γραμμή όχι. */
const DOOR_DENSITY = {
  regular: { link: 'items-start gap-4 p-5', icon: 'mt-0.5 size-6', label: 'text-lg', hint: PROSE_MEASURE_CLASS },
  compact: { link: 'items-center gap-3 px-4 py-3', icon: 'size-5', label: 'text-base', hint: 'truncate' },
} as const;

/**
 * Όλη η κάρτα είναι ο σύνδεσμος — ένας στόχος αφής. Το περίγραμμα ζει στο `<li>`, ώστε ένα `footer`
 * να μπαίνει μέσα στην **ίδια** κάρτα χωρίς να γίνει τέκνο του συνδέσμου.
 */
export function DoorCard({ href, icon: Icon, label, hint, signal, density = 'regular', footer }: DoorCardProps) {
  const d = DOOR_DENSITY[density];
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <Link
        href={href}
        className={cn(
          'flex flex-1 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          d.link,
        )}
      >
        <Icon aria-hidden="true" className={cn('shrink-0 text-muted-foreground', d.icon)} />
        <span className="flex min-w-0 flex-col gap-1">
          <span className={cn('flex items-center gap-2 font-semibold', d.label)}>
            {label}
            {signal}
          </span>
          <span className={cn('text-sm text-muted-foreground', d.hint)}>{hint}</span>
        </span>
      </Link>
      {footer}
    </li>
  );
}

/**
 * ADR-777 §8.99 — **το πρώτο βήμα της ζήτησης, απαντημένο από την αρχική.** Όποιος ξέρει ήδη «πότε»
 * πηγαίνει κατευθείαν στη φόρμα (`?when=`). Η κάρτα μένει σύνδεσμος προς τον **κατάλογο**, όπως ορίζει
 * η Α8.
 *
 * ⚠️ **Τύπος, όχι τιμή, από το `types/property-demand`**: εκείνο σέρνει runtime modules που δεν
 *    ανήκουν στο κέλυφος. Το `Record<DemandTimingKind, …>` εγγυάται ότι νέο «πότε» χωρίς ετικέτα εδώ
 *    δεν μεταγλωττίζεται. Τα κλειδιά είναι ρητά, γιατί ο γεννήτορας του shell slice αρνείται δυναμική `t()`.
 */
function DemandTimingShortcuts(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const labels: Record<DemandTimingKind, string> = {
    now: t('property-market:demand.form.timing.now'),
    window: t('property-market:demand.form.timing.window'),
    whenever: t('property-market:demand.form.timing.whenever'),
  };
  const kinds = Object.keys(labels) as DemandTimingKind[];
  const legendId = React.useId();

  return (
    <footer className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-5 py-3 text-sm">
      <span id={legendId} className="text-muted-foreground">
        {t('property-market:demand.form.timing.legend')}
      </span>
      <ul aria-labelledby={legendId} className="m-0 flex list-none flex-wrap gap-2 p-0">
        {kinds.map((kind) => (
          <li key={kind}>
            <Link
              href={newDemandWithTimingHref(kind, '')}
              className="inline-block rounded-full border border-border px-3 py-1 font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {labels[kind]}
            </Link>
          </li>
        ))}
      </ul>
    </footer>
  );
}

/**
 * ADR-900 §3.7 — η πόρτα του ιδιοκτήτη (πεδίο διεύθυνσης). Η κάρτα ζει στο **ένα** `OwnerInterestEntry`·
 * εδώ μόνο τοποθετείται, σε όλο το πλάτος της λίστας.
 */
function OwnerInterestDoor(): React.ReactElement {
  return (
    <li className="min-w-0 sm:col-span-2">
      <OwnerInterestEntry />
    </li>
  );
}

export function LandingDoors() {
  const { t } = useTranslation(['property-market']);

  // ⚠️ **ΡΗΤΑ ΚΛΕΙΔΙΑ, ΟΧΙ ΠΙΝΑΚΑΣ ΜΕ `t(key)`**: το component ζει στο κέλυφος, και ο
  //    γεννήτορας του shell slice (ADR-744) **αρνείται** δυναμική `t()` — δεν μπορεί να
  //    ξέρει ποια κλειδιά να φορτώσει.
  //
  // 🔑 **`data-shell-span="full"` — ΕΝΑΣ ΑΞΟΝΑΣ ΣΕ ΟΛΗ ΤΗΝ ΟΘΟΝΗ (ADR-820 §5.4.1).** Στο μέτρο
  //    της πρόζας οι πόρτες ήταν το **μόνο** στοιχείο με δικό του άξονα (719px κεντραρισμένα,
  //    ενώ λωρίδα χώρων · ήρωας · βιτρίνα = 2336px σε 2400px παράθυρο). Rightmove · Zillow ·
  //    M3 layout grid: η ζώνη κάτω από τον ήρωα στοιχίζεται στο **ίδιο** πλαίσιο.
  //    ⚠️ Πρέπει να μένει **άμεσο τέκνο** του μέτρου — ο επιλογέας είναι `>`.
  return (
    <nav data-shell-span="full">
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
        <DoorCard
          href={MY_DEMANDS_ROUTE}
          icon={HandHelping}
          label={t('property-market:demand.door.label')}
          hint={t('property-market:demand.door.hint')}
          footer={<DemandTimingShortcuts />}
        />
        <DoorCard
          href={MY_OFFERS_ROUTE}
          icon={KeyRound}
          label={t('property-market:offer.door.label')}
          hint={t('property-market:offer.door.hint')}
        />
        <OwnerInterestDoor />
      </ul>
    </nav>
  );
}
