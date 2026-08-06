/**
 * @fileoverview 🔴 Ο Λ1β πάνω στο **πραγματικό** σχέδιο — 574 κείμενα, 4 έγγραφα (ADR-759 Φ4).
 *
 * ## Τι φυλάει αυτή η σουίτα, και γιατί κάθε αριθμός είναι μετρημένος
 *
 * Δεν ρωτά «διαβάζεις σωστά αυτό το κείμενο;» — ρωτά **«ξεχωρίζεις τα έγγραφα μέσα σε ολόκληρο
 * το σχέδιο και βγάζεις ακριβώς τις τιμές που γράφει ο τοπογράφος;»**. Γι' αυτό η είσοδος είναι
 * **όλα** τα κείμενα του `G753_ergasia F.dxf`, αποκωδικοποιημένα από τον πραγματικό
 * αποκωδικοποιητή MTEXT — όχι γραμμές που γράψαμε εμείς.
 *
 * 🔑 Κάθε προσδοκία εδώ αντιστοιχεί σε **γραμμή του σχεδίου**. Αν κάποια αλλάξει, η σωστή
 * αντίδραση είναι να ανοίξει το αρχείο — όχι να «διορθωθεί» ο αριθμός.
 */

/* global describe, it, expect */
import { uniqueSumTriple } from '../document-body-values';
import { readDocumentBodies } from '../read-document-body';
import type { DocumentBodyFieldKey, DocumentBodyReading } from '@/types/document-body-reading';
import { g753DocumentReadings, g753DocumentSources } from './fixtures/g753-body.fixture';

const readings = g753DocumentReadings();

const byKind = (kind: string): DocumentBodyReading => {
  const found = readings.find((r) => r.kind === kind);
  if (!found) throw new Error(`δεν βρέθηκε έγγραφο «${kind}»`);
  return found;
};

const valueOf = (reading: DocumentBodyReading, key: DocumentBodyFieldKey): string | undefined =>
  reading.fields.find((f) => f.key === key)?.rawValue;

describe('🔴 η επιλογή γίνεται από τον ΤΙΤΛΟ, όχι από το layer', () => {
  it('574 κείμενα μπαίνουν, 4 έγγραφα βγαίνουν — μηδέν θόρυβος', () => {
    expect(g753DocumentSources()).toHaveLength(574);
    expect(readings).toHaveLength(4);
  });

  it('🔴 το layer ΔΕΝ είναι κριτήριο: το ίδιο layer φέρει 2 έγγραφα και 77 κείμενα θορύβου', () => {
    // Μετρημένο: `ΠΕΡΙΓΡΑΦΗ` = 79 κείμενα (διαστάσεις «5.00», λεζάντες «κράσπεδο», οδοί).
    const fromDescription = readings.filter((r) => r.layerName === 'ΠΕΡΙΓΡΑΦΗ');
    expect(fromDescription).toHaveLength(2);
  });

  it('🔴 ούτε λίστα layers θα αρκούσε: ένα έγγραφο ζει σε ΑΛΛΟ layer', () => {
    expect(byKind('parcel-area-note').layerName).toBe('Περίγραμμα');
    expect(byKind('owner-declaration').layerName).toBe('Περίγραμμα');
  });

  it('η σειρά είναι ντετερμινιστική — δύο αναγνώσεις, ίδια οθόνη', () => {
    expect(readDocumentBodies(g753DocumentSources()).map((r) => r.kind)).toEqual(
      readings.map((r) => r.kind),
    );
  });
});

