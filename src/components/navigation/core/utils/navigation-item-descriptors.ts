/**
 * **ΤΙ ΛΕΕΙ ΜΙΑ ΚΑΡΤΑ ΠΛΟΗΓΗΣΗΣ** — μία απάντηση για τις δύο οθόνες.
 *
 * @related components/DesktopMultiColumn.tsx · components/MobileNavigation.tsx
 * @related CHECK 3.28 (jscpd, ADR-583/584) · N.0.2 Boy Scout · N.11 i18n SSoT
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — μετρημένο 2026-08-25
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ιεραρχική πλοήγηση ζει σε **δύο** αρχεία — `DesktopMultiColumn` (494 γρ.)
 * και `MobileNavigation` (274 γρ.) — που έγραφαν την ΙΔΙΑ απάντηση δύο φορές.
 * Το CHECK 3.28 μετρούσε **6 κλώνους** ανάμεσά τους.
 *
 * ⚠️ Δεν ήταν αντίγραφα. Ήταν αντίγραφα **που είχαν αποκλίνει**, και **κάθε**
 * απόκλιση ήταν ελάττωμα στην οθόνη:
 *
 * **1. 🔴 ΩΜΑ ΚΛΕΙΔΙΑ i18n — ΚΑΙ ΣΤΙΣ ΔΥΟ ΟΘΟΝΕΣ, ΤΡΙΑ ΤΟ ΚΑΘΕΝΑ.**
 *    Οι ετικέτες των badge ζουν στο namespace **`navigation-entities`**, ενώ
 *    **και τα δύο** component καλούν `useTranslation('navigation')`. Το Desktop
 *    έγραφε `t(key)` — αστοχία, γιατί ρωτούσε **λάθος namespace**· το Mobile δεν
 *    καλούσε **καθόλου** `t()`. Το `src/i18n/config.ts` **δεν ορίζει
 *    `fallbackNS`**, οπότε και οι δύο δρόμοι κατέληγαν στο ίδιο αποτέλεσμα: το
 *    κλειδί **ζωγραφισμένο αυτούσιο** πάνω στην κάρτα.
 *
 *    ⚠️ Δηλαδή το `t()` του Desktop **δεν ήταν η σωστή εκδοχή** — ήταν η ίδια
 *    βλάβη με πιο πειστική όψη.
 *
 * **2. 🔴 ΕΝΑ ΑΠΟ ΤΑ ΤΡΙΑ ΚΛΕΙΔΙΑ ΔΕΝ ΥΠΗΡΧΕ ΚΑΝ.**
 *    Το λεξιλόγιο ζητούσε `filters.buildings.withoutUnits` — **κανένα locale**
 *    δεν το ορίζει. Το locale ονομάζει την έννοια `withoutProperties`. Άρα ακόμα
 *    και με σωστό namespace, το ένα στα τρία θα έμενε ωμό.
 *
 * **3. ⚠️ ΔΥΟ ΑΠΑΝΤΗΣΕΙΣ ΓΙΑ ΤΟ ΑΦΜ.**
 *    Το Desktop έδειχνε το ΑΦΜ **μόνο** σε εταιρεία χωρίς έργα· το Mobile
 *    **πάντα**. Το Mobile μάλιστα το έθετε δύο φορές, με **ταυτόσημη** έκφραση —
 *    δεύτερη ανάθεση **αποδεδειγμένα νεκρή**, το αποτύπωμα της αντιγραφής.
 *
 *    Κρατήθηκε ο κανόνας του Desktop: το `extraInfo` είναι **εφεδρική** γραμμή —
 *    γεμίζει όταν ο υπότιτλος πάψει να πληροφορεί. Με έργα, ο υπότιτλος λέει τον
 *    κλάδο· χωρίς έργα, γίνεται προτροπή και το ΑΦΜ επαναφέρει την ταυτότητα.
 *    Αυτό είναι **κανόνας**· το «πάντα ΑΦΜ» δεν ήταν κανόνας, ήταν συνέπεια της
 *    αντιγραφής (το αποδεικνύει η νεκρή ανάθεση).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΤΟ ΕΙΔΕ ΚΑΜΙΑ ΠΥΛΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * · **CHECK 3.8** εξάγει μόνο κλήσεις μεταφραστή με **σταθερό** όρισμα — εδώ το
 *   κλειδί είναι **έκφραση** (`getNavigationFilterCategories().x`), άρα αόρατο·
 *   και στο Mobile δεν υπήρχε **καμία** κλήση μεταφραστή να εξαχθεί.
 *
 *   ⚠️ Αυτή η παράγραφος **δεν επιτρέπεται** να περιέχει παράδειγμα κλήσης με
 *   κυριολεκτικό όρισμα: ο εξαγωγέας του 3.8 είναι **regex**, δεν ξεχωρίζει
 *   σχόλιο από κώδικα, και θα το μετρούσε ως **υπαρκτό κλειδί που λείπει** —
 *   πύλη που κοκκινίζει πάνω στην τεκμηρίωση του κανόνα που επιβάλλει. Το ίδιο
 *   λάθος προειδοποιεί ρητά το CHECK 3.36· έγινε ξανά **γράφοντας αυτό εδώ**.
 * · **CHECK 3.51** (ωμά κλειδιά) διαβάζει **SSR HTML** — το badge ζωγραφίζεται
 *   μόνο σε πελάτη, μόνο για εταιρεία **χωρίς έργα**.
 * · **CHECK 3.34** δεν περπατά αυτά τα αρχεία: **δεν** ανήκουν στην κλειστότητα
 *   του κελύφους (επαληθεύτηκε στο `shell-slice.manifest.json`).
 *
 * ⇒ Το εύρημα το γέννησε **η ίδια η αφαίρεση του διπλότυπου**. Αυτό είναι το
 *   επιχείρημα του SSoT, όχι η αισθητική: δύο αντίγραφα δεν είναι διπλή δουλειά,
 *   είναι **δύο ευκαιρίες να διαφωνήσουν σιωπηλά**.
 *
 * ⚠️ **ΜΗΝ** γυρίσεις τις ετικέτες badge σε `t(key)` χωρίς το πρόθεμα
 *    `navigation-entities:` — το namespace του hook είναι `navigation` και
 *    **δεν υπάρχει `fallbackNS`**, οπότε η αστοχία είναι **σιωπηλή** και
 *    καταλήγει στην οθόνη.
 * ⚠️ **ΜΗΝ** αντιγράψεις αυτές τις συναρτήσεις σε τρίτη οθόνη πλοήγησης —
 *    κάλεσέ τες. Το CHECK 3.28 μετρά κλώνους **ανάμεσα στα σταδιοποιημένα**
 *    αρχεία, άρα ένα τρίτο αντίγραφο περνά αθόρυβα αν προσγειωθεί μόνο του.
 */

