/**
 * ΑΓΚΥΡΕΣ — **Η ΕΠΙΦΑΝΕΙΑ ΠΟΥ ΑΝΟΙΓΕΙ ΚΑΙ Ο ΔΙΑΚΟΜΙΣΤΗΣ ΠΟΥ ΑΡΝΕΙΤΑΙ** (ADR-829)
 *
 * ## Η ερώτηση — και γιατί ΔΕΝ είναι η ερώτηση του ADR-823 §13
 *
 * > Ανοίγει η εφαρμογή σε κάποιον μια επιφάνεια που ο διακομιστής **αρνείται**
 * > να τον αφήσει να χρησιμοποιήσει;
 *
 * Το `role-catalogue-coherence.test.ts` (ADR-823 §13, 2026-08-27) ρώτησε το ίδιο
 * πράγμα — αλλά **καρφωμένο σε ΕΝΑ ζευγάρι ονομάτων**
 * (`properties:properties:view` / `units:units:view`). Δύο μέρες αργότερα το
 * σχήμα ξαναχτύπησε αλλού και εκείνη η άγκυρα **δεν το είδε**, επειδή ρωτούσε
 * για το **δείγμα** και όχι για την **κλάση**.
 *
 * 🔑 Το πιο εύγλωττο: το τελευταίο του test **υπολογίζει ήδη** ολόκληρη τη λίστα
 *    «τι βλέπει ο `viewer` που δεν βλέπει ο `internal_user`» — και μετά ελέγχει
 *    **ένα μόνο όνομα από αυτήν**. Η απάντηση ήταν στα χέρια του.
 *
 * ## 🔴 Το περιστατικό (μετρημένο ζωντανά 2026-08-29, emulator)
 *
 * Ο DXF προβολέας εμφάνιζε **«Δεν έχει φορτωθεί σκηνή»** και κενό καμβά μετά από
 * φαινομενικά **επιτυχή** εισαγωγή DXF — χωρίς κανένα μήνυμα σφάλματος.
 *
 * ```
 * GET  /api/dxf-levels → 403 {"requiredPermission":"dxf:layers:view"}
 * POST /api/dxf-levels → 403   (στο ΣΚΕΤΟ φόρτωμα, χωρίς καμία εισαγωγή)
 * ```
 *
 * Η αιτία δεν ήταν στον προβολέα:
 *
 * | σύνολο | ρόλοι |
 * |---|---|
 * | περνούν τον `AdminGuard` (`admin_access`) | **μόνο** `company_admin` |
 * | έχουν `dxf:layers:view` | `project_manager` · `architect` · `engineer` · `viewer` |
 * | **τομή** | **∅** |
 *
 * Δηλαδή ο **μόνος** ρόλος που μπορούσε να **ΜΠΕΙ** ήταν ο μόνος που δεν
 * μπορούσε να **ΧΡΗΣΙΜΟΠΟΙΗΣΕΙ**. Όχι σπάνια περίπτωση — **δομικά αδύνατη
 * επιφάνεια**, για κάθε άνθρωπο, πάντα.
 *
 * Το ορατό σύμπτωμα γεννιόταν τρία επίπεδα πιο κάτω:
 * `useDxfViewerCallbacks.handleFileImportWithEncoding` δεν έβρισκε όροφο, ζητούσε
 * `addLevel()` → 403 → `console.error` + `return`. **Η εισαγωγή αμβλωνόταν
 * σιωπηλά.** Το «Δεν υπάρχουν επίπεδα» ΔΕΝ ήταν κενή βάση· ήταν 403.
 *
 * ## Τι κλειδώνει — ΤΡΕΙΣ ερωτήσεις, καμία καρφωμένη σε όνομα
 *
 * | # | Ερώτηση | Τρόπος |
 * |---|---|---|
 * | **Κ1** | Έχει κάποιος **ισχυρή πράξη** σε πόρο χωρίς το `:view` του **ίδιου** πόρου; | παράγεται από τον κατάλογο |
 * | **Κ2** | Απαιτεί **ζωντανή διαδρομή** permission που δεν το έχει **κανείς**; | **σαρώνει** τα `src/app/api/**\/route.ts` |
 * | **Κ3** | Έχει κάθε δηλωμένη **επιφάνεια** μη-κενή τομή {μπαίνει} ∩ {χρησιμοποιεί}; | ρητός πίνακας |
 *
 * ⚠️ Το **Κ2 σαρώνει τον δίσκο επίτηδες**. Χειρόγραφη λίστα δικαιωμάτων θα
 *    πάλιωνε — και το `CLAUDE.md` καταγγέλλει αυτό ακριβώς το σχήμα τέσσερις
 *    φορές. Νέα διαδρομή με νέο permission καλύπτεται **δωρεάν**.
 *
 * @see ADR-829 · ADR-823 §13 (το δείγμα) · ADR-801 §2.11 (ο κατάλογος = δεδομένα)
 * @module lib/auth/__tests__/surface-authority-reachability
 */

