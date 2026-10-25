/**
 * ADR-871 §10.6 Υ17/Υ18/Υ19 — **η μηχανή** του καταλόγου του γραφείου.
 *
 * Κατάλογος (δεδομένα + πολιτική) → συμβόλαιο απόδοσης (`MenuEntry`), για **έναν** άνθρωπο
 * σε **ένα** περιβάλλον. Αντικαθιστά το `smart-navigation-factory` (1.173 γρ.) και το
 * `config/navigation` (λεπτό περιτύλιγμα). Τρία πράγματα, όλα εδώ και πουθενά αλλού:
 *
 *   1. **Δικαίωμα**    — απαιτούνται **όλα** τα `policy.permissions`. Φίλτρο UX: η
 *                        προστασία ζει στον διακομιστή (ADR-748 Ε5.η). Ρόλος **bypass**
 *                        (super_admin) τα περνά — ίδιο με το βήμα (4) του PDP (`decideCapability`).
 *   2. **Περιβάλλον**  — 🔴 δηλωνόταν και **δεν επιβαλλόταν** (§10.6 Γ7). Πλέον επιβάλλεται.
 *   3. **Κενή ομάδα**  — φεύγει (`withGroupItems`, ο ένας κανόνας).
 *
 * ⚠️ Η **σειρά** δεν υπολογίζεται: είναι η σειρά δήλωσης του καταλόγου.
 * ⚠️ Το φίλτρο **δουλειάς** και **ικανότητας** τρέχουν **μετά**, στο `useJobFilteredNavigation`
 *    — διαδοχικά και ανεξάρτητα (ADR-748 §14.5). Μην τα ενώσεις εδώ.
 */

import type { MenuEntry, MenuGroup, MenuLink } from '@/types/sidebar';
import { withGroupItems } from '@/config/navigation-node';
import type {
  CatalogEntry,
  CatalogGroup,
  CatalogLink,
  NavigationEnvironment,
  NavPolicy,
} from './catalog-types';
import { MAIN_CATALOG } from './catalog-main';
import { TOOLS_CATALOG } from './catalog-tools';
import { SETTINGS_CATALOG } from './catalog-settings';

interface NavigationAudience {
  readonly permissions: readonly string[];
  readonly environment: NavigationEnvironment;
  /**
   * Ρόλος που παρακάμπτει κάθε έλεγχο δικαιώματος (`isRoleBypass`). 🔴 ADR-923 Φάση 1γ: χωρίς αυτό, ο super_admin
   * (`permissions: []` + μόνο `admin_access` στα claims) **δεν έβλεπε ποτέ** στοιχείο με πολιτική άλλη από
   * `admin_access` — ενώ ο κριτής (`decideCapability`, βήμα 4) του τα δίνει όλα. Μενού και κριτής διαφωνούσαν.
   * Το **περιβάλλον** δεν παρακάμπτεται: είναι ιδιότητα της διεργασίας, όχι του ανθρώπου.
   */
  readonly isBypass?: boolean;
}

/** Το περιβάλλον της διεργασίας. `staging` δεν υπάρχει εδώ: το `NODE_ENV` το αγνοεί. */
function currentNavigationEnvironment(): NavigationEnvironment {
  return process.env.NODE_ENV === 'development' ? 'development' : 'production';
}

function isAllowed(policy: NavPolicy | undefined, audience: NavigationAudience): boolean {
  if (policy === undefined) return true;
  const environmentOk =
    policy.environments === undefined || policy.environments.includes(audience.environment);
  const permissionsOk =
    audience.isBypass === true || (policy.permissions ?? []).every((p) => audience.permissions.includes(p));
  return environmentOk && permissionsOk;
}

/** Ο σύνδεσμος **χωρίς** την πολιτική του — καμία στήλη δεν τη βλέπει. */
function toLink({ policy: _policy, ...link }: CatalogLink): MenuLink {
  return link;
}

function toGroup(group: CatalogGroup, audience: NavigationAudience): MenuGroup | null {
  const { items, ...rest } = group;
  const shell: MenuGroup = { ...rest, items: [] };
  const kept = items.filter((item) => isAllowed(item.policy, audience)).map(toLink);
  return withGroupItems(shell, kept);
}

/** Κατάλογος → ό,τι βλέπει **αυτός** ο άνθρωπος, σε **αυτό** το περιβάλλον. */
export function resolveOfficeMenu(
  catalog: readonly CatalogEntry[],
  audience: NavigationAudience,
): MenuEntry[] {
  const out: MenuEntry[] = [];
  for (const entry of catalog) {
    if (entry.kind === 'link') {
      if (isAllowed(entry.policy, audience)) out.push(toLink(entry));
      continue;
    }
    const group = toGroup(entry, audience);
    if (group !== null) out.push(group);
  }
  return out;
}

const audienceOf = (
  permissions: readonly string[],
  environment: NavigationEnvironment,
  isBypass: boolean,
): NavigationAudience => ({ permissions, environment, isBypass });

export function getMainMenuItems(
  permissions: readonly string[] = [],
  environment: NavigationEnvironment = currentNavigationEnvironment(),
  isBypass = false,
): MenuEntry[] {
  return resolveOfficeMenu(MAIN_CATALOG, audienceOf(permissions, environment, isBypass));
}

export function getToolsMenuItems(
  permissions: readonly string[] = [],
  environment: NavigationEnvironment = currentNavigationEnvironment(),
  isBypass = false,
): MenuEntry[] {
  return resolveOfficeMenu(TOOLS_CATALOG, audienceOf(permissions, environment, isBypass));
}

export function getSettingsMenuItems(
  permissions: readonly string[] = [],
  environment: NavigationEnvironment = currentNavigationEnvironment(),
  isBypass = false,
): MenuEntry[] {
  return resolveOfficeMenu(SETTINGS_CATALOG, audienceOf(permissions, environment, isBypass));
}

/** Ο **πλήρης** κατάλογος (χωρίς φίλτρα) — για ελέγχους ακεραιότητας, όχι για απόδοση. */
export const OFFICE_CATALOGS = {
  main: MAIN_CATALOG,
  tools: TOOLS_CATALOG,
  settings: SETTINGS_CATALOG,
} as const satisfies Record<string, readonly CatalogEntry[]>;
