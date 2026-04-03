'use client';

import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  CreateSavedReportInput,
  SavedReport,
  UpdateSavedReportInput,
} from '@/types/reports/saved-report';

// eslint-disable-next-line custom/no-hardcoded-strings -- API route template
const SAVED_REPORTS_API_BASE = '/api/reports/saved';

function savedReportUrl(id: string): string {
  // eslint-disable-next-line custom/no-hardcoded-strings -- API route template
  return `/api/reports/saved/${id}`;
}

interface CreateSavedReportWithPolicyInput {
  readonly input: CreateSavedReportInput;
}

interface UpdateSavedReportWithPolicyInput {
  readonly id: string;
  readonly input: UpdateSavedReportInput;
}

interface DeleteSavedReportWithPolicyInput {
  readonly id: string;
}

interface ToggleFavoriteSavedReportWithPolicyInput {
  readonly id: string;
}

interface TrackSavedReportRunWithPolicyInput {
  readonly id: string;
}

export async function createSavedReportWithPolicy({
  input,
}: CreateSavedReportWithPolicyInput): Promise<SavedReport> {
  return apiClient.post<SavedReport>(SAVED_REPORTS_API_BASE, input);
}

export async function updateSavedReportWithPolicy({
  id,
  input,
}: UpdateSavedReportWithPolicyInput): Promise<SavedReport> {
  return apiClient.put<SavedReport>(savedReportUrl(id), input);
}

export async function deleteSavedReportWithPolicy({
  id,
}: DeleteSavedReportWithPolicyInput): Promise<{ deleted: boolean }> {
  return apiClient.delete<{ deleted: boolean }>(savedReportUrl(id));
}

export async function toggleFavoriteSavedReportWithPolicy({
  id,
}: ToggleFavoriteSavedReportWithPolicyInput): Promise<{ action: string; result: boolean }> {
  return apiClient.post<{ action: string; result: boolean }>(
    savedReportUrl(id),
    // eslint-disable-next-line custom/no-hardcoded-strings -- API action
    { action: 'toggle_favorite' },
  );
}

export async function trackSavedReportRunWithPolicy({
  id,
}: TrackSavedReportRunWithPolicyInput): Promise<{ action: string; result: boolean }> {
  return apiClient.post<{ action: string; result: boolean }>(
    savedReportUrl(id),
    // eslint-disable-next-line custom/no-hardcoded-strings -- API action
    { action: 'track_run' },
  );
}