import * as fs from 'fs';
import * as path from 'path';
import { PREDEFINED_ROLES } from '../role-catalogue';
import { PERMISSIONS } from '../types';

const ROLES = Object.entries(PREDEFINED_ROLES).filter(([, r]) => !r.isBypass);
const DECLARED_PERMISSIONS = Object.keys(PERMISSIONS);
const HELD_BY_SOMEONE = new Set(ROLES.flatMap(([, r]) => r.permissions));

/**
 * Πράξεις **ισχυρότερες** από την ανάγνωση. Το να κατέχεις μία από αυτές σε έναν
 * πόρο χωρίς το `:view` του **ίδιου** πόρου δεν είναι πολιτική — είναι
 * ανεκτέλεστο: δεν σβήνεις/ξεκλειδώνεις ό,τι δεν επιτρέπεσαι να δεις.
 */
const STRONGER_THAN_VIEW = [
  'create', 'update', 'delete', 'manage', 'unlock',
  'upload', 'send', 'assign', 'archive', 'process', 'use',
];

/** Τα `:view` που **δηλώνει** το μητρώο. Πόρος χωρίς `:view` δεν κρίνεται. */
const DECLARED_VIEWS = new Set(DECLARED_PERMISSIONS.filter((p) => p.endsWith(':view')));

/**
 * Permissions που **καμία** μη-bypass ταυτότητα δεν κατέχει, **με γραμμένο λόγο**.
 *
 * ⚠️ Η προσθήκη ονόματος εδώ είναι **απόφαση**, όχι διόρθωση κόκκινου test. Δύο
 *    διαφορετικά πράγματα ζουν σε αυτόν τον πίνακα και ξεχωρίζουν από τον λόγο:
 *    (α) **σκόπιμο** — η διαδρομή ανήκει στον `super_admin` και μόνο (bypass)·
 *    (β) **ανοιχτό εύρημα** — γραμμένο ώστε να μην περνά σιωπηλά, και να μην
 *        μπορεί ο αριθμός τους να **μεγαλώσει** απαρατήρητα.
 */
const UNREACHABLE_BY_DESIGN: Readonly<Record<string, string>> = {
  'admin:migrations:execute':
    'ΣΚΟΠΙΜΟ — 11 διαδρομές μετεγκατάστασης δεδομένων. Ανήκουν αποκλειστικά στον ' +
    'super_admin, που τις φτάνει μέσω isBypass. Κανένας ρόλος εταιρείας δεν εκτελεί migration.',
  'admin:backup:execute':
    'ΣΚΟΠΙΜΟ — 8 διαδρομές αντιγράφων/επαναφοράς. Ίδιος λόγος: πράξη πλατφόρμας, ' +
    'όχι πράξη εταιρείας. Ο super_admin τις φτάνει μέσω isBypass.',
  'admin:system:configure':
    'ΣΚΟΠΙΜΟ — /api/admin/environment. Διαμόρφωση της ίδιας της εγκατάστασης· ' +
    'ανήκει στον super_admin (isBypass), σε κανέναν ρόλο εταιρείας.',
  'admin:data:fix':
    'ΣΚΟΠΙΜΟ — 5 διαδρομές χειροκίνητης επιδιόρθωσης δεδομένων. Πράξη πλατφόρμας ' +
    'υπό επίβλεψη· ο super_admin τη φτάνει μέσω isBypass.',
  'admin:direct:operations':
    'ΣΚΟΠΙΜΟ — break-glass επέμβαση στα δεδομένα (lib/api/admin-operation-route). Η φρουρά δηλώνει ' +
    'requiredGlobalRoles: BYPASS_ROLES, άρα κανένας ρόλος εταιρείας δεν τη φτάνει ούτε με claim.',
  'platform_landing_heroes:heroes:publish':
    'ΣΚΟΠΙΜΟ — δημοσίευση των εικόνων της αρχικής του προϊόντος: πράξη πλατφόρμας, όχι εταιρείας. Οι δύο ' +
    'διαδρομές δηλώνουν requiredGlobalRoles: BYPASS_ROLES.',
};

