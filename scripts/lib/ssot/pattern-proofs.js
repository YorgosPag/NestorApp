/**
 * Golden fixtures for registry-golden-regex.test.js.
 *
 * For each sampled module in .ssot-registry.json:
 *   - shouldMatch: realistic code blob containing TRUE POSITIVES for every
 *     forbiddenPattern of that module. The ratchet regex must fire on at
 *     least one line per pattern.
 *   - shouldSkip: realistic code blob containing KNOWN FALSE-POSITIVE
 *     traps (imports of the SSoT, SSoT API usage, type-union literals,
 *     JSDoc-style comments, etc.). The ratchet regex must NOT fire.
 *
 * Sampling covers one representative per architectural tier:
 *   Core: firestore-collections, enterprise-id, domain-constants,
 *         addDoc-prohibition, intent-badge-utils
 *   Tier 1: tenant-company-id, soft-delete-config, gcs-buckets
 *   Tier 2: openai-provider
 *   Tier 3: intl-formatting, date-local, notification-events
 *   Tier 5: storage-path-construction, entity-creation-manual
 *
 * Pattern SSoT: the regexes live ONLY in .ssot-registry.json. Tests load
 * them from there — never hardcode a pattern in this file.
 */

'use strict';

module.exports = {
  'firestore-collections': {
    shouldMatch: `// Scanner must catch raw literal collection / doc IDs:
db.collection('users');
docRef.doc('abc_xyz');
const ref = db.collection("projects");`,
    shouldSkip: `// Scanner must pass SSoT-routed access:
import { COLLECTIONS } from '@/config/firestore-collections';
db.collection(COLLECTIONS.USERS);
const ref = db.collection(\`\${dynamicName}\`);
docRef.doc(entityId);`,
  },

  // ADR-772 — ο ΕΝΑΣ μετατροπέας διεύθυνσης ↔ διοικητικής ιεραρχίας.
  // Το σήμα είναι ο **ορισμός συνάρτησης**, όχι η κλήση: μια τρίτη εκδοχή του pattern που
  // στόχευε αναθέσεις `<επίπεδο>Name: x.<πεδίο>` πυροδοτούσε σε **τρία νόμιμα** αρχεία που
  // απλώς συγχωνεύουν αποτέλεσμα γεωκωδικοποίησης — απορρίφθηκε πριν μπει (>10% ψευδώς θετικά).
  'administrative-hierarchy-vocabulary': {
    shouldMatch: `// Scanner must catch a NEW private converter pair:
function toHierarchyValue(addr) { return { settlementName: addr.city }; }
function fromHierarchyValue (val) { return { city: val.settlementName }; }
function toHierarchyFromAddr(addr) { return {}; }
function hierarchyToPartial(h, extra) { return {}; }
function hierarchyToResolved(h) { return {}; }
function branchToResolvedFields(addr) { return {}; }
function toResolvedFromAddr(addr) { return {}; }`,
    shouldSkip: `// Scanner must pass SSoT-routed projection:
import { projectAddressVocabulary, storedAddressToResolved } from '@/utils/address/administrative-hierarchy';
const hierarchy = projectAddressVocabulary(addr, 'projectAddress', 'form', { includePostal: true, clearedIdsAsNull: true });
const resolved = storedAddressToResolved(addr, 'companyAddress');
const back = hierarchyToResolvedAddress(hierarchy);`,
  },

  // ADR-777 Α20 — Η ΠΡΟΒΟΛΗ διαθέσεων → `commercialStatus` γίνεται σε ΕΝΑ σημείο.
  // 🔑 Το σήμα είναι ο **ορισμός** (`const x = (…)` / `function`), όχι η κλήση: κάθε
  // καταναλωτής **οφείλει** να καλεί το `deriveCommercialStatus(offers)`, οπότε pattern
  // πάνω στην κλήση θα πυροδοτούσε σε κάθε νόμιμη χρήση. Ομοίως το δεύτερο pattern πιάνει
  // **ανακήρυξη** πίνακα λεξιλογίου, όχι ανάγνωσή του.
  // ⚠️ Ο λόγος που ο φρουρός δεν είναι πολυτέλεια: η προβολή είναι **ρητά lossy** (η
  // αντιπαροχή δεν έχει τιμή στο επτάτιμο λεξιλόγιο), άρα ένα δεύτερο αντίγραφο θα
  // διαφωνούσε **σιωπηλά** ακριβώς εκεί που το πρώτο χάνει πληροφορία.
  'location-provenance': {
    shouldMatch: `// Scanner must catch a SECOND vocabulary / ranking of location provenance:
const locationProvenanceRank = (p) => (p === 'survey' ? 4 : 1);
const placeFactRank = function (s) { return s === 'declared' ? 2 : 1; };
const outranksForLocation = (a, b) => a > b;
const outranksForFact = async (a, b) => a > b;
const locationKnowledgeStep = (p) => (p ? 1 : 0);
const LOCATION_PROVENANCES = ['geocoded', 'manual', 'drawn', 'osm', 'survey', 'bim'];
const LOCATION_PROVENANCE_RANK = { survey: 4, osm: 3 };
const STEP_OF_PROVENANCE = { geocoded: 1, osm: 4 };
const PLACE_FACT_RANK = { declared: 2 };`,
    shouldSkip: `// Scanner must pass SSoT-routed consumption:
import { outranksForLocation, locationKnowledgeStep } from '@/lib/location/location-provenance';
import type { LocationProvenance, PlaceFactSource } from '@/lib/location/location-provenance';
const mayReplace = outranksForLocation(candidate.provenance, current.provenance);
const step = locationKnowledgeStep(positionProvenance(land.position), hasSurveyDocument);
// Type-only declarations must NOT fire — they are not a second ranking:
type LocalProvenance = LocationProvenance;
const rank: number = locationProvenanceRank(provenance);`,
  },

  'property-offer-derivation': {
    shouldMatch: `// Scanner must catch a SECOND implementation of the projection:
const deriveCommercialStatus = (offers) => offers.length ? 'for-sale' : 'unavailable';
const deriveOfferKinds = (offers) => offers.map(o => o.kind);
const hasDuplicateLiveOfferKind = function (offers) { return false; };
const OFFER_KINDS = ['sell', 'leaseOut', 'exchange'];
const OFFER_LIFECYCLES = ['active', 'closed'];
const LIVE_OFFER_LIFECYCLES = ['active'];`,
    shouldSkip: `// Scanner must pass SSoT-routed consumption:
import { deriveCommercialStatus, deriveOfferKinds } from '@/lib/offers/derive-commercial-status';
import { OFFER_KINDS, type OfferKind } from '@/types/property-offers';
payload.commercialStatus = deriveCommercialStatus(offers);
payload.offerKinds = deriveOfferKinds(offers);
if (hasDuplicateLiveOfferKind(offers)) throw new ConflictingLiveOffersError();
const label = OFFER_KINDS.map((kind) => t(\`offerKind.\${kind}\`));`,
  },

  'enterprise-id': {
    shouldMatch: `// Scanner must catch direct crypto.randomUUID usage:
const id = crypto.randomUUID();
export function makeRef() { return crypto.randomUUID(); }`,
    shouldSkip: `// Scanner must pass SSoT-routed ID generation:
import { enterpriseIdService } from '@/services/enterprise-id.service';
const id = enterpriseIdService.generateContactId();`,
  },

  'domain-constants': {
    shouldMatch: `// Scanner must catch hardcoded domain literals:
const m = { senderType: 'customer', body: 'hi' };
let entityType = 'lead';
event.entityType = 'property';`,
    shouldSkip: `// Scanner must pass SSoT-routed enums:
import { SENDER_TYPES, ENTITY_TYPES } from '@/config/domain-constants';
const m = { senderType: SENDER_TYPES.CUSTOMER };
let entityType = ENTITY_TYPES.LEAD;`,
  },

  'addDoc-prohibition': {
    shouldMatch: `// Scanner must catch all 3 enterprise-ID-bypass vectors:
import { addDoc, collection } from 'firebase/firestore';
await addDoc(colRef, data);
await ref.add({ name: 'x' });
const ref2 = db.collection(COLLECTIONS.USERS).doc();`,
    shouldSkip: `// Scanner must pass setDoc + enterprise-ID pattern:
import { setDoc, doc } from 'firebase/firestore';
import { enterpriseIdService } from '@/services/enterprise-id.service';
const id = enterpriseIdService.generateContactId();
await setDoc(doc(db, 'users', id), { name: 'x' });`,
  },

  'intent-badge-utils': {
    shouldMatch: `// Scanner must catch redeclarations of canonical badge helpers:
const getIntentBadge = (x) => ({ label: x });
export function getConfidenceBadge(c) { return c; }
const getConfidenceColor: (v: number) => string = (v) => v > 0.8 ? 'green' : 'red';`,
    shouldSkip: `// Scanner must pass SSoT imports + usage:
import { getIntentBadge, getConfidenceBadge } from '@/components/admin/shared/intent-badge-utils';
const b = getIntentBadge(intent);
const c = getConfidenceBadge(confidence);`,
  },

  'tenant-company-id': {
    shouldMatch: `// Scanner must catch hardcoded legacy tenant literals:
const companyId = 'comp_9c7c1a50';
const legacyCompanyId = "pzNUy8ksddGCtcQMqumR";`,
    shouldSkip: `// Scanner must pass SSoT resolver usage:
import { getCompanyId } from '@/config/tenant';
const companyId = getCompanyId();
const docId = docRef.id;`,
  },

  'soft-delete-config': {
    shouldMatch: `// Scanner must catch redeclarations of the canonical config shape:
export const SOFT_DELETE_CONFIG = { ttlDays: 30 };
type Entity: SoftDeleteEntityConfig = Record<string, number>;`,
    shouldSkip: `// Scanner must pass SSoT import + usage:
import { SOFT_DELETE_CONFIG } from '@/lib/firestore/soft-delete-config';
function check(entity: string) { return SOFT_DELETE_CONFIG[entity]; }`,
  },

  'gcs-buckets': {
    shouldMatch: `// Scanner must catch hardcoded GCP project ID + template-built backup bucket:
const projectId = 'pagonis-87766';
const alt = "pagonis-87766";
const backupBucket = \`\${FIREBASE_PROJECT_ID}-backups\`;
const another = \`\${GCP_PROJECT_ID}-backups\`;`,
    shouldSkip: `// Scanner must pass SSoT imports + subdomain / backup-bucket literals:
import { GCP_PROJECT_ID, GCS_BACKUP_BUCKET, FIREBASE_STORAGE_BUCKET } from '@/config/gcs-buckets';
const bucket = GCS_BACKUP_BUCKET;
const storage = FIREBASE_STORAGE_BUCKET;
const authDomain = 'pagonis-87766.firebaseapp.com';
const storageHost = 'pagonis-87766.firebasestorage.app';
const backupsLiteral = 'pagonis-87766-backups';`,
  },

  'openai-provider': {
    shouldMatch: `// Scanner must catch every hand-rolled OpenAI client:
const provider = createOpenAI({ apiKey, baseURL });
const response = await fetch(\`\${this.config.baseUrl}/responses\`, { method: 'POST', body });
const reply = await fetch(\`\${baseUrl}/chat/completions\`, { method: 'POST', body });
const direct = await fetch('https://api.openai.com/v1/responses', { method: 'POST' });`,
    shouldSkip: `// Scanner must pass SSoT-routed access + known false-positive traps:
import { getOpenAIProvider } from '@/services/ai/openai-provider';
import { executeResponsesRequest, extractOutputText } from '@/services/ai/openai-responses';
const payload = await executeResponsesRequest(config, request);
const text = extractOutputText(payload);
const model = getOpenAIProvider()('gpt-4o-mini');
// Unrelated Telegram reply-builder modules that merely end in "/responses":
import { createSearchMenuResponse } from './responses';
const { createDatabaseUnavailableResponse } = await import('./message/responses');
// Health check hits a different endpoint:
const health = await fetch(\`\${baseUrl}/models\`, { headers });`,
  },

  'intl-formatting': {
    shouldMatch: `// Scanner must catch redeclarations of canonical intl helpers:
export const formatDate = (d: Date) => d.toISOString();
export function formatCurrency(n: number) { return '€' + n; }
const formatNumber = (n: number) => n.toString();`,
    shouldSkip: `// Scanner must pass SSoT imports:
import { formatDate, formatCurrency, formatNumber } from '@/lib/intl-formatting';
const d = formatDate(date);
const p = formatCurrency(price);`,
  },

  'date-local': {
    shouldMatch: `// Scanner must catch all 4 date-local anti-patterns:
export const normalizeToDate = (x: unknown) => x as Date;
function toMs(ts: unknown) { return Number(ts); }
const timestamp = new Date().toISOString();
const firestoreTs = Timestamp.fromDate(new Date());`,
    shouldSkip: `// Scanner must pass SSoT imports + usage:
import { nowISO, nowTimestamp, normalizeToDate } from '@/lib/date-local';
const ts = nowISO();
const firestoreTime = nowTimestamp();
const d = normalizeToDate(raw);`,
  },

  'notification-events': {
    shouldMatch: `// Scanner must catch redeclarations of notification event SSoT:
export const NOTIFICATION_EVENT_TYPES = { CREATED: 'created' };
const NOTIFICATION_CHANNELS: Record<string, string> = { EMAIL: 'email' };
const NOTIFICATION_SEVERITIES = { INFO: 'info', WARN: 'warn' };`,
    shouldSkip: `// Scanner must pass SSoT imports + enum-style access:
import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
if (e.type === NOTIFICATION_EVENT_TYPES.CREATED) {
  console.log('created');
}`,
  },

  'storage-path-construction': {
    shouldMatch: `// Scanner must catch hardcoded Storage path literals:
const avatarPath = \`companies/\${companyId}/avatars/\${userId}.jpg\`;
const filePath = \`companies/\${tenantId}/files/\${fileId}\`;`,
    shouldSkip: `// Scanner must pass SSoT path builder:
import { buildStoragePath } from '@/services/upload/utils/storage-path';
const avatarPath = buildStoragePath(companyId, 'avatars', \`\${userId}.jpg\`);`,
  },

  'entity-creation-manual': {
    shouldMatch: `// Scanner must catch manual createdBy assembly:
const entity = { createdBy: user.uid, name: 'x' };
const record = { createdBy: authContext.uid, ts: nowISO() };
const doc = { createdBy: userId };`,
    shouldSkip: `// Scanner must pass SSoT factory usage:
import { createEntity } from '@/lib/firestore/entity-creation.service';
const entity = await createEntity({ name: 'x' });`,
  },

  'storage-public-upload': {
    shouldMatch: `// Scanner must catch all 3 anti-patterns:
await fileRef.makePublic();
const url = \`https://storage.googleapis.com/\${bucket.name}/\${path}\`;
await bucket.file(storagePath).save(buffer);
await bucket.file(buildPath(id)).save(buf, { contentType: 'image/png' });`,
    shouldSkip: `// Scanner must pass SSoT-routed uploads:
import { uploadPublicFile } from '@/services/storage-admin/public-upload.service';
const result = await uploadPublicFile({ storagePath, buffer, contentType });
const proxyUrl = result.url;
const altHost = 'pagonis-87766.firebasestorage.app';`,
  },

  'floorplan-overlay-gateway': {
    shouldMatch: `// Scanner must catch direct Firestore access to floorplan_overlays:
const ref = db.collection(COLLECTIONS.FLOORPLAN_OVERLAYS).doc(overlayId);
const raw = adminDb.collection('floorplan_overlays');
const docRef = adminDb.doc("floorplan_overlays/abc123");
await deleteDoc(doc(db, COLLECTIONS.FLOORPLAN_OVERLAYS, id));`,
    shouldSkip: `// Scanner must pass gateway-routed mutations:
import { createFloorplanOverlay, updateFloorplanOverlay, deleteFloorplanOverlay } from '@/services/floorplan-overlay-mutation-gateway';
await createFloorplanOverlay({ backgroundId, floorId, geometry, role });
await updateFloorplanOverlay({ overlayId, label: 'A-12' });
await deleteFloorplanOverlay({ overlayId });
const meta = COLLECTIONS.PROPERTIES;
const otherCol = db.collection('properties');`,
  },

  'floorplan-overlay-types': {
    shouldMatch: `// Scanner must catch redeclarations of canonical overlay types:
export interface FloorplanOverlay { id: string; }
export type OverlayGeometry = { type: 'polygon' };
type OverlayRole = 'property' | 'parking';
interface OverlayLinked { propertyId?: string; }`,
    shouldSkip: `// Scanner must pass type imports + re-exports + value-position usage:
import type { FloorplanOverlay, OverlayGeometry, OverlayRole, OverlayLinked } from '@/types/floorplan-overlays';
import {
  type FloorplanOverlay as Overlay,
  type OverlayGeometry,
  type OverlayRole,
  type OverlayLinked,
} from '@/types/floorplan-overlays';
export type { FloorplanOverlay, OverlayGeometry } from '@/types/floorplan-overlays';
const overlay: FloorplanOverlay = readOverlay();
function isProperty(role: OverlayRole): boolean { return role === 'property'; }
const link: OverlayLinked = { propertyId: 'p1' };
type ExtendedFloorplanOverlay = FloorplanOverlay & { extra: string };`,
  },

  'line-settings-schema': {
    shouldMatch: `// Scanner must catch a re-declared standalone line-settings interface:
export interface LineSettings { color: string; lineWidth: number; }
interface LineSettings { enabled: boolean; }`,
    shouldSkip: `// Scanner must pass the canonical base + projections + de-collision rename:
import type { LineSettingsBase } from '../../types/line-settings-schema';
export interface LineSettingsBase { color: string; lineWidth: number; }
export type LineSettings = LineSettingsBase;
type LineSettings = Pick<LineSettingsBase, 'color' | 'lineWidth'> & { lineCap?: string };
export interface LineCssPreviewInput { color: string; width: number; style: string; }`,
  },

  'text-settings-schema': {
    shouldMatch: `// Scanner must catch a re-declared standalone text-settings interface:
export interface TextSettings { color: string; fontSize: number; }
interface TextSettings { enabled: boolean; }`,
    shouldSkip: `// Scanner must pass the canonical base + projections + de-collision rename:
import type { TextSettingsBase } from '../../types/text-settings-schema';
export interface TextSettingsBase { color: string; fontSize: number; }
export type TextSettings = TextSettingsBase;
export type TextSettings = Pick<TextSettingsBase, 'color' | 'fontSize'>;
export interface TextCssPreviewInput { color: string; fontWeight?: 'normal' | 'bold'; }`,
  },

  'comma-normalize': {
    shouldMatch: `// Scanner must catch both inline comma-normalize shapes:
const single = cleaned.replace(',', '.');
const expr = raw.replace(/,/g, '.');
const dq = value.replace(",", ".");`,
    shouldSkip: `// Scanner must pass the canonical SSoT import + usage (no inline replace):
import { normalizeNumber } from '../utils/number';
const single = normalizeNumber(cleaned);
const num = evalExpr(normalizeNumber(raw));
const stripped = formatted.replace(/[^0-9.,-]/g, '');`,
  },

  'scene-manager-adapter-hook': {
    shouldMatch: `// Scanner must catch a re-declared inline getSceneManager builder:
const getSceneManager = useCallback(() => {
  if (!levelManager.currentLevelId) return null;
  return createLevelSceneManagerAdapter(levelManager.getLevelScene, levelManager.setLevelScene, levelManager.currentLevelId);
}, [levelManager]);`,
    shouldSkip: `// Scanner must pass the canonical SSoT hook import + usage:
import { useSceneManagerAdapter } from '../../systems/entity-creation/useSceneManagerAdapter';
const getSceneManager = useSceneManagerAdapter(levelManager);`,
  },

  'point-translate-helpers': {
    shouldMatch: `// Scanner must catch re-declared point-translate duplicate helpers:
function applyDelta(point, delta) { return { x: point.x + delta.x, y: point.y + delta.y }; }
function shiftPoint3D(p, delta) { return { x: p.x + delta.x, y: p.y + delta.y, z: p.z }; }
function shiftPolygon3D(poly, delta) { return { vertices: poly.vertices.map((v) => shiftPoint3D(v, delta)) }; }
function translateVertex(v, delta) { return { x: v.x + delta.x, y: v.y + delta.y }; }`,
    shouldSkip: `// Scanner must pass canonical usage + thin delegators that use OTHER names:
import { translatePoint, translatePoints, translatePoint3D, addPoint3D } from '../geometry-vector-utils';
const moved = translatePoint(p, delta);
const shifted = translatePoints(poly.vertices, delta);
const raised = translatePoint3D(p, delta);
function add(a, b) { return translatePoint(a, b); }
function translate3D(p, delta) { return translatePoint3D(p, delta); }
const summed = addPoint3D(a, b);`,
  },

  'scalar-clamp': {
    shouldMatch: `// Scanner must catch re-declared clamp01/clamp255 + the clamp255 inline shape:
const channel = Math.max(0, Math.min(255, Math.round(v)));
function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
function clamp255(v) { return v; }
const clamp01 = (t) => (t < 0 ? 0 : t);
const clamp255 = (v) => v;`,
    shouldSkip: `// Scanner must pass canonical SSoT import + call-site usage (no re-declaration):
import { clamp, clamp01, clamp255 } from '../../utils/scalar-math';
const alpha = clamp01(rawAlpha);
const bounded = clamp(value, lo, hi);
const rgbChannel = clamp255(rawChannel);`,
  },

  'normalize-angle-deg': {
    shouldMatch: `// Scanner must catch the double-modulo inline + a local normalizeAngleDeg re-declaration:
const wrapped = ((raw % 360) + 360) % 360;
function normalizeAngleDeg(deg) { return deg; }`,
    shouldSkip: `// Scanner must pass SSoT import + call-site usage + an unrelated single-modulo test:
import { normalizeAngleDeg } from '../shared/geometry-angle-utils';
const heading = normalizeAngleDeg(rawDeg);
const isReflex = (span % 360) > 180 ? 1 : 0;`,
  },

  'safe-storage': {
    shouldMatch: `// Scanner must catch a re-declared safeStorage accessor:
function safeStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}`,
    shouldSkip: `// Scanner must pass the SSoT storage helpers (no safeStorage re-declaration):
import { storageGet, storageSet } from '../../utils/storage-utils';
const stored = storageGet('layers', fallback);
storageSet('layers', value);`,
  },

  'edge-triggered-tool-lifecycle': {
    shouldMatch: `// Scanner must catch an inline wasActiveRef edge-latch re-declaration:
const wasActiveRef = useRef(false);
useEffect(() => {
  if (isActive && !wasActiveRef.current) enterTool();
  else if (!isActive && wasActiveRef.current) exitTool();
  wasActiveRef.current = isActive;
}, [isActive]);`,
    shouldSkip: `// Scanner must pass canonical SSoT usage (no wasActiveRef re-declaration):
import { useEdgeTriggeredLifecycle } from './useEdgeTriggeredLifecycle';
useEdgeTriggeredLifecycle(isActive, () => enterTool(), () => exitTool());`,
  },

  // ADR-682. These fixtures exist because the ORIGINAL patterns had two escape
  // hatches that were found by executing them, not by reading them:
  //   (a) "^[^*]*<input..." stopped matching the moment any '*' appeared
  //       earlier on the line — e.g. a JSX expression containing a product.
  //   (b) "^[[:space:]]*type=..." only fired when the attribute was the FIRST
  //       thing on its continuation line, so a spread before it slipped past.
  // Both shapes are pinned below. Comment-line skipping is NOT a regex concern:
  // check-ssot-imports.js drops comment lines before matching.
  'slider-primitive': {
    shouldMatch: `// (a) '*' earlier on the line used to disarm the old anchored pattern:
const w = <input style={{ width: cols * 8 }} type="range" min="0" max="100" />;
// (b) attribute NOT first on its continuation line:
<input
  {...rest} type="range"
  max={100}
/>
// (c) plain multi-line form, attribute alone on its line:
<input
  type="range"
  value={v}
/>
// (d) imperative construction bypasses JSX entirely:
const el = document.createElement('input');
el.type = 'range';
// (e) re-styling the third-party primitive from scratch:
import * as SliderPrimitive from "@radix-ui/react-slider";`,
    shouldSkip: `// Canonical usage: the shared primitive and its viewer wrapper.
import { Slider } from '@/components/ui/slider';
import { SliderInput } from '../shared/SliderInput';
import { SLIDER_VALUE_UNITS } from '../shared/slider-value-units';

<Slider value={[value]} min={0} max={100} step={1} onValueChange={onChange} />
<SliderInput label={t('opacity')} value={v} min={0} max={1} step={0.01}
  onChange={setV} showValue unit={SLIDER_VALUE_UNITS.percent01} />

// Neither a range input nor an import of the raw package:
const type = 'range';
input.setAttribute('data-kind', 'range');
element.dataset.type = 'rangefinder';`,
  },

  // ---------------------------------------------------------------------------
  // point-hash-grid (ADR-650 §M10e) — Tier: spatial
  //
  // The two patterns target the ACT, not the vocabulary: bucketing a POINT's own
  // coordinate into a cell, and re-declaring the nested numeric cell map. The
  // should-skip block is the important half — it pins the three shapes that
  // legitimately floor a coordinate and must never be flagged:
  //   (a) rasterising a TRIANGLE or a BOX into cells (mesh-silhouette, tin-sampler,
  //       broad-phase) — a different question; PointHashGrid indexes points, not
  //       areas, so it is not the answer there;
  //   (b) snapping to a drawing grid, which divides by a SPACING, not a tolerance;
  //   (c) using the SSoT itself.
  'point-hash-grid': {
    shouldMatch: `// (a) bucketing a point's own coordinate by a cell size — a hand-rolled hash:
const col = Math.floor(p.x / cellSize);
const row = Math.floor(point.y / GRID_CELL_SIZE);
const c2 = Math.floor(this.origin.x / this.cellSizeMm);
// (b) re-declaring the nested numeric cell map the SSoT already owns:
const cells = new Map<number, Map<number, number[]>>();`,
    shouldSkip: `// Canonical usage — the SSoT primitive, by import:
import { PointHashGrid, NO_POINT } from '../../core/spatial/PointHashGrid';
const grid = new PointHashGrid(points, toleranceMm);
grid.forEachWithin(x, y, toleranceMm, (i, d2) => visit(i, d2));
if (grid.nearestWithin(x, y, r) === NO_POINT) return;

// Rasterising an AREA into cells is a different question — must not be flagged:
const minC = Math.max(0, Math.floor((Math.min(ax, bx, cx) - ox) / cell));
const r0 = clampCol(Math.floor((Math.min(...ys) - minY) / cellH));
const maxX = Math.floor((b.max.x + marginM) / cellSizeM);

// Snapping to the drawing grid divides by a SPACING, not a proximity tolerance:
const gx = Math.floor(pointer.x / gridSpacing) * gridSpacing;
const step = Math.floor(worldX / majorGridStep);

// Unrelated map shapes:
const items = new Map<string, SpatialItem>();
const byId = new Map<number, Point2D>();`,
  },

  // ADR-739 §26/§27.15 — Tier 3. Added here by ADR-751 for a reason worth recording:
  // all 14 of this module's patterns ended in a JSON "\b", which the JSON parser reads as
  // BACKSPACE (U+0008), NOT the regex word boundary. They matched NOTHING — 14 guards that
  // looked alive in the registry and enforced nothing. The escapes are fixed; these fixtures
  // are what proves they now fire, and stop the same typo from passing review again.
  'table-selection-range': {
    shouldMatch: `// A second body for "what did the user select, and which cells are inside":
export function resolveTableSelectionBounds(model, span) {}
function resolveTableCellRange(model, span) {}
function snapToWholeMerges(model, bounds) {}
export function extendTableSelectionTo(span, cell) {}
function extendTableCellRangeEnd(range, to) {}
function wholeAxisSelection(model, kind, id) {}
function tableRangeMembership(bounds, cell) {}
function tableRangeCellRefs(model, bounds) {}
function tableWholeGridRange(model) {}
export function startTableCellDrag(session) {}
export type TableSelectionKind = 'range' | 'column' | 'row';
export interface TableSelectionSpan { from: TableCellRef; to: TableCellRef }
export interface TableCellRangeBounds { firstRow: number; lastRow: number }
interface TableRectBounds { x: number; y: number; w: number; h: number }`,
    shouldSkip: `// Canonical usage — by import, never re-declared:
import { resolveTableSelectionBounds, type TableSelectionSpan } from './table-cell-range';
import type { TableCellRangeBounds, TableSelectionKind } from '../table-cell-range';
const bounds = resolveTableSelectionBounds(model, cursor.selection);
const refs = tableRangeCellRefs(model, bounds);
if (tableRangeMembership(bounds, cell)) paint(cell);
startTableCellDrag({ entityId, from });

// Local variables and properties that merely MENTION the names:
const resolveTableSelectionBoundsResult = bounds;
const kind: TableSelectionKind = 'column';
let span: TableSelectionSpan | null = null;
props.onExtend = extendTableSelectionTo;`,
  },

  // ADR-751 — Tier 3. Proof matters MORE than usual here: two of the four patterns
  // currently match ZERO lines in src/ (hand-rolled concatenation, and re-declaring
  // the SSoT functions). Without an executed proof they would be dormant guards —
  // and CLAUDE.md N.12 records that 606 of 671 patterns already are. These fixtures
  // are what makes the difference between "clean" and "nobody looked".
  'millesimal-apportionment': {
    shouldMatch: `// (α) Η ΑΝΑ-ΓΡΑΜΜΗ μετατροπή ποσοστού σε χιλιοστά — αυτή ακριβώς έγραφε 999‰:
allocatedShares: Math.round((o.ownershipPct / 100) * TOTAL_SHARES_TARGET),
const shares = Math.round((pct / 100) * 1000);
const m = Math.round( entry.landOwnershipPct / 100 * 1000 );
// (β) δεύτερο σώμα για ερώτημα που ο SSoT ήδη απαντά:
export function apportionLargestRemainder(values, target) {}
export function allocateMillesimalsFromPercentages(percentages) {}`,
    shouldSkip: `// Κανονική χρήση — με εισαγωγή, ποτέ ξαναγραμμένη:
import { allocateMillesimalsFromPercentages } from '@/lib/ownership/millesimal-apportionment';
const shares = allocateMillesimalsFromPercentages(owners.map(o => o.ownershipPct));
const [only] = allocateMillesimalsFromPercentages([pct]);

// 🔑 Ο ΝΟΜΙΜΟΣ ΚΑΤΑΝΑΛΩΤΗΣ: η μηχανή πινάκων προσθέτει ΜΟΝΟ την πολιτική του ελαχίστου
// πάνω στον κοινό πυρήνα — δεν ξαναγράφει τον αλγόριθμο, άρα δεν πρέπει να πιάνεται.
const allocated = apportionLargestRemainder(rawShares, target);
const result = allocated.map(s => Math.max(s, MIN_SHARES_PER_ROW));

// Στρογγυλοποιήσεις ποσοστών που ΔΕΝ είναι χιλιοστά: άλλος παρονομαστής, άλλη ερώτηση.
const pctRounded = Math.round((value / 100) * 10) / 10;
const bytes = Math.round((used / 100) * quotaMb);
const progress = Math.round((done / total) * 100);
const asPercent = Math.round(ratio * 100);

// Αναφορά στον κανόνα χωρίς δεύτερη υλοποίηση:
const isFullyDeclared = sum(shares) === TOTAL_SHARES_TARGET;`,
  },

  'text-horizontal-anchor': {
    shouldMatch: `// (a) η τριάδα ξαναγραμμένη με το ΚΕΝΤΡΟ πρώτο (μορφή renderer / explode / clip):
const xOff = align === 'center' ? -lineWidthPx / 2 : align === 'right' ? -lineWidthPx : 0;
const xLine = align === 'center' ? -line.widthWorld / 2 : align === 'right' ? -line.widthWorld : 0;
// (b) η ΙΔΙΑ τριάδα με τα ΔΕΞΙΑ πρώτα (η παλιά μορφή του bim/table) — πιάνεται στο ίδιο σκέλος:
return hAlign === 'right' ? -advance : hAlign === 'center' ? -advance / 2 : 0;
// (γ) δεύτερο σώμα για ερώτημα που ο SSoT ήδη απαντά:
export function anchorOffset(a, w) {}
export function entityAlignmentToAnchor(alignment) {}`,
    shouldSkip: `// Κανονική χρήση — με εισαγωγή, ποτέ ξαναγραμμένη:
import { anchorOffset, entityAlignmentToAnchor } from '../../text-engine/fonts/text-horizontal-anchor';
const xOff = anchorOffset(align, lineWidthPx) + line.xOffsetWorld * worldToPx;
const localStart = anchorOffset(entityAlignmentToAnchor(e.alignment), totalW);

// 🔴 ΤΑ ΕΞΙ ΨΕΥΔΩΣ ΘΕΤΙΚΑ ΠΟΥ ΕΠΙΒΑΛΑΝ ΝΑ ΜΗΝ ΥΠΑΡΧΕΙ PATTERN ΓΙΑ ΤΟ «right» (μετρημένα σε όλο
// το src): «δεξιά» σημαίνει φορά, όχι στοίχιση κειμένου, σε τέσσερις άσχετους τομείς.
const turnAngleDeg = variant.turnDirection === 'right' ? -90 : 90;
const turnSign = variant.turnDirection === 'right' ? -1 : 1;
const dir = opening.params.handing === 'right' ? -1 : 1;
const sign = justification === 'right' ? -1 : 1;

// Κεντράρισμα που ΔΕΝ είναι αγκύρωση κειμένου: μισό πλάτος χωρίς άγκυρα άκρου.
const cx = (rect.widthPx - textWidthPx) / 2;
if (frame.textAlign === 'center') return (frame.widthPx - textWidthPx) / 2;

// Αναφορά στον κανόνα χωρίς δεύτερη υλοποίηση:
const isCentred = anchor === 'center';`,
  },

  'text-link-detection': {
    shouldMatch: `// (a) hand-rolled href interpolation — the raw phone lands in the href,
// so spaces / dashes / parentheses reach the dialer (real defect, UniversalClickableField):
const mail = \`mailto:\${contact.email}\`;
window.open(\`tel:\${phone}\`, '_self');
// (b) the same thing by concatenation:
const href = "mailto:" + contact.email;
const dial = 'tel:' + rawNumber;
// (c) a second body for a question the SSoT already answers:
export function openCellLink(href: string): void {}
export async function copyCellLinkAddress(kind, href) {}
export const LINK_ACTION_KEY = { email: 'x' };`,
    shouldSkip: `// Canonical usage — by import, never re-built:
import { splitTextIntoLinkSegments } from '@/lib/validation/text-link-segments';
import { openCellLink, copyCellLinkAddress } from './table-link-interaction-2d';
import { LINK_ACTION_KEY, linkClipboardText } from './table-link-labels';
openCellLink(hit.span.href);
void copyCellLinkAddress(target.kind, target.href);
const action = t(LINK_ACTION_KEY[span.kind]);
const payload = linkClipboardText(kind, href);

// Other schemes interpolated legitimately — only mailto/tel carry the normalisation risk:
const page = \`https://\${host}/\${slug}\`;
const asset = \`blob:\${objectUrl}\`;

// Mentioning the scheme without building a destination:
if (href.startsWith('mailto:')) return openInClient(href);
const ALLOWED = ['mailto:', 'tel:', 'https://'];`,
  },

  // ───────────────────────────────────────────────────────────────────────────
  // ADR-749 §6 — δύο modules που είχαν ΝΕΚΡΟΥΣ φρουρούς, ξαναγραμμένα 2026-08-04.
  // Και τα δύο απέκτησαν απόδειξη ζωής ΤΗΝ ΙΔΙΑ ΣΤΙΓΜΗ που άλλαξαν τα patterns
  // τους — αυτός είναι ο κανόνας του ADR-749 §5, όχι εξαίρεση.
  // ───────────────────────────────────────────────────────────────────────────

  'bim-to-boq-bridge': {
    // Ο πίνακας BIM→ΑΤΟΕ ζει στο bim/config/bim-to-atoe-mapping.ts και
    // προσπελαύνεται ΜΟΝΟ μέσω resolveAtoeMapping(). Ο ωμός πίνακας δεν
    // διαβάζεται και δεν αντιγράφεται πουθενά αλλού.
    shouldMatch: `// Απευθείας ανάγνωση ή αντιγραφή του πίνακα εκτός του σπιτιού του:
import { BIM_TO_ATOE_MAPPING } from '../config/bim-to-atoe-mapping';
const typeMap = BIM_TO_ATOE_MAPPING[entityType];
export const BIM_TO_ATOE_MAPPING = { wall: {}, slab: {} };
const code = BIM_TO_ATOE_MAPPING.wall[kind].atoeCode;`,
    shouldSkip: `// Κανονική χρήση — μέσω του accessor, ποτέ του ωμού πίνακα:
import { resolveAtoeMapping, deriveAtoeQuantity } from '../config/bim-to-atoe-mapping';
import type { AtoeMappingEntry, BimEntityType } from '../config/bim-to-atoe-mapping';
const mapping = resolveAtoeMapping(entityType, entity.kind, category);
const parentMapping = resolveAtoeMapping('wall', entity.kind, category);
void bimToBoqBridge.upsertBoqItemForBim(entityType, entity, context, action);
const quantity = deriveAtoeQuantity(mapping, geometry);`,
  },

  'xline-mode-store': {
    // Ο store κατέχει την κατάσταση σε createExternalStore. Οι φρουροί πιάνουν
    // ΔΙΠΛΑΣΙΑΣΗ — δεύτερο αντίγραφο, δεύτερο store, παράκαμψη persistence,
    // ξαναδηλωμένη ένωση.
    shouldMatch: `// Κάθε γραμμή είναι δεύτερη πηγή αλήθειας για το ίδιο πράγμα:
const [mode, setLocalMode] = useState<XLineMode>('through');
const lastMode = useRef<XLineMode>('horizontal');
const store = createExternalStore<XLineModeState>({ ...DEFAULT_STATE });
type XLineMode = 'through' | 'horizontal' | 'vertical';
localStorage.setItem('dxf:xlineMode.lastUsed', 'vertical');`,
    shouldSkip: `// Κανονική χρήση — τα πάντα μέσω της δημόσιας API του store:
import { getMode, setMode, subscribe, getXLineModeState } from '@/subapps/dxf-viewer/systems/tools/xline-mode-store';
import type { XLineMode, XLineModeState } from '@/subapps/dxf-viewer/systems/tools/xline-mode-store';
const mode = getMode();
const state = useSyncExternalStore(subscribe, getXLineModeState, getXLineModeState);
setMode('angle', { angleValue: 45 });
setMode(nextMode);

// Παγίδες που ΔΕΝ πρέπει να πυροδοτήσουν:
type XLineModeState = { readonly mode: XLineMode };
interface XLineModeParams { angleValue?: number | null }
const [angleValue, setAngleValue] = useState<number | null>(null);
const rowRef = useRef<HTMLDivElement | null>(null);
const other = createExternalStore<SnapModeState>({ mode: 'off' });
const label = t('dxf.xlineMode.angle');`,
  },

  // ADR-739 §49 (2026-08-05) — η απόδειξη γράφτηκε μαζί με το 13ο pattern
  // (`@formulajs/formulajs`), όχι αργότερα. Το 13ο είναι και το σημαντικότερο: είναι ο
  // ΜΟΝΟΣ φρουρός που εμποδίζει δεύτερο σημείο εισαγωγής της βιβλιοθήκης — δηλαδή
  // παράκαμψη ολόκληρης της διαμέρισης, δηλαδή `TODAY()` σε κελί παραδοτέου σχεδίου.
  'table-formula-engine': {
    shouldMatch: `// Δεύτερη μηχανή τύπων — κάθε γραμμή πρέπει να πυροδοτήσει:
export function parseTableFormula(text: string) {}
function printTableFormula(node) {}
export function tokenizeFormula(source: string) {}
function evaluateTableFormulaNode(node) {}
export function recalculateTableModel(model, changed) {}
function writeCellInput(model, rowId, colId, text) {}
export function setPersistedCellFormula(model, rowId, colId, formula) {}
export interface TableFormulaEngine { evaluate(): void }
type TableFormulaNode = { kind: 'number' };
import { HyperFormula } from 'hyperformula';
import FormulaParser from 'fast-formula-parser';
import { calc } from '@sheetxl/formulas';
import * as formulajs from '@formulajs/formulajs';`,
    shouldSkip: `// Κανονική χρήση — τα πάντα μέσω της μίας μηχανής:
import { writeCellInput, recalculateTableModel, cellInputText } from './formula/table-formula-engine';
import { parseTableFormula, isFormulaInput } from './formula/table-formula-parse';
import { evaluateTableFormula, expandRangeShape } from './formula/table-formula-eval';
import type { TableFormulaNode, TableFormula } from '../../types/table-formula';
import { TABLE_FORMULA_FUNCTIONS } from './table-formula-functions';
const next = recalculateTableModel(writeCellInput(model, rowId, colId, text), [key]);
const formula = parseTableFormula(model, draft);
const value = evaluateTableFormula(scope, formula);

// Παγίδες που ΔΕΝ πρέπει να πυροδοτήσουν:
const parseTableFormulaResult = parseTableFormula(model, text);
export const printTableFormulaLabel = 'fx';
type TableFormulaNodeEvaluator = (node: TableFormulaNode) => TableFormulaValue;
interface TableFormulaEngineProps { readonly engine: TableFormulaEngine }
const doc = 'δες @formulajs/formulajs για τον κατάλογο συναρτήσεων';`,
  },
  // ADR-777 Α6 — ο ΕΝΑΣ κανόνας τιμής. Η απόδειξη ζωής μετράει διπλά εδώ: **δύο από τα τρία**
  // patterns πιάνουν ΜΗΔΕΝ γραμμές στο `src/` σήμερα, γιατί το Φ4 τα καθάρισε όλα στο ίδιο
  // commit. Χωρίς εκτελεσμένο παράδειγμα θα ήταν αδρανείς φρουροί — και το N.12 καταγράφει ότι
  // **606 από τα 671** patterns ήδη είναι. Αυτά τα fixtures είναι η διαφορά ανάμεσα σε
  // «καθαρό» και «κανείς δεν κοίταξε».
  //
  // ⚠️ Το `shouldSkip` κρατά ΕΠΙΤΗΔΕΣ τις **νόμιμες** χρήσεις που η προφανής (και απορριφθείσα)
  // εκδοχή του pattern θα έπιανε: προεπιλογές φόρμας, στιγμιότυπο payload, έλεγχος αλλαγής,
  // έσοδα από `finalPrice`, και **σχόλιο που περιγράφει την παλιά αλυσίδα** — μάθημα CHECK 3.50
  // (`Κ7β`): ένα σχόλιο που τεκμηριώνει τη βλάβη δεν επιτρέπεται να μετριέται ως η βλάβη.
  'property-price-resolver': {
    shouldMatch: `// (α) Η αλυσίδα «ζητούμενη, αλλιώς το flat πεδίο» — ο resolver την κατέχει:
const price = spot.commercial?.askingPrice ?? spot.price ?? 0;
const p2 = data.commercial?.askingPrice ?? data.price;
// (β) stats accessor που διαβάζει το @deprecated flat πεδίο:
const getValue = (s: Storage): number => s.price || 0;
const getPrice = (p) => p.price ?? 0;
// (γ) άθροισμα πάνω στο flat πεδίο:
const storageTotalValue = sumBy(storage, s => s.price ?? 0);`,
    shouldSkip: `// Κανονική χρήση — πάντα μέσα από τον SSoT:
import { getEffectivePrice, priceSortKey, totalPrice } from '@/lib/properties/price-resolver';
const price = getEffectivePrice(spot)?.amount ?? null;
const getValue = (s: Storage): number | null => priceSortKey(s);
const totals = totalPrice(units);

// 🔑 ΝΟΜΙΜΑ, μετρημένα 2026-08-09 — γι' αυτό τα patterns ΔΕΝ είναι το σκέτο \`askingPrice ??\`:
const [askingPrice, setAskingPrice] = useState<number>(unit.commercial?.askingPrice ?? 0);
askingPrice: unit.commercial?.askingPrice ?? null,
const priceChanged = parsed !== (property.commercial?.askingPrice ?? null);
const totalRevenue = sumBy(sold, u => u.commercial?.finalPrice ?? 0);

// Και ΣΧΟΛΙΟ που περιγράφει την παλιά αλυσίδα — δεν είναι η αλυσίδα:
// ADR-777 Α5/Α6 — το \`s.price || 0\` αγνοούσε το commercial.askingPrice.`,
  },
};
