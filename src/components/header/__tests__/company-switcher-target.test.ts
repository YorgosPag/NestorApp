/**
 * @fileoverview **ΑΓΚΥΡΕΣ: μέσα σε χώρο, ο επιλογέας ΠΛΟΗΓΕΙ** (ADR-849 Β1 — Linear · Vercel · Slack).
 * @related components/header/CompanySwitcher
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/contexts/SuperAdminCompanyContext', () => ({ useSuperAdminCompany: jest.fn() }));
jest.mock('@/lib/workspace/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
  useWorkspaceAlias: jest.fn(),
}));

import fs from 'node:fs';
import path from 'node:path';

import { switchTarget } from '../CompanySwitcher';

describe('switchTarget', () => {
  it('Ε1 🔴 μέσα σε χώρο ⇒ νέα ΔΙΕΥΘΥΝΣΗ, όχι κρυφή κατάσταση', () => {
    expect(switchTarget('comp_a', '/properties', 'comp_b')).toEqual({
      kind: 'navigate',
      href: '/o/comp_b/properties',
    });
  });

  it('Ε2: η ταυτότητα της οντότητας ΠΕΦΤΕΙ — ανήκει στην παλιά εταιρεία', () => {
    expect(switchTarget('comp_a', '/properties/prop_x', 'comp_b')).toEqual({
      kind: 'navigate',
      href: '/o/comp_b/properties',
    });
  });

  it('Ε3: από τον ιδιωτικό χώρο ή την αρχική ⇒ η αρχική της εταιρείας', () => {
    expect(switchTarget('me', '/', 'comp_b')).toEqual({ kind: 'navigate', href: '/o/comp_b' });
  });

  it('Ε4: εκτός χώρου (σελίδες διαχείρισης) ⇒ επιλογή, όπως πάντα', () => {
    expect(switchTarget(null, '/admin/users', 'comp_b')).toEqual({ kind: 'select' });
  });
});

/**
 * 🔴 **ΑΓΚΥΡΑ ΚΛΑΣΗΣ — ο προορισμός του επιλογέα ΥΠΑΡΧΕΙ** (ADR-923 §23.2 K3).
 *
 * Ο επιλογέας κρατά μόνο τον **τομέα** (`/catalog/attributes` ⇒ `/catalog`). Άρα κάθε φάκελος
 * πρώτου επιπέδου κάτω από `o/[workspace]` είναι **πιθανός προορισμός** και οφείλει να έχει
 * `page` — αλλιώς η εναλλαγή εταιρείας δίνει 404. Μετρήθηκε: **έξι** τομείς χωρίς ρίζα
 * (`catalog` πρώτα, μετά `construction`, `dxf`, `listings`, `parking`, `storage`) και ένας
 * νεκρός φάκελος (`geo/`, μόνο `error.tsx` της κλειστής πόρτας `/geo/canvas`, σβήστηκε).
 */
describe('κάθε τομέας του χώρου έχει ρίζα', () => {
  const WORKSPACE_DIR = path.resolve(__dirname, '../../../app/(app)/o/[workspace]');
  const PAGE_FILE = /^page\.(tsx|ts|jsx|js)$/;

  /** Ρητές εξαιρέσεις, **με λόγο**. Κάθε γραμμή εδώ είναι χρέος, όχι κανόνας. */
  const NO_ROOT_PAGE: Readonly<Record<string, string>> = {};

  /** Φάκελοι που **δεν** είναι τμήμα διαδρομής: ομάδες `(x)`, δυναμικά `[x]`, ιδιωτικοί `_x`, παράλληλοι `@x`. */
  const isRouteSegment = (name: string) => !/^[([_@]/.test(name);

  const sections = fs
    .readdirSync(WORKSPACE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isRouteSegment(entry.name))
    .map((entry) => entry.name);

  const hasRootPage = (section: string) =>
    fs.readdirSync(path.join(WORKSPACE_DIR, section)).some((file) => PAGE_FILE.test(file));

  it('Ε5: ο κατάλογος τομέων διαβάστηκε (όχι πράσινο επειδή δεν κοίταξε)', () => {
    expect(sections.length).toBeGreaterThan(10);
    expect(sections).toContain('catalog');
  });

  it.each(sections.filter((s) => !(s in NO_ROOT_PAGE)))('Ε6 🔴 /%s έχει page', (section) => {
    expect(hasRootPage(section)).toBe(true);
  });

  it('Ε7: κάθε εξαίρεση είναι ακόμη αληθινή (ο φάκελος υπάρχει και δεν έχει page)', () => {
    const stale = Object.keys(NO_ROOT_PAGE).filter((s) => !sections.includes(s) || hasRootPage(s));
    expect(stale).toEqual([]);
  });
});
