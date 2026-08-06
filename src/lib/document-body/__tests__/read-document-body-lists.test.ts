/**
 * @fileoverview 🔴 Οι **λίστες** Α′/Θ/Ι πάνω στο πραγματικό G753 (ADR-759 Φ4β).
 *
 * Κάθε αριθμός εδώ είναι **μετρημένος στο αρχείο** (§2β.7). Αν κάποιος αλλάξει, η σωστή
 * αντίδραση είναι να ανοίξει το σχέδιο — όχι να «διορθωθεί» η προσδοκία.
 *
 * 🔑 Η σουίτα δεν ρωτά «σπας σωστά αυτή τη γραμμή;» αλλά **«ξεχωρίζεις πόσες πράξεις υπάρχουν
 * και ποια ΦΕΚ ανήκουν σε ποια;»** — που είναι το ερώτημα στο οποίο κάθε προφανής υλοποίηση
 * απαντά λάθος: δέκα εμφανίσεις της λέξης «ΦΕΚ» δίνουν **έξι** αναφορές σε **πέντε** πράξεις.
 */

/* global describe, it, expect */
import type {
  DocumentBodyListKey,
  DocumentBodyListRow,
  DocumentBodyPartKey,
  DocumentBodyReading,
} from '@/types/document-body-reading';
import { DOCUMENT_BODY_LIST_KEYS, DOCUMENT_BODY_PART_KEYS } from '@/types/document-body-reading';
import { readDocumentBodies } from '../read-document-body';
import { g753DocumentReadings } from './fixtures/g753-body.fixture';

const form = (): DocumentBodyReading => {
  const found = g753DocumentReadings().find((r) => r.kind === 'private-engineer-survey');
  if (!found) throw new Error('δεν βρέθηκε η φόρμα «ΣΤΟΙΧΕΙΑ ΕΡΕΥΝΑΣ ΙΔΙΩΤΗ ΜΗΧΑΝΙΚΟΥ»');
  return found;
};

const rowsOf = (list: DocumentBodyListKey): readonly DocumentBodyListRow[] =>
  form().rows.filter((row) => row.list === list);

/** Όλες οι τιμές ενός μέρους μιας γραμμής — πίνακας, γιατί το ΦΕΚ επαναλαμβάνεται. */
const partsOf = (row: DocumentBodyListRow, part: DocumentBodyPartKey): readonly string[] =>
  row.parts.filter((p) => p.part === part).map((p) => p.rawValue);

const oneOf = (row: DocumentBodyListRow, part: DocumentBodyPartKey): string | undefined =>
  partsOf(row, part)[0];

// ─────────────────────────────────────────────────────────────────────────────

