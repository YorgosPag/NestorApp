// ADR-650 M8α — Point-cloud ingest Web Worker (mirrors `workers/dxf-parser.worker.ts`, ADR-639
// Στάδιο 1). Off the main thread: reading a 250 MB LAS + CSF over 30M points would otherwise
// freeze the tab for minutes.
//
// The pipeline is loaded via a DYNAMIC import INSIDE the handler, not a static top-level import
// — same reason as the DXF worker: if any module in the read/classify/decimate/preview chain
// ever grows an import that fails to execute in the Worker module scope (a store hook, a
// three.js/React dependency — see ADR-650 M8α task brief's "never TopoPointStore in the worker"
// warning), a STATIC top-level import would fail the whole module load, `worker-ready` would
// never post, and the main thread would dead-wait instead of falling back fast. With the dynamic
// import, that failure surfaces as a normal CATCHABLE `error` response instead.
import type {
  PointCloudPipelineOptions,
} from '../systems/topography/pointcloud/pointcloud-pipeline';
import type {
  PointCloudWorkerRequest,
  PointCloudWorkerResponse,
} from '../systems/topography/pointcloud/pointcloud-types';

/** i18n KEY (N.11) — fallback for a throw that did NOT already carry a `topography.pointcloud.*`
 *  key (e.g. an unexpected bug), so the UI never renders a raw JS error message. */
const ERROR_UNEXPECTED = 'topography.pointcloud.error.unexpected';
const POINTCLOUD_KEY_PREFIX = 'topography.pointcloud.';

type ReadRequest = Extract<PointCloudWorkerRequest, { type: 'read-and-classify' }>;

async function runPipeline(req: ReadRequest, post: (msg: PointCloudWorkerResponse) => void): Promise<void> {
  const { runPointCloudPipeline } = await import('../systems/topography/pointcloud/pointcloud-pipeline');
  const opts: PointCloudPipelineOptions = {
    read: req.read,
    csf: req.csf,
    decimate: req.decimate,
    forceCsf: req.forceCsf,
  };
  const result = await runPointCloudPipeline(req.buffer, req.fileName, opts, (stageKey, ratio) => {
    post({ type: 'progress', requestId: req.requestId, stageKey, ratio });
  });
  post({ type: 'done', requestId: req.requestId, result });
}

/** Every stage of the pipeline already throws `Error`s whose `message` is an i18n key
 *  (`POINTCLOUD_MSG`, `VOXEL_ERROR_*`) — forward it as-is. Anything else (a genuine bug) falls
 *  back to `ERROR_UNEXPECTED` rather than leaking a raw, untranslated message into the UI. */
function toErrorKey(error: unknown): string {
  if (error instanceof Error && error.message.startsWith(POINTCLOUD_KEY_PREFIX)) {
    return error.message;
  }
  return ERROR_UNEXPECTED;
}

self.onmessage = async (event: MessageEvent<PointCloudWorkerRequest>) => {
  const req = event.data;
  const post = (msg: PointCloudWorkerResponse) => self.postMessage(msg);
  if (!req || req.type !== 'read-and-classify') return; // no requestId to reply on — ignore

  try {
    await runPipeline(req, post);
  } catch (error) {
    post({
      type: 'error',
      requestId: req.requestId,
      errorKey: toErrorKey(error),
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};

self.onerror = (error) => {
  const ev = error as Partial<ErrorEvent>;
  console.error('❌ Point-cloud worker: global error:', {
    message: ev.message,
    filename: ev.filename,
    lineno: ev.lineno,
  });
};

// ADR-639 Στάδιο 1 pattern — LIVENESS handshake. Runs only if this module (type-only imports at
// top level) loaded without throwing; the main thread's readiness probe treats silence as a
// failed load and falls back fast instead of dead-waiting.
self.postMessage({ type: 'worker-ready' } satisfies PointCloudWorkerResponse);
