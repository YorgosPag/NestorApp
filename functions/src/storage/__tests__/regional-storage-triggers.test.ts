/**
 * ADR-895 Α7 · Ε5 · Φ2 — τα gen2 bindings του κάδου ΕΕ.
 *
 * Ελέγχεται το **εξαγόμενο trigger metadata** (`__endpoint`, αυτό που διαβάζει το Firebase CLI στο deploy)
 * του **πραγματικού** `firebase-functions/v2` — όχι σχόλιο, όχι mock της βιβλιοθήκης. Mock μόνο τα σώματα
 * (ελέγχονται στις δικές τους σουίτες) και το Admin SDK (project id + κανονικός κάδος).
 */

const PROJECT = 'proj-x';

const markSpy = jest.fn().mockResolvedValue(undefined);
const dxfSpy = jest.fn().mockResolvedValue(undefined);
const dimensionsSpy = jest.fn().mockResolvedValue(undefined);

jest.mock('../orphan-cleanup', () => ({ markOrphanCandidateOnFinalize: (o: unknown) => markSpy(o) }));
jest.mock('../dxf-thumbnail-onfinalize', () => ({ generateDxfThumbnailOnFinalize: (o: unknown) => dxfSpy(o) }));
jest.mock('../image-dimensions-onfinalize', () => ({ recordImageDimensionsOnFinalize: (o: unknown) => dimensionsSpy(o) }));
jest.mock('firebase-admin', () => ({
  app: () => ({ options: { projectId: 'proj-x' } }),
  storage: () => ({ bucket: () => ({ name: 'proj-x.appspot.com' }) }),
}));

import { readFileSync } from 'fs';
import { join } from 'path';
import { Expression } from 'firebase-functions/params';

import {
  REGIONAL_FINALIZE_TRIGGERS,
  REGIONAL_TRIGGER_BUCKETS,
  onDxfProcessedFinalizeFilesEu,
  onImageDimensionsFinalizeFilesEu,
  onStorageFinalizeFilesEu,
} from '../regional-storage-triggers';
import { FINALIZE_HANDLER_IDS, FINALIZE_RUNTIME } from '../finalize-runtime';
import { fileStorageBucketNames } from '../file-record-bucket';

interface Endpoint {
  platform: string;
  region: string[];
  availableMemoryMb: number;
  timeoutSeconds: number;
  concurrency?: unknown;
  eventTrigger: { eventType: string; retry: boolean; eventFilters: { bucket: unknown } };
}
const endpointOf = (fn: unknown): Endpoint => (fn as { __endpoint: Endpoint }).__endpoint;

/** Η επίλυση που κάνει το CLI στο deploy για το ενσωματωμένο `projectID` (build.js → resolveString). */
function resolveOnDeploy(cel: string): string {
  return cel.replace('{{ params.PROJECT_ID }}', PROJECT);
}

beforeAll(() => {
  delete process.env.GCS_FILES_EU_BUCKET;
});
beforeEach(() => jest.clearAllMocks());

const PAIRS = (Object.keys(REGIONAL_TRIGGER_BUCKETS) as Array<keyof typeof REGIONAL_TRIGGER_BUCKETS>).flatMap(
  (bucketId) => FINALIZE_HANDLER_IDS.map((handlerId) => [bucketId, handlerId] as const),
);

describe('πληρότητα — κάθε handler έχει binding σε κάθε περιφερειακό κάδο', () => {
  it.each(PAIRS)('%s × %s υπάρχει', (bucketId, handlerId) => {
    expect(REGIONAL_FINALIZE_TRIGGERS[bucketId][handlerId]).toBeDefined();
  });

  it('τα ονομαστικά exports ΕΙΝΑΙ οι εγγραφές του καταλόγου (όχι δεύτερο binding)', () => {
    expect(onStorageFinalizeFilesEu).toBe(REGIONAL_FINALIZE_TRIGGERS['files-eu'].orphanMarker);
    expect(onDxfProcessedFinalizeFilesEu).toBe(REGIONAL_FINALIZE_TRIGGERS['files-eu'].dxfThumbnail);
    expect(onImageDimensionsFinalizeFilesEu).toBe(REGIONAL_FINALIZE_TRIGGERS['files-eu'].imageDimensions);
  });

  it('το `index.ts` τα εξάγει (αλλιώς το Firebase δεν τα ανακαλύπτει ποτέ)', () => {
    const index = readFileSync(join(__dirname, '..', '..', 'index.ts'), 'utf8');
    expect(index).toMatch(
      /export\s*\{\s*onStorageFinalizeFilesEu\s*,\s*onDxfProcessedFinalizeFilesEu\s*,\s*onImageDimensionsFinalizeFilesEu\s*,?\s*\}\s*from\s*'\.\/storage\/regional-storage-triggers'/,
    );
    expect(index).toMatch(/export\s*\{\s*onImageDimensionsFinalize\s*\}\s*from\s*'\.\/storage\/image-dimensions-onfinalize'/);
  });
});

