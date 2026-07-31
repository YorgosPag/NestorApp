/**
 * =============================================================================
 * ΣΥΜΒΟΛΑΙΟ CRON ROUTES — το test που θα είχε αποτρέψει το ADR-739
 * =============================================================================
 *
 * Δύο αναλλοίωτα, και τα δύο παραβιάστηκαν σιωπηλά στην παραγωγή:
 *
 * 1. **Εξαντλητικότητα** — κάθε `src/app/api/cron/<x>/route.ts` πρέπει να είναι
 *    δηλωμένο στο `src/config/cron-schedule.ts`. Το `/api/cron/ai-pipeline` υπήρχε από
 *    την αρχή και **δεν μπήκε ποτέ** στο `vercel.json`: δεν έτρεξε ποτέ, και κανείς δεν
 *    το έμαθε γιατί κανένα εργαλείο δεν συνέκρινε «τι υπάρχει» με «τι δηλώθηκε».
 *
 * 2. **Κάλυψη guard** — κάθε cron route πρέπει να ταυτοποιεί τον καλούντα. Τα
 *    `purge-deleted-entities` και `purge-deleted-contacts` έκαναν **οριστική διαγραφή
 *    με cascade** χωρίς κανέναν έλεγχο· τα κάλυπτε κατά λάθος το bot-block του
 *    middleware, που φιλτράρει user-agent — δηλαδή τίποτα.
 *
 * ## Γιατί διαβάζει αρχεία αντί να κάνει import
 *
 * Το ερώτημα είναι «**τι υπάρχει στον δίσκο**», όχι «τι εξάγει ο κώδικας». Ένα import
 * θα έβλεπε μόνο ό,τι κάποιος θυμήθηκε να δηλώσει — δηλαδή θα ρωτούσε τον ύποπτο. Η
 * σάρωση καταλόγου είναι το μόνο που πιάνει το route που **κανείς δεν σύνδεσε**.
 *
 * @see ADR-739
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const CRON_ROUTES_DIR = join(REPO_ROOT, 'src', 'app', 'api', 'cron');
const SCHEDULE_FILE = join(REPO_ROOT, 'src', 'config', 'cron-schedule.ts');

/** Ο πυροκροτητής του χρονοπρογραμματιστή — δεν είναι εργασία, δεν δηλώνεται. */
const DISPATCHER_SLUG = 'dispatch';

function listCronRouteSlugs(): string[] {
  return readdirSync(CRON_ROUTES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== DISPATCHER_SLUG);
}

function readScheduleSource(): string {
  return readFileSync(SCHEDULE_FILE, 'utf8');
}

/** Τα `path:` που δηλώνει το SSoT, χωρίς να χρειαστεί να φορτωθεί ο κώδικας. */
function declaredCronPaths(source: string): string[] {
  return [...source.matchAll(/path:\s*'(\/api\/cron\/[^']+)'/g)].map((m) => m[1]);
}

/** Τα `slug:` που δηλώνει το SSoT. */
function declaredCronSlugs(source: string): string[] {
  return [...source.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
}

function readRouteSource(slug: string): string {
  return readFileSync(join(CRON_ROUTES_DIR, slug, 'route.ts'), 'utf8');
}

/**
 * Αφαιρεί σχόλια πριν από τους ελέγχους απαγόρευσης.
 *
 * Χωρίς αυτό, μια τεκμηρίωση που **προειδοποιεί** για ένα anti-pattern (π.χ. το
 * παράδειγμα κλήσης στο `dispatch/route.ts` που αναφέρει `CRON_SECRET`) θα κοκκίνιζε
 * το test — και ο επόμενος θα «διόρθωνε» το σχόλιο αντί τον κώδικα. Το test πρέπει να
 * ρωτά τι **εκτελείται**, όχι τι είναι γραμμένο.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('συμβόλαιο cron routes (ADR-739)', () => {
  const routeSlugs = listCronRouteSlugs();

  it('υπάρχουν cron routes προς έλεγχο', () => {
    // Δικλείδα για το ίδιο το test: αν η σάρωση σπάσει (μετακίνηση φακέλου, λάθος
    // διαδρομή), όλα τα υπόλοιπα `it.each` θα περνούσαν κενά — πράσινα και άχρηστα.
    expect(routeSlugs.length).toBeGreaterThanOrEqual(9);
  });

  describe('εξαντλητικότητα — κάθε route είναι δηλωμένο', () => {
    it.each(listCronRouteSlugs())(
      '%s δηλώνεται στο cron-schedule.ts',
      (slug) => {
        const declared = declaredCronPaths(readScheduleSource());
        expect(declared).toContain(`/api/cron/${slug}`);
      }
    );

    it('καμία δήλωση δεν δείχνει σε ανύπαρκτο route', () => {
      const declared = declaredCronPaths(readScheduleSource());
      const orphans = declared.filter(
        (path) => !routeSlugs.includes(path.replace('/api/cron/', ''))
      );
      expect(orphans).toEqual([]);
    });

    it('τα slugs είναι μοναδικά', () => {
      const slugs = declaredCronSlugs(readScheduleSource());
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('κάθε slug ταιριάζει με το τελευταίο τμήμα του path του', () => {
      // Ασυμφωνία slug↔path θα σήμαινε ότι το Sentry monitor και η χειροκίνητη
      // κλήση αναφέρονται σε διαφορετικά πράγματα με το ίδιο όνομα.
      const source = readScheduleSource();
      const pairs = [...source.matchAll(/slug:\s*'([^']+)',\s*\n\s*path:\s*'([^']+)'/g)];
      expect(pairs.length).toBe(declaredCronSlugs(source).length);
      for (const [, slug, path] of pairs) {
        expect(path).toBe(`/api/cron/${slug}`);
      }
    });
  });

  describe('κάλυψη guard — κανένα cron route χωρίς ταυτοποίηση', () => {
    it.each([...listCronRouteSlugs(), DISPATCHER_SLUG])(
      '%s ταυτοποιεί τον καλούντα',
      (slug) => {
        const code = stripComments(readRouteSource(slug));
        const usesGuard =
          code.includes('rejectUnauthorizedCron(') ||
          code.includes('verifyCronAuthorization(');
        expect(usesGuard).toBe(true);
      }
    );

    it.each([...listCronRouteSlugs(), DISPATCHER_SLUG])(
      '%s παίρνει τον guard από το SSoT και όχι από τοπικό αντίγραφο',
      (slug) => {
        const code = stripComments(readRouteSource(slug));
        expect(code).toMatch(/from '@\/lib\/cron-auth'/);
        // Απευθείας ανάγνωση του μυστικού μέσα σε route = δεύτερη υλοποίηση
        // ταυτοποίησης, ακριβώς ό,τι απαγορεύει το module `cron-auth` του
        // .ssot-registry.json.
        expect(code).not.toContain('process.env.CRON_SECRET');
      }
    );
  });

  describe('τα routes είναι πυροκροτητές, όχι λογική', () => {
    it.each(listCronRouteSlugs())('%s δεν αγγίζει απευθείας τη Firestore', (slug) => {
      const code = stripComments(readRouteSource(slug));
      // Η λογική ανήκει στο lib/cron/jobs/*.job.ts ώστε να είναι δοκιμάσιμη χωρίς
      // HTTP. Ερώτημα Firestore μέσα σε route σημαίνει ότι ξανακόλλησε στον handler.
      expect(code).not.toContain('.collection(');
    });
  });
});
