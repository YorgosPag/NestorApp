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
 *   Ρ5 `flushInBatches(` που δηλώνει `COLLECTIONS.CONTACTS` ⇒ περνά `performer` (Σ5· ο γραφέας πετά χωρίς αυτόν)
 *   Ρ6 μορφή `doc.ref` (`.set|update(x.ref`) σε αρχείο που αγγίζει επαφές ⇒ γραφέας — εκτός αν η αναφορά είναι
 *      ΑΛΛΗΣ συλλογής, δηλωμένο με λόγο στο `DOC_REF_OTHER_COLLECTION` (2026-10-30: έτσι βρέθηκε το `migrate-company-id`)
 *
 * ⚠️ ΤΥΦΛΑ ΣΗΜΕΙΑ (δηλωμένα, όχι κρυμμένα): δυναμικό όνομα συλλογής (`firestore_write` — σφραγίζει πάντα,
 * δες `firestore-handler.ts`). Οι μαζικοί γραφείς (`flushInBatches` / `openDeclaredBatch`) **πετούν** σε γραφή
 * συλλογής του CDC χωρίς φορέα (`lib/__tests__/admin-batch-utils.test.ts` Δ8–Δ11) — η άμυνα ζει στον γραφέα.
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

/**
 * Μορφή `doc.ref` σε αρχείο που αγγίζει επαφές, όπου όμως η αναφορά ανήκει σε ΑΛΛΗ συλλογή. Ο στατικός έλεγχος
 * δεν ξέρει από ποιο ερώτημα ήρθε το `doc` — γι' αυτό κάθε τέτοιο αρχείο είναι **απόφαση με λόγο**, όχι σιωπή.
 */
const DOC_REF_OTHER_COLLECTION: Readonly<Record<string, string>> = {
  'app/api/admin/migrate-enterprise-ids/migration-operations.ts':
    'τα `doc.ref` είναι `contact_links` · `projects` · `buildings` · `properties` — οι επαφές μόνο διαβάζονται',
  'app/api/contacts/[contactId]/route.ts':
    'το `fileDoc.ref` είναι έγγραφο `files` (στον κάδο μαζί με την επαφή), όχι η επαφή',
  'app/api/properties/[id]/property-contact-links.ts':
    'το `linkDoc.ref` είναι `contact_links`· η επαφή γράφεται με `performerStamp` στο ίδιο αρχείο',
  'services/banking/bank-accounts-server.service.ts':
    'το `doc.ref` είναι η υποσυλλογή `bankAccounts` — όχι το έγγραφο επαφής που παρακολουθεί ο CDC',
  'services/ai-pipeline/tools/handlers/banking-handler.ts':
    'το `doc.ref` είναι η υποσυλλογή `bankAccounts` — όχι το έγγραφο επαφής που παρακολουθεί ο CDC',
};

const STAMP_TOKEN = /\b(?:performerStamp|stampPerformer|aiAgentStamp|cdcStamped)\(/;
const DOC_REF_WRITE = /\.(?:set|update)\(\s*\w+\.ref\b/;
/** Σχόλια έξω — αλλιώς η ΤΕΚΜΗΡΙΩΣΗ μιας διόρθωσης («πριν: `batch.update(doc.ref)`») θα κοκκίνιζε. */
const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
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

function writesContacts(text: string, file: string): boolean {
  if (!(file in DOC_REF_OTHER_COLLECTION) && DOC_REF_WRITE.test(stripComments(text))) return true;
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
    .filter(([file, text]) => text.includes('COLLECTIONS.CONTACTS') && !isClient(text) && writesContacts(text, file)),
);

/** Κάθε κλήση `flushInBatches(…)` που δηλώνει τις επαφές, ανά αρχείο (Ρ5). */
const CONTACT_FLUSHES: ReadonlyArray<readonly [string, string]> = sourceFiles(SRC)
  .map((file) => [path.relative(SRC, file).split(path.sep).join('/'), fs.readFileSync(file, 'utf8')] as const)
  .flatMap(([file, text]) =>
    [...stripComments(text).replace(/\s+/g, ' ').matchAll(/flushInBatches\([^;]*?\);/g)]
      .filter((m) => m[0].includes('COLLECTIONS.CONTACTS'))
      .map((m) => [file, m[0]] as const));

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
      // Ρ6 — μορφή `doc.ref` με δυναμική συλλογή (ξαναγράφει το `companyId` και στις επαφές)
      'app/api/admin/migrate-company-id/migration-operations.ts',
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

  it('Σ5 🔴 κάθε `flushInBatches` που γράφει επαφές περνά τον φορέα (ο CDC τον διαβάζει από το έγγραφο)', () => {
    // Παρονομαστής: οι τρεις γνωστές μεταπτώσεις επαφών ΒΡΙΣΚΟΝΤΑΙ — αλλιώς το πράσινο θα σήμαινε «δεν κοίταξα».
    expect(new Set(CONTACT_FLUSHES.map(([file]) => file))).toEqual(new Set([
      'app/api/admin/migrate-address-labels/migration-operations.ts',
      'app/api/admin/migrate-postal-codes/migration-operations.ts',
      'app/api/admin/search-backfill/search-backfill.handlers.ts',
    ]));
    const unstamped = CONTACT_FLUSHES.filter(([, call]) => !/\bperformer\b/.test(call)).map(([file]) => file);
    expect(unstamped).toEqual([]);
  });

  it('Σ6 🔴 καμία μπαγιάτικη δήλωση «άλλης συλλογής» — κάθε αρχείο έχει ακόμη τη μορφή `doc.ref`', () => {
    const stale = Object.keys(DOC_REF_OTHER_COLLECTION).filter((file) => {
      const full = path.join(SRC, file);
      return !fs.existsSync(full) || !DOC_REF_WRITE.test(stripComments(fs.readFileSync(full, 'utf8')));
    });
    expect(stale).toEqual([]);
  });

  it('Σ4 ο builder που γράφουν οι εξαιρέσεις συναλλαγής σφραγίζει (αλλιώς η εξαίρεση θα ήταν ψέμα)', () => {
    const builder = fs.readFileSync(path.join(SRC, 'services/ai-pipeline/shared/contact-document-builder.ts'), 'utf8');
    expect(STAMP_TOKEN.test(builder)).toBe(true);
    expect(BARE_KEY.test(builder)).toBe(false);
  });
});
