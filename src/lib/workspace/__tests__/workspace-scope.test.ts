/**
 * @jest-environment node
 *
 * `lib/workspace/workspace-scope` — Η ΔΗΛΩΣΗ ΠΟΥ ΕΧΕΙ ΜΗΧΑΝΙΚΗ ΑΠΟΔΕΙΞΗ
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΥΛΑΕΙ (ADR-787 §5.3 η)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ένα κλειστό σύνολο εξαιρέσεων είναι επικίνδυνο **προς τις δύο κατευθύνσεις**:
 * λέξη που **λείπει** ⇒ δημόσιος σύνδεσμος παίρνει πρόθεμα ⇒ **404**· λέξη
 * **παραπανίσια** ⇒ υπαρκτή σελίδα χώρου γίνεται **απροσπέλαστη**.
 *
 * Γι' αυτό το σύνολο **δεν κρίνεται με το μάτι**: αποδεικνύεται ότι ισούται
 * **ακριβώς** με ό,τι δίνει το πραγματικό δέντρο (Ε1), και ότι δεν διαφωνεί με
 * τη γειτονική αυθεντία της CHECK 3.60 στην τομή τους (Ε2).
 */

import { readdirSync } from 'fs';
import { join } from 'path';
import { REPO_ROOT, readRepoFile } from '@/test-utils/read-source';
import { OUTSIDE_WORKSPACE, isInsideWorkspace } from '../workspace-scope';
import { WORKSPACE_PATH_PREFIX } from '../workspace-path';

const APP = join(REPO_ROOT, 'src', 'app');
const WORKSPACE_TREE = join(APP, '(app)', 'o', '[workspace]');

/**
 * Τα κορυφαία τμήματα διαδρομής όλου του `src/app`.
 *
 * ⚠️ **Τα route groups είναι ΦΑΚΕΛΟΙ και δεν εμφανίζονται ΠΟΤΕ στο pathname** —
 * γι' αυτό ο περίπατος **κατεβαίνει μέσα τους** αντί να τα μετρήσει. Είναι το
 * ίδιο μάθημα που πλήρωσε η CHECK 3.52 (ο φρουρός κελύφους ήταν δομικά τυφλός
 * στο `(light)` επειδή έκρινε `pathname`).
 *
 * ⚠️ **Τα ΔΥΝΑΜΙΚΑ τμήματα (`[id]` · `[...rest]`) είναι ΣΧΗΜΑΤΑ, όχι διευθύνσεις.**
 * Κανένας σύνδεσμος δεν περιέχει κυριολεκτικά `[...unprefixed]` — και αν κάποιος
 * τα καταφέρει, τον πιάνει **ήδη** ο φρουρός placeholder του `src/middleware.ts`
 * (307 προς τον γονέα). Ένα σχήμα στο κλειστό σύνολο θα ήταν εγγραφή για
 * διεύθυνση **που δεν υπάρχει**, δηλαδή φρουρός που δεν μπορεί να πυροδοτήσει.
 * 🔴 Το βρήκε η ΙΔΙΑ η CHECK 3.60, μπλοκάροντας το δίχτυ του §5.3 ιβ.
 */
function topLevelRouteSegments(dir: string): Set<string> {
  const tops = new Set<string>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (/^\(.*\)$/.test(entry.name)) {
      for (const nested of topLevelRouteSegments(join(dir, entry.name))) tops.add(nested);
      continue;
    }
    if (isDynamicSegment(entry.name)) continue;
    if (isPrivateFolder(entry.name)) continue;
    tops.add(entry.name);
  }
  return tops;
}

/** `[id]` · `[...rest]` · `[[...opt]]` — σχήμα διαδρομής, ποτέ κυριολεκτικό τμήμα. */
function isDynamicSegment(name: string): boolean {
  return name.startsWith('[');
}

/**
 * `_folder` — **ιδιωτικός φάκελος του Next.js**: εξαιρείται από τη δρομολόγηση,
 * άρα **δεν είναι τμήμα διαδρομής** και δεν έχει τι να δηλώσει κανείς γι' αυτόν.
 *
 * 🔴 **ΤΟ ΒΡΗΚΕ ΖΩΝΤΑΝΗ ΑΣΤΟΧΙΑ** (2026-08-27): το `98333253` γέννησε το
 * `src/app/__tests__/` και το Ε1 κοκκίνισε ζητώντας δήλωση για φάκελο που **καμία
 * διεύθυνση δεν φτάνει**. Η θεραπεία δεν είναι γραμμή στο `OUTSIDE_WORKSPACE` —
 * θα ήταν ψέμα: ο φάκελος δεν είναι «έξω από τον χώρο», είναι **έξω από τις
 * διαδρομές**. ⚠️ Ο κανόνας είναι η **σύμβαση του πλαισίου**, όχι το όνομα
 * `__tests__`: κάθε `_*` εξαιρείται, όπως ακριβώς το ορίζει το Next.js.
 */
