/**
 * =============================================================================
 * 🔴 Η ΑΓΚΥΡΑ ΤΟΥ ΚΡΙΤΗ ΔΙΑΔΡΟΜΗΣ (ADR-862 Φ0 Β8)
 * =============================================================================
 *
 * **Το ερώτημα της σουίτας**: *«Λέει ο κριτής για **κάθε** ρίζα του bucket ό,τι
 * λένε οι **κανόνες**, και σιωπά για καμία;»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΟΜΑΔΑ `Κ1` ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ένας πίνακας ριζών γραμμένος με το χέρι **παλιώνει σιωπηλά** — είναι το σχήμα
 * που αυτό το δέντρο έχει μετρήσει δεκάδες φορές (`rulesRange`: **11 στα 11**
 * ξεκάρφωτα· ο δείκτης ADR του `CLAUDE.md`: **τέσσερις** φορές μπαγιάτικος).
 *
 * ⇒ Η `Κ1` **δεν εμπιστεύεται τον πίνακα**: ανοίγει το **ίδιο το `storage.rules`**,
 * βγάζει τη ρίζα κάθε `match` μπλοκ, και απαιτεί γραμμή στον κριτή. Νέο δέντρο
 * στους κανόνες χωρίς γραμμή εδώ ⇒ **κόκκινο στο `git add`**, όχι διαρροή στην
 * παραγωγή.
 *
 * ⚠️ **ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΚΟΚΚΙΝΙΣΕΙ**: σβήσε **μία** γραμμή από τον
 * `STORAGE_ROOT_CUSTODY` (π.χ. `owner_properties`) ⇒ η `Κ1` πέφτει, **και το λέει
 * ονομαστικά**. Αν αντ' αυτού έπεφτε μόνο κάποια συμπεριφορική άγκυρα, θα
 * μαθαίναμε ότι «κάτι» χάλασε, όχι **ποια ρίζα** έμεινε αφύλακτη.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 📐 ΒΑΘΜΟΝΟΜΗΣΗ — ΜΕΤΡΗΜΕΝΑ 2026-09-16, ΠΡΙΝ ΓΡΑΦΤΕΙ Ο ΚΡΙΤΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * | μέτρηση | τιμή |
 * |---|---|
 * | inner `match` μπλοκ στο `storage.rules` | **22** |
 * | ρίζες πρώτου επιπέδου που προκύπτουν | **11** |
 * | ρίζες **στο ζωντανό bucket** | **6** *(`asset-packs` · `bim-mesh-library` · `bim-texture-library` · `companies` · `owner_properties` · `temp`)* |
 * | παιδιά του `companies/{id}/` στο ζωντανό bucket | **2** — `entities/` **και** `dxf-external-references/` |
 *
 * 🔴 Η τελευταία γραμμή είναι ο λόγος που ο κριτής **δεν** χτίστηκε πάνω στο
 * `parseStoragePath`: εκείνο γυρίζει `null` για το `dxf-external-references/`,
 * δηλαδή θα έλεγε «ξένο» για αρχείο που **υπάρχει τώρα** στην παραγωγή.
 *
 * @see lib/storage/storage-path-custody — ο κριτής
 * @see storage.rules — η αυθεντία των ριζών
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  isStorageCustodyServable,
  judgeStorageCustody,
  storagePathCustody,
  STORAGE_ROOT_CUSTODY_TABLE,
  type StorageCustodyCaller,
} from '../storage-path-custody';

// =============================================================================
// ΤΟ ΕΛΑΧΙΣΤΟ ΣΥΜΠΑΝ
// =============================================================================

const COMPANY = 'comp_alpha';
const OTHER_COMPANY = 'comp_beta';
const UID = 'uid_reader';
const OTHER_UID = 'uid_stranger';

const caller: StorageCustodyCaller = { uid: UID, companyId: COMPANY };

/**
 * Οι ρίζες **όπως τις δηλώνει το ίδιο το `storage.rules`**.
 *
 * ⚠️ Πιάνει **μόνο** τα εσωτερικά μπλοκ: το εξωτερικό `match /b/{bucket}/o` είναι
 * ο περιέκτης του bucket, όχι ρίζα περιεχομένου. Χωρίς αυτό το φίλτρο η άγκυρα θα
 * απαιτούσε γραμμή για το `b`, δηλαδή θα κοκκίνιζε πάνω στη **θεραπεία**.
 */
