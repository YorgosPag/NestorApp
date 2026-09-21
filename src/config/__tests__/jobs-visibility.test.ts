/**
 * ADR-748 **Φάση 3.6** — ANCHOR TESTS για το **υλικό των τριών επιπέδων**.
 *
 * Τα Μ-1…Μ-7 ζουν στο `jobs-access.test.ts` και χαρακτηρίζουν **τι κρύβεται**.
 * Εδώ χαρακτηρίζεται **τι μπορείς να πεις γι' αυτό που κρύφτηκε** — δηλαδή ό,τι
 * κάνει δυνατά τα επίπεδα 2 και 3 του δείκτη:
 *
 *   Μ-8   Το φίλτρο **δεν πετάει** ό,τι κόβει· τα κρυμμένα είναι ανακτήσιμα
 *   Μ-9   Ο δείκτης της κεφαλίδας **δεν μολύνεται** από τα υπο-στοιχεία
 *   Μ-10  Η σύνοψη των τριών μενού είναι **μία** πράξη, όχι τρεις χειρόγραφες
 *
 * 🔴 ΓΙΑΤΙ ΤΟ Μ-9 ΕΙΝΑΙ ΤΟ ΠΙΟ ΣΗΜΑΝΤΙΚΟ ΕΔΩ: το ελάττωμα των 17:13 ήταν
 * **ακριβώς** η ένωση των δύο αριθμών (22 = 9 κλάδοι + 13 υπο-στοιχεία). Η
 * Φάση 3.6 φέρνει τον δεύτερο αριθμό **πίσω στην οθόνη** — άρα φέρνει και τον
 * πειρασμό να ξανα-προστεθεί. Το Μ-9 κοκκινίζει την ημέρα που θα συμβεί.
 *
 * ADR-871 §10.6 (2026-09-21): ο κατάλογος μιλά **σύνδεσμο | ομάδα** — η ομάδα έχει
 * `id`, όχι διεύθυνση. Τα στημένα δέντρα έρχονται από το `helpers/nav-node-fixtures`.
 */

import { PERMISSIONS } from '@/lib/auth/types';
import type { MenuGroup, MenuLink } from '@/types/sidebar';
import {
  getMainMenuItems,
  getToolsMenuItems,
  getSettingsMenuItems,
} from '../office-navigation/resolve-office-navigation';
import { navNodeKey } from '../navigation-node';
import { JOB_ORDER } from '../jobs-registry';
import { JOB_ALL, type JobSelection } from '../jobs-access';
import {
  REPORTS_GROUP_ID,
  filterItemsByJob,
  filterTilesByJob,
  summarizeHidden,
} from '../jobs-visibility';
import { childHrefs, filterFixtures, group, keyOf, link } from './helpers/nav-node-fixtures';

const ALL_PERMISSIONS = Object.keys(PERMISSIONS);
const LIVE_MENUS = [getMainMenuItems, getToolsMenuItems, getSettingsMenuItems] as const;

/** Τα τρία ζωντανά μενού, όπως τα χτίζει η πραγματική πλοήγηση. */
function liveMenus() {
  return LIVE_MENUS.map((build) => build(ALL_PERMISSIONS, 'production'));
}

const filterLive = (items: readonly (MenuLink | MenuGroup)[], job: JobSelection) =>
  filterItemsByJob<MenuLink, MenuGroup>(items, job);

// ============================================================================
// Μ-8 — ΤΟ ΦΙΛΤΡΟ ΔΕΝ ΠΕΤΑΕΙ Ο,ΤΙ ΚΟΒΕΙ
//
// Χωρίς αυτό, το Επίπεδο 3 («Αποκάλυψη») είναι αδύνατο: δεν αρκεί να ξέρεις
// **πόσα** έφυγαν — πρέπει να μπορείς να τα βάλεις **πίσω στη θέση τους**.
// ============================================================================