function isPrivateFolder(name: string): boolean {
  return name.startsWith('_');
}

function workspaceChildren(): Set<string> {
  return new Set(
    readdirSync(WORKSPACE_TREE, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
  );
}

// =============================================================================
// Ε — ΟΙ ΔΥΟ ΑΠΟΔΕΙΞΕΙΣ
// =============================================================================

describe('Ε — η δήλωση αποδεικνύεται, δεν διαβάζεται', () => {
  it('Ε1: 🔴🔴 ΠΑΡΑΓΩΓΗ — το σύνολο ισούται ΑΚΡΙΒΩΣ με (όλα τα groups) − (παιδιά του χώρου)', () => {
    const expected = [...topLevelRouteSegments(APP)]
      .filter(seg => !workspaceChildren().has(seg))
      .sort();
    expect(Object.keys(OUTSIDE_WORKSPACE).sort()).toEqual(expected);
  });

  it('Ε1β: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — τα δύο σύνολα είναι ΞΕΝΑ και μαζί καλύπτουν το δέντρο', () => {
    // Χωρίς αυτό, το Ε1 θα μπορούσε να περνά με άδειο δέντρο ή άδειο χώρο.
    const tops = topLevelRouteSegments(APP);
    const inside = workspaceChildren();
    expect(inside.size).toBeGreaterThan(20);
    expect(tops.size).toBeGreaterThan(20);
    for (const seg of inside) expect(seg in OUTSIDE_WORKSPACE).toBe(false);
    for (const seg of tops) {
      expect(inside.has(seg) || seg in OUTSIDE_WORKSPACE).toBe(true);
    }
  });

  it('Ε2: 🔴 ΙΣΟΔΥΝΑΜΙΑ — καμία διαφωνία με το `.workspace-scope.json` στην ΤΟΜΗ τους', () => {
    // Οι δύο μηχανές ΕΠΙΤΡΕΠΕΤΑΙ να υπάρχουν (άλλο ερώτημα η καθεμία)· ΔΕΝ
    // επιτρέπεται να διαφωνήσουν. Η CHECK 3.60 κρίνει μόνο το `(app)`, άρα η
    // τομή είναι ακριβώς οι δικές της δηλώσεις.
    const gate = JSON.parse(readRepoFile('.workspace-scope.json')) as {
      outsideWorkspace: Record<string, unknown>;
    };
    // ⚠️ Η τομή είναι τα **ΚΥΡΙΟΛΕΚΤΙΚΑ** τμήματα. Η CHECK 3.60 κρίνει **θέση
    //    σελίδας**, άρα δηλώνει και σχήματα (`[...unprefixed]` — το δίχτυ του
    //    §5.3 ιβ ζει εκεί νόμιμα)· εδώ κρίνεται **διεύθυνση**, και σχήμα δεν
    //    είναι διεύθυνση. Δεν είναι εξαίρεση βολικότητας: είναι ακριβώς η
    //    διαφορά των δύο ερωτημάτων, γραμμένη.
    const declared = Object.keys(gate.outsideWorkspace).filter(s => !isDynamicSegment(s));
    expect(declared.length).toBeGreaterThan(10); // παρονομαστής: δεν είναι άδειο

    for (const seg of declared) {
      expect(seg in OUTSIDE_WORKSPACE).toBe(true);
      expect(isInsideWorkspace(`/${seg}`)).toBe(false);
    }
  });

  it('Ε3: κάθε εγγραφή έχει ΠΡΑΓΜΑΤΙΚΟ λόγο — δήλωση χωρίς λόγο είναι παράκαμψη', () => {
    for (const [seg, why] of Object.entries(OUTSIDE_WORKSPACE)) {
      expect(typeof why).toBe('string');
      expect(why.trim().length).toBeGreaterThan(40);
      expect(seg.trim()).toBe(seg);
    }
  });
});

// =============================================================================
// Ζ — Η ΚΡΙΣΗ
// =============================================================================

describe('Ζ — ο κριτής της διεύθυνσης', () => {
  it('Ζ1: οι ΜΕΤΡΗΜΕΝΟΙ εντός προορισμοί απαντούν «μέσα»', () => {
    // Τα 11 πρώτα τμήματα των 107 κυριολεκτικών σημείων που μετρήθηκαν εντός.
    for (const p of [
      '/procurement', '/accounting', '/properties', '/projects', '/crm',
      '/spaces', '/contacts', '/obligations', '/buildings', '/sales', '/dxf',
      '/dashboard', '/settings/general', '/properties/prop_abc',
    ]) {
      expect(isInsideWorkspace(p)).toBe(true);
    }
  });

  it('Ζ2: 🔴 οι ΜΕΤΡΗΜΕΝΟΙ εκτός προορισμοί απαντούν «έξω» — αλλιώς γεννιέται ΝΕΟ 404', () => {
    for (const p of [
      '/login', '/terms', '/privacy-policy', '/pending-approval', '/onboarding',
      '/navigation', '/debug', '/data-deletion', '/offers/new', '/demands/new',
      '/search', '/admin/users', '/api/properties', '/showcase/tok', '/share/tok',
    ]) {
      expect(isInsideWorkspace(p)).toBe(false);
    }
  });

  it('Ζ3: 🔴 Η ΡΙΖΑ ΕΙΝΑΙ ΔΗΜΟΣΙΑ — «/» δεν μπαίνει σε χώρο', () => {
    expect(isInsideWorkspace('/')).toBe(false);
  });

  it('Ζ4: 🔴 ΤΟ ΕΡΩΤΗΜΑ ΔΕΝ ΕΙΝΑΙ ΤΜΗΜΑ ΔΙΑΔΡΟΜΗΣ', () => {
    // Χωρίς το κόψιμο, το πρώτο τμήμα θα ήταν «terms?x=1» — δεν θα ταίριαζε με
    // καμία εγγραφή, και η δημόσια οθόνη θα έπαιρνε πρόθεμα.
    expect(isInsideWorkspace('/terms?from=footer')).toBe(false);
    expect(isInsideWorkspace('/login#top')).toBe(false);
    expect(isInsideWorkspace('/contacts?filter=%CE%91')).toBe(true);
  });

  it('Ζ5: διεύθυνση που ΗΔΗ ονομάζει χώρο δεν ξαναμπαίνει', () => {
    expect(isInsideWorkspace(`/${WORKSPACE_PATH_PREFIX}/nikos/projects`)).toBe(false);
    expect(isInsideWorkspace(`/${WORKSPACE_PATH_PREFIX}/me`)).toBe(false);
  });

  it('Ζ6: 🔴 ΕΞΩΤΕΡΙΚΟ / ΣΧΕΤΙΚΟ ΜΕΝΕΙ ΑΝΕΓΓΙΧΤΟ', () => {
    for (const p of [
      'https://nestorconstruct.gr/projects',
      'http://example.com',
      'mailto:a@b.gr',
      'tel:+302100000000',
      '//cdn.example.com/x',
      'projects',
      '#anchor',
      '',
    ]) {
      expect(isInsideWorkspace(p)).toBe(false);
    }
  });
});

// =============================================================================
// Ζ5β — Ο ΜΗΧΑΝΙΣΜΟΣ ΤΟΥ Ζ5, ΟΝΟΜΑΣΜΕΝΟΣ
// =============================================================================
//
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το Ζ5 έμενε **ΠΡΑΣΙΝΟ** όταν σβήναμε τον φρουρό
// `hasWorkspacePrefix` (μετάλλαξη Μ4) — γιατί τη δουλειά την έκανε ήδη το
// κλειστό σύνολο. Ο φρουρός ήταν **αδύνατο να πυροδοτήσει** (ADR-749 §5) και
// αφαιρέθηκε. Χωρίς αυτή την άγκυρα, ο επόμενος που θα έβγαζε το `o` από το
// σύνολο θα έβλεπε το Ζ5 να μένει πράσινο για **δεύτερη** λάθος αιτία.
describe('Ζ5β — ποιος ΑΚΡΙΒΩΣ κρατά έξω το ήδη-προθεματισμένο', () => {
  it('Ζ5β: 🔴 ο δείκτης χώρου ΕΙΝΑΙ εγγραφή του κλειστού συνόλου, με λόγο', () => {
    expect(WORKSPACE_PATH_PREFIX in OUTSIDE_WORKSPACE).toBe(true);
    expect(OUTSIDE_WORKSPACE[WORKSPACE_PATH_PREFIX].length).toBeGreaterThan(40);
  });
});
