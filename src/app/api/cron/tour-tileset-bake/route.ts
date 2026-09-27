/**
 * `GET /api/cron/tour-tileset-bake` — το δίχτυ του ψήστη πλακιδίων περιήγησης (ADR-884 Φ2α).
 *
 * Λεπτό περιτύλιγμα: η πράξη ζει στο `lib/cron/jobs/tour-tileset-bake.job.ts`, ο φρουρός
 * (μυστικό cron, lease, check-in) στο `createScanCronRoute` — ίδιο σχήμα με κάθε σάρωση του έργου.
 */

import 'server-only';

import { runTourTilesetBake } from '@/lib/cron/jobs/tour-tileset-bake.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'tour-tileset-bake',
  label: 'Tour tileset bake safety net',
  logger: createModuleLogger('TOUR_TILESET_BAKE_CRON'),
  slug: 'tour-tileset-bake',
  run: runTourTilesetBake,
});
