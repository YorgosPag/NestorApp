/**
 * **Ο ΚΑΤΑΛΟΓΟΣ ΤΟΥ ΠΡΟΣΩΠΙΚΟΥ ΧΩΡΟΥ** — «τα δικά μου», μία φορά.
 *
 * @related ADR-871 §5.2 (ο κατάλογος) · §8 Ε5 (μία πηγή για στήλη ΚΑΙ μενού avatar) · §10.3 Υ3
 * @module config/personal-navigation
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΕΠΙΦΑΝΕΙΕΣ, ΕΝΑΣ ΚΑΤΑΛΟΓΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η στήλη του `(me)` και οι συντομεύσεις του `UserMenu` (που αποδίδεται σε **κάθε**
 * κόσμο) ρωτούν την **ίδια** συνάρτηση. Προσθήκη προορισμού = μία γραμμή εδώ, και
 * φαίνεται όπου δηλώνει το `surfaces` του. Πριν, το μενού είχε τέσσερα χειρόγραφα
 * στοιχεία με δική του σειρά.
 *
 * ⚠️ **ΔΕΝ περνά από τον κατάλογο του γραφείου (`office-navigation`)** (ADR-871 §4 λόγος 3 · §10.1 Α11):
 * εκείνο φιλτράρει με δικαιώματα/ικανότητα/δουλειά **εταιρείας**, ενώ εδώ η εμβέλεια
 * είναι ο **άνθρωπος**. Μιλά απευθείας το συμβόλαιο απόδοσης {@link MenuLink}.
 *
 * ⚠️ **Καμία διαδρομή γραμμένη με το χέρι** — όλες από τις σταθερές των ιδιοκτητών
 * τους, και καμία με πρόθεμα `/o/…` (ADR-820 §6: ο προσωπικός χώρος ζει εκτός χώρου
 * γραφείου).
 */

import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Building2,
  FolderArchive,
  Handshake,
  House,
  MessagesSquare,
  Plus,
  Search,
  SearchCheck,
  User,
} from 'lucide-react';

import { AGENCY_DIRECTORY_ROUTE } from '@/components/mandate/agency-directory-route';
import { MY_FIRST_CONTACTS_ROUTE } from '@/lib/contact/first-contact-routes';
import { MY_DEMANDS_ROUTE } from '@/lib/demand/demand-routes';
import { SEARCH_LANDING_ROUTE } from '@/lib/listings/listing-routes';
import { MY_MESSAGES_ROUTE } from '@/lib/network-messaging/network-messaging-routes';
import { MY_OFFERS_ROUTE, NEW_OFFER_ROUTE } from '@/lib/owner-property/owner-property-routes';
import { MY_DOSSIERS_ROUTE } from '@/lib/property-dossier/property-dossier-routes';
import { hasOrganization, resolveAccountRoute, type LandingIdentity } from '@/lib/routes/landing';
import { CREATE_WORKSPACE_ROUTE } from '@/lib/workspace/workspace-routes';
import type { WorkspaceHref } from '@/lib/workspace/route-worlds';
import type { MenuLink } from '@/types/sidebar';

/** Πού εμφανίζεται ένα στοιχείο. */
export type PersonalNavigationSurface = 'sidebar' | 'userMenu';

/**
 * Ο προορισμός του λογαριασμού **κρίνεται**, δεν είναι σταθερός: γραφείο ⇒ `/account`
 * (με πρόθεμα από το σύνορο), ιδιώτης ⇒ `/profile`. Ο κριτής είναι ο **ένας**
 * `resolveAccountRoute` — εδώ μόνο δηλώνεται ότι τον χρειάζεται.
 */
const ACCOUNT_DESTINATION = 'account' as const;

export interface PersonalNavigationEntry {
  readonly id: string;
  /**
   * Κλειδί στο namespace `navigation` — **ίδιο όνομα** με το `MenuLink.navLabelKey` (ADR-871
   * §10.6): η συγκομιδή ιδιοτήτων του shell slice βρίσκει έτσι αυτές τις τιμές ως υποψήφιες
   * του `t(link.navLabelKey)` της στήλης και του μενού avatar.
   */
  readonly navLabelKey: string;
  readonly icon: LucideIcon;
  readonly href: WorkspaceHref | typeof ACCOUNT_DESTINATION;
  readonly surfaces: readonly PersonalNavigationSurface[];
  /** Εμφανίζεται **μόνο** σε όποιον δεν ανήκει σε οργανισμό (ADR-871 §5.2). */
  readonly onlyWithoutOrganization?: boolean;
}

export interface PersonalNavigationGroup {
  readonly id: string;
  readonly labelKey: string;
  readonly entries: readonly PersonalNavigationEntry[];
}

const SIDEBAR_ONLY = ['sidebar'] as const;
const BOTH = ['sidebar', 'userMenu'] as const;

/**
 * **Η σειρά ΕΙΝΑΙ η σειρά και στις δύο επιφάνειες** (WCAG 3.2.3 «same relative
 * order»· ADR-871 §10.3 Υ4).
 */
