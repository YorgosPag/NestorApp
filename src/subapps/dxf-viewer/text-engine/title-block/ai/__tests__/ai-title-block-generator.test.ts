/**
 * ADR-651 Φάση Δ — tests του AI generator (mocked `ai` SDK).
 *
 * Καρφώνει: (α) το structured output επιστρέφεται, (β) το usage καταγράφεται στον υπάρχοντα
 * SSoT (`recordUsage`) με σωστό mapping tokens, (γ) **graceful null** σε αποτυχία (ο καλών
 * πέφτει σε manual preset). Μηδέν πραγματική κλήση OpenAI (mock provider + generateObject).
 */

// Μην κάνεις import `jest` από @jest/globals (σπάει το hoisting των mocks — memory gotcha).
jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@/services/ai/openai-provider', () => ({
  getOpenAIProvider: () => (model: string) => ({ model }),
}));
jest.mock('@/services/ai-pipeline/ai-usage.service', () => ({
  recordUsage: jest.fn().mockResolvedValue(undefined),
}));

import { generateObject } from 'ai';
import { recordUsage } from '@/services/ai-pipeline/ai-usage.service';
import {
  AI_TITLE_BLOCK_USAGE_CHANNEL,
  generateTitleBlockFromText,
  generateTitleBlockFromImage,
} from '../ai-title-block-generator';
import type { AiTitleBlock } from '../ai-title-block-schema';

const mockedGenerate = generateObject as jest.MockedFunction<typeof generateObject>;
const mockedRecordUsage = recordUsage as jest.MockedFunction<typeof recordUsage>;

const SAMPLE: AiTitleBlock = {
  locale: 'el',
  heading: { placeholderPath: 'company.name', literalText: null },
  rows: [{ label: 'Έργο', placeholderPath: 'project.name', literalValue: null, emphasis: 'default' }],
  withStampBox: true,
  confidence: 0.9,
  notes: 'ok',
};

beforeEach(() => {
  mockedGenerate.mockReset();
  mockedRecordUsage.mockClear();
});

describe('generateTitleBlockFromText', () => {
  it('returns the structured object and records usage with mapped tokens', async () => {
    mockedGenerate.mockResolvedValue({
      object: SAMPLE,
      usage: { inputTokens: 120, outputTokens: 45, totalTokens: 165 },
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

    const result = await generateTitleBlockFromText({ userId: 'u1', prompt: 'A2 permit', locale: 'el' });

    expect(result).toEqual(SAMPLE);
    expect(mockedRecordUsage).toHaveBeenCalledWith('u1', AI_TITLE_BLOCK_USAGE_CHANNEL, {
      prompt_tokens: 120,
      completion_tokens: 45,
      total_tokens: 165,
    });
  });

  it('returns null gracefully when the model call throws', async () => {
    mockedGenerate.mockRejectedValue(new Error('network'));
    const result = await generateTitleBlockFromText({ userId: 'u1', prompt: 'x', locale: 'el' });
    expect(result).toBeNull();
    expect(mockedRecordUsage).not.toHaveBeenCalled();
  });
});

describe('generateTitleBlockFromImage', () => {
  it('passes an image message part and returns the object', async () => {
    mockedGenerate.mockResolvedValue({
      object: SAMPLE,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

    const result = await generateTitleBlockFromImage({
      userId: 'u2',
      imageDataUrl: 'data:image/png;base64,AAAA',
      locale: 'en',
    });

    expect(result).toEqual(SAMPLE);
    const call = mockedGenerate.mock.calls[0][0] as { messages?: Array<{ content: unknown }> };
    const content = call.messages?.[0]?.content as Array<{ type: string }>;
    expect(content.some((part) => part.type === 'image')).toBe(true);
  });
});
