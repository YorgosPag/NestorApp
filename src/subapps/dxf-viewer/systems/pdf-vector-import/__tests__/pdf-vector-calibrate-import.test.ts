/**
 * ADR-941 Δ15 — `calibrateAndImportFloorPdfVectors`: μπαγιάτικη κάρτα ⇒ καμία εγγραφή· βαθμονόμηση που δεν σώθηκε ⇒ καμία
 * εισαγωγή· σωσμένη ⇒ η εισαγωγή τρέχει ΜΕΤΑ (πάνω στη νέα τοποθέτηση).
 */

import type { FloorplanBackground } from '../../../floorplan-background/providers/types';
import type { PdfVectorScaleProposal } from '../pdf-vector-scale';

const mockGetFloorBackground = jest.fn();
const mockGetFloorProvider = jest.fn();
const mockCommitCalibration = jest.fn();

jest.mock('../../../floorplan-background/stores/floorplanBackgroundStore', () => ({
  getFloorBackground: (id: string) => mockGetFloorBackground(id),
  getFloorProvider: (id: string) => mockGetFloorProvider(id),
}));
jest.mock('../../../floorplan-background/services/commit-calibration', () => ({
  commitCalibration: (...args: unknown[]) => mockCommitCalibration(...args),
}));

import { calibrateAndImportFloorPdfVectors } from '../pdf-vector-import-commit';

const TRANSFORM = { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const BACKGROUND: Pick<FloorplanBackground, 'id' | 'transform'> = { id: 'bg_1', transform: TRANSFORM };

const PROPOSAL: PdfVectorScaleProposal = {
  kind: 'proposal',
  basis: { backgroundId: 'bg_1', transform: TRANSFORM, sceneUnits: 'mm' },
  references: [{ raw: '2.05', valueMm: 2050, a: { x: 0, y: 0 }, b: { x: 205, y: 0 } }],
  solution: {
    transform: { ...TRANSFORM, scaleX: 10, scaleY: 10 }, mode: 'uniform', anisotropyRel: 0, residualsRel: [0],
    mmPerPixelX: 10, mmPerPixelY: 10,
  },
  needsReview: false,
  replacesMmPerPixel: null,
};

const TARGET = { floorId: 'flr_1', levelId: 'lvl_1', getScene: () => null, setScene: () => undefined };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetFloorBackground.mockReturnValue(BACKGROUND);
  mockGetFloorProvider.mockReturnValue(undefined);
});

describe('calibrateAndImportFloorPdfVectors', () => {
  it('μπαγιάτικη κάρτα (άλλη τοποθέτηση) ⇒ calibration-stale, ούτε βαθμονόμηση ούτε εισαγωγή', async () => {
    mockGetFloorBackground.mockReturnValue({ ...BACKGROUND, transform: { ...TRANSFORM, scaleX: 2 } });
    await expect(calibrateAndImportFloorPdfVectors(TARGET, PROPOSAL, 'undo')).resolves.toEqual({ kind: 'calibration-stale' });
    expect(mockCommitCalibration).not.toHaveBeenCalled();
    expect(mockGetFloorProvider).not.toHaveBeenCalled();
  });

  it.each(['conflict', 'failed'])('βαθμονόμηση %s ⇒ calibration-failed, καμία εισαγωγή', async (status) => {
    mockCommitCalibration.mockResolvedValue({ status, overlaysSkipped: 0 });
    await expect(calibrateAndImportFloorPdfVectors(TARGET, PROPOSAL, 'undo')).resolves.toEqual({ kind: 'calibration-failed' });
    expect(mockGetFloorProvider).not.toHaveBeenCalled();
  });

  it('σωσμένη ⇒ γράφεται η ΙΔΙΑ λύση και ΜΕΤΑ τρέχει η εισαγωγή', async () => {
    mockCommitCalibration.mockResolvedValue({ status: 'saved', overlaysSkipped: 0 });
    const outcome = await calibrateAndImportFloorPdfVectors(TARGET, PROPOSAL, 'undo');
    expect(mockCommitCalibration).toHaveBeenCalledWith('flr_1', PROPOSAL.solution.transform, expect.objectContaining({ origin: 'pdf-vector-dimensions' }));
    expect(mockGetFloorProvider).toHaveBeenCalledWith('flr_1'); // η εισαγωγή ξεκίνησε μετά τη βαθμονόμηση
    expect(outcome).toEqual({ kind: 'not-vector' }); // χωρίς provider στο test
    expect(mockCommitCalibration.mock.invocationCallOrder[0]).toBeLessThan(mockGetFloorProvider.mock.invocationCallOrder[0]);
  });
});