import { NAVIGATION_ENTITIES } from '../../config';
import { getNavigationFilterCategories } from '@/config/vocabulary/labels/navigation';
import { formatBuildingLabel } from '@/lib/entity-formatters';
import type { useTranslation } from '@/i18n/hooks/useTranslation';

/**
 * Ο μεταφραστής, **όπως ακριβώς τον επιστρέφει το hook**.
 *
 * ⚠️ Παράγεται από το `useTranslation` αντί να ξαναγραφεί ως υπογραφή: μια
 * χειρόγραφη `(key: string) => string` θα ήταν **δεύτερη αλήθεια** που αποκλίνει
 * σιωπηλά μόλις αλλάξει το hook.
 */
export type NavigationTranslate = ReturnType<typeof useTranslation>['t'];

/**
 * Το namespace όπου **ΟΝΤΩΣ** ζουν οι ετικέτες των badge.
 *
 * ⚠️ Και τα δύο component καλούν `useTranslation('navigation')`, ΟΧΙ αυτό. Το
 * πρόθεμα είναι ο **μόνος** λόγος που οι ετικέτες λύνονται.
 */
const BADGE_NAMESPACE = 'navigation-entities';

/** Η μοναδική κατάσταση badge που ξέρει η πλοήγηση: «άδειο, δεν έχει παιδιά». */
export const NAVIGATION_EMPTY_BADGE_STATUS = 'no_projects' as const;

