'use client';

/**
 * @fileoverview **Λίστα ενοτήτων → ενότητα → πλαϊνό πάνελ** για τη σελίδα **μίας** εγγραφής που κυλά (π.χ. το ακίνητο
 * του ιδιοκτήτη). Ένα μητρώο ενοτήτων, τρεις παρουσιάσεις κατά πλάτος.
 * @related ADR-946 · ADR-797 (ο καταναλωτής δηλώνει `data-shell-span="full"`) · `useUrlSection` · `record-action-bar`
 * @module core/layouts/SectionListDetail
 *
 * | Πλάτος | Τι φαίνεται |
 * |---|---|
 * | `<md` | **ή** πλαϊνό (σύνοψη) + λίστα ως κάρτες, **ή** η ενότητα με «‹ πίσω» — drill-down (Material 3 · Apple HIG) |
 * | `md`–`xl` | λίστα (sticky) · πλαϊνό στην κορυφή της στήλης ενότητας · ενότητα |
 * | `≥xl` | λίστα (sticky) · ενότητα · πλαϊνό **sticky** — το πάνελ ιδιοτήτων του Revit/Figma, πάντα ορατό |
 *
 * 🔑 **«Ποια ενότητα» = διεύθυνση, «πόσες στήλες» = CSS** — το δόγμα του `read-only-viewer/viewer-panes.ts`. Καμία
 *   γεωμετρία δεν ρωτά το `useViewportClass`· μόνο η **συμπεριφορά ιστορικού** (`push` στο κινητό, `replace` στο φαρδύ).
 * 🔑 **Ένα αντίτυπο, ποτέ δύο** (κανόνας `ListDetailsSplit`, ADR-912): ενότητα και πλαϊνό αποδίδονται **μία** φορά· τα
 *   πλάτη τα μετακινούν μόνο με τοποθέτηση στο πλέγμα. Η σειρά DOM (λίστα → πλαϊνό → ενότητα) είναι η οπτική σειρά στο
 *   `md`· στο `xl` το πλαϊνό πάει δεξιά (πάνελ επιθεωρητή, όπως στο `ListingDetailContent`).
 * ⚠️ **Καμία κλάση κελύφους εδώ** (`p-*` · `max-w-*` · `data-shell-*`, CHECK 3.63 Κ1): το πλάτος το ανοίγει ο
 *   καταναλωτής με `data-shell-span="full"` στο δικό του `<main>`, όπως το `NetworkThreadScreen`.
 * ⚠️ **Κανένα `@container`** — σπάει το `sticky` των παιδιών (ADR-797, `shell-surface.css`).
 */

import { useId, useMemo, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

import { useViewportClass } from '@/hooks/media/useViewportClass';
import { useUrlSection } from '@/hooks/useUrlTabParam';
import { cn } from '@/lib/utils';

import { RecordActionBarProvider } from './record-action-bar';
import { SectionNavList, type SectionEntry } from './SectionNavList';

interface SectionListDetailProps {
  readonly sections: readonly SectionEntry[];
  /** Η παράμετρος της διεύθυνσης (προεπιλογή `section`). */
  readonly param?: string;
  readonly navLabel: string;
  readonly backLabel: string;
  readonly asideLabel: string;
  /** Το πλαϊνό πάνελ: κατάσταση + ενέργειες. Οι ενέργειες με `RecordActionLead` πάνε στην κάτω μπάρα του κινητού. */
  readonly aside: ReactNode;
  /** Η ενεργή ενότητα — αποδίδεται **μία** φορά. */
  readonly children: (activeId: string) => ReactNode;
  /** Ειδοποίηση επιλογής (π.χ. η σελίδα κλείνει τη φόρμα επεξεργασίας). */
  readonly onSelect?: (sectionId: string) => void;
}

/** Μία στήλη στο κινητό · 2 από το `md` · 3 από το `xl`. Το κενό ζει **εδώ**, όχι στο μέτρο του κελύφους (Φ.Κ6). */
const GRID = cn(
  'grid grid-cols-1 gap-6',
  'md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]',
  'xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,20rem)]',
);
const NAV = 'row-start-2 md:sticky md:top-4 md:col-start-1 md:row-span-2 md:row-start-1 md:self-start xl:row-span-1';
const ASIDE = cn(
  'row-start-1 flex min-w-0 flex-col gap-4 md:col-start-2 md:row-start-1',
  // Sticky πάνελ ψηλότερο από την οθόνη = περιεχόμενο που δεν φτάνεται ποτέ ⇒ δική του κύλιση.
  'xl:sticky xl:top-4 xl:col-start-3 xl:max-h-[calc(100dvh-2rem)] xl:self-start xl:overflow-y-auto',
);
const DETAIL = 'flex min-w-0 flex-col gap-4 md:col-start-2 md:row-start-2 xl:row-start-1';

/** Η στήλη της ενότητας: «‹ πίσω» (μόνο κινητό) · τίτλος · περιεχόμενο. Κρυφή στο κινητό όσο δεν ζητήθηκε ενότητα. */
function SectionPane({
  title,
  backLabel,
  onBack,
  drilled,
  children,
}: {
  readonly title: string | undefined;
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly drilled: boolean;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn(DETAIL, !drilled && 'max-md:hidden')}>
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-11 items-center gap-1 self-start text-sm font-medium text-foreground underline md:hidden"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {backLabel}
      </button>
      <h2 id={headingId} className="m-0 text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function SectionListDetail({
  sections,
  param = 'section',
  navLabel,
  backLabel,
  asideLabel,
  aside,
  children,
  onSelect,
}: SectionListDetailProps) {
  const ids = useMemo(() => sections.map((entry) => entry.id), [sections]);
  const { requested, open, close } = useUrlSection(param, ids);
  const viewport = useViewportClass();
  const activeId = requested ?? ids[0] ?? '';
  const drilled = requested !== null;

  const select = (sectionId: string): void => {
    open(sectionId, viewport === 'narrow' ? 'push' : 'replace');
    onSelect?.(sectionId);
  };

  return (
    <RecordActionBarProvider>
      <div data-section-pane={drilled ? 'section' : 'list'} className={GRID}>
        <SectionNavList
          sections={sections}
          currentId={activeId}
          onSelect={select}
          ariaLabel={navLabel}
          className={cn(NAV, drilled && 'max-md:hidden')}
        />
        <aside aria-label={asideLabel} className={cn(ASIDE, drilled && 'max-md:hidden')}>
          {aside}
        </aside>
        <SectionPane
          title={sections.find((entry) => entry.id === activeId)?.label}
          backLabel={backLabel}
          onBack={close}
          drilled={drilled}
        >
          {children(activeId)}
        </SectionPane>
      </div>
    </RecordActionBarProvider>
  );
}
