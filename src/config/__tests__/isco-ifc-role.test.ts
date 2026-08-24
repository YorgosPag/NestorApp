/**
 * ADR-798 Φάση 4 — άγκυρες για την **προβολή** ISCO → `IfcRoleEnum`.
 *
 * 🔑 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ Η ΜΙΣΗ ΔΟΥΛΕΙΑ.** Ένα test που δείχνει μόνο ότι ο
 * αρχιτέκτονας παίρνει `ARCHITECT` θα έμενε πράσινο και με πίνακα που δίνει
 * `ARCHITECT` σε **όλους**. Γι' αυτό κάθε ομάδα εδώ κλειδώνει **και** τι
 * **ΔΕΝ** πρέπει να απαντηθεί — οι αδελφές ομάδες που ρητά εξαιρέθηκαν.
 */

import {
  ISCO_IFC_ROLE,
  judgeIfcActorRole,
  type IfcRoleEnumValue,
  type IscoIfcRoleEntry,
} from '../isco-ifc-role';
import { ISCO_UNIT_GROUP_LENGTH } from '../isco-prefix';
import type { DeclaredOccupation } from '@/types/professional-identity';

/**
 * Το **κλειστό** σύνολο του IFC4 ADD2 TC1, γραμμένο **δεύτερη φορά, με το χέρι**.
 *
 * ⚠️ Είναι σκόπιμος «κλώνος»: αν το test εισήγαγε τον τύπο από το module που
 * ελέγχει, θα επικύρωνε τον εαυτό του — μια μετάλλαξη που **προσθέτει** τιμή
 * εκτός προτύπου θα έμενε πράσινη. Είναι η **δεύτερη φωνή** του ADR-587 §6.1.
 */
const IFC4_ROLE_ENUM: readonly string[] = [
  'SUPPLIER', 'MANUFACTURER', 'CONTRACTOR', 'SUBCONTRACTOR', 'ARCHITECT',
  'STRUCTURALENGINEER', 'COSTENGINEER', 'CLIENT', 'BUILDINGOWNER', 'BUILDINGOPERATOR',
  'MECHANICALENGINEER', 'ELECTRICALENGINEER', 'PROJECTMANAGER', 'FACILITIESMANAGER',
  'CIVILENGINEER', 'COMMISSIONINGENGINEER', 'ENGINEER', 'OWNER', 'CONSULTANT',
  'CONSTRUCTIONMANAGER', 'FIELDCONSTRUCTIONMANAGER', 'RESELLER', 'USERDEFINED',
];

/** Πραγματικοί κωδικοί ISCO-08, επαληθευμένοι στο επίσημο ESCO API (2026-08-24). */
const ISCO = {
  engineerGeneric: '2141', // Industrial and production engineers
  civilEngineer: '2142', // Civil engineers
  environmental: '2143', // Environmental engineers
  mechanical: '2144', // Mechanical engineers
  chemical: '2145', // Chemical engineers
  nec: '2149', // Engineering professionals not elsewhere classified (quantity surveyor)
  electrical: '2151', // Electrical engineers
  electronics: '2152', // Electronics engineers
  telecom: '2153', // Telecommunications engineers
  buildingArchitect: '2161', // Building architects
  landscapeArchitect: '2162', // Landscape architects
  productDesigner: '2163', // Product and garment designers
  townPlanner: '2164', // Town and traffic planners
  surveyor: '2165', // Cartographers and surveyors
  graphicDesigner: '2166', // Graphic and multimedia designers
  constructionManager: '1323', // Construction managers
  supplyManager: '1324', // Supply, distribution and related managers
  lawyer: '2611', // Lawyers
  realEstateAgent: '3334', // Real estate agents and property managers
} as const;

const URI = 'http://data.europa.eu/esco/occupation/11111111-2222-3333-4444-555555555555';

function classified(iscoCode: string, label = 'Δοκιμαστικό επάγγελμα'): DeclaredOccupation {
  return { profession: label, escoLabel: label, escoUri: URI, iscoCode };
}