export type NavigationEmptyBadgeStatus = typeof NAVIGATION_EMPTY_BADGE_STATUS;

/**
 * **Ό,τι ΛΕΕΙ** μια κάρτα πλοήγησης — ταυτότητα και περιεχόμενο μαζί.
 *
 * ⚠️ Το εικονίδιο και ο τίτλος ανήκουν **εδώ** και όχι στο σημείο κλήσης: όσο
 * έμεναν έξω, οι δύο οθόνες ξανάγραφαν τις ίδιες τρεις γραμμές και το CHECK 3.28
 * τις ξαναμετρούσε ως κλώνο. Ό,τι μένει στο component είναι **συμπεριφορά**
 * (`onClick`, `isSelected`, `variant`, σύνδεσμοι) — εκεί οι δύο οθόνες **όντως**
 * διαφέρουν.
 */
export interface NavigationItemDescriptor {
  icon: typeof NAVIGATION_ENTITIES.property.icon;
  iconColor: string;
  title: string;
  subtitle: string;
  extraInfo?: string;
  badgeStatus?: NavigationEmptyBadgeStatus;
  badgeText?: string;
}

/** Μια ενέργεια της στήλης «Ενέργειες» — ίδια σε desktop και κινητό. */
export interface NavigationActionDescriptor {
  key: string;
  page: 'properties' | 'projects' | 'buildings';
  icon: typeof NAVIGATION_ENTITIES.property.icon;
  iconColor: string;
  title: string;
  subtitle: string;
}

/** Ελάχιστο σχήμα εταιρείας — ό,τι χρειάζεται η κάρτα, τίποτα παραπάνω. */
interface CompanyShape {
  companyName: string;
  industry?: string | null;
  vatNumber?: string | null;
}

/** Ελάχιστο σχήμα κτιρίου για την ετικέτα της ενέργειας. */
interface BuildingShape {
  code?: string | null;
  name: string;
}

/**
 * Η **μία** θέση όπου μια ετικέτα badge γίνεται κείμενο.
 *
 * ⚠️ Το κλειδί έρχεται από το λεξιλόγιο (SSoT) και **δεν** είναι σταθερά, άρα
 * είναι αόρατο στο CHECK 3.8. Το κενό το καλύπτει η άγκυρα
 * `navigation-item-descriptors.test.ts`, που απαιτεί να **λύνονται και στα δύο**
 * locale — αυστηρότερο από τη σάρωση, γιατί ελέγχει την **τιμή**, όχι την ύπαρξη.
 */
function emptyBadge(
  categoryKey: string,
  t: NavigationTranslate,
): Pick<NavigationItemDescriptor, 'badgeStatus' | 'badgeText'> {
  return {
    badgeStatus: NAVIGATION_EMPTY_BADGE_STATUS,
    badgeText: t(`${BADGE_NAMESPACE}:${categoryKey}`),
  };
}

/**
 * Τι λέει η κάρτα μιας **εταιρείας**.
 *
 * @param projectsLoading Όσο φορτώνουν τα έργα, «χωρίς έργα» είναι **άγνωστο**,
 *        όχι ψευδές — γι' αυτό το badge σιωπά αντί να πει λάθος.
 */
