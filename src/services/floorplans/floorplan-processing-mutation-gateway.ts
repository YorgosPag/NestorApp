import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';

interface FloorplanProcessInput {
  fileId: string;
  forceReprocess: boolean;
}

export interface FloorplanProcessResult {
  success: true;
  fileId: string;
  fileType: 'dxf' | 'pdf';
  processedAt: string;
  stats?: {
    entityCount: number;
    layerCount: number;
    parseTimeMs: number;
  };
}

export interface FloorplanProcessInProgressResult {
  success: true;
  status: 'in_progress';
  fileId: string;
}

export type FloorplanProcessOutcome = FloorplanProcessResult | FloorplanProcessInProgressResult;

export function isInProgress(r: FloorplanProcessOutcome): r is FloorplanProcessInProgressResult {
  return 'status' in r && r.status === 'in_progress';
}

export async function processFloorplanWithPolicy(
  input: FloorplanProcessInput,
): Promise<FloorplanProcessOutcome> {
  return apiClient.post<FloorplanProcessOutcome>(API_ROUTES.FLOORPLANS.PROCESS, input);
}
