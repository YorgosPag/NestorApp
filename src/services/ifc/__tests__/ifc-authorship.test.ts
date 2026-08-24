/**
 * ADR-798 Φάση 4 — άγκυρες για την **εκπομπή** της επαγγελματικής ταυτότητας.
 *
 * 🔑 Οι τρεις ομάδες απαντούν τρία **ανεξάρτητα** ερωτήματα, και καμία δεν
 * καλύπτει την άλλη:
 *   **Δ** — *«τι μπαίνει στον γράφο;»* (και, κυρίως, **τι ΔΕΝ μπαίνει**)
 *   **Ε** — *«είναι η αλυσίδα ΚΛΕΙΣΤΗ;»* — ο δομικός κανόνας «και τα δύο, πάντα»
 *   **Ζ** — *«επιβιώνει το ελληνικό κείμενο στο ΑΡΧΕΙΟ;»* — round-trip STEP21
 *
 * ⚠️ Η **Ζ** δεν είναι πολυτέλεια. Είναι ο μετρημένος λόγος που η Φάση 4 μπήκε
 * σε **αυτόν** τον εξαγωγέα: ο εξαγωγέας καννάβου
 * *(`guides/guide-ifc-exporter.ts`)* έχει **μηδέν** STEP21 escaping — γράφει
 * `IFCGRIDAXIS('${name}',…)` ωμά — και το `escoLabel` είναι **ελληνικό**.
 */

import { IfcGraph, type IfcEntityRecord } from '../ifc-entity-graph';
import { writeStepIfc } from '../ifc-step-writer';
import { appendIfcAuthorship, type IfcAuthoringApplication } from '../ifc-authorship';
import type { DeclaredOccupation } from '@/types/professional-identity';
import { ESCO_CLASSIFICATION_SOURCE } from '@/types/professional-identity';

const APP: IfcAuthoringApplication = {
  developer: 'Nestor',
  version: '1.0',
  fullName: 'Nestor BIM',
  identifier: 'NestorBIM',
};
const STAMP = 1_756_000_000;

const ARCHITECT_URI = 'http://data.europa.eu/esco/occupation/aaaa-1111';
const LAWYER_URI = 'http://data.europa.eu/esco/occupation/bbbb-2222';

const ARCHITECT: DeclaredOccupation = {
  profession: 'Αρχιτέκτονας',
  escoLabel: 'αρχιτέκτονας κτιρίων',
  escoUri: ARCHITECT_URI,
  iscoCode: '2161',
};
/** Δικηγόρος: **ταξινομημένος**, αλλά το `IfcRoleEnum` δεν έχει τιμή γι' αυτόν. */
const LAWYER: DeclaredOccupation = {
  profession: 'Δικηγόρος',
  escoLabel: 'δικηγόρος',
  escoUri: LAWYER_URI,
  iscoCode: '2611',
};

function build(occupation?: DeclaredOccupation | null) {
  const graph = new IfcGraph();
  const outcome = appendIfcAuthorship(graph, {
    application: APP,
    occupation,
    creationTimestamp: STAMP,
  });
  return { graph, outcome, records: graph.records() };
}

const of = (records: readonly IfcEntityRecord[], type: string): IfcEntityRecord[] =>
  records.filter((r) => r.type === type);

const one = (records: readonly IfcEntityRecord[], type: string): IfcEntityRecord => {
  const found = of(records, type);
  if (found.length !== 1) throw new Error(`Περίμενα ΑΚΡΙΒΩΣ ένα ${type}, βρήκα ${found.length}`);
  return found[0];
};

const text = (graph: IfcGraph): string => new TextDecoder().decode(writeStepIfc(graph));

