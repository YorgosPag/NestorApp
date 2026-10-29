/**
 * 🔒 ΑΓΚΥΡΑ ΚΛΑΣΗΣ — κάθε γραφέας επαφής του server **σφραγίζει φορέα** (ADR-195, 2026-10-29).
 *
 * Μετρημένο ζωντανά (MACON ATEE, «Ιστορικό»): καμία γραμμή δεν έλεγε «από …». Ο CDC
 * (`functions/src/audit/contact-audit-trigger.ts`) διαβάζει τον δράστη από `_lastModifiedBy` /
 * `_lastModifiedByName`· οι server γραφείς έγραφαν `lastModifiedBy` (χωρίς `_`) ⇒ `cdc_unknown`, και το
 * ωμό κλειδί εμφανιζόταν ως «αλλαγή». Η θεραπεία είναι ΕΝΑΣ βοηθός (`server/lib/performer-stamp.ts`)·
 * αυτή η άγκυρα κρατά **κάθε** γραφέα πάνω του — και αυτούς που θα γραφτούν αύριο.
 *
 * Τι ανιχνεύει (στατικά, σε όλο το `src/`, εκτός tests):
 *   Ρ1 `collection(COLLECTIONS.CONTACTS).doc(…).set|update|create(`
 *   Ρ2 `tx|transaction|batch.set|update|create(<…>collection(COLLECTIONS.CONTACTS)`
 *   Ρ3 μεταβλητή από `…COLLECTIONS.CONTACTS…` και μετά `var.set|update(` ή `.set|update(var`
 *   Ρ4 φορτωτής επαφής (`loadAgentContact` · `openOwnedContact`) και μετά `.ref.set|update(`
 *
 * ⚠️ ΤΥΦΛΑ ΣΗΜΕΙΑ (δηλωμένα, όχι κρυμμένα): δυναμικό όνομα συλλογής (`firestore_write` — σφραγίζει πάντα,
 * δες `firestore-handler.ts`) · αναφορές από στιγμιότυπα ερωτήματος (`doc.ref`) · μαζικές μεταπτώσεις μέσω
 * `flushInBatches` (εκκρεμές στο `pending-ratchet-work.md`, μπλοκ 🧑).
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | αφαιρείται η σφραγίδα από έναν γραφέα | Σ1 ⇒ 🔴 (ονομάζει το αρχείο) |
 * | ξαναμπαίνει ωμό `lastModifiedBy:` | Σ2 ⇒ 🔴 |
 * | εξαίρεση για αρχείο που δεν γράφει πια επαφές | Σ3 ⇒ 🔴 (μπαγιάτικη εξαίρεση) |
 *
 * @module server/lib/__tests__/contact-writer-performer-stamp
 */

/* global describe, it, expect */

import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../../..');

/** Γράφουν επαφές χωρίς δική τους σφραγίδα — **με λόγο**. Κάθε γραμμή εδώ είναι απόφαση, όχι σιωπή. */
const STAMP_EXEMPT: Readonly<Record<string, string>> = {
  'app/api/admin/migrate-enterprise-ids/route.ts':
    'αντιγράφει ΟΛΟΚΛΗΡΟ το έγγραφο σε νέο id — κρατά σωστά τη σφραγίδα του αρχικού φορέα',
  'server/spatial-tour/tour-access-decision.ts':
    'γράφει το έγγραφο του `buildContactDocument` (σφραγισμένο εκεί· Σ4) μέσα στη συναλλαγή',
  'services/mandate/mandate-acceptance.service.ts':
    'γράφει το έγγραφο του `buildContactDocument` (σφραγισμένο εκεί· Σ4) μέσα στη συναλλαγή',
  'services/ai-pipeline/tools/handlers/banking-handler.ts':
    'γράφει στην υποσυλλογή `bankAccounts` — όχι στο έγγραφο επαφής που παρακολουθεί ο CDC',
};

/** Ωμό `lastModifiedBy:` επιτρέπεται μόνο όπου ανήκει σε ΑΛΛΗ συλλογή του ίδιου αρχείου. */
const BARE_KEY_ALLOWED: Readonly<Record<string, string>> = {
  'services/ai-pipeline/tools/handlers/attachment-handler.ts':
    'το `lastModifiedBy` του `promoteFileRecord` ανήκει σε έγγραφο `files`, όχι επαφής',
  'subapps/procurement/services/commit-signatory-service.ts':
    'το `lastModifiedBy` ανήκει στο έγγραφο `contact_relationships` (υπογράφων ↔ προμηθευτής), όχι επαφής',
};

