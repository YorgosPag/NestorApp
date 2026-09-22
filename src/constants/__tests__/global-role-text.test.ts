/**
 * @jest-environment node
 *
 * @fileoverview **ΕΝΑ ΟΝΟΜΑ ΑΝΑ ΡΟΛΟ, ΣΕ ΟΛΟ ΤΟ ΔΕΝΤΡΟ** — ADR-853 §17 (Ε-Β).
 * @related constants/global-role-text.ts · components/workspace-invite/workspace-invite-labels.ts
 *
 * 🔴 **Το εύρημα (ζωντανά, 2026-09-22)**: ο ίδιος ρόλος λεγόταν «Εσωτερικός» στη διαχείριση,
 * «Εσωτερικός συνεργάτης» στη σελίδα πρόσκλησης και «Εσωτερικός χρήστης» στο email — και τα
 * τρία «σωστά», γιατί κανείς δεν ρωτούσε το ίδιο ερώτημα δύο φορές.
 *
 *   Λ1  Κάθε ρόλος έχει λέξη, σε **κάθε** γλώσσα *(τα JSON δεν έχουν τύπο)*
 *   Λ2  Η οθόνη και το εκτός-React ζητούν **το ίδιο** κλειδί
 *   Λ3  🔴 **ΚΑΝΕΝΑ άλλο locale αρχείο δεν απαριθμεί ρόλους** — ο φρουρός του τέταρτου αντιγράφου
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import elCommon from '@/i18n/locales/el/common.json';
import { GLOBAL_ROLES } from '@/lib/auth/types';
import { INVITED_ROLE_KEY } from '@/components/workspace-invite/workspace-invite-labels';

import {
  GLOBAL_ROLE_KEY_PREFIX,
  everyGlobalRoleHasName,
  globalRoleName,
} from '../global-role-text';

describe('Λ — ο ΕΝΑΣ κατάλογος ονομάτων ρόλου', () => {
  it('Λ1 — κάθε ρόλος έχει λέξη σε κάθε γλώσσα (και καμία δεν είναι κενή)', () => {
    expect(everyGlobalRoleHasName()).toBe(true);
    for (const role of GLOBAL_ROLES) {
      expect(globalRoleName('el', role)).not.toBeNull();
      expect(globalRoleName('en', role)).not.toBeNull();
    }
  });

  it('Λ2 — η οθόνη της πρόσκλησης ζητά ΤΟ ΙΔΙΟ κλειδί που σερβίρει το εκτός-React', () => {
    for (const [role, key] of Object.entries(INVITED_ROLE_KEY)) {
      expect(key).toBe(`${GLOBAL_ROLE_KEY_PREFIX}${role}`);
      // Και το κλειδί **λύνεται**: ένα ορφανό κλειδί θα έβαφε ωμό `internal_user`.
      const leaf = key.slice(GLOBAL_ROLE_KEY_PREFIX.length) as keyof typeof elCommon.globalRoles;
      expect(typeof elCommon.globalRoles[leaf]).toBe('string');
    }
  });

  /**
   * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΠΡΩΤΑ**: αν ο σαρωτής δεν άνοιγε αρχεία, το «κανένα αντίγραφο» θα
   * ήταν πράσινο επειδή **κανείς δεν κοίταξε** — το σχήμα που αυτό το repo έχει μετρήσει
   * τέσσερις φορές (N.11 · N.12 · N.18 · CHECK 3.18).
   */
  it('Λ3 🔴 κανένα ΑΛΛΟ locale αρχείο δεν απαριθμεί ονόματα ρόλων', () => {
    const roots = ['el', 'en'].map((lang) => path.join(process.cwd(), 'src/i18n/locales', lang));
    const offenders: string[] = [];
    let scanned = 0;

    for (const root of roots) {
      for (const file of readdirSync(root).filter((name) => name.endsWith('.json'))) {
        scanned += 1;
        if (file === 'common.json') continue;
        const text = readFileSync(path.join(root, file), 'utf8');
        // «Απαρίθμηση ρόλων» = **δύο ή περισσότερα** role ids ως κλειδιά στο ίδιο αρχείο.
        // Ένα μόνο του μπορεί να είναι νόμιμο μήνυμα· δύο είναι κατάλογος.
        const declared = GLOBAL_ROLES.filter((role) => text.includes(`"${role}":`));
        if (declared.length >= 2) offenders.push(`${path.basename(root)}/${file}: ${declared.join(', ')}`);
      }
    }

    expect(scanned).toBeGreaterThan(100); // παρονομαστής: ο σαρωτής όντως διάβασε το δέντρο
    expect(offenders).toEqual([]);
  });
});