/**
 * Οι **επιφάνειες** που κρίνονται: τι ανοίγει την πόρτα, και τι απαιτεί το εσωτερικό.
 *
 * ⚠️ ΔΕΝ είναι απογραφή όλης της εφαρμογής — είναι ο πίνακας των επιφανειών που
 *    έχουν **μετρηθεί**. Μεγαλώνει όταν μετρηθεί η επόμενη· ένα ψεύτικο «όλα
 *    καλυμμένα» θα ήταν χειρότερο από μια ειλικρινώς μικρή λίστα.
 */
const SURFACES: ReadonlyArray<{
  readonly name: string;
  readonly entry: string;
  readonly needs: readonly string[];
  readonly why: string;
}> = [
  {
    name: 'DXF Viewer — /o/[workspace]/dxf/viewer',
    entry: 'admin_access',
    needs: ['dxf:layers:view', 'projects:floors:view', 'dxf:files:view'],
    why:
      'Ο AdminGuard της σελίδας ρωτά decideCapability("admin_access"). Μέσα, ο ' +
      'προβολέας καλεί /api/dxf-levels + /api/floorplan-overlays (dxf:layers:view), ' +
      '/api/floors (projects:floors:view) και /api/dxf/revisions (dxf:files:view). ' +
      'Χωρίς το πρώτο, η εισαγωγή DXF αμβλώνεται ΣΙΩΠΗΛΑ.',
  },
  {
    name: 'Καθολική αναζήτηση — μπάρα του κελύφους',
    entry: 'search:global:execute',
    needs: [
      'projects:projects:view',
      'buildings:buildings:view',
      'projects:floors:view',
      'properties:properties:view',
      'units:units:view',
    ],
    why:
      'Το AppHeader ρωτά useCapability("search:global:execute"). Μέσα, το /api/search κρίνει κάθε ' +
      'τύπο με τον SEARCH_REQUIRED_PERMISSIONS. Χωρίς αυτά, ο κάτοχος ανοίγει μια μπάρα που ' +
      'επιστρέφει μόνιμα κενό. Τα έξι είδη του internal_user δίνονται από πέντε δικαιώματα ' +
      '(θέσεις και αποθήκες μοιράζονται το units:units:view).',
  },
];