describe('🔴 Α′ — δέκα εμφανίσεις «ΦΕΚ» δεν είναι δέκα γραμμές', () => {
  it('πέντε θεσμικές πράξεις από έξι γραμμές του σχεδίου', () => {
    const acts = form().rows.filter((r) => r.list !== 'approvals' && r.list !== 'titleDeeds');
    expect(acts).toHaveLength(5);
  });

  it('🔴 έξι αναφορές ΦΕΚ από ΔΕΚΑ εμφανίσεις της λέξης', () => {
    const acts = form().rows.filter((r) => r.list !== 'approvals' && r.list !== 'titleDeeds');
    const gazettes = acts.flatMap((row) => partsOf(row, 'gazette'));
    const spelled = acts.reduce((sum, row) => sum + (row.rawText.match(/ΦΕΚ/g)?.length ?? 0), 0);

    expect(spelled).toBe(10);
    expect(gazettes).toHaveLength(6);
  });

  it('η ταξινόμηση σε ομάδες βγαίνει από ΛΕΞΕΙΣ γραμμένες μέσα στη γραμμή', () => {
    expect(rowsOf('urbanPlanDecree')).toHaveLength(1);
    expect(rowsOf('generalUrbanPlan')).toHaveLength(1);
    // Το υπόλοιπο: «τομείς αρτιοτήτων» + «πολεοδομικές ρυθμίσεις» + ΖΚΣ.
    expect(rowsOf('zoningRegulations')).toHaveLength(3);
  });

  it('το Διάταγμα Ρυμοτομίας: η πράξη αριστερά, το ΦΕΚ της δεξιά', () => {
    const [decree] = rowsOf('urbanPlanDecree');
    expect(oneOf(decree, 'reference')).toBe('Διάταγμα Ρυμοτομίας Π.Δ. 02-09-1992');
    expect(partsOf(decree, 'gazette')).toEqual(['ΦΕΚ 963Δ/25-09-1992']);
  });

  it('🔴 το ΚΟΜΜΑ χωρίζει: το Γ.Π.Σ. φέρει ΔΥΟ ΦΕΚ, όχι ένα', () => {
    const [gps] = rowsOf('generalUrbanPlan');
    expect(oneOf(gps, 'reference')).toBe('Γ.Π.Σ.');
    expect(partsOf(gps, 'gazette')).toEqual([
      'ΦΕΚ 115/Δ/24-02-1999',
      'ΦΕΚ 633Δ/02-08-2001',
    ]);
  });

  it('🔴 η ΛΕΞΗ δένει: η αλυσίδα διόρθωσης μένει ΜΙΑ αναφορά με το κείμενό της ακέραιο', () => {
    // Q3: ο reader **δεν** μοντελοποιεί τη σχέση διόρθωσης — την αφήνει στο `rawText`.
    const chain = rowsOf('zoningRegulations').find((row) =>
      row.rawText.includes('Έγκριση Πολεοδομικών ρυθμίσεων'),
    );
    expect(chain).toBeDefined();
    expect(partsOf(chain!, 'gazette')).toEqual([
      'ΦΕΚ 2Δ/10-01-2005 όπως διορθώθηκε ΦΕΚ 2/τ.Δ/2006 με το ΦΕΚ 49τ.Δ/ 30-01-2006',
    ]);
  });

  it('🔴 Η ΣΤΗΛΗ ΑΠΟΦΑΣΙΖΕΙ: η ανώνυμη γραμμή 06 πάει στην 07, ΟΧΙ στην 05', () => {
    // Ο προφανής κανόνας «γραμμή χωρίς ετικέτα = συνέχεια της προηγούμενης» θα την κολλούσε
    // στην 05 — δηλαδή στη λάθος πράξη. Οι 06/07 έχουν **πέντε** στηλοθέτες, η 05 **δύο**.
    const zoning = rowsOf('zoningRegulations');
    const sectors = zoning.find((row) => row.rawText.includes('τομέων αρτιοτήτων'));
    const chain = zoning.find((row) => row.rawText.includes('Έγκριση Πολεοδομικών'));

    expect(sectors!.rawText).not.toContain('Έγκριση Πολεοδομικών');
    expect(partsOf(sectors!, 'gazette')).toEqual(['ΦΕΚ 1220Δ/30-9-.1993)']);
    // Η αλυσίδα κρατά **και τις δύο** γραμμές της.
    expect(chain!.rawText).toContain('ΦΕΚ 2Δ/10-01-2005');
    expect(chain!.rawText).toContain('ΦΕΚ 49τ.Δ/ 30-01-2006');
  });

  it('🔴 η ΙΔΙΑ αλυσίδα δηλώνεται για ΔΥΟ πράξεις — δεν είναι διπλότυπο', () => {
    // §2β.7 εύρημα 5: μία απόφαση που ισχύει για δύο πράξεις (πολεοδομικές ρυθμίσεις + ΖΚΣ).
    // Η συγχώνευση μαρτύρων της Φ4 θα τις ένωνε **λάθος**.
    const withChain = rowsOf('zoningRegulations').filter((row) =>
      partsOf(row, 'gazette').some((g) => g.includes('49τ.Δ/ 30-01-2006')),
    );
    expect(withChain).toHaveLength(2);
  });

  it('η πράξη που ονομάζεται μόνο στην ΟΥΡΑ της δεν αποκτά ψεύτικη ταυτότητα', () => {
    const chain = rowsOf('zoningRegulations').find((row) =>
      row.rawText.includes('Έγκριση Πολεοδομικών'),
    );
    // Καμία `reference`: οι γραμμές 06-07 δεν έχουν τίποτα πριν το πρώτο ΦΕΚ. Το κενό είναι
    // η αλήθεια — και το `note` κουβαλά το τι είναι.
    expect(partsOf(chain!, 'reference')).toEqual([]);
    expect(oneOf(chain!, 'note')).toBe('Έγκριση Πολεοδομικών ρυθμίσεων');
  });

  it('η ΖΚΣ γράφεται ΚΑΙ ως λογική τιμή ΚΑΙ ως πράξη — ένα κείμενο, δύο κανόνες', () => {
    const zks = rowsOf('zoningRegulations').find((row) => row.rawText.includes('(ΖΚΣ)'));
    expect(oneOf(zks!, 'reference')).toBe('ΕΝΤΟΣ ΖΩΝΗΣ ΚΟΙΝΩΝΙΚΟΥ ΣΥΝΤΕΛΕΣΤΗ (ΖΚΣ)');
    expect(form().fields.some((f) => f.key === 'inSocialFactorZone')).toBe(true);
  });
});

