/**
 * **Οι προορισμοί της δημόσιας κεφαλίδας — ΜΙΑ λίστα, δύο παρουσιάσεις** (ADR-809 §9).
 *
 * @related PublicSiteHeader (μπάρα, από `lg`) · PublicSiteMenuSheet (συρτάρι, κάτω από `lg`)
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: μέχρι 2026-09-25 οι ακτίνες, οι πόρτες και η πράξη ήταν γραμμένες
 * **μέσα** στο JSX της κεφαλίδας. Με το μενού κινητού θα χρειάζονταν **δεύτερη** γραφή —
 * και δύο λίστες προορισμών αποκλίνουν στον πρώτο νέο σύνδεσμο (σχήμα που το repo έχει
 * πληρώσει μετρημένα: CHECK 3.34 · 3.37 · 3.49). Μπάρα και συρτάρι διαβάζουν **αυτό**.
 *
 * ⚠️ **ΤΡΕΙΣ ΚΑΤΗΓΟΡΙΕΣ, ΟΧΙ ΜΙΑ** (ADR-777 §8.82 · ADR-660 §5.11): **ακτίνες** (πλοήγηση
 * στις σελίδες του κόμβου) · **πόρτες** (κατάλογοι του ιδιώτη — ποτέ φόρμα, Α8) · **πράξη**
 * (η μόνη που δείχνει σε φόρμα). Οι ετικέτες είναι τα **ίδια** κλειδιά με τις καρτέλες του
 * κόμβου ⇒ μία λέξη για μία έννοια.
 */

import { typedHref, type WorkspaceHref } from '@/lib/workspace/route-worlds';
import { SHORT_STAY_LANDING_ROUTE } from '@/lib/listings/listing-routes';
import { AGENCY_DIRECTORY_ROUTE } from '@/components/mandate/agency-directory-route';
import { MY_DEMANDS_ROUTE } from '@/lib/demand/demand-routes';
import { MY_OFFERS_ROUTE, NEW_OFFER_ROUTE } from '@/lib/owner-property/owner-property-routes';

export interface PublicSiteDestination {
  /** Σταθερό κλειδί React + άγκυρα των tests. */
  readonly id: string;
  readonly href: WorkspaceHref;
  readonly labelKey: string;
}

/** Οι ακτίνες του κόμβου (§8.82) — πλοήγηση, όχι πράξη. */
export const PUBLIC_SITE_SPOKES: readonly PublicSiteDestination[] = [
  { id: 'pros', href: typedHref(AGENCY_DIRECTORY_ROUTE), labelKey: 'search-results:landing.modes.pros' },
  { id: 'stay', href: typedHref(SHORT_STAY_LANDING_ROUTE), labelKey: 'search-results:landing.modes.stay' },
];

/** Οι πόρτες του ιδιώτη — **κατάλογοι**, που ανοίγουν σε κάθε συσκευή (Α8 · Α14). */
export const PUBLIC_SITE_DOORS: readonly PublicSiteDestination[] = [
  { id: 'demand', href: typedHref(MY_DEMANDS_ROUTE), labelKey: 'property-market:demand.door.label' },
  { id: 'offer', href: typedHref(MY_OFFERS_ROUTE), labelKey: 'property-market:offer.door.label' },
];

/** Η **μία** πράξη — η μόνη πόρτα που δείχνει σε φόρμα (ADR-660 §5.11). */
export const PUBLIC_SITE_PRIMARY_ACTION: PublicSiteDestination = {
  id: 'new-offer',
  href: typedHref(NEW_OFFER_ROUTE),
  labelKey: 'property-market:offer.door.cta',
};
