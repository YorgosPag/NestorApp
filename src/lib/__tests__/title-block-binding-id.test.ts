/**
 * @fileoverview Το ντετερμινιστικό κλειδί σύνδεσης πινακίδας (ADR-745 §6.2).
 *
 * Τα tests είναι οργανωμένα κατά **αναλλοίωτο**, όχι κατά συνάρτηση: κάθε ένα ονομάζει το
 * σενάριο απώλειας που αποτρέπει. Ένα test ανά export θα γραφόταν δίπλα στον κώδικα που είναι
 * ήδη σωστός — που είναι ακριβώς ο λόγος που τέτοια κενά επιζούν.
 */

import {
  bindingSlot,
  bindingSlotScope,
  buildTitleBlockBindingKey,
  cellRef,
  encodeKeySegment,
  targetRef,
} from '../title-block-binding-id';
import type { BindingProposal, BindingTarget } from '@/types/title-block-binding';
import type { TitleBlockFieldKey } from '@/types/title-block-reading';

const FILE = 'file_abc';
const LEVEL = 'lvl_1';

function proposal(over: Partial<BindingProposal> = {}): BindingProposal {
  return {
    fieldKey: 'designers' as TitleBlockFieldKey,
    titleBlockIndex: 0,
    sourceHandle: 'mtext_7',
    labelHandle: 'mtext_6',
    at: { x: 408012.8, y: 4497231.25 },
    snapshotValue: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ',
    candidates: [],
    ...over,
  };
}

const contactTarget = (contactId: string, role = 'surveyor'): BindingTarget =>
  ({ kind: 'contact', contactId, role, projectId: 'proj_1' }) as BindingTarget;

const key = (p: BindingProposal, t: BindingTarget) =>
  buildTitleBlockBindingKey({ fileRecordId: FILE, levelId: LEVEL, proposal: p, target: t });

describe('ιδιοτροπία — η επανάληψη δεν διπλασιάζει', () => {
  it('ίδια είσοδος ⇒ ίδιο κλειδί', () => {
    const p = proposal();
    expect(key(p, contactTarget('c1'))).toBe(key(p, contactTarget('c1')));
  });

  it('το κλειδί ξεκινά με το prefix του SSoT (N.6)', () => {
    expect(key(proposal(), contactTarget('c1')).startsWith('tbb_')).toBe(true);
  });
});

describe('🔴 ΤΟ ΚΕΛΙ ΤΑΥΤΟΠΟΙΕΙΤΑΙ ΑΠΟ ΤΗ ΓΕΩΜΕΤΡΙΑ, ΟΧΙ ΑΠΟ ΤΟΝ ΜΕΤΡΗΤΗ', () => {
  /**
   * Το σενάριο που κατέρριψε την πρώτη σχεδίαση: πινακίδα μέσα σε BLOCK. Οι δύο μετρητές id
   * (top-level και block-flattened) παράγουν **το ίδιο** `mtext_7` για δύο διαφορετικά κελιά.
   * Με κλειδί βασισμένο στο handle, η έγκριση του ενός θα έσβηνε τον άλλο.
   */
  it('δύο ΔΙΑΦΟΡΕΤΙΚΑ κελιά με ΤΟ ΙΔΙΟ sourceHandle δίνουν ΔΙΑΦΟΡΕΤΙΚΑ κλειδιά', () => {
    const fromEntities = proposal({ sourceHandle: 'mtext_7', at: { x: 408012.8, y: 100 } });
    const fromBlock = proposal({ sourceHandle: 'mtext_7', at: { x: 408069.733, y: 100 } });

    expect(fromEntities.sourceHandle).toBe(fromBlock.sourceHandle);
    expect(key(fromEntities, contactTarget('c1'))).not.toBe(key(fromBlock, contactTarget('c1')));
  });

  it('ΤΟ ΙΔΙΟ κελί με διαφορετικό sourceHandle δίνει ΤΟ ΙΔΙΟ κλειδί (ο μετρητής δεν μετράει)', () => {
    const a = proposal({ sourceHandle: 'mtext_7' });
    const b = proposal({ sourceHandle: 'mtext_412' });
    expect(key(a, contactTarget('c1'))).toBe(key(b, contactTarget('c1')));
  });

  it('ούτε ο titleBlockIndex μπαίνει — είναι σειρά ομαδοποίησης, όχι ταυτότητα', () => {
    expect(key(proposal({ titleBlockIndex: 0 }), contactTarget('c1'))).toBe(
      key(proposal({ titleBlockIndex: 1 }), contactTarget('c1')),
    );
  });

  it('το -0 εξομαλύνεται — αλλιώς ένα κελί στον άξονα δίνει δύο κλειδιά', () => {
    expect(cellRef({ x: -0.0001, y: 0 })).toBe(cellRef({ x: 0, y: -0 }));
  });

  it('μη πεπερασμένη συντεταγμένη ΣΚΑΕΙ — δεν γεννά κλειδί-φάντασμα', () => {
    expect(() => cellRef({ x: NaN, y: 0 })).toThrow();
  });
});