describe('🔴 Θ — το «κενό» είναι ΤΕΛΕΙΕΣ, και δεν γίνεται ποτέ τιμή', () => {
  it('δύο εγκρίσεις', () => {
    expect(rowsOf('approvals')).toHaveLength(2);
  });

  it('🔴 το ΤΙ εγκρίνεται και το ΠΟΙΟΣ εγκρίνει είναι δύο διαφορετικά πράγματα', () => {
    // «ΒΕΒΑΙΩΣΗ ΥΨΟΜΕΤΡΩΝ» **δεν είναι αρχή** — αρχή είναι ο «Δήμος Κορδελιού - Ευόσμου».
    expect(rowsOf('approvals').map((r) => oneOf(r, 'subject'))).toEqual([
      'ΑΡΧΑΙΟΛΟΓΙΑ',
      'ΒΕΒΑΙΩΣΗ ΥΨΟΜΕΤΡΩΝ',
    ]);
    expect(rowsOf('approvals').map((r) => oneOf(r, 'authority'))).toEqual([
      'Εφορεία Αρχαιοτήτων Πόλης Θεσσαλονίκης',
      'Δήμου Κορδελιού - Ευόσμου',
    ]);
  });

  it('🔴 καμία τιμή δεν κουβαλά τη σειρά τελειών του εντύπου', () => {
    for (const row of rowsOf('approvals')) {
      // Η ίδια η γραμμή **έχει** είκοσι τελείες· καμία τιμή δεν τις κρατά.
      expect(row.rawText).toMatch(/\.{10,}/);
      for (const part of row.parts) expect(part.rawValue).not.toMatch(/\.{3,}/);
    }
  });

  it('ο αριθμός πρωτοκόλλου ΔΕΝ διαβάζεται — το σχέδιο δεν τον δίνει', () => {
    // Κανόνας για κάτι που κανένα σχέδιο του δείγματος δεν λέει = νεκρό λεξιλόγιο (§4.4.1).
    // Το πεδίο υπάρχει στην καρτέλα για να το πληκτρολογήσει ο μηχανικός.
    expect(DOCUMENT_BODY_PART_KEYS).not.toContain('protocolNumber');
  });
});

