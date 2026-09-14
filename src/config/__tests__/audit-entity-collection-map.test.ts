/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΕΣ — ADR-195 / ADR-684 / **ADR-852 §4.9**: η «desync» κλάση, κλεισμένη.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΞΑΝΑΓΡΑΦΤΗΚΕ — **ΗΤΑΝ ΠΡΑΣΙΝΟ ΕΠΕΙΔΗ ΚΑΝΕΙΣ ΔΕΝ ΤΟ ΕΝΗΜΕΡΩΣΕ**
 *
 * Η προηγούμενη εκδοχή κρατούσε **χειρόγραφη** λίστα `BIM_AUDIT_ENTITY_TYPES` με
 * **18** ονόματα και το σχόλιο *«Προσθέτοντας νέο BIM audit-client → πρόσθεσέ το
 * ΚΑΙ εδώ»*. Μετρήθηκε 13/09: οι audit-clients ήταν **25**. Δηλαδή η οδηγία δεν
 * τηρήθηκε **επτά** φορές, και το test — που γράφτηκε **ακριβώς** για να μην
 * ξανασυμβεί το σιωπηλό 400 — ήταν πράσινο ενώ **έξι** οντότητες έχαναν κάθε
 * εγγραφή ιστορικού τους (`railing` · `floorplan-symbol` · `mep-radiator` ·
 * `mep-boiler` · `mep-water-heater` · `mep-underfloor`).
 *
 * 🔑 **Η ΘΕΡΑΠΕΙΑ: Η ΛΙΣΤΑ ΠΑΡΑΓΕΤΑΙ ΑΠΟ ΤΗΝ ΠΡΑΓΜΑΤΙΚΟΤΗΤΑ.** Το test σαρώνει τα
 * ίδια τα `*-audit-client.ts` και διαβάζει το `entityType` που **στέλνουν όντως**.
 * Ένας νέος client καλύπτεται **δωρεάν**, χωρίς να τον θυμηθεί κανείς — δηλαδή ο
 * όγδοος δεν μπορεί να ξεχαστεί όπως οι επτά.
 *
 * ⚠️ Οδηγία σε σχόλιο δεν είναι πύλη. Χειρόγραφη λίστα δίπλα σε αυτόματο κόσμο
 * είναι **χρονόμετρο**, όχι φρουρός.
 * ═════════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  ENTITY_COLLECTION_MAP,
  VALID_ENTITY_TYPES,
  SUBCOLLECTION_ENTITY_TYPES,
  RENAME_PROPAGATION_MAP,
  BACKUP_COLLECTION_KEY_MAP,
} from '../audit-entity-collection-map';
import { AUDIT_ENTITIES } from '../audit-entity-registry';
import { COLLECTIONS } from '../firestore-collections';

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const BIM_DIR = path.join(PROJECT_ROOT, 'src/subapps/dxf-viewer/bim');

/** Κάθε `*-audit-client.ts`, αναδρομικά. */
function collectAuditClients(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      collectAuditClients(abs, out);
    } else if (entry.name.endsWith('-audit-client.ts')) {
      out.push(abs);
    }
  }
  return out;
}

/**
 * Τα `entityType` που **στέλνει όντως** κάθε client στο `/api/audit-trail/record`.
 *
 * ⚠️ Διαβάζεται το ζεύγος **POST + entityType**, όχι σκέτο `entityType:` — αλλιώς
 * θα μετρούσαμε και σχόλια ή τοπικούς τύπους. Ο σαρωτής ΥΠΕΡ-εκτιμά ποτέ, υπο-
 * εκτιμά ποτέ: ένα `.post('/api/audit-trail/record', { entityType: 'x'` είναι
 * κυριολεκτικά η γραμμή που φτάνει στον φρουρό.
 */