describe('🔴 ΤΟ SLOT ΚΡΑΤΑΕΙ ΖΩΝΤΑΝΕΣ ΤΙΣ ΠΟΛΛΑΠΛΕΣ ΠΡΟΤΑΣΕΙΣ ΕΝΟΣ ΚΕΛΙΟΥ', () => {
  it('δύο μελετητές από ΤΟ ΙΔΙΟ κελί δεν συγκρούονται, ούτε στην εμβέλεια supersede', () => {
    const first = proposal({ personName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ' });
    const second = proposal({ personName: 'ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ' });

    expect(key(first, contactTarget('c1'))).not.toBe(key(second, contactTarget('c2')));
    // Το κρίσιμο: η έγκριση του #2 δεν πρέπει να ΑΓΓΙΞΕΙ τον #1.
    const scope = (p: BindingProposal, t: BindingTarget) =>
      bindingSlotScope({ fileRecordId: FILE, levelId: LEVEL, proposal: p, target: t });
    expect(scope(first, contactTarget('c1'))).not.toBe(scope(second, contactTarget('c2')));
  });

  it('τρεις ενότητες θέσης από ΤΟ ΙΔΙΟ κελί δεν συγκρούονται', () => {
    const at = { x: 1, y: 2 };
    const loc = (field: 'municipality' | 'neighborhood') =>
      key(
        proposal({ fieldKey: 'location' as TitleBlockFieldKey, at }),
        { kind: 'project-address', projectId: 'p', field, value: 'v' } as BindingTarget,
      );
    const ot = key(
      proposal({ fieldKey: 'location' as TitleBlockFieldKey, at }),
      { kind: 'project-field', projectId: 'p', field: 'buildingBlock', value: 'v' } as BindingTarget,
    );
    expect(new Set([loc('municipality'), loc('neighborhood'), ot]).size).toBe(3);
  });
});

/**
 * 🔴 **ΤΟ ΕΚΚΡΕΜΕΣ ΤΗΣ Φ3γ** (ADR-759 §4.8 χρέος β / §4.9).
 *
 * Το `bindingSlot` επέστρεφε `encodeKeySegment(personName)` **πριν κοιτάξει το είδος στόχου**.
 * Άρα «ο Μαυρομιχάλης → επαφή έργου» και «ο Μαυρομιχάλης → **τοπογράφος αυτού** του
 * τοπογραφικού» έπεφταν στο **ίδιο slot**: δύο νόμιμες, ταυτόχρονα αληθείς συνδέσεις, και η
 * δεύτερη έγκριση μαρκάριζε `superseded` την πρώτη — **σιωπηλά, χωρίς μήνυμα**.
 *
 * Είναι **κατά λέξη** η βλάβη που γέννησε αυτή τη συνάρτηση (δύο μελετητές από ένα κελί), σε
 * άλλον άξονα: εκεί άλλαζε το **πρόσωπο** με σταθερό προορισμό, εδώ αλλάζει ο **προορισμός** με
 * σταθερό πρόσωπο. Ο πρώτος άξονας καλύφθηκε· ο δεύτερος όχι, γιατί μέχρι τη Φ3γ **δεν υπήρχε**
 * δεύτερος προορισμός για πρόσωπο.
 *
 * ⚠️ **Ο έλεγχος γράφτηκε ΠΡΙΝ τη θεραπεία και ήταν κόκκινος** — αλλιώς δεν θα ξέραμε ότι
 * διορθώθηκε κάτι (handoff §Δ.2).
 */
describe('🔴 ΙΔΙΟ ΠΡΟΣΩΠΟ, ΑΛΛΟΣ ΠΡΟΟΡΙΣΜΟΣ — Η ΣΙΩΠΗΛΗ ΑΠΟΣΥΡΣΗ', () => {
  const scope = (p: BindingProposal, t: BindingTarget) =>
    bindingSlotScope({ fileRecordId: FILE, levelId: LEVEL, proposal: p, target: t });

  /** Η ίδια δήλωση της πινακίδας, με προορισμό το **τοπογραφικό** αντί για την επαφή έργου. */
  const surveyTarget: BindingTarget = {
    kind: 'survey-record',
    projectId: 'proj_1',
    recordId: 'srv_1',
    field: 'surveyDate',
    value: { kind: 'text', value: '2026-07-30' },
  } as BindingTarget;

  it('🔴 η δεύτερη έγκριση ΔΕΝ αποσύρει την πρώτη — άλλο είδος στόχου, άλλη εμβέλεια', () => {
    const p = proposal({ personName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ' });
    expect(scope(p, contactTarget('c1'))).not.toBe(scope(p, surveyTarget));
  });

  it('και τα δύο έγγραφα επιβιώνουν — δύο κλειδιά, όχι ένα επιγραμμένο', () => {
    const p = proposal({ personName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ' });
    expect(key(p, contactTarget('c1'))).not.toBe(key(p, surveyTarget));
  });

  it('το ίδιο ισχύει για τον οικοπεδούχο — ο άξονας είναι το ΕΙΔΟΣ, όχι ο ρόλος', () => {
    const p = proposal({ personName: 'ΖΕΡΒΑ ΓΕΩΡΓΙΑ' });
    const landowner = {
      kind: 'landowner',
      projectId: 'proj_1',
      contactId: 'c9',
      acquisitionStatus: 'prospective',
    } as BindingTarget;
    expect(scope(p, landowner)).not.toBe(scope(p, surveyTarget));
  });

  /**
   * 🔴 **Η ΑΠΟΔΕΙΞΗ ΟΤΙ Η ΘΕΡΑΠΕΙΑ ΕΙΝΑΙ ΠΡΟΣΘΕΤΙΚΗ.**
   *
   * Το slot ζει μέσα σε **αποθηκευμένα** `bindingId` του Firestore. Αλλάζοντάς το για τα
   * υπάρχοντα είδη, κάθε εγκεκριμένη σύνδεση θα αποκτούσε **νέο** κλειδί: το επόμενο φόρτωμα
   * δεν θα την ξανάβρισκε, το δεύτερο κλικ θα γεννούσε **δεύτερο έγγραφο**, και το supersede
   * δεν θα έφτανε ποτέ στο παλιό (ADR-745 §Γ2, η ίδια βλάβη με το `?? ''`).
   *
   * Ο έλεγχος είναι ασφαλής **επειδή είναι μετρημένο** ότι μόνο δύο σημεία παράγουν
   * `personName` (`resolve-people.ts:152`, `resolve-landowner.ts:67`) και **και τα δύο**
   * δίνουν στόχο προσώπου — άρα κανένα αποθηκευμένο κλειδί δεν αλλάζει.
   */
  it.each([
    ['επαφή έργου', contactTarget('c1')],
    [
      'οικοπεδούχος',
      {
        kind: 'landowner',
        projectId: 'proj_1',
        contactId: 'c1',
        acquisitionStatus: 'prospective',
      } as BindingTarget,
    ],
  ])('🔴 το slot του «%s» μένει ΑΚΡΙΒΩΣ το πρόσωπο — κανένα αποθηκευμένο κλειδί δεν αλλάζει', (
    _name,
    target: BindingTarget,
  ) => {
    const name = 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ';
    expect(bindingSlot(proposal({ personName: name }), target)).toBe(encodeKeySegment(name));
  });

  it('χωρίς πρόσωπο, τα είδη προσώπου κρατούν το contactId — ίδια συμπεριφορά με πριν', () => {
    expect(bindingSlot(proposal(), contactTarget('c1'))).toBe('c1');
  });
});

describe('🔴 Η ΔΙΟΡΘΩΣΗ ΚΡΑΤΑΕΙ ΙΣΤΟΡΙΑ — ΙΔΙΟ SLOT, ΑΛΛΟ ΕΓΓΡΑΦΟ', () => {
  it('λάθος επαφή και σωστή επαφή = δύο έγγραφα, ίδια εμβέλεια supersede', () => {
    const p = proposal({ personName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ' });
    const wrong = contactTarget('c_wrong');
    const right = contactTarget('c_right');

    expect(key(p, wrong)).not.toBe(key(p, right));
    expect(bindingSlotScope({ fileRecordId: FILE, levelId: LEVEL, proposal: p, target: wrong })).toBe(
      bindingSlotScope({ fileRecordId: FILE, levelId: LEVEL, proposal: p, target: right }),
    );
  });

  it('🔑 ο ΡΟΛΟΣ ξεχωρίζει — αλλιώς ο παλιός σύνδεσμος γίνεται μόνιμα ανακτήσιμος', () => {
    const p = proposal({ personName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ' });
    expect(key(p, contactTarget('c1', 'civil_engineer'))).not.toBe(
      key(p, contactTarget('c1', 'surveyor')),
    );
    expect(targetRef(contactTarget('c1', 'surveyor'))).toContain('surveyor');
  });

  it('η εμβέλεια supersede είναι όντως το κλειδί ΧΩΡΙΣ τον στόχο', () => {
    const p = proposal();
    const t = contactTarget('c1');
    const parts = { fileRecordId: FILE, levelId: LEVEL, proposal: p, target: t };
    expect(buildTitleBlockBindingKey(parts)).toBe(`${bindingSlotScope(parts)}_${targetRef(t)}`);
  });
});

describe('🔴 Η ΚΩΔΙΚΟΠΟΙΗΣΗ ΕΙΝΑΙ 1:1 — ΑΛΛΙΩΣ ΤΟ SUPERSEDE ΣΒΗΝΕΙ ΞΕΝΟ BINDING', () => {
  it('«ΚΩΝ/ΝΟΣ»: το / φεύγει — παράνομο σε Firestore document id', () => {
    expect(encodeKeySegment('ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ')).not.toContain('/');
    expect(key(proposal({ personName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ' }), contactTarget('c1'))).not.toContain('/');
  });

  it('ονόματα που διαφέρουν ΜΟΝΟ στον χαρακτήρα-πρόβλημα ΔΕΝ συγχωνεύονται', () => {
    // Μια «καθαρίστρια» κανονικοποίηση σε `-` θα τα έκανε ταυτόσημα, και η έγκριση του ενός θα
    // μαρκάριζε superseded τον άλλο — σιωπηλά.
    const a = encodeKeySegment('ΠΑΠΠΑΣ Α/Β');
    const b = encodeKeySegment('ΠΑΠΠΑΣ Α Β');
    const c = encodeKeySegment('ΠΑΠΠΑΣ Α_Β');
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('ο διαχωριστής `_` δεν διαρρέει μέσα σε τμήμα', () => {
    expect(encodeKeySegment('Α_Β')).not.toContain('_');
  });

  it('τα κενά κανονικοποιούνται ώστε η ίδια γραφή να δίνει ένα κλειδί', () => {
    expect(encodeKeySegment('  ΖΕΡΒΑ   ΓΕΩΡΓΙΑ ')).toBe(encodeKeySegment('ΖΕΡΒΑ ΓΕΩΡΓΙΑ'));
  });

  it('το κλειδί δεν ξεπερνά το όριο των 1500 bytes του Firestore', () => {
    const long = 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝΣΤΑΝΤΙΝΟΣ ΤΟΥ ΓΕΩΡΓΙΟΥ'.repeat(3);
    const k = key(proposal({ personName: long }), contactTarget('c1'));
    expect(Buffer.byteLength(k, 'utf8')).toBeLessThan(1500);
  });
});

describe('🔴 ΚΑΝΕΝΑ ΣΙΩΠΗΛΟ ΚΕΝΟ ΤΜΗΜΑ — ΠΟΤΕ `?? \'\'`', () => {
  it.each([
    ['fileRecordId', { fileRecordId: '', levelId: LEVEL }],
    ['levelId', { fileRecordId: FILE, levelId: '' }],
  ])('%s κενό ⇒ ΣΚΑΕΙ, δεν γεννά δεύτερο έγγραφο στο cold load', (_name, over) => {
    expect(() =>
      buildTitleBlockBindingKey({ ...over, proposal: proposal(), target: contactTarget('c1') }),
    ).toThrow();
  });

  it('κενό personName ⇒ ΣΚΑΕΙ αντί να συγχωνεύσει δύο πρόσωπα σε ένα slot', () => {
    expect(() => bindingSlot(proposal({ personName: '   ' }), contactTarget('c1'))).toThrow();
  });
});

/**
 * 🔴 **ΟΙ ΓΡΑΜΜΕΣ ΜΟΙΡΑΖΟΝΤΑΙ ΤΟ ΙΔΙΟ ΚΕΛΙ — ΤΟ SLOT ΕΙΝΑΙ ΤΟ ΜΟΝΟ ΠΟΥ ΤΙΣ ΞΕΧΩΡΙΖΕΙ** (Φ4β).
 *
 * Τα έγγραφα του σώματος είναι **ένα MTEXT το καθένα**: οι πέντε θεσμικές πράξεις, οι δύο
 * εγκρίσεις και οι τρεις τίτλοι του G753 έχουν **ταυτόσημο** σημείο εισαγωγής. Με slot το
 * πεδίο — όπως τα βαθμωτά — και οι δέκα θα καταλάμβαναν την ίδια θέση, και κάθε έγκριση θα
 * μαρκάριζε `superseded` την προηγούμενη: θα επιβίωνε **μία**.
 */
describe('🔴 ΓΡΑΜΜΗ ΤΟΠΟΓΡΑΦΙΚΟΥ — ΔΕΚΑ ΔΗΛΩΣΕΙΣ ΑΠΟ ΕΝΑ ΣΗΜΕΙΟ', () => {
  const rowTarget = (rowId: string, list = 'zoningRegulations'): BindingTarget =>
    ({
      kind: 'survey-record-row',
      projectId: 'proj_1',
      recordId: 'srv_1',
      list,
      rowId,
      parts: [],
    }) as BindingTarget;

  const rowProposal = proposal({ fieldKey: 'zoningRegulations', personName: undefined });

  it('δύο γραμμές του ΙΔΙΟΥ εγγράφου δίνουν ΔΙΑΦΟΡΕΤΙΚΟ κλειδί', () => {
    expect(key(rowProposal, rowTarget('svact_a'))).not.toBe(key(rowProposal, rowTarget('svact_b')));
  });

  it('🔴 και ΔΙΑΦΟΡΕΤΙΚΟ slot — αλλιώς η δεύτερη έγκριση αποσύρει την πρώτη', () => {
    expect(bindingSlot(rowProposal, rowTarget('svact_a'))).not.toBe(
      bindingSlot(rowProposal, rowTarget('svact_b')),
    );
  });

  it('η ίδια γραμμή σε ΑΛΛΟ τοπογραφικό είναι άλλος σύνδεσμος', () => {
    const other = {
      ...rowTarget('svact_a'),
      recordId: 'srv_2',
    } as BindingTarget;
    expect(targetRef(rowTarget('svact_a'))).not.toBe(targetRef(other));
  });

  it('ίδια γραμμή ⇒ ίδιο κλειδί: η επανάληψη της έγκρισης δεν διπλασιάζει', () => {
    expect(key(rowProposal, rowTarget('svact_a'))).toBe(key(rowProposal, rowTarget('svact_a')));
  });
});