describe('Κ1 — ισχυρή πράξη σε πόρο ΧΩΡΙΣ το :view του ίδιου πόρου', () => {
  it('ο κατάλογος δεν είναι άδειος (αλλιώς κάθε test παρακάτω είναι κενό)', () => {
    // ⚠️ Χωρίς αυτό, αλλαγή σχήματος θα άφηνε ΟΛΑ τα επόμενα πράσινα πάνω σε
    //    μηδέν ρόλους — φρουρός που δεν φυλάει (μάθημα ADR-823 §13).
    expect(ROLES.length).toBeGreaterThan(5);
    expect(DECLARED_VIEWS.size).toBeGreaterThan(10);
    expect(ROLES.some(([, r]) => r.permissions.length > 10)).toBe(true);
  });

  it('🔴 κανένας ρόλος δεν κατέχει ισχυρή πράξη χωρίς το :view του ΙΔΙΟΥ πόρου', () => {
    const offenders: string[] = [];
    for (const [name, role] of ROLES) {
      for (const permission of role.permissions) {
        const [domain, resource, action] = permission.split(':');
        if (!domain || !resource || !action) continue;
        if (!STRONGER_THAN_VIEW.includes(action)) continue;
        const view = `${domain}:${resource}:view`;
        if (!DECLARED_VIEWS.has(view)) continue;
        if (!role.permissions.includes(view as never)) {
          offenders.push(`${name}: «${permission}» χωρίς «${view}»`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('ο company_admin συγκεκριμένα — ο ρόλος του περιστατικού', () => {
    const permissions = PREDEFINED_ROLES.company_admin!.permissions;
    // Τα δύο δομικά αποτυπώματα που απέδειξαν ότι ήταν παράλειψη, όχι πολιτική.
    expect(permissions).toContain('dxf:layers:unlock');
    expect(permissions).toContain('dxf:layers:view');
    expect(permissions).toContain('projects:floors:delete');
    expect(permissions).toContain('projects:floors:view');
  });

  it('ADR-829 §7.1 — τα κτίρια ανήκουν στον διαχειριστή, όπως τα έργα, και σε κανέναν άλλο ρόλο', () => {
    const writes = [
      'buildings:buildings:create', 'buildings:buildings:update', 'buildings:buildings:delete',
      'projects:floors:create', 'projects:floors:update',
    ];
    for (const [name, role] of ROLES) {
      for (const permission of writes) {
        expect([name, permission, role.permissions.includes(permission as never)])
          .toEqual([name, permission, name === 'company_admin']);
      }
    }
  });

  it('ADR-829 §7.1 — καμία διαδρομή ορόφων δεν γράφει με `:view`', () => {
    const route = fs.readFileSync(path.resolve(__dirname, '../../../app/api/floors/route.ts'), 'utf8');
    expect(route.match(/export const POST[\s\S]*?\n\);/)?.[0]).toContain("permissions: 'projects:floors:create'");
    expect(route.match(/export const PATCH[\s\S]*?\n\);/)?.[0]).toContain("permissions: 'projects:floors:update'");
  });

  it('ΔΕΝ στρογγυλεύτηκε — ο company_admin δεν πήρε ό,τι δεν του χρειάζεται', () => {
    // 🔑 Η διόρθωση έπρεπε να είναι ΕΛΑΧΙΣΤΗ: κάθε νέο permission αντιστοιχεί σε
    //    διαδρομή που ο προβολέας ΚΑΛΕΙ. Αν κάποιος «συμπληρώσει» την οικογένεια,
    //    αυτό κοκκινίζει.
    const permissions = PREDEFINED_ROLES.company_admin!.permissions;
    for (const notNeeded of ['dxf:files:upload', 'dxf:annotations:edit']) {
      expect(permissions).not.toContain(notNeeded);
    }
  });
});

describe('Κ2 — permission που ΑΠΑΙΤΕΙ ζωντανή διαδρομή και δεν το έχει ΚΑΝΕΙΣ', () => {
  /**
   * Σαρώνει τον δίσκο: `permission id` → οι διαδρομές που το απαιτούν.
   *
   * 🔴 ADR-829 §7.1 — ως τις 2026-11-01 κοιτούσε μόνο `route.ts` με `permissions:`. Έμεναν αόρατοι οι handlers που
   * έχουν βγει σε δικό τους αρχείο (`building-update.handler.ts`), τα εργοστάσια διαδρομών του `lib/api` και η ενική
   * δήλωση `permission:`. Έτσι το ADR έγραφε «5 διαδρομές» για το `buildings:update`, ενώ ήταν 7.
   */
  const requiredByRoutes = ((): ReadonlyMap<string, ReadonlySet<string>> => {
    const srcDir = path.resolve(__dirname, '../../..');
    const found = new Map<string, Set<string>>();
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') walk(full);
        } else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) {
          const src = fs.readFileSync(full, 'utf8');
          for (const m of src.matchAll(/permissions?:\s*'([a-z_0-9]+:[a-z_0-9]+:[a-z_0-9]+)'/g)) {
            const rel = path.relative(srcDir, full).split(path.sep).join('/');
            if (!found.has(m[1]!)) found.set(m[1]!, new Set());
            found.get(m[1]!)!.add(rel);
          }
        }
      }
    };
    for (const root of ['app/api', 'lib/api', 'services/showcase-core/api']) walk(path.join(srcDir, root));
    return found;
  })();

  it('η σάρωση βρήκε πραγματικές διαδρομές (αλλιώς το επόμενο test είναι κενό)', () => {
    // ⚠️ Το «0 = κανείς δεν κοίταξε» είναι ΤΟ σχήμα που κυνηγά αυτό το αρχείο.
    //    Αν το regex ή η διαδρομή σπάσει, θέλουμε ΚΟΚΚΙΝΟ, όχι σιωπηλό πράσινο.
    expect(requiredByRoutes.size).toBeGreaterThan(25);
    expect(requiredByRoutes.has('dxf:layers:view')).toBe(true);
  });

  it('🔴 κάθε τέτοιο permission είναι ΔΗΛΩΜΕΝΟ με λόγο — κανένα σιωπηλό', () => {
    const unreachable = [...requiredByRoutes.keys()].filter((p) => !HELD_BY_SOMEONE.has(p));
    const undeclared = unreachable.filter((p) => !(p in UNREACHABLE_BY_DESIGN));
    expect(undeclared).toEqual([]);
  });

  it('🔴 και αντίστροφα: καμία δήλωση δεν είναι μπαγιάτικη', () => {
    // Αν ένα permission αποκτήσει κάτοχο, η γραμμή του εδώ πρέπει να ΦΥΓΕΙ —
    // αλλιώς ο πίνακας γίνεται νεκρό χαρτί που δικαιολογεί ανύπαρκτα ευρήματα.
    const stillUnreachable = [...requiredByRoutes.keys()].filter((p) => !HELD_BY_SOMEONE.has(p));
    for (const declared of Object.keys(UNREACHABLE_BY_DESIGN)) {
      expect(stillUnreachable).toContain(declared);
    }
  });

  it('κάθε δήλωση έχει ΠΡΑΓΜΑΤΙΚΟ λόγο, και ξεχωρίζει σκόπιμο από ανοιχτό', () => {
    for (const [name, reason] of Object.entries(UNREACHABLE_BY_DESIGN)) {
      expect(DECLARED_PERMISSIONS).toContain(name);
      expect(reason.trim().length).toBeGreaterThan(60);
      expect(/^(ΣΚΟΠΙΜΟ|ΑΝΟΙΧΤΟ ΕΥΡΗΜΑ)/.test(reason)).toBe(true);
    }
  });
});