// =============================================================================
describe('Α — ο πίνακας προβολής', () => {
  it('Α1: κάθε δήλωση έχει έγκυρο πρόθεμα ISCO και ΜΗ ΚΕΝΟ `why`', () => {
    const entries = Object.entries(ISCO_IFC_ROLE);
    expect(entries.length).toBeGreaterThan(0);
    for (const [prefix, entry] of entries) {
      expect(prefix).toMatch(/^\d{1,4}$/);
      expect(prefix.length).toBeLessThanOrEqual(ISCO_UNIT_GROUP_LENGTH);
      expect((entry as IscoIfcRoleEntry).why.trim().length).toBeGreaterThan(0);
    }
  });

  it('Α2: κάθε `role` ανήκει στο κλειστό σύνολο IFC4 και ΠΟΤΕ δεν είναι USERDEFINED', () => {
    for (const [, entry] of Object.entries(ISCO_IFC_ROLE)) {
      const role: IfcRoleEnumValue = (entry as IscoIfcRoleEntry).role;
      expect(IFC4_ROLE_ENUM).toContain(role);
      // Το USERDEFINED είναι ΕΤΥΜΗΓΟΡΙΑ, ποτέ δήλωση: αν γραφόταν στον πίνακα θα
      // ήταν σιωπηλή διέξοδος με πρόσωπο απόφασης (ADR-798 §6.2).
      expect(role).not.toBe('USERDEFINED');
    }
  });

  it('Α3: καμία ΠΛΕΟΝΑΣΤΙΚΗ δήλωση — ο πλησιέστερος δηλωμένος πρόγονος λέει άλλο', () => {
    for (const [prefix, entry] of Object.entries(ISCO_IFC_ROLE)) {
      for (let length = prefix.length - 1; length >= 1; length -= 1) {
        const ancestor = ISCO_IFC_ROLE[prefix.slice(0, length)];
        if (ancestor === undefined) continue;
        expect({ prefix, role: ancestor.role }).not.toEqual({
          prefix,
          role: (entry as IscoIfcRoleEntry).role,
        });
        break; // μόνο ο ΠΛΗΣΙΕΣΤΕΡΟΣ έχει σημασία — αυτός νικά στην ανάλυση
      }
    }
  });
});

// =============================================================================
describe('Β — ο μακρύτερος πρόθεμα νικά, ΚΑΙ ο παρονομαστής', () => {
  const roleOf = (code: string): string => {
    const verdict = judgeIfcActorRole(classified(code));
    return verdict.kind === 'enumerated' ? verdict.role : verdict.kind;
  };

  it('Β1: το γενικό 214 δίνει ENGINEER σε ΟΛΗ την ελάσσονα ομάδα', () => {
    expect(roleOf(ISCO.engineerGeneric)).toBe('ENGINEER');
    expect(roleOf(ISCO.environmental)).toBe('ENGINEER');
    expect(roleOf(ISCO.chemical)).toBe('ENGINEER');
    expect(roleOf(ISCO.nec)).toBe('ENGINEER');
  });

  it('Β2: και τα 2142/2144 τον ΕΞΕΙΔΙΚΕΥΟΥΝ — ο μακρύτερος νικά', () => {
    expect(roleOf(ISCO.civilEngineer)).toBe('CIVILENGINEER');
    expect(roleOf(ISCO.mechanical)).toBe('MECHANICALENGINEER');
  });

  it('Β3 🔑 ΠΑΡΟΝΟΜΑΣΤΗΣ: ο ηλεκτρολόγος παίρνει ELECTRICALENGINEER, ο ηλεκτρονικός ΟΧΙ', () => {
    expect(roleOf(ISCO.electrical)).toBe('ELECTRICALENGINEER');
    // Το 215 δεν δηλώνεται ολόκληρο, και δεν είναι απόγονος του 214.
    expect(roleOf(ISCO.electronics)).toBe('user-defined');
    expect(roleOf(ISCO.telecom)).toBe('user-defined');
  });

  it('Β4 🔑 ΠΑΡΟΝΟΜΑΣΤΗΣ: ο αρχιτέκτονας κτιρίων ΝΑΙ, ο γραφίστας ΟΧΙ', () => {
    expect(roleOf(ISCO.buildingArchitect)).toBe('ARCHITECT');
    expect(roleOf(ISCO.productDesigner)).toBe('user-defined');
    expect(roleOf(ISCO.graphicDesigner)).toBe('user-defined');
    expect(roleOf(ISCO.landscapeArchitect)).toBe('user-defined');
    expect(roleOf(ISCO.townPlanner)).toBe('user-defined');
  });

  it('Β5 🔑 ΠΑΡΟΝΟΜΑΣΤΗΣ: το 1323 ΝΑΙ, το αδελφό 1324 ΟΧΙ (το γονικό 132 δεν δηλώνεται)', () => {
    expect(roleOf(ISCO.constructionManager)).toBe('CONSTRUCTIONMANAGER');
    expect(roleOf(ISCO.supplyManager)).toBe('user-defined');
  });

  it('Β6: ο ΤΟΠΟΓΡΑΦΟΣ, ο ΔΙΚΗΓΟΡΟΣ και ο ΜΕΣΙΤΗΣ σωπαίνουν — το πρότυπο δεν τους έχει', () => {
    // Δεν είναι έλλειψη: το IfcRoleEnum ΔΕΝ έχει SURVEYOR, ούτε δικηγόρο, ούτε
    // μεσίτη. Και η πληροφορία ΔΕΝ χάνεται — το δεύτερο κανάλι κουβαλά το URI.
    for (const code of [ISCO.surveyor, ISCO.lawyer, ISCO.realEstateAgent]) {
      const verdict = judgeIfcActorRole(classified(code));
      expect(verdict.kind).toBe('user-defined');
      if (verdict.kind !== 'user-defined') throw new Error('αδύνατο');
      expect(verdict.source.uri).toBe(URI);
      expect(verdict.source.code).toBe(code);
    }
  });
});

