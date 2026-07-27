/**
 * ADR-344 Φ-3D — «ο καμβάς κρατάει το αρχικό κείμενο» (Giorgio 2026-07-28).
 *
 * Το `textNode` (AST) είναι το **canonical**: εκεί γράφει κάθε text command. Το flat `.text`
 * είναι **παράγωγος καθρέφτης**, που ο import γεμίζει μία φορά και μετά κανείς δεν ξαναγγίζει.
 *
 * Ο `projectSceneTextToDxf` — από τον οποίο περνά ΟΛΟΚΛΗΡΟ το render pipeline, 2D και 3D —
 * διάβαζε `e.text ?? extractFlatText(e.textNode)`, δηλαδή **ο καθρέφτης νικούσε το canonical**.
 * Αποτέλεσμα: κάθε εισαγμένο TEXT/MTEXT (που έχει flat `.text` από τον import) αποδιδόταν με
 * το ΠΡΟ-ΕΠΕΞΕΡΓΑΣΙΑΣ κείμενο, ενώ το AST ήταν σωστό. Η επεξεργασία «δεν έπιανε», χωρίς
 * κανένα σφάλμα πουθενά.
 *
 * ⚠️ Αν κάποιος γυρίσει τη σειρά σε «flat πρώτο» για οποιονδήποτε λόγο, αυτή η σουίτα κοκκινίζει.
 * Μην τη «διορθώσεις» αλλάζοντας την προσδοκία — είναι το bug, όχι το test.
 */

import { projectSceneTextToDxf, type TextSceneShape } from '../project-scene-text';
import type { DxfTextNode } from '../../../text-engine/types';

/** Ελάχιστο AST ενός μονόγραμμου κειμένου. */
function nodeWith(text: string): DxfTextNode {
  return {
    paragraphs: [{
      runs: [{ text, style: { height: 2.5 } }],
      indent: 0, leftMargin: 0, rightMargin: 0, tabs: [],
      justification: 0, lineSpacingMode: 'multiple', lineSpacingFactor: 1,
    }],
    attachment: 'TL',
    lineSpacing: { mode: 'multiple', factor: 1 },
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  } as unknown as DxfTextNode;
}

function sceneText(overrides: Partial<TextSceneShape>): TextSceneShape {
  return { type: 'text', position: { x: 0, y: 0 }, height: 2.5, ...overrides };
}

describe('projectSceneTextToDxf — το AST νικά τον καθρέφτη', () => {
  it('⚠️ μετά από επεξεργασία, αποδίδεται το ΝΕΟ κείμενο του AST — όχι το μπαγιάτικο flat', () => {
    const projected = projectSceneTextToDxf(
      sceneText({ text: 'ΑΡΧΙΚΟ', textNode: nodeWith('ΔΙΟΡΘΩΜΕΝΟ') }),
      't1',
    );
    expect(projected.text).toBe('ΔΙΟΡΘΩΜΕΝΟ');
  });

  it('σβήσιμο ΟΛΟΥ του κειμένου δίνει κενό — ο καθρέφτης δεν «επαναφέρει» το παλιό', () => {
    const projected = projectSceneTextToDxf(
      sceneText({ text: 'ΑΡΧΙΚΟ', textNode: nodeWith('') }),
      't1',
    );
    expect(projected.text).toBe('');
  });

  it('legacy οντότητα ΧΩΡΙΣ AST εξακολουθεί να αποδίδεται από το flat πεδίο', () => {
    const projected = projectSceneTextToDxf(sceneText({ text: 'LEGACY' }), 't1');
    expect(projected.text).toBe('LEGACY');
  });

  it('χωρίς AST και χωρίς flat → κενό, ποτέ undefined', () => {
    expect(projectSceneTextToDxf(sceneText({}), 't1').text).toBe('');
  });

  /**
   * Κάποια μονοπάτια (ghost preview / grip fixtures) φτιάχνουν textNode **μόνο** για να
   * δηλώσουν στοίχιση: `{ attachment: 'BR' }`, χωρίς `paragraphs`. Αυτό λέει «δεν ξέρω το
   * κείμενο», ΟΧΙ «κενό κείμενο» — άρα το flat πεδίο εξακολουθεί να απαντά.
   */
  it('ημιτελές AST (μόνο attachment, χωρίς paragraphs) → πέφτει στο flat, δεν σκάει', () => {
    const partial = { attachment: 'BR' } as unknown as DxfTextNode;
    const projected = projectSceneTextToDxf(
      sceneText({ text: 'ΜΕ ΣΤΟΙΧΙΣΗ', textNode: partial }),
      't1',
    );
    expect(projected.text).toBe('ΜΕ ΣΤΟΙΧΙΣΗ');
  });

  it('πολυγραμμικό AST (MTEXT) ενώνεται με \\n', () => {
    const node = nodeWith('ΓΡΑΜΜΗ Α');
    const multi = {
      ...node,
      paragraphs: [node.paragraphs[0], { ...node.paragraphs[0], runs: [{ text: 'ΓΡΑΜΜΗ Β', style: { height: 2.5 } }] }],
    } as unknown as DxfTextNode;
    const projected = projectSceneTextToDxf(sceneText({ text: 'ΠΑΛΙΟ', textNode: multi }), 'm1');
    expect(projected.text).toBe('ΓΡΑΜΜΗ Α\nΓΡΑΜΜΗ Β');
  });
});