describe('Κ3 — η τομή {ποιος μπαίνει} ∩ {ποιος μπορεί να χρησιμοποιήσει}', () => {
  it('ο πίνακας επιφανειών δεν είναι άδειος', () => {
    expect(SURFACES.length).toBeGreaterThan(0);
  });

  it.each(SURFACES.map((s) => [s.name, s] as const))(
    '🔴 %s — η τομή ΔΕΝ είναι κενή',
    (_name, surface) => {
      const canEnter = ROLES
        .filter(([, r]) => r.permissions.includes(surface.entry as never))
        .map(([n]) => n);
      const canUse = ROLES
        .filter(([, r]) => surface.needs.every((p) => r.permissions.includes(p as never)))
        .map(([n]) => n);

      // Η πόρτα πρέπει να ανοίγει σε κάποιον…
      expect(canEnter.length).toBeGreaterThan(0);
      // …και τουλάχιστον ένας από αυτούς πρέπει να μπορεί να είναι μέσα.
      expect(canEnter.filter((n) => canUse.includes(n))).not.toEqual([]);
    },
  );

  it('κάθε επιφάνεια δηλώνει ΓΙΑΤΙ, και ζητά υπαρκτά permissions', () => {
    for (const surface of SURFACES) {
      expect(surface.why.trim().length).toBeGreaterThan(60);
      expect(DECLARED_PERMISSIONS).toContain(surface.entry);
      for (const need of surface.needs) expect(DECLARED_PERMISSIONS).toContain(need);
    }
  });
});
