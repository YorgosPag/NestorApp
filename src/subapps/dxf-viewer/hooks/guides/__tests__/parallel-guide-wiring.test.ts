/**
 * ΦΡΟΥΡΟΣ ΚΑΛΩΔΙΩΣΗΣ — «ο handler υπάρχει» ≠ «ο handler εκτελείται»
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ (περιστατικό 2026-07-18):
 * Το commit-με-δεύτερο-κλικ υλοποιήθηκε πλήρως — τύπος, κλάδος στον click handler,
 * handler στο workflow, 102 πράσινα tests — και ήταν **νεκρό στην εφαρμογή**, επειδή
 * κανείς δεν πέρασε το callback στο `CanvasSection.tsx`. Η κλήση είναι optional
 * (`p.onParallelDistanceCommitted?.(...)`), οπότε γινόταν σιωπηλά no-op και το κλικ
 * καταναλωνόταν — ΑΚΡΙΒΩΣ η προηγούμενη συμπεριφορά. Κανένα test δεν κοκκίνισε, γιατί
 * όλα καλούσαν τον handler ΑΠΕΥΘΕΙΑΣ, παρακάμπτοντας τη σύνδεση.
 *
 * ΤΟ ΜΑΘΗΜΑ: όταν ένα callback είναι προαιρετικό, η ΑΠΟΥΣΙΑ του δεν σπάει τίποτα —
 * απλώς ακυρώνει το χαρακτηριστικό. Χρειάζεται ρητός φρουρός στο σημείο σύνδεσης.
 *
 * @see ADR-189 §3.13
 */
import fs from 'fs';
import path from 'path';

const readSource = (relativePath: string): string =>
  fs.readFileSync(path.join(__dirname, relativePath), 'utf8');

describe('καλωδίωση ροής «Παράλληλος Οδηγός» — τα callbacks φτάνουν στον orchestrator', () => {
  it('το CanvasSection περνά το onParallelDistanceCommitted στα click-handler params', () => {
    const src = readSource('../../../components/dxf-layout/CanvasSection.tsx');

    expect(src).toMatch(/onParallelDistanceCommitted:\s*guideWorkflows\.handleParallelDistanceCommitted/);
  });

  it('το CanvasSection εξακολουθεί να περνά το onParallelRefSelected (μη-παλινδρόμηση 1ου κλικ)', () => {
    const src = readSource('../../../components/dxf-layout/CanvasSection.tsx');

    expect(src).toMatch(/onParallelRefSelected:\s*guideWorkflows\.handleParallelRefSelected/);
  });

  it('το useGuideWorkflowHandlers εξάγει και τους δύο handlers της ροής', () => {
    const src = readSource('../useGuideWorkflowHandlers.ts');
    const returnBlock = src.slice(src.lastIndexOf('return {'));

    expect(returnBlock).toContain('handleParallelRefSelected');
    expect(returnBlock).toContain('handleParallelDistanceCommitted');
  });

  it('ο click handler καλεί το callback του commit όταν υπάρχει ήδη οδηγός αναφοράς', () => {
    const src = readSource('../../canvas/guide-click-handlers.ts');

    expect(src).toContain('onParallelDistanceCommitted');
  });
});

describe('ένας κέρσορας, πέντε αναγνώστες — κανείς δεν διαβάζει ωμά', () => {
  /**
   * Τα πέντε σημεία που ΠΡΕΠΕΙ να περνούν από το `resolveParallelCursor`: η διακεκομμένη,
   * το λευκό HUD (και τα δύο στο preview hook), το φάντασμα-οδηγός, το Enter και το κλικ.
   * Το φάντασμα ξεχάστηκε στην πρώτη υλοποίηση και ζωγραφιζόταν με ΟΡΘΟ/ΒΗΜΑ αγνοημένα,
   * δείχνοντας άλλη θέση από τη διακεκομμένη μέσα στο ΙΔΙΟ frame.
   */
  it.each([
    ['φάντασμα-οδηγός', '../useGuideWorkflowComputed.ts'],
    ['Enter + κλικ', '../useGuideWorkflowHandlers.ts'],
    ['διακεκομμένη + HUD', '../../tools/useParallelGuideAnchorPreview.ts'],
  ])('%s περνά από το resolveParallelCursor', (_label, relativePath) => {
    expect(readSource(relativePath)).toContain('resolveParallelCursor');
  });

  it('το commit-με-κλικ ΔΕΝ κβαντίζει το OSNAP-σημείο του κλικ', () => {
    const src = readSource('../useGuideWorkflowHandlers.ts');
    const handler = src.slice(src.indexOf('handleParallelDistanceCommitted'));

    // Το `mouse-handler-up` εφαρμόζει OSNAP στο worldPoint πριν φτάσει εδώ· η ζωγραφική
    // και ο resolver του Enter διαβάζουν τον ωμό κέρσορα. Πρέπει να διαβάζει τον ίδιο.
    expect(handler).toMatch(/getRealtimeWorldCursor\(\)\s*\?\?\s*worldPoint/);
  });
});
