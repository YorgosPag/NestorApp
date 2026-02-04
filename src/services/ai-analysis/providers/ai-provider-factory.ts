/**
 * =============================================================================
 * AI PROVIDER FACTORY (CENTRALIZED)
 * =============================================================================
 */

import { AI_ANALYSIS_DEFAULTS, AI_PROVIDER_IDS } from '@/config/ai-analysis-config';
import type { IAIAnalysisProvider } from './IAIAnalysisProvider';
import { createMockAIAnalysisProvider } from './MockAIAnalysisProvider';
import { createOpenAIProvider } from './OpenAIAnalysisProvider';

export function createAIAnalysisProvider(): IAIAnalysisProvider {
  const providerEnv = AI_ANALYSIS_DEFAULTS.PROVIDER;

  if (providerEnv === AI_PROVIDER_IDS.MOCK) {
    return createMockAIAnalysisProvider();
  }

  const openAIProvider = createOpenAIProvider();
  if (openAIProvider) {
    return openAIProvider;
  }

  return createMockAIAnalysisProvider();
}