const STAMP_TOKEN = /\b(?:performerStamp|stampPerformer|aiAgentStamp)\(/;
const BARE_KEY = /(?<![\w_])lastModifiedBy\s*:/;
const WRITE = '(?:set|update|create)';

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function writesContacts(text: string): boolean {
  const flat = text.replace(/\s+/g, ' ');
  if (new RegExp(`collection\\(COLLECTIONS\\.CONTACTS\\) ?\\.doc\\([^;]*?\\) ?\\.${WRITE}\\(`).test(flat)) {
    const inline = new RegExp(`collection\\(COLLECTIONS\\.CONTACTS\\) ?\\.doc\\(([^()]|\\([^()]*\\))*\\) ?\\.${WRITE}\\(`);
    if (inline.test(flat)) return true;
  }
  if (new RegExp(`\\b(?:tx|transaction|batch)\\.${WRITE}\\( ?[\\w.]*collection\\(COLLECTIONS\\.CONTACTS\\)`).test(flat)) return true;
  if (/\b(?:loadAgentContact|openOwnedContact)\(/.test(text) && new RegExp(`\\.ref\\.${WRITE}\\(`).test(text)) return true;
  for (const m of text.matchAll(/(?:const|let)\s+(\w+)\s*=\s*[^;]*COLLECTIONS\.CONTACTS\b/g)) {
    const v = m[1];
    if (new RegExp(`\\b${v}\\.${WRITE}\\(|\\.${WRITE}\\(\\s*${v}\\b`).test(text)) return true;
  }
  return false;
}

const isClient = (text: string): boolean => /^\s*['"]use client['"]/m.test(text.slice(0, 300));

const WRITERS: ReadonlyMap<string, string> = new Map(
  sourceFiles(SRC)
    .map((file) => [path.relative(SRC, file).split(path.sep).join('/'), fs.readFileSync(file, 'utf8')] as const)
    .filter(([, text]) => text.includes('COLLECTIONS.CONTACTS') && !isClient(text) && writesContacts(text)),
);

describe('γραφείς επαφών του server — σφραγίδα φορέα (ADR-195)', () => {
  it('Σ0 ΠΑΡΟΝΟΜΑΣΤΗΣ — η σάρωση βρίσκει τους γνωστούς γραφείς (αλλιώς το πράσινο θα σήμαινε «δεν κοίταξα»)', () => {
    for (const known of [
      'app/api/contacts/resolve/route.ts',
      'app/api/contacts/resolve/resolve-helpers.ts',
      'services/ai-pipeline/shared/contact-lookup-crud.ts',
      'services/communications/inbound/email-inbound-service.ts',
      'subapps/procurement/services/commit-signatory-service.ts',
      'services/ai-pipeline/tools/handlers/activity-handler.ts',
      'services/ai-pipeline/tools/handlers/esco-write-handler.ts',
    ]) {
      expect(WRITERS.has(known)).toBe(true);
    }
    expect(WRITERS.size).toBeGreaterThanOrEqual(14);
  });

  it('Σ1 🔴 κάθε γραφέας σφραγίζει μέσω του SSoT — ή είναι δηλωμένη εξαίρεση με λόγο', () => {
    const unstamped = [...WRITERS]
      .filter(([file, text]) => !(file in STAMP_EXEMPT) && !STAMP_TOKEN.test(text))
      .map(([file]) => file);
    expect(unstamped).toEqual([]);
  });

  it('Σ2 🔴 κανένας γραφέας δεν γράφει το ωμό `lastModifiedBy` (ο CDC δεν το διαβάζει — το δείχνει ως «αλλαγή»)', () => {
    const bare = [...WRITERS]
      .filter(([file, text]) => !(file in BARE_KEY_ALLOWED) && BARE_KEY.test(text))
      .map(([file]) => file);
    expect(bare).toEqual([]);
  });

  it('Σ3 🔴 καμία μπαγιάτικη εξαίρεση — κάθε δηλωμένο αρχείο είναι ακόμη γραφέας', () => {
    const stale = [...Object.keys(STAMP_EXEMPT), ...Object.keys(BARE_KEY_ALLOWED)].filter((file) => !WRITERS.has(file));
    expect(stale).toEqual([]);
  });

  it('Σ4 ο builder που γράφουν οι εξαιρέσεις συναλλαγής σφραγίζει (αλλιώς η εξαίρεση θα ήταν ψέμα)', () => {
    const builder = fs.readFileSync(path.join(SRC, 'services/ai-pipeline/shared/contact-document-builder.ts'), 'utf8');
    expect(STAMP_TOKEN.test(builder)).toBe(true);
    expect(BARE_KEY.test(builder)).toBe(false);
  });
});
