/**
 * @fileoverview Λ1 — ανάγνωση MTEXT πινακίδας πάνω στο ΠΡΑΓΜΑΤΙΚΟ αρχείο του τοπογράφου.
 *
 * Κάθε ισχυρισμός εδώ αντιστοιχεί σε μέτρηση του ADR-745, όχι σε υπόθεση. Το fixture
 * παράγεται από το `G753_ergasia F.dxf` — δες `fixtures/g753-titleblock.fixture.ts`.
 */

import { mtextToSegments, mtextToPlainText, isSameHeight } from '../mtext-segments';
import { G753_TITLEBLOCK_ROWS } from './fixtures/g753-titleblock.fixture';

/** Η μία γραμμή του fixture που περιέχει το δοσμένο κείμενο στο ωμό της περιεχόμενο. */
const rowContaining = (needle: string) => {
  const hits = G753_TITLEBLOCK_ROWS.filter(r => r.raw.includes(needle));
  if (hits.length === 0) throw new Error(`Το fixture δεν περιέχει «${needle}»`);
  return hits[0];
};

describe('Λ1 — πραγματική πινακίδα G753', () => {
  it('το fixture έχει τις 19 μετρημένες οντότητες', () => {
    expect(G753_TITLEBLOCK_ROWS).toHaveLength(19);
  });

  // ── ADR-745 §2.3 Παγίδα Α ────────────────────────────────────────────────
  describe('κατακερματισμός σε format runs — η σιωπηλή απώλεια', () => {
    it('ανασυνθέτει το «Π.Ε. 39», που το αρχείο σπάει σε «Π.Ε. 3» + «9»', () => {
      const row = rowContaining('ΠΕΡΙΟΧΗ ΕΠΕΚΤΑΣΗΣ');

      // Η απόδειξη ότι η παγίδα υπάρχει: το ωμό κείμενο ΔΕΝ περιέχει το ζητούμενο.
      expect(row.raw).not.toContain('Π.Ε. 39');
      expect(row.raw).toContain('Π.Ε. 3');

      expect(mtextToPlainText(row.raw)).toContain('Π.Ε. 39');
    });

    it('ανασυνθέτει το «Ο.Τ. Γ 753», σπασμένο σε «Ο.Τ. Γ» + « 753»', () => {
      expect(mtextToPlainText(rowContaining('ΠΕΡΙΟΧΗ ΕΠΕΚΤΑΣΗΣ').raw)).toContain('Ο.Τ. Γ 753');
    });

    it('ανασυνθέτει την ΚΛΙΜΑΚΑ «1:200», σπασμένη σε «1» + «:2» + «00»', () => {
      const row = rowContaining('Courier') ?? rowContaining(':2');
      const scale = G753_TITLEBLOCK_ROWS.find(r => /\|p18;1\\/.test(r.raw) || r.raw.includes(':2'));
      expect(scale).toBeDefined();
      expect(scale!.raw).not.toContain('1:200');
      expect(mtextToPlainText(scale!.raw)).toBe('1:200');
      void row;
    });

    it('ανασυνθέτει το κινητό, σπασμένο σε «694» + «9727121»', () => {
      expect(mtextToPlainText(rowContaining('ΝΕΟΧΩΡΟΥΔΑ').raw)).toContain('6949727121');
    });

    it('σε πολύγραμμο κελί οι ΓΡΑΜΜΕΣ χωρίζονται, τα ΚΟΜΜΑΤΙΑ γραμμής ενώνονται', () => {
      // Δύο διαφορετικές ενώσεις, εύκολο να συγχυστούν: τα format runs μέσα σε μια
      // γραμμή κολλάνε χωρίς κενό («Π.Ε. 3»+«9»), ενώ οι γραμμές χωρίζονται με κενό.
      // Χωρίς αυτόν τον ισχυρισμό ο διαχωριστής γραμμών ήταν αόρατος (μετάλλαξη που επέζησε).
      const text = mtextToPlainText(rowContaining('ΜΑΥΡΟΜΙΧΑΛΗΣ').raw);
      expect(text).toContain('ΚΩΝ/ΝΟΣ ΑΓΡΟΝΟΜΟΣ');   // όριο γραμμής → κενό
      expect(text).not.toContain('ΚΩΝ/ΝΟΣΑΓΡΟΝΟΜΟΣ');
      expect(text).toContain('6949727121');            // εντός γραμμής → χωρίς κενό
      expect(text).not.toContain('694 9727121');
    });
  });

  // ── ADR-745 §2.2β ─────────────────────────────────────────────────────────
  describe('τυπογραφική ιεραρχία — ποιο είναι όνομα και ποιο ιδιότητα', () => {
    const meletitis = () => mtextToSegments(rowContaining('ΜΑΥΡΟΜΙΧΑΛΗΣ').raw);

    it('σπάει το κελί ΜΕΛΕΤΗΤΗΣ στις 7 γραμμές του', () => {
      expect(meletitis().map(s => s.text.trim())).toEqual([
        'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ',
        'ΑΓΡΟΝΟΜΟΣ ΤΟΠΟΓΡΑΦΟΣ ΜΗΧΑΝΙΚΟΣ Α.Π.Θ.',
        'ΝΙΚΟΛΑΟΥ  ΕΥ. ΙΩΑΝΝΗΣ',
        'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Τ.Ε.',
        'ΤΟΠΟΓΡΑΦΙΚΕΣ ΜΕΛΕΤΕΣ - ΕΦΑΡΜΟΓΕΣ',
        'ΕΔΡΑ ΝΕΟΧΩΡΟΥΔΑ 2310-788493 κιν 6949727121',
        'site: www.nikolaou.com.gr  e-mail: info@nikolaou.com.gr',
      ]);
    });

    it('🔴 τα σχετικά \\H είναι ΣΩΡΕΥΤΙΚΑ — οι δύο μηχανικοί βγαίνουν ΙΣΟΫΨΕΙΣ', () => {
      const [name1, spec1, name2, spec2] = meletitis();

      // Αν το \H1.875x; διαβαζόταν ως απόλυτο, ο δεύτερος θα ήταν 1,875 — σχεδόν
      // διπλάσιος από τον πρώτο — που είναι ορατά ψευδές στην πινακίδα.
      expect(isSameHeight(name1.heightFactor, name2.heightFactor)).toBe(true);
      expect(name2.heightFactor).toBeCloseTo(1, 2);
      expect(name2.heightFactor).not.toBeCloseTo(1.875, 2);

      expect(isSameHeight(spec1.heightFactor, spec2.heightFactor)).toBe(true);
      expect(spec1.heightFactor).toBeCloseTo(0.5334, 3);
    });

    it('η ειδικότητα είναι πάντα χαμηλότερη από το όνομα που τη συνοδεύει', () => {
      const [name1, spec1, name2, spec2] = meletitis();
      expect(spec1.heightFactor).toBeLessThan(name1.heightFactor);
      expect(spec2.heightFactor).toBeLessThan(name2.heightFactor);
    });

    it('τα στοιχεία του γραφείου είναι χαμηλότερα και από τις ειδικότητες', () => {
      const segs = meletitis();
      const officeLines = segs.slice(4);
      const specialty = segs[1].heightFactor;
      officeLines.forEach(l => expect(l.heightFactor).toBeLessThan(specialty));
    });

    it('ένα \\H στη ΜΕΣΗ γραμμής δεν αλλάζει τον χαρακτηρισμό της', () => {
      // Η τελευταία γραμμή του πραγματικού κελιού έχει `\H0.99999x;` πριν το e-mail.
      const last = meletitis()[6];
      expect(last.text).toContain('site:');
      expect(last.text).toContain('e-mail:');
      expect(last.heightFactor).toBeCloseTo(meletitis()[5].heightFactor, 4);
    });

    it('…και αυτό ΔΕΝ το αποδεικνύει το πραγματικό αρχείο — χρειάζεται ρητό δείγμα', () => {
      // Το μεσο-γραμμικό \H του G753 είναι 0,99999 — πρακτικά no-op, οπότε ο ισχυρισμός
      // από πάνω περνά ακόμη και με «τελευταίο \H νικά». Μια μετάλλαξη το απέδειξε.
      // Ο κανόνας «μία γραμμή, μία σημασία» είναι σχεδιαστική απόφαση και θέλει δικό της δείγμα.
      const [line] = mtextToSegments('ΟΝΟΜΑ\\H0.25x;μικρο-ουρα');
      expect(line.text).toBe('ΟΝΟΜΑμικρο-ουρα');
      expect(line.heightFactor).toBe(1);      // το ύψος της ΑΡΧΗΣ της γραμμής
      expect(line.heightFactor).not.toBe(0.25); // όχι το τελευταίο που συναντήθηκε
    });

    it('…αλλά ένα \\H ΠΡΙΝ το κείμενο της γραμμής μετράει κανονικά', () => {
      const segs = mtextToSegments('ΠΡΩΤΗ\\P\\H0.5x;ΔΕΥΤΕΡΗ');
      expect(segs.map(s => s.heightFactor)).toEqual([1, 0.5]);
    });
  });

  // ── ADR-745 §2.3 — νέο εύρημα ─────────────────────────────────────────────
  describe('ομόγλυφα', () => {
    it('το «ΣΥΝΤΑΞΗ» της πινακίδας τελειώνει σε ΛΑΤΙΝΙΚΟ H', () => {
      const text = mtextToPlainText(rowContaining('ΣΥΝΤΑΞ').raw);
      expect(text).toBe('ΣΥΝΤΑΞ' + String.fromCodePoint(0x0048));
      expect(text).not.toBe('ΣΥΝΤΑΞΗ');
      expect(text.codePointAt(6)).toBe(0x0048); // Latin H, όχι 0x0397
    });
  });

  // ── ADR-745 §2.2α — διόρθωση της μέτρησης ─────────────────────────────────
  describe('χωρική στοίχιση', () => {
    it('🔴 στοιχίζονται 7 από τις 19 — είναι ιδιότητα της ΑΡΙΣΤΕΡΗΣ ΣΤΗΛΗΣ, όχι της πινακίδας', () => {
      const byX = new Map<string, number>();
      G753_TITLEBLOCK_ROWS.forEach(r => {
        const k = r.x.toFixed(3);
        byX.set(k, (byX.get(k) ?? 0) + 1);
      });
      expect(byX.get('408012.762')).toBe(7);
      expect(G753_TITLEBLOCK_ROWS).not.toHaveLength(7); // …οι υπόλοιπες 12 ζουν αλλού
    });

    it('🔴 οι πινακίδες είναι ΔΥΟ — 17 οντότητες αριστερά, 2 στο x≈408069,7', () => {
      const right = G753_TITLEBLOCK_ROWS.filter(r => r.x > 408060);
      expect(right).toHaveLength(2);
      expect(G753_TITLEBLOCK_ROWS.filter(r => r.x <= 408060)).toHaveLength(17);
      // Το δεξί μπλοκ έχει το δικό του ΕΡΓΟΔΟΤΗΣ — δεν είναι τιμή του αριστερού.
      expect(right.some(r => r.raw.includes('ΕΡΓΟΔΟΤΗΣ'))).toBe(true);
    });
  });

  // ── §2.2α — τα δύο σχήματα ζεύγους ────────────────────────────────────────
  describe('δύο σχήματα ζεύγους ετικέτα→τιμή', () => {
    it('INLINE: το ΕΡΓΟΔΟΤΗΣ φέρει την τιμή του στο ΙΔΙΟ MTEXT', () => {
      const row = G753_TITLEBLOCK_ROWS.find(r => r.raw.includes('ΖΕΡΒΑ'))!;
      expect(mtextToPlainText(row.raw)).toBe('ΕΡΓΟΔΟΤΗΣ: ΖΕΡΒΑ ΓΕΩΡΓΙΑ');
    });

    it('ΧΩΡΙΣΤΟ: το ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ έχει την τιμή του σε ΑΛΛΟ MTEXT δεξιά, ίδιο y', () => {
      const label = G753_TITLEBLOCK_ROWS.find(r => r.raw.includes('ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ'))!;
      const value = G753_TITLEBLOCK_ROWS.find(r => r.raw.includes('ΙΟΥΛΙΟΣ'))!;
      expect(mtextToPlainText(label.raw)).toBe('ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ');
      expect(mtextToPlainText(value.raw)).toBe('ΙΟΥΛΙΟΣ 2026');
      expect(value.y).toBeCloseTo(label.y, 3); // ταυτόσημο y
      expect(value.x).toBeGreaterThan(label.x); // η τιμή δεξιά
    });
  });

  describe('κενά κελιά', () => {
    it('το «ΕΡΓΟ:» είναι κενό — και στις δύο πινακίδες', () => {
      const erga = G753_TITLEBLOCK_ROWS.filter(r => /ΕΡΓΟ\\H|ΕΡΓΟ\b/.test(r.raw) && !r.raw.includes('ΕΡΓΟΔΟΤΗΣ'));
      expect(erga).toHaveLength(2);
      erga.forEach(r => expect(mtextToPlainText(r.raw)).toBe('ΕΡΓΟ:'));
    });
  });

  describe('καμία απώλεια', () => {
    it('κάθε γραμμή του fixture δίνει μη κενό απλό κείμενο', () => {
      G753_TITLEBLOCK_ROWS.forEach(r => {
        expect(mtextToPlainText(r.raw).length).toBeGreaterThan(0);
      });
    });

    it('κανένας κωδικός μορφοποίησης δεν διαρρέει στην έξοδο', () => {
      G753_TITLEBLOCK_ROWS.forEach(r => {
        const out = mtextToPlainText(r.raw);
        expect(out).not.toMatch(/\\[fFHCcLlOoKkPNSAp]/);
        expect(out).not.toMatch(/Times New Roman|Arial|Courier/);
        expect(out).not.toMatch(/[{}]/);
      });
    });
  });
});
