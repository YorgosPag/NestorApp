/**
 * ADR-748 Φάση 1 — ANCHOR TEST για το μητρώο δουλειών.
 *
 * Δεν ελέγχει «τρέχει ο κώδικας» (δεν υπάρχει κώδικας — είναι δεδομένα).
 * Ελέγχει τις **αναλλοίωτες** που το ADR κλείδωσε και που, αν σπάσουν σιωπηλά,
 * παίρνουν μαζί τους ολόκληρο το σχέδιο:
 *
 *   • Έξι δουλειές, ούτε πέντε ούτε επτά (Ε4.α)
 *   • Κάθε permission υπάρχει πραγματικά στο `PERMISSIONS` (όχι τυπογραφικό)
 *   • Καμία δουλειά δεν μοιράζεται permission με άλλη (αλλιώς δεν είναι
 *     «αποκλειστικά» και ο υπολογισμός του Ε-5 θα έδινε λάθος λίστα)
 *   • **Ακριβώς μία** δουλειά κατέχει τον DXF viewer (§14.3)
 *   • Το `/legal-documents` ΔΕΝ έχει τρυπώσει πουθενά (απόφαση Γιώργου 2026-08-02)
 *   • Κάθε αναφορά κληρονομεί από πηγή που **υπάρχει** — η αντι-αντιγραφή του Υ-5
 */

import { PERMISSIONS } from '@/lib/auth/types';
import {
  COMMON_DASHBOARD_TILES,
  COMMON_SIDEBAR_ROUTES,
  JOBS,
  JOB_ORDER,
  LEGAL_DOCUMENTS_STATUS,
  REPORT_SOURCES,
  type JobId,
} from '../jobs-registry';

const ALL_JOBS = JOB_ORDER.map((id) => JOBS[id]);

/** Κάθε διαδρομή που το μητρώο ταξινομεί (κοινή ή δουλειάς). */
const ALL_KNOWN_ROUTES = new Set<string>([
  ...COMMON_SIDEBAR_ROUTES,
  ...ALL_JOBS.flatMap((job) => job.sidebar),
]);

