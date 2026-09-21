/**
 * ADR-871 §10.6 Υ21(α) — **ΧΡΥΣΗ ΙΣΟΔΥΝΑΜΙΑ.**
 *
 * Το `office-navigation.golden.json` καταγράφηκε **ΠΡΙΝ** αγγιχτεί ο κώδικας, τρέχοντας τον
 * τότε `smart-navigation-factory` για main/tools/settings × {development, production} ×
 * {χωρίς δικαιώματα, `admin_access`}. Η νέα μηχανή πρέπει να δίνει **το ίδιο** — τίτλος,
 * διεύθυνση, σήμα, παιδιά, **σειρά** — εκτός από τις αλλαγές της λίστας `DECLARED_CHANGES`,
 * η καθεμία με το §10.6 που την αποφάσισε.
 *
 * Γιατί υπάρχει: ο πράκτορας δεν τρέχει `tsc` (N.17)· αυτό είναι **εκτελούμενη** απόδειξη ότι
 * η αναδόμηση 1.173 γραμμών δεν άλλαξε τίποτα που δεν δηλώθηκε.
 *
 * ⛔ ΜΗΝ «διορθώσεις» το JSON για να περάσει. Αλλαγή στη στήλη = νέα γραμμή στη λίστα, με λόγο.
 */

import type { MenuEntry, MenuLink } from '@/types/sidebar';
import type { NavigationEnvironment } from '../catalog-types';
import {
  getMainMenuItems,
  getSettingsMenuItems,
  getToolsMenuItems,
} from '../resolve-office-navigation';
import golden from './office-navigation.golden.json';

interface GoldenNode {
  title: string;
  href: string;
  badge?: string;
  children?: GoldenNode[];
}
type GoldenTree = GoldenNode[];

/** Η ομάδα δεν έχει διεύθυνση (Υ13)· για τη σύγκριση, το href που είχε ως γονιός. */
const LEGACY_PARENT_HREF: Readonly<Record<string, string>> = {
  spaces: '/spaces',
  sales: '/sales',
  crm: '/crm',
  reports: '/reports',
  accounting: '/accounting',
  legal: '/legal-documents',
  settings: '/settings',
};

const linkNode = (link: MenuLink): GoldenNode => ({
  title: link.navLabelKey,
  href: link.href,
  ...(link.badge ? { badge: link.badge } : {}),
});

function toGolden(entries: readonly MenuEntry[]): GoldenTree {
  return entries.map((entry) =>
    entry.kind === 'link'
      ? linkNode(entry)
      : {
          title: entry.navLabelKey,
          href: LEGACY_PARENT_HREF[entry.id] ?? `?${entry.id}`,
          ...(entry.badge ? { badge: entry.badge } : {}),
          children: entry.items.map(linkNode),
        },
  );
}

const clone = (tree: GoldenTree): GoldenTree => JSON.parse(JSON.stringify(tree)) as GoldenTree;
const groupOf = (tree: GoldenTree, href: string) => tree.find((n) => n.href === href && n.children);

interface Scenario {
  readonly menu: 'main' | 'tools' | 'settings';
  readonly env: NavigationEnvironment;
  readonly perms: 'none' | 'admin';
}

/**
 * **ΟΙ ΜΟΝΕΣ ΕΠΙΤΡΕΠΤΕΣ ΔΙΑΦΟΡΕΣ.** Καθεμία: τι, γιατί, και ποια απόφαση του ADR-871 §10.6.
 */
const DECLARED_CHANGES: ReadonlyArray<(tree: GoldenTree, s: Scenario) => void> = [
  // Υ15 — τα hubs ως ρητό πρώτο παιδί «Επισκόπηση» (ήταν απρόσιτα: ο γονιός είναι κουμπί).
  (tree, s) => {
    if (s.menu !== 'main') return;
    for (const href of ['/spaces', '/sales', '/accounting']) {
      groupOf(tree, href)?.children?.unshift({ title: 'menu.overview', href });
    }
  },
  // Υ15 — ΕΝΑ κλειδί για κάθε «Επισκόπηση»· το `crm.overview` (ίδιο κείμενο) διαγράφηκε.
  (tree, s) => {
    if (s.menu !== 'main') return;
    const overview = groupOf(tree, '/crm')?.children?.find((c) => c.href === '/crm');
    if (overview) overview.title = 'menu.overview';
  },
  // Υ16 — η ομάδα «Αναφορές» έβγαινε «Διοικητική Σύνοψη»: ο συμπερασμός της έδινε το κλειδί
  //        του πρώτου παιδιού της. Δηλωμένος τίτλος ⇒ `pages.reports` («Αναφορές»).
  (tree, s) => {
    if (s.menu !== 'main') return;
    const reports = groupOf(tree, '/reports');
    if (reports) reports.title = 'pages.reports';
  },
  // Υ18 — το `environments` δηλωνόταν και ΔΕΝ επιβαλλόταν: «Debug» στην παραγωγή.
  (tree, s) => {
    if (s.menu !== 'settings' || s.env !== 'production') return;
    const settings = groupOf(tree, '/settings');
    if (settings?.children) settings.children = settings.children.filter((c) => c.href !== '/debug');
  },
];

const RESOLVERS = { main: getMainMenuItems, tools: getToolsMenuItems, settings: getSettingsMenuItems } as const;
const PERMS = { none: [] as string[], admin: ['admin_access'] };
const GOLDEN: Readonly<Record<string, GoldenTree>> = golden;

const scenarios: Scenario[] = (['main', 'tools', 'settings'] as const).flatMap((menu) =>
  (['development', 'production'] as const).flatMap((env) =>
    (['none', 'admin'] as const).map((perms) => ({ menu, env, perms })),
  ),
);

describe('ADR-871 §10.6 Υ21(α) — χρυσή ισοδυναμία με τον παλιό factory', () => {
  it('η λήψη καλύπτει και τα 12 σενάρια (αλλιώς το test δεν ελέγχει ό,τι λέει)', () => {
    expect(Object.keys(GOLDEN).sort()).toEqual(scenarios.map((s) => `${s.menu}|${s.env}|${s.perms}`).sort());
  });

  it.each(scenarios)('$menu · $env · $perms — ίδιο αποτέλεσμα, εκτός από τις δηλωμένες αλλαγές', (s) => {
    const expected = clone(GOLDEN[`${s.menu}|${s.env}|${s.perms}`]);
    for (const change of DECLARED_CHANGES) change(expected, s);
    const actual = toGolden(RESOLVERS[s.menu](PERMS[s.perms], s.env));
    expect(actual).toEqual(expected);
  });
});
