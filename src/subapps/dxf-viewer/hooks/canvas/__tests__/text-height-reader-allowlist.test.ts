/**
 * ΠΟΙΟΣ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΡΩΤΑΕΙ ΤΟΝ **ΚΑΘΑΡΟ** ΑΝΑΓΝΩΣΤΗ ΥΨΟΥΣ; (ADR-825 §5.5)
 *
 * Μετά το Στάδιο 1β υπάρχουν **δύο** αναγνώστες ύψους κειμένου, και η επιλογή είναι
 * σημασιολογική, όχι γούστο:
 *
 * | αναγνώστης | απαντά | ποιος τον θέλει |
 * |---|---|---|
 * | `resolveTextHeightLive` | μονάδες κόσμου **στην τρέχουσα Κλίμακα σχεδίου** | ό,τι παράγει ΓΕΩΜΕΤΡΙΑ |
 * | `resolveTextHeight` (καθαρός) | την **αποθηκευμένη** τιμή, ωμή | ό,τι καθρεφτίζει/σειριοποιεί |
 *
 * 🔴 **Γιατί υπάρχει αυτό το αρχείο.** Το Στάδιο 1β άλλαξε πέντε γεωμετρικούς καταναλωτές σε
 * `…Live` (κλικ, όρια broad-phase, αποκοπή, footprint διαστάσεων, 3D glyphs). **Καμία άγκυρα
 * συμπεριφοράς δεν τους φυλάει όλους**: αν αύριο κάποιος γυρίσει έναν πίσω στον καθαρό —ή
 * γράψει **νέο** γεωμετρικό καταναλωτή με τον καθαρό— δεν θα κοκκινίσει τίποτα, και το
 * σύμπτωμα θα είναι το ύπουλο «τα γράμματα μεγάλωσαν αλλά το κλικ ψάχνει αλλού».
 *
 * Ο πίνακας του ADR-825 §5.5 είναι η απόφαση· **αυτό το test την εκτελεί**. Το ίδιο σχήμα με
 * τις πύλες του `CLAUDE.md`: η λίστα δεν είναι σχόλιο, είναι κλειστό σύνολο με λόγο ανά γραμμή.
 *
 * ➜ **Αν κοκκινίσει επειδή πρόσθεσες καταναλωτή**: μη σβήσεις το test. Απάντησε πρώτα
 * «*παράγει αυτό ΓΕΩΜΕΤΡΙΑ ΚΟΣΜΟΥ;*». ΝΑΙ ⇒ χρησιμοποίησε `resolveTextHeightLive`.
 * ΟΧΙ ⇒ πρόσθεσε γραμμή εδώ **με τον λόγο** και στο ADR-825 §5.5.
 *
 * Μεταλλάξεις που το κάνουν κόκκινο:
 *   Μ6 ένας από τους 5 γεωμετρικούς γυρίζει σε `resolveTextHeight`
 *   Μ7 νέο αρχείο καλεί τον καθαρό χωρίς δηλωμένο λόγο
 */

import { describe, it, expect } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SUBAPP_ROOT = join(__dirname, '..', '..', '..');

/**
 * Ο **ΚΛΕΙΣΤΟΣ** κατάλογος: αρχεία που επιτρέπεται να καλούν τον καθαρό `resolveTextHeight`,
 * με τον λόγο του καθενός. Κατοπτρίζει τον πίνακα του **ADR-825 §5.5** — αλλάζουν μαζί.
 */
const ALLOWED: Readonly<Record<string, string>> = {
  'text-engine/edit/ensure-text-node.ts':
    'ΧΤΙΖΕΙ το AST από τα flat πεδία — καθρεφτίζει αποθηκευμένη τιμή, δεν παράγει γεωμετρία.',
  'text-engine/title-block/reading/scene-title-block-cells.ts':
    'Είναι η ΒΑΣΗ των απόλυτων \\H που εκπέμπει ο serializer — μονάδα σειριοποίησης, όχι κόσμου.',
  'ui/text-toolbar/hooks/useTextToolbarSelectionSync.ts':
    'Δείχνει/επεξεργάζεται τον ΑΠΟΘΗΚΕΥΜΕΝΟ αριθμό· η παρουσίαση ανά βάση είναι Στάδιο 3.',
  'export/core/dxf-ascii-entity-dispatch.ts':
    'ADR-825 §8-1: ο MTEXT writer εκπέμπει ΑΠΟΛΥΤΑ \\H ΚΑΙ group 40 — ψήσιμο μόνο του 40 = '
    + 'διπλή εφαρμογή. Το ψήσιμο γίνεται σε ΟΛΟ το AST, στο Στάδιο 2.',
  'export/core/tek/dxf-to-tek-texts.ts':
    'ADR-825 §8-1: μένει ΜΑΖΙ με τον αδελφό δρόμο DXF — μισή υιοθέτηση = δύο εξαγωγές, '
    + 'δύο μεγέθη (η ασυμμετρία που έκλεισε το ADR-737 §18 #6).',
};

