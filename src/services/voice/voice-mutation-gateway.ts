import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { SubmitCommandResult } from '@/types/voice-command';

interface VoiceTranscriptionResult {
  success: boolean;
  text: string;
  error?: string;
}

export async function transcribeVoiceWithPolicy(
  formData: FormData,
): Promise<VoiceTranscriptionResult> {
  return apiClient.post<VoiceTranscriptionResult>(API_ROUTES.VOICE.TRANSCRIBE, formData);
}

export async function submitVoiceCommandWithPolicy(
  text: string,
): Promise<SubmitCommandResult> {
  return apiClient.post<SubmitCommandResult>(API_ROUTES.VOICE.COMMAND, { text });
}