describe('Α. ΟΡΟΙ ΔΟΜΗΣΗΣ — οι τιμές που γράφει το σχέδιο', () => {
  const form = byKind('private-engineer-survey');

  it.each([
    ['sector', 'Ι'],
    ['plotBoundaryLabels', 'Α,Β,Γ,Δ,Α'],
    ['minFrontage', '20'],
    ['minArea', '500'],
    ['declaredCoveragePct', '50'],
    ['maxCoveragePct', '60'],
    ['landUse', 'Αμιγής Κατοικία'],
  ] as const)('«%s» = %s', (key, expected) => {
    expect(valueOf(form, key)).toBe(expected);
  });

  it('🔴 το ύψος μένει ΚΕΙΜΕΝΟ — το σχέδιο λέει «κατά ΝΟΚ», όχι αριθμό', () => {
    // Με λατινικό N, όπως ακριβώς το γράφει το αρχείο. Η αναδίπλωση ανήκει στην **τιμή**
    // (`parseSurveyText`), όχι στον αναγνώστη: το `rawText` είναι η μόνη απόδειξη.
    expect(valueOf(form, 'declaredMaxHeight')).toBe('κατά NΟΚ');
  });

  it('🔴 δύο ποσοστά στο ΙΔΙΟ τμήμα διαβάζονται ως δύο πεδία, όχι ένα', () => {
    // «Ποσοστό κάλυψης 50%, 60% (μέγιστο ποσοστό καλύψης λόγω κοινωνικού συντελεστή)»
    expect(valueOf(form, 'declaredCoveragePct')).not.toBe(valueOf(form, 'maxCoveragePct'));
  });

  it('🔴 η ΖΚΣ δίνει την ίδια τη δήλωση ως μαρτυρία — η ύπαρξη είναι η τιμή', () => {
    expect(valueOf(form, 'inSocialFactorZone')).toBe('ΕΝΤΟΣ ΖΩΝΗΣ ΚΟΙΝΩΝΙΚΟΥ ΣΥΝΤΕΛΕΣΤΗ');
  });
});

describe('🔴 ο Συντελεστής Δόμησης είναι ΤΡΕΙΣ αριθμοί, και διαλέγονται με αριθμητική', () => {
  const form = byKind('private-engineer-survey');

  it('«0,8 με κοινωνικό συντελεστή 0,8+0,5 = 1,3» ⇒ 0,8 · 0,5 · 1,3', () => {
    expect(valueOf(form, 'declaredSd')).toBe('0,8');
    expect(valueOf(form, 'socialFactorSd')).toBe('0,5');
    expect(valueOf(form, 'totalSd')).toBe('1,3');
  });

  it('η επανάληψη του πρώτου αριθμού ΔΕΝ γεννά δεύτερη τριάδα', () => {
    // Οι θέσεις είναι δύο (το «0,8» γράφεται δις)· οι **τιμές** μία.
    expect(uniqueSumTriple([0.8, 0.8, 0.5, 1.3])).toEqual({ a: 0.8, b: 0.5, total: 1.3 });
  });

  it('🔑 δουλεύει ό,τι σειρά κι αν έχουν — δεν είναι κανόνας θέσης', () => {
    expect(uniqueSumTriple([1.3, 0.5, 0.8])).toEqual({ a: 0.5, b: 0.8, total: 1.3 });
  });

  it('🔴 ΑΜΦΙΣΗΜΙΑ ⇒ τίποτα: δύο τριάδες που κλείνουν δεν λύνονται με «πάρε την πρώτη»', () => {
    // 1+2=3 και 1+3=4 — το σχέδιο δεν λέει ποια εννοεί, άρα το πεδίο δεν προτείνεται.
    expect(uniqueSumTriple([1, 2, 3, 4])).toBeNull();
  });

  it('καμία τριάδα ⇒ τίποτα, ποτέ εύλογο λάθος', () => {
    expect(uniqueSumTriple([2, 5, 9])).toBeNull();
  });

  it('το μηδέν δεν είναι προσθετέος — «0 + x = x» κλείνει πάντα και δεν σημαίνει τίποτα', () => {
    expect(uniqueSumTriple([0, 7, 7])).toBeNull();
  });
});

describe('Β. ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ — τιμές μέσα σε πρόζα', () => {
  const form = byKind('private-engineer-survey');

  it.each([
    ['settlementActs', 'Δεν Υπάρχουν ούτε απαιτούνται'],
    ['implementationActNumber', '39'],
    ['implementationActDecision', '29/οικ/5078/ΠΕ/534/13-02-1996'],
    ['implementationActVolume', '106'],
    ['implementationActEntry', '155'],
    ['implementationActDate', '2-5-1996'],
    ['implementationActRegistry', 'Νεάπολης'],
    ['implementationActUrbanUnits', '16 και 17'],
    ['implementationActOriginalProperties', '012431 & 012432'],
  ] as const)('«%s» = %s', (key, expected) => {
    expect(valueOf(form, key)).toBe(expected);
  });

  it('🔴 η στίξη της ΠΡΟΤΑΣΗΣ δεν μπαίνει στην τιμή — «16 και 17).» → «16 και 17»', () => {
    expect(valueOf(form, 'implementationActUrbanUnits')).not.toMatch(/[).]/);
  });
});