describe('Μ-8 — τα κρυμμένα είναι ανακτήσιμα, όχι μόνο μετρημένα', () => {
  it.each([...JOB_ORDER])(
    '🔑 visible ∪ hidden = η είσοδος, χωρίς επικάλυψη και χωρίς απώλεια (%s)',
    (job) => {
      for (const items of liveMenus()) {
        const result = filterLive(items, job);
        const seen = [...result.visible, ...result.hidden].map(navNodeKey);
        expect(seen.slice().sort()).toEqual(items.map(navNodeKey).sort());
        expect(new Set(seen).size).toBe(items.length);
      }
    },
  );

  it('🔒 ο δείκτης ΠΑΡΑΓΕΤΑΙ από τη λίστα — δεν είναι ανεξάρτητος μετρητής', () => {
    // Το ελάττωμα των 17:13 ήταν δύο μονοπάτια που αύξαναν τον ΙΔΙΟ μετρητή με
    // διαφορετική μονάδα. Όσο το `hiddenCount` είναι `hidden.length`, η
    // απόκλιση παύει να είναι εκφράσιμη — δεν φυλάσσεται από σύμβαση.
    for (const job of [...JOB_ORDER, JOB_ALL]) {
      for (const items of liveMenus()) {
        const result = filterLive(items, job);
        expect(result.hiddenCount).toBe(result.hidden.length);
      }
    }
  });

  it('τα κλαδεμένα παιδιά ΟΡΑΤΩΝ ομάδων κρατιούνται με κλειδί το `id` της ομάδας', () => {
    const result = filterFixtures([group('crm', '/crm/leads', '/admin/ai-inbox')], 'clients');
    expect(result.hiddenSubItems.get('crm')?.map((s) => s.href)).toEqual(['/admin/ai-inbox']);
    // …και ΔΕΝ μετρήθηκαν στον δείκτη: η ομάδα είναι στη θέση της (Ε14.ιβ).
    expect(result.hiddenCount).toBe(0);
  });

  it('ο κλάδος που φεύγει ΟΛΟΚΛΗΡΟΣ μπαίνει στο `hidden` με τα παιδιά του άθικτα', () => {
    // Η «Αποκάλυψη» πρέπει να τον ξαναδείξει **ολόκληρο**, όχι ακρωτηριασμένο.
    const result = filterFixtures([group('spaces', '/spaces/properties', '/spaces/parking')], 'finance');
    expect(result.visible).toEqual([]);
    expect(result.hidden).toHaveLength(1);
    expect(childHrefs(result.hidden[0])).toHaveLength(2);
    expect(result.hiddenSubItems.size).toBe(0);
  });

  it('🔑 Υ19 — ορατή ομάδα που ΑΔΕΙΑΣΕ μετρά στα κρυμμένα (όχι κενό κουμπί, όχι σιωπή)', () => {
    // Αταξινόμητη ⇒ ορατή (Ε14.θ), αλλά ΚΑΘΕ παιδί της ανήκει αλλού ⇒ δεν έχει τι να δείξει.
    // Στα `visible` θα ήταν κουμπί που ανοίγει το τίποτα· χαμένη σιωπηλά, ο δείκτης «Χ
    // κρυμμένα» θα έλεγε ψέματα. Πηγαίνει στα `hidden` — ανακτήσιμη στην «Αποκάλυψη».
    // ⛔ ΜΕΤΑΛΛΑΞΗ: κράτα την ομάδα με `items: []` αντί για `withGroupItems` ⇒ κόκκινο.
    const result = filterFixtures([group('x', '/contacts', '/listings/mandates')], 'finance');
    expect(result.visible).toEqual([]);
    expect(result.hidden.map(keyOf)).toEqual(['x']);
    expect(result.hiddenCount).toBe(1);
    expect(result.hiddenSubItems.size).toBe(0);
  });

  it('«Όλα» ⇒ τίποτα κρυμμένο, σε κανένα από τα τρία πεδία', () => {
    for (const items of liveMenus()) {
      const result = filterLive(items, JOB_ALL);
      expect(result.visible).toBe(items);
      expect(result.hidden).toEqual([]);
      expect(result.hiddenSubItems.size).toBe(0);
      expect(result.hiddenCount).toBe(0);
    }
  });

  it('τα πλακίδια ακολουθούν το ΙΔΙΟ συμβόλαιο (§14.2)', () => {
    const tiles = [{ href: '/dxf/viewer' }, { href: '/files' }];
    const result = filterTilesByJob(tiles, 'finance');
    expect(result.visible.map((t) => t.href)).toEqual(['/files']);
    expect(result.hidden.map((t) => t.href)).toEqual(['/dxf/viewer']);
    expect(result.hiddenCount).toBe(result.hidden.length);
  });
});