function declaredRootsInRules(): string[] {
  const source = readFileSync(join(process.cwd(), 'storage.rules'), 'utf8');
  const roots = new Set<string>();

  for (const line of source.split('\n')) {
    const match = /^\s*match\s+\/([^/{\s]+)\//.exec(line);
    if (match === null) continue;
    const root = match[1];
    if (root === 'b') continue;
    roots.add(root);
  }

  return [...roots].sort();
}

// =============================================================================
// Κ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΩΝ ΙΔΙΩΝ ΤΩΝ ΑΓΚΥΡΩΝ
// =============================================================================

describe('Κ0 — οι άγκυρες μετρούν κάτι υπαρκτό', () => {
  it('Κ0.1 — το `storage.rules` διαβάζεται και δηλώνει ρίζες', () => {
    // Χωρίς αυτό, μια αποτυχία ανάγνωσης θα άφηνε την Κ1 **κενά αληθή**: κανένα
    // στοιχείο να ελεγχθεί ⇒ πράσινο που σημαίνει «δεν κοίταξα».
    const roots = declaredRootsInRules();

    expect(roots.length).toBeGreaterThanOrEqual(10);
    expect(roots).toContain('companies');
  });

  it('Κ0.2 — ο πίνακας του κριτή δεν είναι κενός', () => {
    expect(Object.keys(STORAGE_ROOT_CUSTODY_TABLE).length).toBeGreaterThanOrEqual(10);
  });
});

// =============================================================================
// Κ1 — ΤΟ ΚΛΕΙΔΙ: Ο ΠΙΝΑΚΑΣ ΕΙΝΑΙ ΚΑΤΟΠΤΡΟ ΤΩΝ ΚΑΝΟΝΩΝ
// =============================================================================

describe('Κ1 — καμία ρίζα των κανόνων χωρίς γραμμή στον κριτή', () => {
  it('🔑 Κ1.1 — ΜΕΤΑΛΛΑΞΗ: σβήσε γραμμή από τον πίνακα ⇒ ΚΟΚΚΙΝΟ, ονομαστικά', () => {
    const declared = declaredRootsInRules();
    const missing = declared.filter(root => !(root in STORAGE_ROOT_CUSTODY_TABLE));

    // ⚠️ Το μήνυμα ονομάζει **ποιες** ρίζες λείπουν: «κάτι χάλασε» δεν είναι
    //    οδηγία, «το `owner_properties` δεν έχει κάτοχο» είναι.
    expect(missing).toEqual([]);
  });

  it('Κ1.2 — καμία ρίζα των κανόνων δεν κρίνεται `undeclared-root`', () => {
    // Η συμπεριφορική όψη της Κ1.1: όχι μόνο «υπάρχει γραμμή», αλλά **ο κριτής
    // την ασκεί**. Ένας πίνακας με γραμμή που ο κριτής δεν διαβάζει είναι ο
    // αδρανής φρουρός του ADR-749 §5.
    for (const root of declaredRootsInRules()) {
      const verdict = judgeStorageCustody(`${root}/${COMPANY}/x.pdf`, caller);
      expect(verdict).not.toBe('undeclared-root');
    }
  });
});

// =============================================================================
// Ρ — ΟΙ ΤΕΣΣΕΡΙΣ ΕΙΔΗ ΘΕΜΑΤΟΦΥΛΑΚΗΣ
// =============================================================================

describe('Ρ — κάθε είδος ρίζας διαβάζεται σωστά', () => {
  it('Ρ1 — εταιρικό: ο μισθωτής είναι το 2ο τμήμα', () => {
    expect(storagePathCustody(`companies/${COMPANY}/entities/contact/c1/x.jpg`)).toEqual({
      kind: 'company',
      root: 'companies',
      companyId: COMPANY,
    });
  });

  it('🔴 Ρ2 — `dxf-external-references`: το σχήμα που το `parseStoragePath` ΔΕΝ βλέπει', () => {
    // 🔑 Μετρημένο στο **ζωντανό** bucket: υπάρχει **τώρα**, δίπλα στο `entities/`.
    //    Μετάλλαξη: χτίσε τον κριτή πάνω στο `parseStoragePath` ⇒ αυτό κοκκινίζει,
    //    και μαζί του κάθε λήψη υποβάθρου DXF στην παραγωγή.
    expect(judgeStorageCustody(`companies/${COMPANY}/dxf-external-references/f1.png`, caller))
      .toBe('own-company');
  });

  it('Ρ3 — προσωπικό: ο μισθωτής είναι ο άνθρωπος, όχι η εταιρεία', () => {
    expect(storagePathCustody(`owner_properties/${UID}/ownp_1/kat.pdf`)).toEqual({
      kind: 'user',
      root: 'owner_properties',
      uid: UID,
    });
  });

  it('Ρ4 — κοινόχρηστος κατάλογος: κανένας μισθωτής', () => {
    expect(storagePathCustody('bim-mesh-library/sanitary/wc_01.glb')).toEqual({
      kind: 'shared',
      root: 'bim-mesh-library',
    });
  });

  it('Ρ5 — `asset-packs`: οι κανόνες λένε `allow read: if false` ⇒ μόνο ο διακομιστής', () => {
    expect(judgeStorageCustody('asset-packs/pack_1/v1/a.glb', caller)).toBe('server-mediated');
  });
});

// =============================================================================
// Ξ — Ο ΞΕΝΟΣ
// =============================================================================

describe('Ξ — ξένος μισθωτής δεν παίρνει bytes', () => {
  it('Ξ1 — ξένη εταιρεία ⇒ foreign-company, ΠΟΤΕ σερβίρεται', () => {
    const verdict = judgeStorageCustody(`companies/${OTHER_COMPANY}/entities/x/y/z.pdf`, caller);

    expect(verdict).toBe('foreign-company');
    expect(isStorageCustodyServable(verdict)).toBe(false);
  });

  it('Ξ2 — ξένος άνθρωπος ⇒ foreign-user, ΠΟΤΕ σερβίρεται', () => {
    // 🔴 Οι κανόνες αποκλείουν εδώ **ακόμη και τον super_admin** («η κάτοψη του
    //    σπιτιού ενός ανθρώπου»). Ο κριτής δεν έχει bypass ρόλο — αν αποκτήσει,
    //    ο proxy θα δίνει ό,τι οι κανόνες αρνούνται.
    const verdict = judgeStorageCustody(`owner_properties/${OTHER_UID}/ownp_9/kat.pdf`, caller);

    expect(verdict).toBe('foreign-user');
    expect(isStorageCustodyServable(verdict)).toBe(false);
  });

  it('🔑 Ξ3 — ΜΕΤΑΛΛΑΞΗ: «ίδια εταιρεία ⇒ και τα προσωπικά δικά μου»', () => {
    // Αν κάποιος «απλοποιήσει» τον κριτή ώστε το `user` να κρίνεται με `companyId`,
    // ο συνάδελφος θα κατεβάζει τις κατόψεις του σπιτιού του διπλανού του.
    expect(judgeStorageCustody(`users/${OTHER_UID}/avatar.png`, caller)).toBe('foreign-user');
  });
});

// =============================================================================
// Α — ΟΙ ΑΠΟΥΣΙΕΣ, FAIL-CLOSED
// =============================================================================

describe('Α — ό,τι δεν δηλώθηκε, δεν σερβίρεται', () => {
  it('Α1 — άγνωστη ρίζα ⇒ undeclared-root (νέο δέντρο δεν γίνεται προσιτό σιωπηλά)', () => {
    const verdict = judgeStorageCustody('kainourio-dentro/comp_alpha/x.pdf', caller);

    expect(verdict).toBe('undeclared-root');
    expect(isStorageCustodyServable(verdict)).toBe(false);
  });

  it('Α2 — ρίζα ΧΩΡΙΣ τμήμα μισθωτή ⇒ unknown, όχι «όλες οι εταιρείες»', () => {
    expect(storagePathCustody('companies/')).toEqual({
      kind: 'unknown',
      root: 'companies',
      why: 'tenant-segment-missing',
    });
  });

  it('Α3 — κενή διαδρομή ⇒ unknown, ποτέ ρίψη', () => {
    expect(storagePathCustody('   ')).toEqual({ kind: 'unknown', root: '', why: 'path-not-a-path' });
  });

  it('Α4 — αρχική κάθετος δεν αλλάζει την απάντηση', () => {
    // Το object name του bucket **δεν** έχει αρχική κάθετο, αλλά τα `match` των
    // κανόνων την έχουν. Ο κριτής δεν πρέπει να διαφωνεί με τον εαυτό του επειδή
    // ο καλών αντέγραψε τη μορφή του κανόνα.
    expect(judgeStorageCustody(`/companies/${COMPANY}/entities/a/b/c.pdf`, caller))
      .toBe('own-company');
  });
});
