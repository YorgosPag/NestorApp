/**
 * ADR-344 Φ-3D — ο flat καθρέφτης `.text` δεν επιτρέπεται να μπαγιατέψει.
 *
 * Το `textNode` (AST) είναι το canonical: εκεί γράφει κάθε text command. Το flat `.text`
 * είναι **παράγωγο** — ο import το γεμίζει μία φορά (`dxf-text-converters`) και μετά, μέχρι
 * το 2026-07-28, **κανείς δεν το ξανάγγιζε**. Καταναλωτές που το διαβάζουν απευθείας
 * (export DXF/TEK, clip) έβλεπαν για πάντα το προ-επεξεργασίας κείμενο.
 *
 * Το render path διορθώθηκε χωριστά (διαβάζει πλέον το canonical — δες
 * `bim/text/__tests__/project-scene-text-canonical.test.ts`). Αυτή η σουίτα καρφώνει το
 * **δεύτερο σκέλος** (N.7.2 #4 belt-and-suspenders): ο writer συντηρεί τον καθρέφτη, οπότε
 * ΚΑΘΕ καταναλωτής — υπάρχων ή μελλοντικός — βλέπει την ίδια αλήθεια.
 *
 * ⚠️ Το `undo()` ελέγχεται ρητά: αναίρεση που επαναφέρει το AST αφήνοντας τον καθρέφτη στο
 * νέο κείμενο παράγει το ΙΔΙΟ σφάλμα ανάποδα — και είναι ακόμη πιο δύσκολο να εντοπιστεί.
 */

import { ReplaceTextNodeCommand } from '../ReplaceTextNodeCommand';
import {
  makeNode, makeParagraph, makeRun, makeScene, makeTextEntity,
  makeLayerProvider, makeRecorder,
} from './test-fixtures';

function setup() {
  const entity = makeTextEntity('t1', {
    textNode: makeNode({ paragraphs: [makeParagraph([makeRun('ΑΡΧΙΚΟ')])] }),
    text: 'ΑΡΧΙΚΟ',
  } as never);
  const { scene, store } = makeScene([entity]);
  return {
    scene,
    store,
    services: {
      sceneManager: scene,
      layerProvider: makeLayerProvider(),
      auditRecorder: makeRecorder(),
    },
  };
}

const flatOf = (store: Map<string, unknown>) => (store.get('t1') as { text?: string }).text;

describe('flat `.text` mirror συντηρείται σε κάθε εγγραφή του AST', () => {
  it('το execute γράφει ΚΑΙ το AST ΚΑΙ τον καθρέφτη', () => {
    const { store, services } = setup();
    const next = makeNode({ paragraphs: [makeParagraph([makeRun('ΔΙΟΡΘΩΜΕΝΟ')])] });

    new ReplaceTextNodeCommand(
      { entityId: 't1', nextNode: next },
      services.sceneManager,
      services.layerProvider,
      services.auditRecorder,
    ).execute();

    expect(flatOf(store)).toBe('ΔΙΟΡΘΩΜΕΝΟ');
  });

  it('⚠️ το undo επαναφέρει ΚΑΙ τον καθρέφτη — αλλιώς το σφάλμα γυρίζει ανάποδα', () => {
    const { store, services } = setup();
    const cmd = new ReplaceTextNodeCommand(
      { entityId: 't1', nextNode: makeNode({ paragraphs: [makeParagraph([makeRun('ΔΙΟΡΘΩΜΕΝΟ')])] }) },
      services.sceneManager,
      services.layerProvider,
      services.auditRecorder,
    );

    cmd.execute();
    expect(flatOf(store)).toBe('ΔΙΟΡΘΩΜΕΝΟ');

    cmd.undo();
    expect(flatOf(store)).toBe('ΑΡΧΙΚΟ');
  });

  it('σβήσιμο όλου του κειμένου δίνει κενό καθρέφτη, όχι το παλιό', () => {
    const { store, services } = setup();
    new ReplaceTextNodeCommand(
      { entityId: 't1', nextNode: makeNode({ paragraphs: [makeParagraph([makeRun('')])] }) },
      services.sceneManager,
      services.layerProvider,
      services.auditRecorder,
    ).execute();

    expect(flatOf(store)).toBe('');
  });
});