// ============================================================================
// Μ-9 — ΟΙ ΔΥΟ ΑΡΙΘΜΟΙ ΔΕΝ ΕΝΩΝΟΝΤΑΙ. ΠΟΤΕ.
// ============================================================================

describe('Μ-9 — ο δείκτης της κεφαλίδας μένει ΑΝΑΓΝΩΣΙΜΟΣ (Ε14.ιβ/Ε14.ιγ)', () => {
  const financeSummary = () =>
    summarizeHidden(liveMenus().map((items) => filterLive(items, 'finance')));

  it('🔴 τα «Οικονομικά» δίνουν 9 κλάδους — ο αριθμός του ανθρώπου, συν τον κατάλογο', () => {
    // Το ένα καρφωμένο νούμερο, επίτηδες (§14.6.3): αν αλλάξει, κάποιος άλλαξε
    // τη σύνθεση του μενού και το ADR πρέπει να ξαναμετρηθεί.
    //
    // 🔴 ΑΛΛΑΞΕ 2026-08-10: **9 → 8** (ADR-777 §Α4, έκλεισε η πόρτα `/geo/canvas`).
    // Πλήρης απογραφή και των έξι δουλειών στο ADR-748 §14.6.4 — **−1 στις πέντε**,
    // **0 στο Σχέδιο** όπου το στοιχείο ήταν **ορατό**, άρα δεν μετριόταν ποτέ εκεί.
    // 🔴 ΑΛΛΑΞΕ 2026-08-21: **8 → 9** (ADR-777 §8.34 — άνοιξε ο κατάλογος εντολών
    // `/listings/mandates`). Το στοιχείο ανήκει στους **Πελάτες**, άρα **κρύβεται**
    // στις άλλες πέντε δουλειές και μετριέται εκεί. Απογραφή **και των έξι**,
    // εκτελεσμένη πριν το κλείδωμα:
    //   Σχέδιο 7→**8** · Εργοτάξιο 7→**8** · Πελάτες 5→**5** (ορατό εκεί, δεν μετριέται)
    //   Οικονομικά 8→**9** · Προμήθειες 8→**9** · Διαχείριση 9→**10**
    // ⚠️ Το **9** είναι **υπολογισμένο**, όχι ιδωμένο· ο δεύτερος μάρτυρας λείπει.
    // ✅ 2026-09-21 (ADR-871 §10.6): **αμετάβλητο** μετά τη μετάβαση γονιός → ομάδα — οι
    //    ομάδες ταξινομούνται με το `id` τους ένα-προς-ένα με τις παλιές διαδρομές.
    expect(financeSummary().hiddenCount).toBe(9);
  });

  it('🔑 …και τα υπο-στοιχεία μετριούνται ΧΩΡΙΣΤΑ — 9 + 12 δεν γίνεται ποτέ 21', () => {
    // Αυτό ΕΙΝΑΙ το ελάττωμα των 17:13, γραμμένο ως anchor. Η ημέρα που κάποιος
    // «απλοποιήσει» ενώνοντας τους δύο αριθμούς, εδώ γίνεται κόκκινο.
    const summary = financeSummary();
    // Ήταν τα **13** του §14.6.2 — 7 στις αναφορές, 6 admin στις ρυθμίσεις. Ο αριθμός
    // που **έλειπε** από τον δείκτη μετά τη διόρθωση των 17:13, ο λόγος της Φάσης 3.6.
    // ⚠️ Δεν κουνήθηκε ούτε από το κλείσιμο της πόρτας (ADR-777 §Α4) ούτε από τον
    // κατάλογο εντολών (§8.34): και τα δύο ήταν **φύλλα**. Ο ένας αριθμός αλλάζει και ο
    // άλλος όχι — **αυτό είναι** η απόδειξη ότι μετριούνται χωριστά.
    // 🔴 ΑΛΛΑΞΕ 2026-09-21: **13 → 12** (ADR-871 §10.6 Υ18). Ένα από τα 6 admin των
    //    ρυθμίσεων ήταν το «Debug», δηλωμένο `environments: ['development']` που ΔΕΝ
    //    επιβαλλόταν — εμφανιζόταν στην παραγωγή. Πλέον επιβάλλεται, και το ζωντανό μενού
    //    εδώ είναι `'production'`. Οι κλάδοι (9) δεν κουνήθηκαν — τρίτη φορά.
    expect(summary.hiddenSubItemCount).toBe(12);
    expect(summary.hiddenCount).toBe(9);
    // …και το άθροισμά τους ΔΕΝ είναι ο δείκτης. Αυτό ήταν το 22.
    expect(summary.hiddenCount).not.toBe(summary.hiddenCount + summary.hiddenSubItemCount);
  });

  it('ο ανά-δοχείο δείκτης αθροίζει ΑΚΡΙΒΩΣ τον συνολικό υπο-αριθμό', () => {
    const summary = financeSummary();
    const sum = [...summary.hiddenSubItemCountByParent.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(summary.hiddenSubItemCount);
  });

  it('🔑 η ομάδα `reports` δηλώνει κρυμμένα παιδιά — εκεί ζει το Επίπεδο 2', () => {
    // Η εγκάρσια ομάδα μένει ΠΑΝΤΑ ορατή (Ε14.α) ενώ τα παιδιά της κληρονομούν
    // (Ε14.β). Είναι το κατεξοχήν δοχείο που «έχασε χωρίς να λείπει».
    const summary = financeSummary();
    expect(summary.hiddenSubItemCountByParent.get(REPORTS_GROUP_ID)).toBeGreaterThan(0);
  });
});

// ============================================================================
// Μ-10 — Η ΣΥΝΟΨΗ ΕΙΝΑΙ ΜΙΑ ΠΡΑΞΗ (το υλικό του Επιπέδου 3)
// ============================================================================

describe('Μ-10 — summarizeHidden: μία ένωση, δύο επίπεδα', () => {
  it('🔑 το `hiddenKeys` περιέχει ΚΑΙ κλάδους ΚΑΙ υπο-στοιχεία', () => {
    // Το Επίπεδο 3 υποβαθμίζει οπτικά ό,τι έκρυψε το φίλτρο, σε **οποιοδήποτε**
    // επίπεδο. Αν το σύνολο κάλυπτε μόνο το ένα, η «Αποκάλυψη» θα έδειχνε
    // κάποια στοιχεία κανονικά — δηλαδή θα έλεγε ψέματα για το τι έλειπε.
    const result = filterFixtures(
      [group('crm', '/crm/leads', '/admin/ai-inbox'), link('/dxf/viewer')],
      'clients',
    );
    const summary = summarizeHidden([result]);
    expect(summary.hiddenKeys.has('/dxf/viewer')).toBe(true); // κλάδος
    expect(summary.hiddenKeys.has('/admin/ai-inbox')).toBe(true); // υπο-στοιχείο
    expect(summary.hiddenKeys.has('crm')).toBe(false); // ορατή ομάδα
    expect(summary.hiddenCount).toBe(1);
    expect(summary.hiddenSubItemCount).toBe(1);
  });

  it('αθροίζει και τα τρία μενού χωρίς να χάσει δοχείο με ίδιο id', () => {
    // Η `x` είναι αταξινόμητη ⇒ ορατή (Ε14.θ)· το κοινό `/files` την κρατά, ενώ τα
    // `/contacts` και `/listings/mandates` ανήκουν στους Πελάτες ⇒ κλαδεύονται. Το
    // κλειδί είναι το ίδιο: πρέπει να **προστεθούν**.
    const a = filterFixtures([group('x', '/files', '/contacts')], 'finance');
    const b = filterFixtures([group('x', '/files', '/listings/mandates')], 'finance');
    const summary = summarizeHidden([a, b]);
    expect(summary.hiddenSubItemCountByParent.get('x')).toBe(2);
    expect(summary.hiddenSubItemCount).toBe(2);
  });

  it('κενή είσοδος ⇒ μηδενική σύνοψη, ποτέ undefined', () => {
    const summary = summarizeHidden([]);
    expect(summary.hiddenCount).toBe(0);
    expect(summary.hiddenSubItemCount).toBe(0);
    expect(summary.hiddenKeys.size).toBe(0);
    expect(summary.hiddenSubItemCountByParent.size).toBe(0);
  });
});
