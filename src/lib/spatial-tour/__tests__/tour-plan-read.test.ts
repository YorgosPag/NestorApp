/**
 * @fileoverview **Η ΚΑΤΟΨΗ ΣΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΚΑΙ ΣΤΟ ΜΑΝΙΦΕΣΤΟ** (ADR-884 Φ2στ-β · §4.13).
 *
 * - **Α** — ανάγνωση: εικόνα/κλίμακα απούσες ⇒ παλιό έγγραφο αμετάβλητο· παρούσες αλλά χαλασμένες ⇒ η περιήγηση `null`
 *   (κανένα σιωπηλό πέταγμα)· `headingSource` άγνωστο ⇒ η λήψη `null`.
 * - **Μ** — μανιφέστο: η ενεργή κάτοψη ταξιδεύει **χωρίς** `approvedBy`· πηγαινέλα προς τον γράφο της οθόνης κρατά ό,τι
 *   ρωτούν οι καθαρές (εικόνα · κλίμακα · αρχείο · πηγή)· ο χάρτης της στήλης εμφανίζεται με εικόνα ακόμη και χωρίς θέσεις.
 */

import { CAPTURE_DOC, TOUR_DOC } from './spatial-tour-fixtures';
import { spatialTourFromDocument, tourCaptureFromDocument } from '../spatial-tour-from-document';
import { buildViewerGraph, graphLevelsOfViewer, viewerLevelsOf } from '../viewer/tour-viewer-graph';
import type { TourManifestStop } from '../tour-manifest-stop';
import type { TourLevel } from '@/types/spatial-tour';

const L0 = { kind: 'local', ordinal: 0 } as const;
const IMAGE = { width: 1000, height: 500, contentHash: 'h1' };
const SCALE = { metresPerPixel: 0.02, calibratedBy: 'boris', calibratedAt: '2026-09-27T10:00:00.000Z' };
const PLAN = { source: 'engineer', state: 'active', fileId: 'f1', approvedBy: 'boris', approvedAt: '2026-09-27T10:00:00.000Z' };

const withLevels = (floorPlans: readonly unknown[]) => ({ ...TOUR_DOC, levels: [{ key: L0, floorPlans }], nodes: [] });

describe('Α — ανάγνωση', () => {
  it('κάτοψη με εικόνα και κλίμακα διαβάζεται ολόκληρη', () => {
    const tour = spatialTourFromDocument(withLevels([{ ...PLAN, image: IMAGE, scale: SCALE }]), 'stour_1');
    expect(tour?.levels[0].floorPlans[0]).toMatchObject({ image: IMAGE, scale: SCALE });
  });

  it('χωρίς εικόνα/κλίμακα (έγγραφο πριν τη Φ2στ-β) ⇒ ίδια όπως πριν, χωρίς τα πεδία', () => {
    const plan = spatialTourFromDocument(withLevels([PLAN]), 'stour_1')?.levels[0].floorPlans[0];
    expect(plan).toBeDefined();
    expect(plan && 'image' in plan).toBe(false);
    expect(plan && 'scale' in plan).toBe(false);
  });

  it.each([
    ['εικόνα χωρίς hash', { image: { width: 10, height: 10 } }],
    ['εικόνα με μηδενικό πλάτος', { image: { ...IMAGE, width: 0 } }],
    ['κλίμακα αρνητική', { scale: { ...SCALE, metresPerPixel: -1 } }],
    ['κλίμακα χωρίς «ποιος»', { scale: { metresPerPixel: 0.02, calibratedAt: SCALE.calibratedAt } }],
  ])('%s ⇒ ολόκληρη η περιήγηση null', (_why, broken) => {
    expect(spatialTourFromDocument(withLevels([{ ...PLAN, ...broken }]), 'stour_1')).toBeNull();
  });

  it('headingSource: απούσα ⇒ καμία· manual ⇒ manual· άγνωστη ⇒ η λήψη null', () => {
    expect(tourCaptureFromDocument(CAPTURE_DOC, 'tcap_1')?.headingSource).toBeUndefined();
    expect(tourCaptureFromDocument({ ...CAPTURE_DOC, headingSource: 'manual' }, 'tcap_1')?.headingSource).toBe('manual');
    expect(tourCaptureFromDocument({ ...CAPTURE_DOC, headingSource: 'compass' }, 'tcap_1')).toBeNull();
  });
});

describe('Μ — μανιφέστο', () => {
  const LEVEL: TourLevel = {
    key: L0,
    floorPlans: [
      { source: 'user-sketch', state: 'superseded', fileId: 'f0', approvedBy: 'boris', approvedAt: '2026-09-01T00:00:00.000Z' },
      { source: 'engineer', state: 'active', fileId: 'f1', approvedBy: 'boris', approvedAt: SCALE.calibratedAt, image: IMAGE, scale: SCALE },
    ],
  };

  it('η ενεργή κάτοψη ταξιδεύει χωρίς «ποιος ενέκρινε»', () => {
    const [level] = viewerLevelsOf([LEVEL]);
    expect(level.plan).toEqual({ fileId: 'f1', source: 'engineer', image: IMAGE, metresPerPixel: 0.02 });
    expect(JSON.stringify(level)).not.toContain('boris');
  });

  it('όροφος χωρίς εικόνα ⇒ plan null', () => {
    const none: TourLevel = { key: L0, floorPlans: [{ source: 'none', state: 'active', fileId: null, approvedBy: null, approvedAt: null }] };
    expect(viewerLevelsOf([none])[0].plan).toBeNull();
  });

  it('πηγαινέλα προς τον γράφο της οθόνης: η ενεργή κάτοψη με εικόνα, κλίμακα, αρχείο και πηγή', () => {
    const [back] = graphLevelsOfViewer(viewerLevelsOf([LEVEL]));
    expect(back.floorPlans).toHaveLength(1);
    expect(back.floorPlans[0]).toMatchObject({ source: 'engineer', state: 'active', fileId: 'f1', image: IMAGE, scale: { metresPerPixel: 0.02 } });
  });

  it('ο χάρτης της στήλης εμφανίζεται με εικόνα κάτοψης ακόμη και χωρίς καμία θέση', () => {
    const stop: TourManifestStop = { captureId: 'c1', nodeId: 'n1', capturedAt: '2026-09-27T00:00:00.000Z', headingRad: 0, tilesetHash: 'h', faceSize: 512 };
    const graph = buildViewerGraph(
      { nodes: [{ id: 'n1', levelKey: L0, position: null, links: [] }], stops: [stop] },
      viewerLevelsOf([LEVEL]),
    );
    expect(graph.levels[0]).toMatchObject({ hasPlan: true, plan: { fileId: 'f1' } });
  });
});