function postedEntityTypes(): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  for (const file of collectAuditClients(BIM_DIR)) {
    const text = fs.readFileSync(file, 'utf8');
    const m = text.match(
      /\.post\(\s*['"]\/api\/audit-trail\/record['"],\s*\{\s*entityType:\s*['"]([a-zA-Z0-9_-]+)['"]/,
    );
    if (m) found.set(m[1], path.relative(PROJECT_ROOT, file).replace(/\\/g, '/'));
  }
  return found;
}

describe('ADR-852 §4.9 — ο σαρωτής βλέπει τον πραγματικό κόσμο (ΠΑΡΟΝΟΜΑΣΤΗΣ)', () => {
  it('Μ0 🔴 — βρίσκει audit-clients· χωρίς αυτό κάθε άλλη άγκυρα περνά ΔΩΡΕΑΝ', () => {
    // Το μάθημα των «0 = κανείς δεν κοίταξε»: κενή σάρωση θα έκανε τα Μ1/Μ2
    // πράσινα πάνω σε τίποτα. Ο αριθμός δηλώνεται ρητά ώστε μια μελλοντική
    // αναδιάρθρωση φακέλων να ΦΑΙΝΕΤΑΙ αντί να σιγήσει την πύλη.
    const posted = postedEntityTypes();
    expect(posted.size).toBeGreaterThanOrEqual(20);
  });
});

describe('ADR-852 §4.9 — κάθε client που POST-άρει είναι εγγεγραμμένος', () => {
  it('Μ1 🔴 — ΚΑΝΕΝΑΣ audit-client δεν στέλνει τύπο εκτός μητρώου (αλλιώς σιωπηλό 400)', () => {
    const orphans: string[] = [];
    for (const [type, file] of postedEntityTypes()) {
      if (!VALID_ENTITY_TYPES.has(type)) orphans.push(`${type} → ${file}`);
    }
    // Η αναφορά ονομάζει ΠΟΙΟΝ και ΠΟΥ: ένα σκέτο `toBe(0)` θα ανάγκαζε τον
    // επόμενο να ξανακάνει τη σάρωση με το χέρι για να μάθει ποιος έλειπε.
    expect(orphans).toEqual([]);
  });

  it('Μ2 🔴 — κάθε `client-post` του μητρώου ΕΧΕΙ συλλογή (το ζεύγος που έκρυψε τις έξι)', () => {
    // Ο συνδυασμός «στέλνω POST» + «δεν έχω collectionKey» είναι ΑΚΡΙΒΩΣ η βλάβη:
    // ο φρουρός του route ζητά συλλογή για να επαληθεύσει κατοχή, δεν τη βρίσκει,
    // και γυρίζει 400 που το fire-and-forget καταπίνει.
    const broken = Object.entries(AUDIT_ENTITIES)
      .filter(([, spec]) => spec.writer === 'client-post' && spec.collectionKey === null)
      .map(([type]) => type);
    expect(broken).toEqual([]);
  });

  it('Μ3 — οι έξι που έχαναν το ιστορικό τους γράφουν πλέον (ονομαστικά)', () => {
    // Ονομαστικά, ΟΧΙ με πλήθος: το πλήθος είναι τυφλό στην ανταλλαγή — μια
    // μελλοντική αφαίρεση με ταυτόχρονη προσθήκη θα έμενε πράσινη (μάθημα 3.71 Π4).
    for (const type of [
      'railing', 'floorplan-symbol', 'mep-radiator',
      'mep-boiler', 'mep-water-heater', 'mep-underfloor',
    ]) {
      expect(VALID_ENTITY_TYPES.has(type)).toBe(true);
      expect(ENTITY_COLLECTION_MAP[type]).toBeTruthy();
    }
  });
});

describe('ADR-852 §4.9 — οι προβολές συμφωνούν με το μητρώο, εξ ορισμού', () => {
  it('Μ4 — το `VALID_ENTITY_TYPES` είναι ΑΚΡΙΒΩΣ τα κλειδιά του χάρτη (SSoT)', () => {
    expect([...VALID_ENTITY_TYPES].sort()).toEqual(Object.keys(ENTITY_COLLECTION_MAP).sort());
  });

  it('Μ5 — κάθε τιμή του χάρτη είναι υπαρκτό collection name (κανένα typo/undefined)', () => {
    const valid = new Set(Object.values(COLLECTIONS));
    for (const [type, collection] of Object.entries(ENTITY_COLLECTION_MAP)) {
      expect(typeof collection).toBe('string');
      expect(`${type}: ${valid.has(collection as string)}`).toBe(`${type}: true`);
    }
  });

  it('Μ6 — τα δύο ΕΞΑΝΤΛΗΤΙΚΑ παράγωγα καλύπτουν ΚΑΘΕ μέλος του μητρώου', () => {
    // Εδώ ήταν η απόκλιση των δύο μηνών: 37 κλειδιά για 40 μέλη, σε τύπο που
    // δηλώνεται εξαντλητικός. Πλέον είναι αδύνατο — αλλά η άγκυρα το ΕΚΤΕΛΕΙ.
    const members = Object.keys(AUDIT_ENTITIES).sort();
    expect(Object.keys(RENAME_PROPAGATION_MAP).sort()).toEqual(members);
    expect(Object.keys(BACKUP_COLLECTION_KEY_MAP).sort()).toEqual(members);
  });

  it('Μ7 — το `bim_family_type` είναι η ΜΟΝΗ subcollection, και υπάρχει στον χάρτη', () => {
    expect([...SUBCOLLECTION_ENTITY_TYPES]).toEqual(['bim_family_type']);
    for (const t of SUBCOLLECTION_ENTITY_TYPES) expect(VALID_ENTITY_TYPES.has(t)).toBe(true);
  });

  it('Μ8 — οντότητα ΧΩΡΙΣ δικό της έγγραφο δεν είναι «έγκυρη» (τηλεμετρία 3D)', () => {
    // Δηλωμένη συμπεριφορά, όχι παράλειψη: δεν υπάρχει έγγραφο του οποίου να
    // επαληθευτεί η κατοχή, άρα ο route ΟΦΕΙΛΕΙ να τις απορρίπτει.
    for (const t of ['performance_diagnostic', 'bim_dimension_3d']) {
      expect(VALID_ENTITY_TYPES.has(t)).toBe(false);
      expect(AUDIT_ENTITIES[t as keyof typeof AUDIT_ENTITIES].writer).toBe('none');
    }
  });
});