// =============================================================================
describe('Δ — τι μπαίνει στον γράφο, και τι ΔΕΝ μπαίνει', () => {
  it('Δ1 🔴 Ο ΦΡΟΥΡΟΣ GDPR: το IfcPerson ΔΕΝ έχει ΠΟΤΕ όνομα — σε καμία κατάσταση', () => {
    for (const occupation of [undefined, null, ARCHITECT, LAWYER, { profession: 'Μηχανικός' }]) {
      const { records } = build(occupation);
      const person = one(records, 'IFCPERSON');
      // 2 FamilyName · 3 GivenName · 4 MiddleNames · 5 PrefixTitles · 6 SuffixTitles
      expect(person.args.slice(1, 6)).toEqual([null, null, null, null, null]);
    }
  });

  it('Δ2: το Identification είναι ΣΤΑΘΕΡΟ — ίδιο σε κάθε αρχείο, άρα μηδενικής διάκρισης', () => {
    const a = one(build(ARCHITECT).records, 'IFCPERSON').args[0];
    const b = one(build(LAWYER).records, 'IFCPERSON').args[0];
    const c = one(build(null).records, 'IFCPERSON').args[0];
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a).toEqual({ kind: 'label', value: expect.any(String) });
  });

  it('Δ3: `enumerated` ⇒ IFCACTORROLE με την τιμή του προτύπου, χωρίς UserDefinedRole', () => {
    const { records, outcome } = build(ARCHITECT);
    expect(outcome.verdict.kind).toBe('enumerated');
    const role = one(records, 'IFCACTORROLE');
    expect(role.args[0]).toEqual({ kind: 'enum', value: 'ARCHITECT' });
    expect(role.args[1]).toBeNull(); // WR1: δεν χρειάζεται όταν δεν είναι USERDEFINED
    expect(role.args[2]).toEqual({ kind: 'label', value: 'ISCO-08 2161' });
  });

  it('Δ4: `user-defined` ⇒ USERDEFINED με ΜΗ ΚΕΝΟ UserDefinedRole (WR1 του προτύπου)', () => {
    const { records, outcome } = build(LAWYER);
    expect(outcome.verdict.kind).toBe('user-defined');
    const role = one(records, 'IFCACTORROLE');
    expect(role.args[0]).toEqual({ kind: 'enum', value: 'USERDEFINED' });
    expect(role.args[1]).toEqual({ kind: 'label', value: 'δικηγόρος' });
  });

  it('Δ5: `absent` και `unclassified` ⇒ ΚΑΝΕΝΑΣ ρόλος και ΚΑΜΙΑ ταξινόμηση', () => {
    for (const occupation of [undefined, null, { profession: 'Μηχανικός' }]) {
      const { records, outcome } = build(occupation);
      expect(['absent', 'unclassified']).toContain(outcome.verdict.kind);
      expect(of(records, 'IFCACTORROLE')).toHaveLength(0);
      expect(of(records, 'IFCCLASSIFICATIONREFERENCE')).toHaveLength(0);
      expect(of(records, 'IFCEXTERNALREFERENCERELATIONSHIP')).toHaveLength(0);
      expect(one(records, 'IFCPERSON').args[6]).toBeNull(); // Roles
    }
  });

  it('Δ6: το OwnerHistory ικανοποιεί το WHERE CorrectChangeAction και φέρει CreationDate', () => {
    const { records, outcome } = build(ARCHITECT);
    const history = one(records, 'IFCOWNERHISTORY');
    expect(history.id).toBe(outcome.ownerHistoryId);
    // 3 State · 4 ChangeAction · 5 LastModifiedDate · 6 LastModifyingUser · 7 LastModifyingApplication
    expect(history.args.slice(2, 7)).toEqual([null, null, null, null, null]);
    expect(history.args[7]).toEqual({ kind: 'integer', value: STAMP });
  });

  it('Δ7: η ταξινομία δηλώνεται από το SSoT, ΟΧΙ σκληρά μέσα στον εξαγωγέα', () => {
    const { records } = build(ARCHITECT);
    const classification = one(records, 'IFCCLASSIFICATION');
    expect(classification.args[0]).toEqual({ kind: 'label', value: ESCO_CLASSIFICATION_SOURCE.publisher });
    expect(classification.args[1]).toEqual({ kind: 'label', value: ESCO_CLASSIFICATION_SOURCE.edition });
    expect(classification.args[3]).toEqual({ kind: 'label', value: ESCO_CLASSIFICATION_SOURCE.name });
    expect(classification.args[5]).toEqual({ kind: 'label', value: ESCO_CLASSIFICATION_SOURCE.location });
  });
});

