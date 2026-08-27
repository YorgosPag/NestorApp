/**
 * =============================================================================
 * ⚓ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ «0» — η λίστα ονομάτων δρώντα ΔΕΝ παλιώνει σιωπηλά
 * =============================================================================
 *
 * 🔴 **ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΦΥΛΑΕΙ** (ADR-822 §2.6): κάποιος ρώτησε
 * `entity_audit_trail where userId == 'dev-admin'` και πήρε **0**. Το πεδίο
 * λέγεται **`performedBy`**. Το «0» σήμαινε *«ρώτησα λάθος»* — και διαβάστηκε
 * ως *«καθαρό»*. Τέταρτη εμφάνιση του σχήματος N.11 / N.12 / N.18 / CHECK 3.18.
 *
 * ⚠️ Μια **δηλωμένη** λίστα λύνει το πρόβλημα **σήμερα** και το ξαναγεννά αύριο:
 * νέο πεδίο δρώντα στο δέντρο ⇒ το εργαλείο δεν το ρωτά ⇒ **σιωπηλό `0`**. Γι'
 * αυτό η άγκυρα **ξανασαρώνει τους τύπους** και απαιτεί η λίστα να είναι
 * **υπερσύνολο** όσων υπάρχουν. *Η λίστα δηλώνεται· η πληρότητά της μετριέται.*
 *
 * @see ADR-822 §2.6 · §4.3
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from '@jest/globals';

import { ACTOR_FIELD_NAMES } from '../lib/identity-provenance/actor-fields';

/** Τα δέντρα όπου ζουν οι δηλώσεις τύπων του τομέα. */
const SCANNED_TREES = ['src/types', 'src/services', 'src/lib'] as const;

/**
 * Το σχήμα μιας δήλωσης πεδίου που **μπορεί να κρατά uid δρώντα**:
 * `<όνομα>?: string | null | undefined` — και **τίποτα άλλο** στη δεξιά πλευρά.
 *
 * 🔴 **ΓΙΑΤΙ Ο ΤΥΠΟΣ ΚΑΙ ΟΧΙ ΤΟ ΟΝΟΜΑ — ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΣΗ (2026-08-27)**: η
 * πρώτη γραφή αυτής της άγκυρας δεχόταν κάθε κατάληξη `…By`. Το δέντρο
 * απάντησε με **59** ακόμη ονόματα, και μέσα τους `areaOverBy`, `priceUnderBy`,
 * `worseBy`, `betterBy` — όπου το «by» σημαίνει **«κατά πόσο»**, όχι **«από
 * ποιον»** — μαζί με `orderBy: jest.fn()` και `keyBy: 'id'`, που δεν είναι καν
 * δηλώσεις τύπου αλλά **τιμές αντικειμένων**. *Η κατάληξη `…By` είναι
 * διφορούμενη σε αυτό το δέντρο· ο τύπος `string` δεν είναι.*
 *
 * ⚠️ **ΚΑΙ ΜΕΝΕΙ ΣΚΟΠΙΜΑ ΥΠΕΡ-ΣΥΜΠΕΡΙΛΗΠΤΙΚΟΣ.** Ένα όνομα παραπάνω στη λίστα
 * κοστίζει **μηδέν**: το `fieldsPresentIn()` του εργαλείου κλαδεύει στον χρόνο
 * εκτέλεσης, ρωτώντας μόνο πεδία που **υπάρχουν πράγματι** στα δείγματα της
 * συλλογής. Ένα όνομα που **λείπει** κοστίζει ένα σιωπηλό «0». **Η ασυμμετρία
 * του κόστους ορίζει την κατεύθυνση του σφάλματος** — προς τα πάνω.
 */
const ACTOR_DECLARATION =
  /^\s+(?<name>_?[a-z][A-Za-z0-9]*)\s*\??\s*:\s*(?<type>(?:string|null|undefined)(?:\s*\|\s*(?:string|null|undefined))*)\s*;/gm;

/**
 * Ονόματα που **σημαίνουν δρώντα** — το κριτήριο, γραμμένο μία φορά.
 *
 * Η κατάληξη `…By` *(σε πεδίο τύπου `string`)* ή ρητή ονομασία δρώντα.
 */
function looksLikeActorField(name: string): boolean {
  const bare = name.replace(/^_/, '');
  return /By$/.test(bare) || /^(userId|actorId|uid|assignedTo|senderId|authorId)$/.test(bare);
}

function listTypeScriptFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      out.push(...listTypeScriptFiles(full));
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Κάθε όνομα πεδίου δρώντα που **δηλώνεται σήμερα** στους τύπους. */
function actorFieldsInTree(): Set<string> {
  const found = new Set<string>();
  for (const tree of SCANNED_TREES) {
    for (const file of listTypeScriptFiles(join(process.cwd(), tree))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(ACTOR_DECLARATION)) {
        const name = match.groups?.name;
        if (name && looksLikeActorField(name)) found.add(name);
      }
    }
  }
  return found;
}

describe('ΑΦ — ο παρονομαστής του «0» είναι πλήρης', () => {
  it('ΑΦ0 — ο παρονομαστής του ίδιου του σαρωτή: ΒΡΙΣΚΕΙ ονόματα', () => {
    // ⚠️ Χωρίς αυτό, ένας σαρωτής που δεν ταιριάζει ΤΙΠΟΤΑ θα έκανε το ΑΦ1
    //    μονίμως πράσινο. Ένα «0 ευρήματα» στον έλεγχο πληρότητας είναι
    //    ακριβώς το σφάλμα που ο έλεγχος υπάρχει για να πιάσει.
    const scanned = actorFieldsInTree();
    expect(scanned.size).toBeGreaterThanOrEqual(10);
    expect(scanned).toContain('performedBy');
  });

  it('ΑΦ1 — κάθε όνομα δρώντα του δέντρου ΕΙΝΑΙ στη λίστα που ρωτά το εργαλείο', () => {
    const missing = [...actorFieldsInTree()].filter((n) => !ACTOR_FIELD_NAMES.includes(n)).sort();
    // 🔑 Αν κοκκινίσει: πρόσθεσε τα ονόματα στο `actor-fields.ts`. ΜΗΝ χαλαρώσεις
    //    τον σαρωτή — κάθε όνομα που λείπει είναι μια συλλογή που το εργαλείο
    //    δεν ρωτά, δηλαδή ένα «0» που σημαίνει «δεν κοίταξα».
    expect(missing).toEqual([]);
  });

  it('ΑΦ2 — η λίστα είναι ταξινομημένη και χωρίς διπλότυπα', () => {
    // Δύο άνθρωποι δεν πρέπει να μπορούν να προσθέσουν το ίδιο όνομα δύο φορές.
    expect([...ACTOR_FIELD_NAMES]).toEqual([...new Set(ACTOR_FIELD_NAMES)]);
    expect([...ACTOR_FIELD_NAMES]).toEqual([...ACTOR_FIELD_NAMES].sort());
  });

  it('ΑΦ3 — περιέχει το όνομα που ΞΕΓΕΛΑΣΕ το handoff', () => {
    // Η συγκεκριμένη αστοχία, καρφωμένη: `entity_audit_trail.performedBy`,
    // που ρωτήθηκε ως `userId` και απάντησε «0».
    expect(ACTOR_FIELD_NAMES).toContain('performedBy');
    expect(ACTOR_FIELD_NAMES).toContain('userId');
  });
});
