/**
 * ADR-871 §10.6 Υ21(β) — **ΑΚΕΡΑΙΟΤΗΤΑ ΤΟΥ ΚΑΤΑΛΟΓΟΥ**, εκτελώντας τον.
 *
 * Ό,τι ο τύπος δεν μπορεί να πει (και ό,τι ο πράκτορας δεν επαληθεύει με `tsc`, N.17):
 *   Κ1 — κάθε κλειδί κόμβου είναι **μοναδικό** (αλλιώς δύο γραμμές φωτίζουν μαζί)
 *   Κ2 — καμία ομάδα **κενή** στον κατάλογο
 *   Κ3 — κάθε `navLabelKey` λύνεται σε `el` **και** `en` (N.11)
 *   Κ4 — κάθε κλειδί που ταξινομεί το ADR-748 (δουλειές · κοινά · πηγές αναφορών) **υπάρχει**
 *        στον κατάλογο — αλλιώς η ταξινόμηση δείχνει σε φάντασμα και σιωπηλά δεν κάνει τίποτα
 *   Κ5 — το `environments` **επιβάλλεται** (Υ18)
 *   Κ6 — ομάδα που αδειάζει από την πολιτική **φεύγει** (Υ19)
 *   Κ7 — η πολιτική **δεν** φτάνει στη στήλη
 */

import { House } from 'lucide-react';
import type { MenuEntry } from '@/types/sidebar';
import { navNodeKey } from '@/config/navigation-node';
import { COMMON_SIDEBAR_NODES, JOBS, JOB_ORDER, LEGAL_DOCUMENTS_STATUS, REPORT_SOURCES } from '@/config/jobs-registry';
import el from '@/i18n/locales/el/navigation.json';
import en from '@/i18n/locales/en/navigation.json';
import type { CatalogEntry } from '../catalog-types';
import { OFFICE_CATALOGS, getSettingsMenuItems, resolveOfficeMenu } from '../resolve-office-navigation';

const ALL: readonly CatalogEntry[] = [
  ...OFFICE_CATALOGS.main,
  ...OFFICE_CATALOGS.tools,
  ...OFFICE_CATALOGS.settings,
];

/** Κάθε κλειδί κόμβου — ομάδες **και** σύνδεσμοι, σε κάθε επίπεδο. */
const nodeKeys = (entries: readonly CatalogEntry[]): string[] =>
  entries.flatMap((e) => (e.kind === 'link' ? [e.href] : [e.id, ...e.items.map((l) => l.href)]));

const titleKeys = (entries: readonly CatalogEntry[]): string[] =>
  entries.flatMap((e) => (e.kind === 'link' ? [e.navLabelKey] : [e.navLabelKey, ...e.items.map((l) => l.navLabelKey)]));

function resolves(locale: unknown, dotted: string): boolean {
  let cur: unknown = locale;
  for (const part of dotted.split('.')) {
    if (typeof cur !== 'object' || cur === null || !Object.hasOwn(cur, part)) return false;
    cur = Object.getOwnPropertyDescriptor(cur, part)?.value;
  }
  return typeof cur === 'string' && cur.length > 0;
}

describe('ADR-871 §10.6 — ακεραιότητα του καταλόγου του γραφείου', () => {
  it('Κ1 — κάθε κλειδί κόμβου εμφανίζεται ΜΙΑ φορά', () => {
    const keys = nodeKeys(ALL);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  it('Κ2 — καμία ομάδα κενή στον κατάλογο', () => {
    expect(ALL.filter((e) => e.kind === 'group' && e.items.length === 0)).toEqual([]);
  });

  it.each([['el', el], ['en', en]] as const)('Κ3 — κάθε navLabelKey λύνεται στο %s', (_lang, locale) => {
    expect(titleKeys(ALL).filter((key) => !resolves(locale, key))).toEqual([]);
  });

  it('Κ4 — κάθε κλειδί που ταξινομεί το ADR-748 υπάρχει στον κατάλογο', () => {
    const known = new Set(nodeKeys(ALL));
    const classified = [
      ...JOB_ORDER.flatMap((job) => JOBS[job].sidebar),
      ...COMMON_SIDEBAR_NODES,
      ...Object.keys(REPORT_SOURCES),
      ...Object.values(REPORT_SOURCES).flatMap((s) => (s.kind === 'node' ? [s.node] : [])),
      LEGAL_DOCUMENTS_STATUS.groupId,
      LEGAL_DOCUMENTS_STATUS.livingChildRoute,
    ];
    expect(classified.filter((key) => !known.has(key))).toEqual([]);
  });

  it('Κ4′ — η νεκρή διαδρομή `/legal-documents` δεν ξαναδηλώνεται πουθενά στον κατάλογο', () => {
    expect(nodeKeys(ALL)).not.toContain(LEGAL_DOCUMENTS_STATUS.deadRoute);
  });

  it('Κ5 — «Debug»: ναι στην ανάπτυξη, ΟΧΙ στην παραγωγή (ακόμη και για διαχειριστή)', () => {
    const hrefs = (entries: MenuEntry[]) => entries.flatMap((e) => (e.kind === 'link' ? [e.href] : e.items.map((l) => l.href)));
    expect(hrefs(getSettingsMenuItems(['admin_access'], 'development'))).toContain('/debug');
    expect(hrefs(getSettingsMenuItems(['admin_access'], 'production'))).not.toContain('/debug');
  });

  it('Κ6 — ομάδα που αδειάζει από την πολιτική φεύγει ολόκληρη', () => {
    const catalog: CatalogEntry[] = [
      {
        kind: 'group',
        id: 'settings',
        navLabelKey: 'menu.settings',
        icon: House,
        items: [{ kind: 'link', navLabelKey: 'admin.setup', icon: House, href: '/admin/setup', policy: { permissions: ['admin_access'] } }],
      },
      { kind: 'link', navLabelKey: 'pages.projects', icon: House, href: '/projects' },
    ];
    const audience = { permissions: [], environment: 'production' } as const;
    expect(resolveOfficeMenu(catalog, audience).map(navNodeKey)).toEqual(['/projects']);
    expect(resolveOfficeMenu(catalog, { ...audience, permissions: ['admin_access'] }).map(navNodeKey)).toEqual([
      'settings',
      '/projects',
    ]);
  });

  it('Κ7 — η πολιτική (`policy`) δεν φτάνει ποτέ στη στήλη', () => {
    const leaked = getSettingsMenuItems(['admin_access'], 'development').flatMap((e) =>
      e.kind === 'link' ? [e] : e.items,
    );
    expect(leaked.filter((link) => 'policy' in link)).toEqual([]);
  });
});