// =============================================================================
describe('Γ — οι πέντε ρητές καταστάσεις', () => {
  it('Γ1: `absent` για null, undefined και κενό αντικείμενο', () => {
    expect(judgeIfcActorRole(null).kind).toBe('absent');
    expect(judgeIfcActorRole(undefined).kind).toBe('absent');
    expect(judgeIfcActorRole({}).kind).toBe('absent');
    expect(judgeIfcActorRole({ profession: '   ' }).kind).toBe('absent');
  });

  it('Γ2: `unclassified` για σκέτο ελεύθερο κείμενο — η ΣΥΝΗΘΙΣΜΕΝΗ κατάσταση', () => {
    expect(judgeIfcActorRole({ profession: 'Μηχανικός' })).toEqual({ kind: 'unclassified' });
  });

  it('Γ3 🔴 Η ΣΕΙΡΑ ΤΩΝ ΕΛΕΓΧΩΝ: ΟΡΦΑΝΟΣ κωδικός ISCO χωρίς URI ΔΕΝ γίνεται `enumerated`', () => {
    // Αν ο πίνακας ρωτιόταν πριν το URI, αυτό θα έδινε ARCHITECT με ΚΕΝΟ δεύτερο
    // κανάλι — δηλαδή μηχανισμό «με ή» από την πίσω πόρτα (ADR-798 §6.2).
    const orphan: DeclaredOccupation = { profession: 'Αρχιτέκτονας', iscoCode: ISCO.buildingArchitect };
    expect(judgeIfcActorRole(orphan)).toEqual({ kind: 'unclassified' });
  });

  it('Γ4: `enumerated` κουβαλά ΚΑΙ τον ρόλο ΚΑΙ την πηγή, ακέραια', () => {
    const verdict = judgeIfcActorRole({
      profession: 'Αρχιτέκτονας',
      escoLabel: 'αρχιτέκτονας κτιρίων',
      escoUri: URI,
      iscoCode: ISCO.buildingArchitect,
    });
    expect(verdict).toEqual({
      kind: 'enumerated',
      role: 'ARCHITECT',
      prefix: ISCO.buildingArchitect,
      source: { uri: URI, code: ISCO.buildingArchitect, label: 'αρχιτέκτονας κτιρίων' },
    });
  });

  it('Γ5: `malformed` όταν ο κωδικός δεν είναι ISCO-08 — fail-closed ΚΑΙ ορατό', () => {
    for (const bad of ['ABCD', '21611', '21.6', '-1']) {
      expect(judgeIfcActorRole(classified(bad))).toEqual({ kind: 'malformed', value: bad });
    }
  });

  it('Γ6: ταξινομημένο ΧΩΡΙΣ κωδικό ISCO ⇒ `user-defined` — το URI αρκεί', () => {
    const verdict = judgeIfcActorRole({ escoLabel: 'κάτι', escoUri: URI });
    expect(verdict.kind).toBe('user-defined');
    if (verdict.kind !== 'user-defined') throw new Error('αδύνατο');
    expect(verdict.source.code).toBeNull();
    expect(verdict.label).toBe('κάτι');
  });

  it('Γ7: τα κενά ΔΕΝ είναι τιμές, και το `profession` καλύπτει το `escoLabel`', () => {
    expect(judgeIfcActorRole({ escoUri: '  ', profession: 'Χ' })).toEqual({ kind: 'unclassified' });
    const verdict = judgeIfcActorRole({ escoUri: URI, escoLabel: '   ', profession: '  Δικηγόρος ' });
    expect(verdict.kind).toBe('user-defined');
    if (verdict.kind !== 'user-defined') throw new Error('αδύνατο');
    expect(verdict.label).toBe('Δικηγόρος');
  });
});