export const PERSONAL_NAVIGATION: readonly PersonalNavigationGroup[] = [
  {
    id: 'listings',
    labelKey: 'personal.groups.listings',
    entries: [
      { id: 'myOffers', navLabelKey: 'personal.items.myOffers', icon: House, href: MY_OFFERS_ROUTE, surfaces: SIDEBAR_ONLY },
      { id: 'myDemands', navLabelKey: 'personal.items.myDemands', icon: SearchCheck, href: MY_DEMANDS_ROUTE, surfaces: SIDEBAR_ONLY },
    ],
  },
  {
    id: 'communication',
    labelKey: 'personal.groups.communication',
    entries: [
      { id: 'myMessages', navLabelKey: 'personal.items.myMessages', icon: MessagesSquare, href: MY_MESSAGES_ROUTE, surfaces: BOTH },
      { id: 'myContacts', navLabelKey: 'personal.items.myContacts', icon: Handshake, href: MY_FIRST_CONTACTS_ROUTE, surfaces: BOTH },
    ],
  },
  {
    id: 'organization',
    labelKey: 'personal.groups.organization',
    entries: [
      { id: 'myDossiers', navLabelKey: 'personal.items.myDossiers', icon: FolderArchive, href: MY_DOSSIERS_ROUTE, surfaces: BOTH },
    ],
  },
  {
    id: 'discovery',
    labelKey: 'personal.groups.discovery',
    entries: [
      { id: 'searchListings', navLabelKey: 'personal.items.searchListings', icon: Search, href: SEARCH_LANDING_ROUTE, surfaces: SIDEBAR_ONLY },
      { id: 'professionals', navLabelKey: 'personal.items.professionals', icon: Briefcase, href: AGENCY_DIRECTORY_ROUTE, surfaces: SIDEBAR_ONLY },
    ],
  },
  {
    id: 'account',
    labelKey: 'personal.groups.account',
    entries: [
      { id: 'account', navLabelKey: 'personal.items.account', icon: User, href: ACCOUNT_DESTINATION, surfaces: BOTH },
      {
        id: 'createWorkspace',
        navLabelKey: 'personal.items.createWorkspace',
        icon: Building2,
        href: CREATE_WORKSPACE_ROUTE,
        surfaces: SIDEBAR_ONLY,
        onlyWithoutOrganization: true,
      },
    ],
  },
];

/**
 * **Η κύρια πράξη** — πάνω από την πλοήγηση (Drive «New» · Gmail «Compose»).
 *
 * ⚠️ Το κλειδί είναι **το ίδιο** με το CTA της κεφαλίδας (`PublicSiteHeader`): μία
 * πράξη, μία διατύπωση. Ζει σε άλλο namespace, γι' αυτό δηλώνεται με πρόθεμα.
 */
export const PERSONAL_PRIMARY_ACTION = {
  labelKey: 'property-market:offer.door.cta',
  icon: Plus,
  href: NEW_OFFER_ROUTE,
} as const;

/** Ένας σύνδεσμος **έτοιμος για απόδοση** (το ΕΝΑ συμβόλαιο, ADR-871 §10.6), μαζί με το `id` του καταλόγου. */
export interface ResolvedPersonalItem extends MenuLink {
  readonly id: string;
}

export interface ResolvedPersonalGroup {
  readonly id: string;
  readonly labelKey: string;
  readonly items: readonly ResolvedPersonalItem[];
}

/**
 * **Ποια είναι «τα δικά μου» για ΑΥΤΟΝ τον άνθρωπο, σε ΑΥΤΗ την επιφάνεια.**
 *
 * Καθαρή συνάρτηση: λύνει τον λογαριασμό με τον `resolveAccountRoute` και την
 * ορατότητα με τον `hasOrganization` — **καμία** νέα κρίση ταυτότητας (ADR-749).
 * Ομάδες που μένουν άδειες παραλείπονται.
 *
 * @param identity `null` = η ταυτότητα **δεν έχει λυθεί ακόμη**. Τότε ό,τι εξαρτάται
 *   από τον οργανισμό **δεν** εμφανίζεται: ένα «Δημιουργώ χώρο γραφείου» που θα
 *   αναβόσβηνε για ένα καρέ σε μέλος γραφείου είναι υπόσχεση που αίρεται μπροστά του.
 */
export function resolvePersonalNavigation(
  identity: LandingIdentity | null,
  surface: PersonalNavigationSurface,
): readonly ResolvedPersonalGroup[] {
  const known = identity ?? {};
  const hideOrganizationDependent = identity === null || hasOrganization(known);
  return PERSONAL_NAVIGATION.map((group) => ({
    id: group.id,
    labelKey: group.labelKey,
    items: group.entries
      .filter((entry) => entry.surfaces.includes(surface))
      .filter((entry) => !(entry.onlyWithoutOrganization && hideOrganizationDependent))
      .map((entry): ResolvedPersonalItem => ({
        kind: 'link',
        id: entry.id,
        navLabelKey: entry.navLabelKey,
        icon: entry.icon,
        href: entry.href === ACCOUNT_DESTINATION ? resolveAccountRoute(known) : entry.href,
      })),
  })).filter((group) => group.items.length > 0);
}
