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
 */

import { PERMISSIONS } from '@/lib/auth/types';
import {
  createMainMenuItems,
  createToolsMenuItems,
  createSettingsMenuItems,
} from '../smart-navigation-factory';
import { JOB_ORDER } from '../jobs-registry';
import { JOB_ALL } from '../jobs-access';
import {
  REPORTS_PARENT_ROUTE,
  filterItemsByJob,
  filterTilesByJob,
  summarizeHidden,
} from '../jobs-visibility';

const ALL_PERMISSIONS = Object.keys(PERMISSIONS);
const LIVE_MENUS = [createMainMenuItems, createToolsMenuItems, createSettingsMenuItems] as const;

/** Τα τρία ζωντανά μενού, όπως τα χτίζει η πραγματική πλοήγηση. */
function liveMenus() {
  return LIVE_MENUS.map((build) => build('production', ALL_PERMISSIONS));
}

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
        const result = filterItemsByJob(items, job);
        const seen = [...result.visible, ...result.hidden].map((item) => item.href);
        expect(seen.slice().sort()).toEqual(items.map((item) => item.href).sort());
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
        const result = filterItemsByJob(items, job);
        expect(result.hiddenCount).toBe(result.hidden.length);
      }
    }
  });

  it('τα κλαδεμένα παιδιά ΟΡΑΤΩΝ γονέων κρατιούνται με κλειδί τον γονιό τους', () => {
    const branch = [
      { href: '/crm', subItems: [{ href: '/crm/leads' }, { href: '/admin/ai-inbox' }] },
    ];
    const result = filterItemsByJob(branch, 'clients');
    expect(result.hiddenSubItems.get('/crm')?.map((s) => s.href)).toEqual(['/admin/ai-inbox']);
    // …και ΔΕΝ μετρήθηκαν στον δείκτη: ο γονιός είναι στη θέση του (Ε14.ιβ).
    expect(result.hiddenCount).toBe(0);
  });

  it('ο κλάδος που φεύγει ΟΛΟΚΛΗΡΟΣ μπαίνει στο `hidden` με τα παιδιά του άθικτα', () => {
    // Η «Αποκάλυψη» πρέπει να τον ξαναδείξει **ολόκληρο**, όχι ακρωτηριασμένο.
    const branch = [
      { href: '/spaces', subItems: [{ href: '/spaces/properties' }, { href: '/spaces/parking' }] },
    ];
    const result = filterItemsByJob(branch, 'finance');
    expect(result.visible).toEqual([]);
    expect(result.hidden).toHaveLength(1);
    expect(result.hidden[0]?.subItems).toHaveLength(2);
    expect(result.hiddenSubItems.size).toBe(0);
  });

  it('«Όλα» ⇒ τίποτα κρυμμένο, σε κανένα από τα τρία πεδία', () => {
    for (const items of liveMenus()) {
      const result = filterItemsByJob(items, JOB_ALL);
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
    summarizeHidden(liveMenus().map((items) => filterItemsByJob(items, 'finance')));

  it('🔴 τα «Οικονομικά» δίνουν 8 κλάδους — ο αριθμός του ανθρώπου, μείον την πόρτα', () => {
    // Το ένα καρφωμένο νούμερο, επίτηδες (§14.6.3): αν αλλάξει, κάποιος άλλαξε
    // τη σύνθεση του μενού και το ADR πρέπει να ξαναμετρηθεί.
    //
    // 🔴 ΑΛΛΑΞΕ 2026-08-10: **9 → 8** (ADR-777 §Α4, έκλεισε η πόρτα `/geo/canvas`).
    // Πλήρης απογραφή και των έξι δουλειών στο ADR-748 §14.6.4 — **−1 στις πέντε**,
    // **0 στο Σχέδιο** όπου το στοιχείο ήταν **ορατό**, άρα δεν μετριόταν ποτέ εκεί.
    // ⚠️ Το **8** είναι **υπολογισμένο**, όχι ιδωμένο· ο δεύτερος μάρτυρας λείπει.
    expect(financeSummary().hiddenCount).toBe(8);
  });

  it('🔑 …και τα υπο-στοιχεία μετριούνται ΧΩΡΙΣΤΑ — 8 + 13 δεν γίνεται ποτέ 21', () => {
    // Αυτό ΕΙΝΑΙ το ελάττωμα των 17:13, γραμμένο ως anchor. Η ημέρα που κάποιος
    // «απλοποιήσει» ενώνοντας τους δύο αριθμούς, εδώ γίνεται κόκκινο.
    const summary = financeSummary();
    // Τα **13** της ανάλυσης του §14.6.2 — 7 στο `/reports`, 6 admin στο
    // `/settings`. Είναι ο αριθμός που **έλειπε** από τον δείκτη μετά τη
    // διόρθωση των 17:13, και ο λόγος ύπαρξης ολόκληρης της Φάσης 3.6.
    // ⚠️ Τα **13** ΔΕΝ κουνήθηκαν από το κλείσιμο της πόρτας (ADR-777 §Α4) — το
    // `/geo/canvas` ήταν **φύλλο**, χωρίς υπο-στοιχεία. Ο ένας αριθμός άλλαξε και ο
    // άλλος όχι· αυτό **είναι** η απόδειξη ότι μετριούνται χωριστά.
    expect(summary.hiddenSubItemCount).toBe(13);
    expect(summary.hiddenCount).toBe(8);
    // …και το άθροισμά τους ΔΕΝ είναι ο δείκτης. Αυτό ήταν το 22.
    expect(summary.hiddenCount).not.toBe(summary.hiddenCount + summary.hiddenSubItemCount);
  });

  it('ο ανά-δοχείο δείκτης αθροίζει ΑΚΡΙΒΩΣ τον συνολικό υπο-αριθμό', () => {
    const summary = financeSummary();
    const sum = [...summary.hiddenSubItemCountByParent.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(summary.hiddenSubItemCount);
  });

  it('🔑 το `/reports` δηλώνει κρυμμένα παιδιά — εκεί ζει το Επίπεδο 2', () => {
    // Ο εγκάρσιος γονιός μένει ΠΑΝΤΑ ορατός (Ε14.α) ενώ τα παιδιά του
    // κληρονομούν (Ε14.β). Είναι το κατεξοχήν δοχείο που «έχασε χωρίς να λείπει».
    const summary = financeSummary();
    expect(summary.hiddenSubItemCountByParent.get(REPORTS_PARENT_ROUTE)).toBeGreaterThan(0);
  });
});

// ============================================================================
// Μ-10 — Η ΣΥΝΟΨΗ ΕΙΝΑΙ ΜΙΑ ΠΡΑΞΗ (το υλικό του Επιπέδου 3)
// ============================================================================

describe('Μ-10 — summarizeHidden: μία ένωση, δύο επίπεδα', () => {
  it('🔑 το `hiddenHrefs` περιέχει ΚΑΙ κλάδους ΚΑΙ υπο-στοιχεία', () => {
    // Το Επίπεδο 3 υποβαθμίζει οπτικά ό,τι έκρυψε το φίλτρο, σε **οποιοδήποτε**
    // επίπεδο. Αν το σύνολο κάλυπτε μόνο το ένα, η «Αποκάλυψη» θα έδειχνε
    // κάποια στοιχεία κανονικά — δηλαδή θα έλεγε ψέματα για το τι έλειπε.
    const result = filterItemsByJob(
      [
        { href: '/crm', subItems: [{ href: '/crm/leads' }, { href: '/admin/ai-inbox' }] },
        { href: '/dxf/viewer' },
      ],
      'clients',
    );
    const summary = summarizeHidden([result]);
    expect(summary.hiddenHrefs.has('/dxf/viewer')).toBe(true); // κλάδος
    expect(summary.hiddenHrefs.has('/admin/ai-inbox')).toBe(true); // υπο-στοιχείο
    expect(summary.hiddenHrefs.has('/crm')).toBe(false); // ορατός γονιός
    expect(summary.hiddenCount).toBe(1);
    expect(summary.hiddenSubItemCount).toBe(1);
  });

  it('αθροίζει και τα τρία μενού χωρίς να χάσει δοχείο με ίδιο href', () => {
    const a = filterItemsByJob([{ href: '/x', subItems: [{ href: '/spaces' }] }], 'finance');
    const b = filterItemsByJob([{ href: '/x', subItems: [{ href: '/sales' }] }], 'finance');
    const summary = summarizeHidden([a, b]);
    // Το `/x` είναι αταξινόμητο ⇒ ορατό (Ε14.θ)· τα δύο παιδιά του ανήκουν
    // αλλού ⇒ κλαδεύονται. Το κλειδί είναι το ίδιο: πρέπει να **προστεθούν**.
    expect(summary.hiddenSubItemCountByParent.get('/x')).toBe(2);
    expect(summary.hiddenSubItemCount).toBe(2);
  });

  it('κενή είσοδος ⇒ μηδενική σύνοψη, ποτέ undefined', () => {
    const summary = summarizeHidden([]);
    expect(summary.hiddenCount).toBe(0);
    expect(summary.hiddenSubItemCount).toBe(0);
    expect(summary.hiddenHrefs.size).toBe(0);
    expect(summary.hiddenSubItemCountByParent.size).toBe(0);
  });
});