describe('🔴 Ι — δύο διαχωριστές στην ίδια ενότητα, και τα ΤΡΙΑ διαβάζονται', () => {
  it('τρεις τίτλοι ιδιοκτησίας', () => {
    expect(rowsOf('titleDeeds')).toHaveLength(3);
  });

  it('🔴 «2946 - 18/01/1993» και «475, 25/06/2004» — κανόνας ΣΧΗΜΑΤΟΣ, όχι διαχωριστή', () => {
    // Κάθε κανόνας με έναν διαχωριστή διαβάζει **μία στις τρεις** γραμμές.
    expect(rowsOf('titleDeeds').map((r) => oneOf(r, 'number'))).toEqual(['2946', '475', '477']);
    expect(rowsOf('titleDeeds').map((r) => oneOf(r, 'date'))).toEqual([
      '18/01/1993',
      '25/06/2004',
      '30/06/2004',
    ]);
  });

  it('το είδος και το όνομα είναι τιμές ΜΕΤΑΒΛΗΤΟΥ πλήθους λέξεων', () => {
    expect(rowsOf('titleDeeds').map((r) => oneOf(r, 'kind'))).toEqual([
      'Κληρονομιάς',
      'Γονικής Παροχής',
      'Διανομής',
    ]);
    expect(rowsOf('titleDeeds').map((r) => oneOf(r, 'notaryName'))).toEqual([
      'ΜΑΙΡΗΣ ΑΘΑΝΑΣΙΑΔΟΥ',
      'ΚΩΝΣΤΑΝΤΙΝΑ ΚΑΛΟΓΙΑΝΝΗ',
      'ΚΩΝΣΤΑΝΤΙΝΑ ΚΑΛΟΓΙΑΝΝΗ',
    ]);
  });

  it('🔴 «ΣΥΜΒ/ΦΟΣ ΘΕΣ/ ΝΙΚΗΣ» — η συντομογραφία έχει ΚΕΝΟ μέσα της και δεν μπαίνει στο όνομα', () => {
    for (const value of rowsOf('titleDeeds').map((r) => oneOf(r, 'notaryName'))) {
      expect(value).not.toContain('ΘΕΣ');
      expect(value).not.toContain('ΣΥΜΒ');
    }
  });

  it('🔴 «Τόμο ... με α.α. ...» ⇒ ΤΙΠΟΤΑ· «Τόμο 262 με α.α. 78» ⇒ οι αριθμοί', () => {
    const [first, dotted, filled] = rowsOf('titleDeeds');
    // Η πρώτη γραμμή δεν έχει καθόλου τμήμα μεταγραφής — απουσία, όχι αποτυχία ανάγνωσης.
    expect(partsOf(first, 'volume')).toEqual([]);
    expect(partsOf(first, 'registry')).toEqual([]);
    // Η δεύτερη το έχει, **κενό**: τυπωμένες τελείες στη θέση των αριθμών.
    expect(partsOf(dotted, 'volume')).toEqual([]);
    expect(partsOf(dotted, 'entry')).toEqual([]);
    expect(oneOf(dotted, 'registry')).toBe('Νεάπολης');
    // Η τρίτη τους δίνει.
    expect(oneOf(filled, 'volume')).toBe('262');
    expect(oneOf(filled, 'entry')).toBe('78');
  });

  it('ο συμβολαιογράφος ΔΕΝ ταυτοποιείται — το όνομα αλλάζει πτώση ανά γραμμή', () => {
    // «ΜΑΙΡΗΣ ΑΘΑΝΑΣΙΑΔΟΥ» (γενική) vs «ΚΩΝΣΤΑΝΤΙΝΑ ΚΑΛΟΓΙΑΝΝΗ» (ονομαστική): ανάγνωση δεν
    // είναι ταυτοποίηση (ADR-745 §8), γι' αυτό δεν υπάρχει μέρος `notaryContactId`.
    expect(DOCUMENT_BODY_PART_KEYS).not.toContain('notaryContactId');
  });
});

describe('🔴 κάθε δηλωμένο λεξιλόγιο γραμμών ΠΑΡΑΓΕΤΑΙ από το πραγματικό σχέδιο', () => {
  const produced = () => {
    const lists = new Set<string>();
    const parts = new Set<string>();
    for (const reading of g753DocumentReadings()) {
      for (const row of reading.rows) {
        lists.add(row.list);
        for (const part of row.parts) parts.add(part.part);
      }
    }
    return { lists, parts };
  };

  it('τα σύνολα ΛΙΣΤΩΝ είναι ίσα — ούτε νεκρή δήλωση, ούτε αδήλωτος παραγωγός', () => {
    expect([...produced().lists].sort()).toEqual([...DOCUMENT_BODY_LIST_KEYS].sort());
  });

  it('τα σύνολα ΜΕΡΩΝ είναι ίσα', () => {
    expect([...produced().parts].sort()).toEqual([...DOCUMENT_BODY_PART_KEYS].sort());
  });

  it('τα υπόλοιπα έγγραφα του σχεδίου ΔΕΝ φέρουν λίστες — και δεν επινοούν καμία', () => {
    for (const reading of g753DocumentReadings()) {
      if (reading.kind === 'private-engineer-survey') continue;
      expect(reading.rows).toEqual([]);
    }
  });

  it('η ανάγνωση είναι ντετερμινιστική — δύο περάσματα, ίδιες γραμμές', () => {
    expect(readDocumentBodies([]).length).toBe(0);
    expect(g753DocumentReadings().flatMap((r) => r.rows)).toEqual(
      g753DocumentReadings().flatMap((r) => r.rows),
    );
  });
});