describe('trigger metadata — αυτό που βλέπει το deploy', () => {
  it.each(PAIRS)('%s × %s: gen2 · περιοχή του κάδου · finalized · χωρίς retry', (bucketId, handlerId) => {
    const ep = endpointOf(REGIONAL_FINALIZE_TRIGGERS[bucketId][handlerId]);
    expect(ep.platform).toBe('gcfv2');
    expect(ep.region).toEqual([REGIONAL_TRIGGER_BUCKETS[bucketId].region]);
    expect(ep.eventTrigger.eventType).toBe('google.cloud.storage.object.v1.finalized');
    expect(ep.eventTrigger.retry).toBe(false);
  });

  it.each(PAIRS)('%s × %s: μνήμη/timeout/concurrency = FINALIZE_RUNTIME (ίδια πηγή με το gen1)', (bucketId, handlerId) => {
    const ep = endpointOf(REGIONAL_FINALIZE_TRIGGERS[bucketId][handlerId]);
    const runtime = FINALIZE_RUNTIME[handlerId];
    expect(ep.availableMemoryMb).toBe(runtime.memoryMiB);
    expect(ep.timeoutSeconds).toBe(runtime.timeoutSeconds);
    // Απόν στο runtime ⇒ `ResetValue` στο endpoint, που στο wire γίνεται `null` = προεπιλογή πλατφόρμας.
    expect(JSON.parse(JSON.stringify(ep.concurrency ?? null))).toBe(runtime.concurrency ?? null);
  });

  it('🔴 Ε5: ο κάδος ΕΕ ακούγεται από το `europe-west3` — ποτέ ΗΠΑ', () => {
    for (const fn of Object.values(REGIONAL_FINALIZE_TRIGGERS['files-eu'])) {
      expect(endpointOf(fn).region).toEqual(['europe-west3']);
    }
  });

  it('🔴 DXF: concurrency 1 (80 ραστεροποιήσεις σε 512MiB = OOM)', () => {
    expect(endpointOf(onDxfProcessedFinalizeFilesEu).concurrency).toBe(1);
  });

  it('🔴 κάδος = έκφραση deploy `{project}-files-eu`, ΙΔΙΑ με το όνομα του runtime', () => {
    for (const fn of Object.values(REGIONAL_FINALIZE_TRIGGERS['files-eu'])) {
      const bucket = endpointOf(fn).eventTrigger.eventFilters.bucket;
      expect(bucket).toBeInstanceOf(Expression);
      const cel = (bucket as Expression<string>).toCEL();
      expect(cel).toBe('{{ params.PROJECT_ID }}-files-eu');
      expect(resolveOnDeploy(cel)).toBe(fileStorageBucketNames()['eu-originals']);
    }
  });
});

describe('το binding καλεί το ΚΟΙΝΟ σώμα με το ουδέτερο σχήμα', () => {
  const run = (fn: unknown, data: Record<string, unknown>): Promise<unknown> =>
    (fn as { run: (e: unknown) => Promise<unknown> }).run({ data });

  it('γεγονός ΕΕ ⇒ σώμα με θέση `eu-originals` και size αριθμό', async () => {
    await run(onStorageFinalizeFilesEu, { bucket: `${PROJECT}-files-eu`, name: 'companies/c1/a.jpg', size: 5 });
    expect(markSpy).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: `${PROJECT}-files-eu`, placement: 'eu-originals', size: 5 }),
    );
    expect(dxfSpy).not.toHaveBeenCalled();
  });

  it('DXF binding ⇒ σώμα DXF', async () => {
    await run(onDxfProcessedFinalizeFilesEu, { bucket: `${PROJECT}-files-eu`, name: 'companies/c1/f.dxf.processed.json' });
    expect(dxfSpy).toHaveBeenCalledWith(expect.objectContaining({ placement: 'eu-originals' }));
  });

  it('⛔ αδήλωτος κάδος ⇒ κανένα σώμα', async () => {
    await run(onStorageFinalizeFilesEu, { bucket: 'stranger', name: 'companies/c1/a.jpg' });
    await run(onDxfProcessedFinalizeFilesEu, { bucket: 'stranger', name: 'companies/c1/f.dxf.processed.json' });
    expect(markSpy).not.toHaveBeenCalled();
    expect(dxfSpy).not.toHaveBeenCalled();
  });
});