describe('Γ–Ζ — η πρόζα κάτω από την επικεφαλίδα', () => {
  const form = byKind('private-engineer-survey');

  it('η αρτιότητα λέγεται με ΠΡΟΤΑΣΗ, και αποθηκεύεται ως πρόταση', () => {
    expect(valueOf(form, 'buildabilityNote')).toBe('Είναι με τα κατά κανόνα όρια αρτιότητας');
  });

  it('🔴 το ΕΜΒΑΔΟΝ βγαίνει από τη γραμμή της επικεφαλίδας της — «ΣΤ. … Ε = 1.364,05 τ.μ.»', () => {
    // Αν το υπόλοιπο της γραμμής επικεφαλίδας θεωρούνταν επικεφαλίδα, η ενότητα ΣΤ θα
    // φαινόταν **κενή** ενώ φέρει τη σημαντικότερη τιμή του σχεδίου.
    expect(valueOf(form, 'plotArea')).toBe('1.364,05');
  });

  it('η αφετηρία υψομέτρων διαβάζεται παρά το ορθογραφικό «ΑΦΕΤΕΡΙΑΣ» του σχεδίου', () => {
    expect(valueOf(form, 'heightDatum')).toBe(
      'Σαν αφετηρία μέτρησης υψομέτρων πάρθηκαν Απόλυτα Υψόμετρα',
    );
  });
});

describe('🔴 ΔΗΛΩΣΗ Ν.651/77 — το έγγραφο που αναβαθμίζει ήδη παραδομένη δουλειά (Φ5)', () => {
  const law = byKind('law651-declaration');

  it('η ΑΚΡΙΒΗΣ ημερομηνία: η πινακίδα λέει «ΙΟΥΛΙΟΣ 2026», το σώμα «30/7/2026»', () => {
    expect(valueOf(law, 'surveyDate')).toBe('30/7/2026');
  });

  it('🔴 η γραμμή υπογραφής διαλέγεται από το ΤΕΛΟΣ ΓΡΑΜΜΗΣ, όχι «η τελευταία ημερομηνία»', () => {
    // Το ίδιο έγγραφο περιέχει άλλες τέσσερις ημερομηνίες (ΦΕΚ, απόφαση, μεταγραφή) — καμία
    // τους δεν κλείνει γραμμή. Χωρίς αυτό το κριτήριο θα γραφόταν ημερομηνία **ΦΕΚ του 1992**.
    expect(valueOf(law, 'surveyDate')).not.toBe('2-5-1996');
  });

  it('🔴 και σαρώνεται από το ΤΕΛΟΣ: όταν ΔΥΟ γραμμές κλείνουν σε ημερομηνία, κερδίζει η υπογραφή', () => {
    // 🔑 Χειροποίητη είσοδος **επίτηδες**: το G753 δεν έχει δεύτερη γραμμή που να κλείνει σε
    // ημερομηνία, οπότε πάνω του η φορά σάρωσης δεν φαίνεται. Ένα δείγμα που δεν φτάνει σε μια
    // κατάσταση **δεν αποδεικνύει ότι η κατάσταση δεν υπάρχει** — και η επόμενη δήλωση που θα
    // γράψει «η άδεια εκδόθηκε 12-03-2020» στο σώμα της θα έδινε **ημερομηνία άδειας** ως
    // ημερομηνία τοπογραφικού, σιωπηλά.
    const [reading] = readDocumentBodies([
      {
        handle: 'h_sign',
        at: { x: 0, y: 0 },
        layerName: 'ΠΕΡΙΓΡΑΦΗ',
        lines: [
          'ΔΗΛΩΣΗ ΤΟΥ Ν.651/77',
          'Η άδεια εκδόθηκε 12-03-2020',
          '                    Θεσσαλονίκη 30/7/2026',
        ],
      },
    ]);
    expect(valueOf(reading, 'surveyDate')).toBe('30/7/2026');
  });

  it('🔴 η Πράξη Εφαρμογής ΟΛΟΓΡΑΦΩΣ — εδώ το «39» δεν είναι διφορούμενο', () => {
    expect(valueOf(law, 'implementationActNumber')).toBe('39');
  });

  it('🔴 «Π.Ε. Θεσσαλονίκης» ⇒ Περιφερειακή Ενότητα· «Π.Ε. 39» ΠΟΤΕ', () => {
    // Το ακρωνύμιο έχει τρεις σημασίες στο ίδιο αρχείο (§2β.3). Αποφασίζει το **σχήμα του
    // επόμενου**, δηλαδή συμφραζόμενο — όχι η μορφή του ακρωνυμίου.
    expect(valueOf(law, 'regionalUnit')).toBe('Θεσσαλονίκης');
  });

  it('🔴 η λίστα κορυφών ΣΤΑΜΑΤΑ στο «στο» — δεν ρουφά τη συνέχεια της πρότασης', () => {
    // Μετρημένο ελάττωμα: με σχήμα «γράμματα» το αποτέλεσμα ήταν «Α,Β,Γ,Δ,Α, στο Ο.Τ. Γ».
    expect(valueOf(law, 'plotBoundaryLabels')).toBe('Α,Β,Γ,Δ,Α');
  });

  it('🔴 «στις» εμφανίζεται ΔΥΟ φορές — κερδίζει η εμφάνιση που δίνει ημερομηνία', () => {
    // «υπάγεται **στις** διατάξεις του Ν.1337/83» προηγείται του «**στις** 2-5-1996».
    expect(valueOf(law, 'implementationActDate')).toBe('2-5-1996');
  });

  it('το εμβαδόν γράφεται ΧΩΡΙΣ διαχωριστή χιλιάδων εδώ — ίδια τιμή, άλλη γραφή', () => {
    expect(valueOf(law, 'plotArea')).toBe('1364,05');
  });
});