// =============================================================================
describe('Ε — η αλυσίδα είναι ΚΛΕΙΣΤΗ («και τα δύο κανάλια, ΠΑΝΤΑ»)', () => {
  it('Ε1 🔑 Ο ΔΟΜΙΚΟΣ ΚΑΝΟΝΑΣ: όπου υπάρχει ρόλος, υπάρχει ταξινόμηση που τον ΔΕΙΧΝΕΙ', () => {
    for (const occupation of [ARCHITECT, LAWYER, undefined, null, { profession: 'Χ' }]) {
      const { records } = build(occupation);
      const roles = of(records, 'IFCACTORROLE');
      const links = of(records, 'IFCEXTERNALREFERENCERELATIONSHIP');
      expect(links).toHaveLength(roles.length); // ΚΑΙ ΤΑ ΔΥΟ, ή ΚΑΝΕΝΑ

      for (const link of links) {
        // 4 RelatedResourceObjects : SET[1:?] — πρέπει να δείχνει στον ρόλο
        expect(link.args[3]).toEqual([{ kind: 'ref', id: roles[0].id }]);
        // 3 RelatingReference → IfcClassificationReference
        expect(link.args[2]).toEqual({ kind: 'ref', id: one(records, 'IFCCLASSIFICATIONREFERENCE').id });
      }
    }
  });

  it('Ε2: ο ρόλος είναι δεμένος στο IfcPerson.Roles — το ΚΑΝΑΛΙ 1 φτάνει στον άνθρωπο', () => {
    const { records } = build(ARCHITECT);
    const role = one(records, 'IFCACTORROLE');
    expect(one(records, 'IFCPERSON').args[6]).toEqual([{ kind: 'ref', id: role.id }]);
  });

  it('Ε3: το ΚΑΝΑΛΙ 2 κουβαλά URI + κωδικό + ετικέτα, ακέραια', () => {
    const { records } = build(ARCHITECT);
    const reference = one(records, 'IFCCLASSIFICATIONREFERENCE');
    expect(reference.args[0]).toEqual({ kind: 'label', value: ARCHITECT_URI }); // Location
    expect(reference.args[1]).toEqual({ kind: 'label', value: '2161' }); // Identification
    expect(reference.args[2]).toEqual({ kind: 'label', value: 'αρχιτέκτονας κτιρίων' }); // Name
    expect(reference.args[3]).toEqual({ kind: 'ref', id: one(records, 'IFCCLASSIFICATION').id });
  });

  it('Ε4 🔑 ΠΑΡΟΝΟΜΑΣΤΗΣ: ακόμη κι όταν ο ρόλος είναι USERDEFINED, το URI ταξιδεύει ΑΚΕΡΑΙΟ', () => {
    // Αυτό είναι ολόκληρη η υπόσχεση του ADR-798 §6.2: η λειψή προβολή ΔΕΝ
    // κοστίζει πληροφορία, γιατί το δεύτερο κανάλι δεν λείπει ποτέ.
    const { records } = build(LAWYER);
    expect(one(records, 'IFCCLASSIFICATIONREFERENCE').args[0]).toEqual({
      kind: 'label',
      value: LAWYER_URI,
    });
  });
});

// =============================================================================
describe('Ζ — round-trip STEP21: επιβιώνει το ελληνικό κείμενο στο ΑΡΧΕΙΟ;', () => {
  it('Ζ1 🔴 Το ελληνικό `escoLabel` βγαίνει με ISO 10303-21 escaping, ΟΧΙ ωμό', () => {
    const spf = text(build(LAWYER).graph);
    // 'δικηγόρος' → \X2\03B403B903BA03B703B303CC03C103BF03C2\X0\
    expect(spf).toContain('\\X2\\');
    expect(spf).toContain('\\X0\\');
    expect(spf).not.toContain('δικηγόρος'); // ωμό ελληνικό ⇒ ΑΚΥΡΟ IFC
  });

  it('Ζ2: το URI βγαίνει ΑΥΤΟΥΣΙΟ — είναι ASCII, δεν χρειάζεται escaping', () => {
    expect(text(build(ARCHITECT).graph)).toContain(`'${ARCHITECT_URI}'`);
  });

  it('Ζ3: οι γραμμές που μας αφορούν υπάρχουν στο ΑΡΧΕΙΟ, όχι μόνο στον γράφο', () => {
    const spf = text(build(ARCHITECT).graph);
    expect(spf).toContain('=IFCACTORROLE(.ARCHITECT.');
    expect(spf).toContain('=IFCEXTERNALREFERENCERELATIONSHIP(');
    expect(spf).toContain('=IFCOWNERHISTORY(');
    expect(spf).toMatch(/=IFCPERSON\('[^']+',\$,\$,\$,\$,\$,\(#\d+\),\$\);/);
  });

  it('Ζ4: απόστροφος σε ετικέτα διπλασιάζεται — δεν σπάει το αρχείο', () => {
    const spf = text(
      build({ escoUri: ARCHITECT_URI, escoLabel: "O'Brien architecte", iscoCode: '2161' }).graph,
    );
    expect(spf).toContain("O''Brien architecte");
  });
});
