import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ApdStatus, EfkaDeclarationData, WorkerStampsSummary } from '@/components/projects/ika/contracts';
import type { AttendanceEventType, AttendanceMethod } from '@/components/projects/ika/contracts';
import type { GeofenceApiResponse } from '@/components/projects/ika/map-shared/geofence-api-types';

interface CreateAttendanceEventInput {
  projectId: string;
  contactId: string;
  eventType: AttendanceEventType;
  method: AttendanceMethod;
  notes?: string;
  coordinates?: { lat: number; lng: number };
  deviceId?: string;
  approvedBy?: string;
}

interface SaveEmploymentRecordsInput {
  projectId: string;
  month: number;
  year: number;
  workerSummaries: WorkerStampsSummary[];
}

interface UpdateEmploymentRecordApdStatusInput {
  status: ApdStatus;
  referenceNumber?: string;
}

interface SaveGeofenceConfigInput {
  projectId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  enabled: boolean;
}

interface GenerateAttendanceQrCodeInput {
  projectId: string;
  date: string;
}

interface GenerateAttendanceQrCodeResult {
  success: boolean;
  tokenId?: string;
  qrDataUrl?: string;
  validDate?: string;
  expiresAt?: string;
  checkInUrl?: string;
  error?: string;
}

export async function createAttendanceEventWithPolicy(
  input: CreateAttendanceEventInput,
): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>(API_ROUTES.IKA.ATTENDANCE_EVENTS, input);
}

export async function saveEmploymentRecordsWithPolicy(
  input: SaveEmploymentRecordsInput,
): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>(API_ROUTES.IKA.EMPLOYMENT_RECORDS, input);
}

export async function updateEmploymentRecordApdStatusWithPolicy(
  recordId: string,
  input: UpdateEmploymentRecordApdStatusInput,
): Promise<{ success: boolean }> {
  return apiClient.patch<{ success: boolean }>(
    API_ROUTES.IKA.EMPLOYMENT_RECORD_APD_STATUS(recordId),
    input,
  );
}

export async function updateEfkaDeclarationWithPolicy(
  projectId: string,
  updates: Partial<EfkaDeclarationData>,
): Promise<{ success: boolean; data?: EfkaDeclarationData }> {
  return apiClient.patch<{ success: boolean; data?: EfkaDeclarationData }>(
    API_ROUTES.IKA.EFKA_DECLARATION(projectId),
    updates,
  );
}

export async function saveGeofenceConfigWithPolicy(
  input: SaveGeofenceConfigInput,
): Promise<GeofenceApiResponse> {
  return apiClient.post<GeofenceApiResponse>(API_ROUTES.ATTENDANCE.GEOFENCE, input);
}

export async function generateAttendanceQrCodeWithPolicy(
  input: GenerateAttendanceQrCodeInput,
): Promise<GenerateAttendanceQrCodeResult> {
  return apiClient.post<GenerateAttendanceQrCodeResult>(API_ROUTES.ATTENDANCE.QR_GENERATE, input);
}
