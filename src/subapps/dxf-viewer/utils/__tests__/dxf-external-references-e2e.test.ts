/**
 * ADR-736 — από άκρη σε άκρη: **αρχείο DXF → σκηνή**, μέσα από τον πραγματικό `DxfSceneBuilder`.
 *
 * Τα προηγούμενα tests ελέγχουν reader και converter **χωριστά**. Αυτό ελέγχει ότι είναι
 * **συνδεδεμένα** — γιατί ένα σωστό εξάρτημα που δεν το καλεί κανείς είναι νεκρός κώδικας, και
 * αυτή ακριβώς η κλάση σφάλματος (δυνατότητα υλοποιημένη αλλά μη συνδεδεμένη στη μία πόρτα
 * εισαγωγής) κόστισε 117 γραμμοσκιάσεις στο ADR-635 Φ C.18.
 *
 * Ο builder είναι ο **κοινός** κόμβος και των δύο πορτών (client import + server wizard), οπότε
 * ό,τι αποδεικνύεται εδώ ισχύει και για τις δύο.
 */

import { DxfSceneBuilder } from '../dxf-scene-builder';
import { isImageEntity } from '../../types/image';
import { summarizeExternalReferences } from '../../types/dxf-external-reference';

/** Ελάχιστο αλλά πλήρες DXF: ένα IMAGEDEF + δύο IMAGE που το δείχνουν (σχέση 1:N). */
const DXF_WITH_TWO_IMAGES_ONE_DEF = [
  '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC',
  '0', 'SECTION', '2', 'OBJECTS',
  '0', 'IMAGEDEF',
  '5', '94E9',
  '1', 'Z:\\Jobs\\OT\\ΕΥΟΣΜΟΣ\\047\\diatagma_1993.JPG',
  '10', '690', '20', '500',
  '11', '1', '21', '1',
  '280', '1',
  '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES',
  '0', 'IMAGE',
  '8', 'ΥΠΟΜΝΗΜΑ',
  '10', '0', '20', '0',
  '11', '1', '21', '0',
  '12', '0', '22', '1',
  '13', '690', '23', '500',
  '340', '94E9',
  '0', 'IMAGE',
  '8', 'ΑΠΟΤ_ΚΤΙΡΙΟ',
  '10', '1000', '20', '1000',
  '11', '1', '21', '0',
  '12', '0', '22', '1',
  '13', '690', '23', '500',
  '340', '94E9',
  '0', 'ENDSEC',
  '0', 'EOF',
].join('\n');

describe('DxfSceneBuilder — τα συνημμένα φτάνουν ΣΤΗ ΣΚΗΝΗ (και οι δύο πόρτες)', () => {
  const build = () => DxfSceneBuilder.buildSceneWithDiagnostics(DXF_WITH_TWO_IMAGES_ONE_DEF);

  it('η σκηνή κουβαλά τη μία αναφορά (1 ορισμός, όχι 2 οντότητες)', () => {
    const { scene } = build();
    expect(scene.externalReferences).toHaveLength(1);
    expect(summarizeExternalReferences(scene.externalReferences ?? []))
      .toEqual({ total: 1, resolved: 0, missing: 1, unsupported: 0 });
    expect(scene.externalReferences?.[0].basename).toBe('diatagma_1993.JPG');
  });

  it('και τα δύο IMAGE έγιναν ImageEntity, δεμένα στην ΙΔΙΑ αναφορά', () => {
    const { scene } = build();
    const images = scene.entities.filter(isImageEntity);
    expect(images).toHaveLength(2);
    expect(images.map((i) => i.externalRefId)).toEqual(['94E9', '94E9']);
    expect(images.every((i) => i.url === '')).toBe(true);
  });

  it('🔴 το IMAGE ΔΕΝ μετριέται πια ως «unsupported entity» — μετριέται ως parsed', () => {
    // Αυτό ΗΤΑΝ το σφάλμα: ο χρήστης έβλεπε «Skipped 10 unsupported entities (IMAGE ×10)».
    // Σωστό πλήθος, λάθος νόημα: δεν είναι άγνωστη οντότητα, είναι 10 συνημμένα που λείπουν.
    const { diagnostics } = build();
    expect(diagnostics.skippedByType.IMAGE).toBeUndefined();
    expect(diagnostics.parsedByType.IMAGE).toBe(2);
  });

  it('σχέδιο ΧΩΡΙΣ συνημμένα δεν αποκτά καθόλου το πεδίο (μηδέν θόρυβος στο blob)', () => {
    const plain = ['0', 'SECTION', '2', 'ENTITIES',
      '0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '10', '21', '10',
      '0', 'ENDSEC', '0', 'EOF'].join('\n');
    const { scene } = DxfSceneBuilder.buildSceneWithDiagnostics(plain);
    expect(scene.externalReferences).toBeUndefined();
  });
});

/**
 * Το **πραγματικό** αρχείο του πελάτη — opt-in, δεν μπαίνει στο git (μόνο ανάγνωση από `F:\`):
 *
 *   DXF_REAL_SAMPLE="F:\…\47_ergasia.dxf" npx jest dxf-external-references-e2e
 */
const realSample = process.env.DXF_REAL_SAMPLE;
const describeReal = realSample ? describe : describe.skip;

describeReal('DxfSceneBuilder — ΠΡΑΓΜΑΤΙΚΟ τοπογραφικό (opt-in)', () => {
  it('10 συνημμένα στη σκηνή + 10 ImageEntity, κανένα IMAGE στα skipped', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    const { scene, diagnostics } = DxfSceneBuilder.buildSceneWithDiagnostics(
      fs.readFileSync(realSample as string, 'utf8'),
    );

    expect(summarizeExternalReferences(scene.externalReferences ?? []))
      .toEqual({ total: 10, resolved: 0, missing: 10, unsupported: 0 });
    expect(scene.entities.filter(isImageEntity)).toHaveLength(10);
    expect(diagnostics.skippedByType.IMAGE).toBeUndefined();

    // Τα layers των υποβάθρων, όπως μετρήθηκαν: ΥΠΟΜΝΗΜΑ ×7, ΑΠΟΤ_ΚΤΙΡΙΟ ×2, ΠΕΡΙΓΡΑΦΗ ×1.
    const byLayer = new Map<string, number>();
    for (const img of scene.entities.filter(isImageEntity)) {
      byLayer.set(img.layerId, (byLayer.get(img.layerId) ?? 0) + 1);
    }
    expect([...byLayer.values()].reduce((a, b) => a + b, 0)).toBe(10);
  });
});