/** Το ίδιο το αρχείο ορισμού — ούτε επιτρέπεται ούτε απαγορεύεται, απλώς δεν είναι καταναλωτής. */
const DEFINITION_FILE = 'hooks/canvas/dxf-text-style-extractor.ts';

/** Καλεί ο πηγαίος κώδικας —**όχι** τα σχόλια— τον καθαρό αναγνώστη; */
function callsPureReader(source: string): boolean {
  const code = source
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      // JSDoc / block-comment συνέχεια και ολόκληρες γραμμές σχολίου: έξω.
      if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return '';
      // Σχόλιο στο τέλος κώδικα: κόψε το.
      const inline = line.indexOf('//');
      return inline >= 0 ? line.slice(0, inline) : line;
    })
    .join('\n');
  // `resolveTextHeightLive(` / `resolveTextHeightIn(` ΔΕΝ ταιριάζουν: το `\b` απαιτεί ότι
  // αμέσως μετά το όνομα ακολουθεί μη-αναγνωριστικό, και εκεί ακολουθεί γράμμα.
  return /\bresolveTextHeight\s*\(/.test(code);
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectSourceFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('ADR-825 §5.5 — ο καθαρός resolveTextHeight είναι ΚΛΕΙΣΤΟ σύνολο, με λόγο ανά γραμμή', () => {
  const callers = collectSourceFiles(SUBAPP_ROOT)
    .filter((f) => callsPureReader(readFileSync(f, 'utf8')))
    .map((f) => relative(SUBAPP_ROOT, f).split(sep).join('/'))
    .filter((f) => f !== DEFINITION_FILE)
    .sort();

  it('η σάρωση ΟΝΤΩΣ βλέπει κώδικα (αλλιώς το πράσινο σημαίνει «κανείς δεν κοίταξε»)', () => {
    // Χωρίς αυτό, ένα χαλασμένο regex ή λάθος ρίζα θα έδινε κενό σύνολο — και κενό ⊆ allowlist
    // περνά αθόρυβα. Το ίδιο μάθημα με τα «0 παραβιάσεις» του N.11/N.12: μέτρα το ΟΡΓΑΝΟ.
    expect(collectSourceFiles(SUBAPP_ROOT).length).toBeGreaterThan(1000);
    expect(callers.length).toBeGreaterThan(0);
    // Και ότι ΔΕΝ μπερδεύει τους δύο αναγνώστες μεταξύ τους:
    expect(callsPureReader('const h = resolveTextHeightLive(e);')).toBe(false);
    expect(callsPureReader('const h = resolveTextHeightIn(e, ctx);')).toBe(false);
    expect(callsPureReader('const h = resolveTextHeight(e);')).toBe(true);
    expect(callsPureReader('// mirror resolveTextHeight()')).toBe(false);
    expect(callsPureReader(' * βλ. resolveTextHeight(entity)')).toBe(false);
  });

  it('Μ6/Μ7: κανένας καταναλωτής εκτός του δηλωμένου καταλόγου', () => {
    expect(callers).toEqual(Object.keys(ALLOWED).sort());
  });

  it('οι πέντε ΓΕΩΜΕΤΡΙΚΟΙ δρόμοι ρωτούν τη ζωντανή κλίμακα — ονομαστικά', () => {
    // Ονομαστικά και όχι «απουσία από τη λίστα»: αν κάποιος σβήσει την κλήση εντελώς (π.χ.
    // επιστρέψει σε inline `height ?? 2.5`), η απουσία θα φαινόταν σωστή. Εδώ ζητείται ΠΑΡΟΥΣΙΑ.
    const geometric = [
      'hooks/canvas/canvas-click-entity-hit.ts',
      'rendering/hitTesting/bounds-primitives.ts',
      'services/clip/clip-entity.ts',
      'bim/framing/entity-footprint-for-dims.ts',
      'bim-3d/converters/glyph-atlas-text-layout.ts',
      'bim/text/project-scene-text.ts',
    ];
    for (const rel of geometric) {
      const source = readFileSync(join(SUBAPP_ROOT, rel), 'utf8');
      expect([rel, /\bresolveTextHeightLive\s*\(/.test(source)]).toEqual([rel, true]);
      expect([rel, callsPureReader(source)]).toEqual([rel, false]);
    }
  });
});