describe('🔴 τα ΚΕΝΑ είναι δεδομένο — ορατή απουσία, όχι σιωπή', () => {
  const form = byKind('private-engineer-survey');

  it('ό,τι τυπώνει η φόρμα και ο μηχανικός δεν συμπλήρωσε, λέγεται', () => {
    expect(form.emptySections).toEqual(['e', 'Παρέκλιση', 'Σύστημα', 'ΟΡΟΦΟΙ']);
  });

  it('🔴 και ΔΕΝ γίνεται πεδίο: ο Λ2 δεν μπορεί να γράψει ό,τι δεν βλέπει', () => {
    const keys = form.fields.map((f) => f.key);
    expect(keys).not.toContain('deviation');
    expect(keys).not.toContain('buildingSystem');
  });
});

describe('🔴 ο ΘΟΡΥΒΟΣ δεν γίνεται ποτέ έγγραφο', () => {
  it('κείμενο χωρίς δηλωμένο τίτλο αγνοείται, όσο κι αν μοιάζει με δεδομένα', () => {
    expect(
      readDocumentBodies([
        {
          handle: 'x1',
          at: { x: 0, y: 0 },
          layerName: 'ΠΕΡΙΓΡΑΦΗ',
          lines: ['Συντελεστής Δόμησης : 0,8+0,5 = 1,3', 'Χρήση Γης: Αμιγής Κατοικία'],
        },
      ]),
    ).toEqual([]);
  });

  it('ο τίτλος μετράει μόνο στις πρώτες γραμμές — αναφορά μέσα σε πρόζα δεν βαφτίζει έγγραφο', () => {
    expect(
      readDocumentBodies([
        {
          handle: 'x2',
          at: { x: 0, y: 0 },
          layerName: 'ΠΕΡΙΓΡΑΦΗ',
          lines: ['α', 'β', 'γ', 'ΔΗΛΩΣΗ ΙΔΙΟΚΤΗΤΗ (Ν. 4030/11)'],
        },
      ]),
    ).toEqual([]);
  });
});
