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

export async function processFloorplanWithPolicy(
  input: FloorplanProcessInput,
): Promise<FloorplanProcessResult> {
  return apiClient.post<FloorplanProcessResult>(API_ROUTES.FLOORPLANS.PROCESS, input);
}
