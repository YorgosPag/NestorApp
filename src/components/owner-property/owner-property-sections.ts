/**
 * @fileoverview **Το μητρώο ενοτήτων της σελίδας ακινήτου ιδιοκτήτη** (`/offers/[offerId]`) — ποιες ενότητες υπάρχουν,
 * με ποια σειρά, και **τι λέει η καθεμία για τον εαυτό της** στη λίστα, πριν ανοίξει.
 * @related ADR-946 · `core/layouts/SectionListDetail` · `OwnerPropertySectionContent` (ό,τι αποδίδει κάθε ενότητα)
 * @module components/owner-property/owner-property-sections
 *
 * 🔑 **Οι συνόψεις διαβάζουν ΜΟΝΟ ό,τι ο γονέας έχει ήδη** (`mandateViews` · `stats`) — καμία νέα ανάγνωση δικτύου για
 *   να γεμίσει μια γραμμή λίστας. Όπου τα δεδομένα ζουν μέσα σε παιδί (υποχρεώσεις · επαλήθευση ιδιοκτησίας), η γραμμή
 *   λέει **τι** περιέχει η ενότητα, όχι έναν αριθμό που θα έπρεπε να μαντέψουμε (ADR-946 §ανοιχτά).
 * 🔑 Η **πρώτη** ενότητα είναι η προεπιλογή του φαρδιού και δεν γράφεται στη διεύθυνση (`useUrlSection`).
 */

import type { SectionEntry } from '@/core/layouts';
import type { ListingStatsState } from '@/hooks/owner-property/useOwnerPortfolioStats';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { CLOSED, EXPIRING } from '@/lib/mandate/mandate-standing';
import type { OwnerMandateView } from '@/lib/mandate/owner-mandate-view';

const OWNER_PROPERTY_SECTION_IDS = ['overview', 'mandate', 'documents', 'history'] as const;
type OwnerPropertySectionId = (typeof OWNER_PROPERTY_SECTION_IDS)[number];

export function isOwnerPropertySection(id: string): id is OwnerPropertySectionId {
  return (OWNER_PROPERTY_SECTION_IDS as readonly string[]).includes(id);
}

/**
 * Το πρόθεμα των κειμένων των ενοτήτων. ⚠️ **Τοπικό, όχι εξαγόμενο**: ο γεννήτορας του route slice (ADR-744) λύνει
 * template κλειδιά μόνο από σταθερές **του ίδιου** module — εισαγόμενη σταθερά = «ανεπίλυτη δυναμική t()» = άρνηση slice.
 */
const OWNER_SECTIONS_KEY = 'property-market:offer.sections';

/** Ζωντανές εντολές (ό,τι δεν έκλεισε) και πόσες λήγουν σύντομα — ο ίδιος ταξινομητής με τον κατάλογο του γραφείου. */
export function ownerMandateTally(
  views: readonly Pick<OwnerMandateView, 'group'>[],
): { readonly live: number; readonly expiring: number } {
  const live = views.filter((view) => view.group !== CLOSED);
  return { live: live.length, expiring: live.filter((view) => view.group === EXPIRING).length };
}

/** Σύνολο προβολών από τότε που μετράμε — `null` όσο δεν υπάρχει μέτρηση (δεν λέμε «0» για «δεν ξέρουμε»). */
export function totalViewsOf(stats: ListingStatsState): number | null {
  return stats.state === 'ready' ? stats.summary.views?.total ?? null : null;
}

export interface OwnerSectionFacts {
  readonly mandateViews: readonly Pick<OwnerMandateView, 'group'>[];
  readonly stats: ListingStatsState;
}

function overviewEntry(facts: OwnerSectionFacts, t: Translate): SectionEntry {
  const views = totalViewsOf(facts.stats);
  return {
    id: 'overview',
    label: t(`${OWNER_SECTIONS_KEY}.overview.title`),
    summary: views === null
      ? t(`${OWNER_SECTIONS_KEY}.overview.summary`)
      : t(`${OWNER_SECTIONS_KEY}.overview.views`, { count: views }),
  };
}

function mandateEntry(facts: OwnerSectionFacts, t: Translate): SectionEntry {
  const tally = ownerMandateTally(facts.mandateViews);
  return {
    id: 'mandate',
    label: t(`${OWNER_SECTIONS_KEY}.mandate.title`),
    summary: tally.live === 0
      ? t(`${OWNER_SECTIONS_KEY}.mandate.none`)
      : t(`${OWNER_SECTIONS_KEY}.mandate.live`, { count: tally.live }),
    count: tally.expiring,
    attention: tally.expiring > 0,
  };
}

/**
 * Ένας κατασκευαστής **ανά id του μητρώου** — `Record`, άρα νέα ενότητα χωρίς γραμμή λίστας δεν μεταγλωττίζεται.
 * ⚠️ Τα κλειδιά γράφονται **ρητά** (όχι `${id}.title`): μεταβλητή μέσα στο κλειδί = ανεπίλυτη δυναμική t() (ADR-744).
 */
const ENTRY_OF: Record<OwnerPropertySectionId, (facts: OwnerSectionFacts, t: Translate) => SectionEntry> = {
  overview: overviewEntry,
  mandate: mandateEntry,
  documents: (_facts, t) => ({
    id: 'documents',
    label: t(`${OWNER_SECTIONS_KEY}.documents.title`),
    summary: t(`${OWNER_SECTIONS_KEY}.documents.summary`),
  }),
  history: (_facts, t) => ({
    id: 'history',
    label: t(`${OWNER_SECTIONS_KEY}.history.title`),
    summary: t(`${OWNER_SECTIONS_KEY}.history.summary`),
  }),
};

/** Οι γραμμές της λίστας, στη σειρά του μητρώου. */
function ownerPropertySectionEntries(facts: OwnerSectionFacts, t: Translate): readonly SectionEntry[] {
  return OWNER_PROPERTY_SECTION_IDS.map((id) => ENTRY_OF[id](facts, t));
}

/** Οι γραμμές, μεταφρασμένες. */
export function useOwnerPropertySectionEntries(facts: OwnerSectionFacts): readonly SectionEntry[] {
  const { t } = useTranslation(['property-market']);
  return ownerPropertySectionEntries(facts, t);
}