export function describeNavigationCompany(params: {
  company: CompanyShape;
  hasProjects: boolean;
  isNavigationCompany: boolean;
  projectsLoading: boolean;
  t: NavigationTranslate;
}): NavigationItemDescriptor {
  const { company, hasProjects, isNavigationCompany, projectsLoading, t } = params;

  const identity = {
    icon: NAVIGATION_ENTITIES.company.icon,
    iconColor: NAVIGATION_ENTITIES.company.color,
    title: company.companyName,
  };

  if (hasProjects) {
    return { ...identity, subtitle: company.industry || t('columns.companies.defaultSubtitle') };
  }

  return {
    ...identity,
    subtitle: isNavigationCompany
      ? t('columns.companies.addProjects')
      : t('columns.companies.noProjects'),
    extraInfo: company.vatNumber
      ? t('columns.companies.vatNumber', { vatNumber: company.vatNumber })
      : undefined,
    ...(projectsLoading
      ? {}
      : emptyBadge(getNavigationFilterCategories().company_without_projects, t)),
  };
}

/** Τι λέει η κάρτα ενός **έργου**. */
export function describeNavigationProject(params: {
  project: { name: string };
  buildingCount: number;
  t: NavigationTranslate;
}): NavigationItemDescriptor {
  const { project, buildingCount, t } = params;

  return {
    icon: NAVIGATION_ENTITIES.project.icon,
    iconColor: NAVIGATION_ENTITIES.project.color,
    title: project.name,
    subtitle: t('columns.projects.buildingCount', { count: buildingCount }),
    ...(buildingCount > 0
      ? {}
      : emptyBadge(getNavigationFilterCategories().project_without_buildings, t)),
  };
}

/** Τι λέει η κάρτα ενός **κτιρίου**. */
export function describeNavigationBuilding(params: {
  building: { name: string };
  propertyCount: number;
  t: NavigationTranslate;
}): NavigationItemDescriptor {
  const { building, propertyCount, t } = params;

  return {
    icon: NAVIGATION_ENTITIES.building.icon,
    iconColor: NAVIGATION_ENTITIES.building.color,
    title: building.name,
    subtitle: t('columns.buildings.propertyCount', { count: propertyCount }),
    ...(propertyCount > 0
      ? {}
      : emptyBadge(getNavigationFilterCategories().building_without_units, t)),
  };
}

/**
 * Οι ενέργειες που προσφέρει ένα επιλεγμένο κτίριο.
 *
 * Η σειρά **είναι** το νόημα: από το στενότερο (ακίνητα του κτιρίου) προς το
 * ευρύτερο (έργο). Η τρίτη υπάρχει μόνο όταν υπάρχει επιλεγμένο έργο.
 */
export function buildBuildingActionDescriptors(params: {
  selectedBuilding: BuildingShape;
  selectedProject: { name: string } | null | undefined;
  propertyCount: number;
  t: NavigationTranslate;
}): NavigationActionDescriptor[] {
  const { selectedBuilding, selectedProject, propertyCount, t } = params;

  const descriptors: NavigationActionDescriptor[] = [
    {
      key: 'properties',
      page: 'properties',
      icon: NAVIGATION_ENTITIES.property.icon,
      iconColor: NAVIGATION_ENTITIES.property.color,
      title: t('columns.actions.viewProperties'),
      subtitle: t('columns.actions.propertiesCount', { count: propertyCount }),
    },
    {
      key: 'buildings',
      page: 'buildings',
      icon: NAVIGATION_ENTITIES.building.icon,
      iconColor: NAVIGATION_ENTITIES.building.color,
      title: t('columns.actions.buildingDetails'),
      subtitle: formatBuildingLabel(selectedBuilding.code, selectedBuilding.name),
    },
  ];

  if (selectedProject) {
    descriptors.push({
      key: 'projects',
      page: 'projects',
      icon: NAVIGATION_ENTITIES.project.icon,
      iconColor: NAVIGATION_ENTITIES.project.color,
      title: t('columns.actions.projectDetails'),
      subtitle: selectedProject.name,
    });
  }

  return descriptors;
}