describe('ADR-748 Ε4.α — έξι δουλειές, με σταθερή ταυτότητα', () => {
  it('το μητρώο έχει ακριβώς έξι εγγραφές', () => {
    expect(JOB_ORDER).toHaveLength(6);
    expect(Object.keys(JOBS)).toHaveLength(6);
  });

  it('το JOB_ORDER και το JOBS περιέχουν τα ίδια ids', () => {
    expect([...JOB_ORDER].sort()).toEqual(Object.keys(JOBS).sort());
  });

  it('το id κάθε εγγραφής ταιριάζει με το κλειδί της', () => {
    for (const [key, job] of Object.entries(JOBS)) expect(job.id).toBe(key);
  });

  it('η σειρά είναι 1..6 χωρίς κενά και χωρίς διπλά (κανόνας ισοβαθμίας Ε7.δ)', () => {
    expect(ALL_JOBS.map((job) => job.order).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('η έβδομη δουλειά («Το κοινό μου», Ε4.ζ) ΔΕΝ έχει μπει', () => {
    const forbidden = ['audience', 'my_audience', 'public', 'website', 'social'];
    for (const id of JOB_ORDER) expect(forbidden).not.toContain(id);
  });
});

describe('ΟΝΟΜΑΤΟΛΟΓΙΑ (Ε6.στ, Π-9) — η δουλειά ΔΕΝ λέγεται Workspace', () => {
  it('κανένα job id δεν περιέχει «workspace»', () => {
    for (const id of JOB_ORDER) expect(id.toLowerCase()).not.toContain('workspace');
  });

  it('κανένα i18n key δεν περιέχει «workspace»', () => {
    for (const job of ALL_JOBS) {
      expect(job.labelKey.toLowerCase()).not.toContain('workspace');
      expect(job.descriptionKey.toLowerCase()).not.toContain('workspace');
    }
  });
});

describe('permissions — η είσοδος του υπολογισμού του Ε-5', () => {
  it('κάθε permission υπάρχει πραγματικά στο PERMISSIONS (κανένα τυπογραφικό)', () => {
    for (const job of ALL_JOBS) {
      for (const permission of job.permissions) {
        expect(Object.prototype.hasOwnProperty.call(PERMISSIONS, permission)).toBe(true);
      }
    }
  });

  it('καμία δουλειά δεν είναι χωρίς permissions (αλλιώς δεν γεννιέται ποτέ)', () => {
    for (const job of ALL_JOBS) expect(job.permissions.length).toBeGreaterThan(0);
  });

  it('🔴 καμία δουλειά δεν μοιράζεται permission με άλλη (Ε-4.2: «αποκλειστικά»)', () => {
    const owner = new Map<string, JobId>();
    for (const job of ALL_JOBS) {
      for (const permission of job.permissions) {
        const previous = owner.get(permission);
        expect(previous === undefined || previous === job.id).toBe(true);
        owner.set(permission, job.id);
      }
    }
  });

  it('κανένα από τα «σχεδόν όλοι το έχουν» δεν γεννά δουλειά (Ε-4.2)', () => {
    const tooCommon = [
      'notifications:notifications:view',
      'projects:projects:view',
      'properties:properties:view',
      'units:units:view',
    ];
    for (const job of ALL_JOBS) {
      for (const permission of tooCommon) expect(job.permissions).not.toContain(permission);
    }
  });

  it('καμία δουλειά δεν έχει διπλότυπο permission', () => {
    for (const job of ALL_JOBS) {
      expect(new Set(job.permissions).size).toBe(job.permissions.length);
    }
  });
});

describe('ο DXF viewer ανήκει σε ΜΙΑ δουλειά (§14.3)', () => {
  it('ακριβώς μία δουλειά τον κατέχει', () => {
    expect(ALL_JOBS.filter((job) => job.ownsDxfViewer)).toHaveLength(1);
  });

  it('είναι το «Σχέδιο», και η διαδρομή του είναι στο sidebar της', () => {
    const owner = ALL_JOBS.find((job) => job.ownsDxfViewer);
    expect(owner?.id).toBe('design');
    expect(owner?.sidebar).toContain('/dxf/viewer');
  });

  it('καμία άλλη δουλειά δεν δείχνει τον viewer', () => {
    for (const job of ALL_JOBS) {
      if (job.id !== 'design') expect(job.sidebar).not.toContain('/dxf/viewer');
    }
  });

  it('το μητρώο ΔΕΝ ξαναγράφει τη λίστα των ribbon καρτελών', () => {
    // Οι καρτέλες έχουν SSoT στο subapp. Δεύτερη λίστα εδώ = διπλότυπο.
    const ribbonTabIds = ['home', 'structural', 'architecture', 'electrical', 'topography'];
    for (const job of ALL_JOBS) {
      for (const id of ribbonTabIds) {
        expect(job.sidebar).not.toContain(id);
        expect(job.dashboardTiles).not.toContain(id);
      }
    }
  });
});

describe('ετικέτες ορατότητας — καμία επικάλυψη με τα κοινά (§14.5)', () => {
  it('καμία δουλειά δεν ξαναδηλώνει κοινή διαδρομή', () => {
    for (const job of ALL_JOBS) {
      for (const route of job.sidebar) {
        expect(COMMON_SIDEBAR_ROUTES).not.toContain(route);
      }
    }
  });

  it('καμία δουλειά δεν ξαναδηλώνει κοινό πλακίδιο', () => {
    for (const job of ALL_JOBS) {
      for (const tile of job.dashboardTiles) {
        expect(COMMON_DASHBOARD_TILES).not.toContain(tile);
      }
    }
  });

  it('κάθε διαδρομή είναι απόλυτη (ξεκινά με «/»)', () => {
    for (const route of [...COMMON_SIDEBAR_ROUTES, ...ALL_JOBS.flatMap((j) => j.sidebar)]) {
      expect(route.startsWith('/')).toBe(true);
    }
  });

  it('το «/buildings» μοιράζεται σκόπιμα σε Σχέδιο + Εργοτάξιο (§14.1/7)', () => {
    // Το κτίριο μελετάται ΚΑΙ χτίζεται. Είναι η μόνη επιτρεπτή επικάλυψη
    // sidebar — και δηλώνεται ρητά εδώ ώστε να μη «διορθωθεί» κατά λάθος.
    const owners = ALL_JOBS.filter((job) => job.sidebar.includes('/buildings'));
    expect(owners.map((job) => job.id).sort()).toEqual(['design', 'site']);
  });

  it('Εργοτάξιο και Προμήθειες είναι ανώριμες — 1 στοιχείο η καθεμιά (§14.4/3)', () => {
    // Δεν είναι διακοσμητικό: αν αυτό αλλάξει, το Ε4.στ έπαψε να ισχύει και το
    // ADR πρέπει να ενημερωθεί — όχι να προσαρμοστεί σιωπηλά το test.
    expect(JOBS.procurement.sidebar).toHaveLength(1);
    expect(JOBS.procurement.dashboardTiles).toHaveLength(0);
    expect(JOBS.site.dashboardTiles).toHaveLength(1); // μόνο το κοινό «buildings»
  });
});

describe('🔴 /legal-documents — νεκρός σύνδεσμος, ΕΚΤΟΣ μητρώου (απόφαση 2026-08-02)', () => {
  it('δεν εμφανίζεται σε καμία δουλειά', () => {
    for (const job of ALL_JOBS) {
      expect(job.sidebar).not.toContain('/legal-documents');
      expect(job.dashboardTiles).not.toContain('legal-documents');
    }
  });

  it('δεν εμφανίζεται ούτε στα κοινά', () => {
    expect(COMMON_SIDEBAR_ROUTES).not.toContain('/legal-documents');
    expect(COMMON_DASHBOARD_TILES).not.toContain('legal-documents');
  });

  it('το ζωντανό παιδί του («/obligations») είναι κοινό σε όλες', () => {
    expect(COMMON_SIDEBAR_ROUTES).toContain(LEGAL_DOCUMENTS_STATUS.livingChildRoute);
  });

  it('η κατάσταση παραμένει καταγεγραμμένη ως ανοιχτό κενό, όχι λυμένη', () => {
    expect(LEGAL_DOCUMENTS_STATUS.hasPage).toBe(false);
    expect(LEGAL_DOCUMENTS_STATUS.enforced).toBe(false);
  });
});

describe('αναφορές — κληρονομιά από την πηγή, ΠΟΤΕ αντιγραμμένη ετικέτα (Υ-5)', () => {
  it('ο γονιός «/reports» δεν ανήκει σε καμία δουλειά (ορατός σε όλες)', () => {
    for (const job of ALL_JOBS) expect(job.sidebar).not.toContain('/reports');
    expect(REPORT_SOURCES['/reports']).toBeUndefined();
  });

  it('καμία υπο-αναφορά δεν έχει τρυπώσει ως ετικέτα δουλειάς', () => {
    for (const job of ALL_JOBS) {
      for (const route of job.sidebar) expect(route.startsWith('/reports/')).toBe(false);
    }
  });

  it('κάθε αναφορά που κληρονομεί από διαδρομή δείχνει σε διαδρομή που ΥΠΑΡΧΕΙ', () => {
    for (const [report, source] of Object.entries(REPORT_SOURCES)) {
      if (source.kind !== 'route') continue;
      expect({ report, known: ALL_KNOWN_ROUTES.has(source.route) })
        .toEqual({ report, known: true });
    }
  });

  it('κάθε αναφορά που κληρονομεί από δουλειά δείχνει σε υπαρκτή δουλειά', () => {
    for (const source of Object.values(REPORT_SOURCES)) {
      if (source.kind !== 'job') continue;
      expect(JOB_ORDER).toContain(source.job);
    }
  });

  it('κάθε κλειδί είναι υπο-διαδρομή του «/reports/»', () => {
    for (const report of Object.keys(REPORT_SOURCES)) {
      expect(report.startsWith('/reports/')).toBe(true);
    }
  });

  it('καλύπτονται και τα δέκα υπο-στοιχεία του smart-navigation-factory', () => {
    const expected = [
      'financial', 'projects', 'sales', 'contacts', 'crm',
      'spaces', 'construction', 'compliance', 'export', 'cash-flow',
    ].map((slug) => `/reports/${slug}`);
    expect(Object.keys(REPORT_SOURCES).sort()).toEqual(expected.sort());
  });
});

describe('i18n (N.11) — μηδέν ωμό αλφαριθμητικό στο μητρώο', () => {
  it('κάθε ετικέτα είναι κλειδί «jobs.<id>.label»', () => {
    for (const job of ALL_JOBS) {
      expect(job.labelKey).toBe(`jobs.${job.id}.label`);
      expect(job.descriptionKey).toBe(`jobs.${job.id}.description`);
    }
  });

  it('κανένα ελληνικό κείμενο δεν έχει διαρρεύσει σε πεδίο δεδομένων', () => {
    const greek = /[Ͱ-Ͽἀ-῿]/;
    for (const job of ALL_JOBS) {
      expect(greek.test(job.labelKey)).toBe(false);
      expect(greek.test(job.descriptionKey)).toBe(false);
      for (const route of job.sidebar) expect(greek.test(route)).toBe(false);
    }
  });
});
