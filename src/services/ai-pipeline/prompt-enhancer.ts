/**
 * =============================================================================
 * PROMPT ENHANCER — Dynamic AI Prompt Enhancement with Learned Patterns
 * =============================================================================
 *
 * Queries learned patterns and tool warnings, then formats them as
 * additional prompt sections for the agentic loop system prompt.
 *
 * Token budget: max ~400 tokens for patterns + ~100 for warnings = ~500 total
 *
 * @module services/ai-pipeline/prompt-enhancer
 * @see ADR-173 (AI Self-Improvement System)
 */

import 'server-only';

import { getLearningService } from './learning-service';
import { getToolAnalyticsService } from './tool-analytics-service';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('PROMPT_ENHANCER');

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_PATTERN_CHARS = 1200; // ~400 tokens
const MAX_WARNING_CHARS = 300;  // ~100 tokens

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate an enhancement section for the system prompt based on
 * learned patterns and tool analytics.
 *
 * @param userQuery - The current user query
 * @returns Additional prompt section string (empty if nothing relevant)
 */
export async function enhanceSystemPrompt(userQuery: string): Promise<string> {
  try {
    // Fetch patterns and warnings in parallel
    const [patterns, warnings] = await Promise.all([
      getLearningService().findRelevantPatterns(userQuery, 3),
      getToolAnalyticsService().getToolWarnings(),
    ]);

    const sections: string[] = [];

    // Build patterns section
    if (patterns.length > 0) {
      let patternsText = '\n\nΜΑΘΗΜΕΝΑ ΠΑΡΑΔΕΙΓΜΑΤΑ:';
      let charCount = patternsText.length;

      for (let i = 0; i < patterns.length; i++) {
        const p = patterns[i];
        const toolChainStr = p.toolChain.length > 0
          ? p.toolChain.join(' → ')
          : 'χωρίς εργαλεία';

        const statusIcon = p.patternType === 'success' ? '\u2705' : '\u26A0\uFE0F';
        const entry = `\n${statusIcon} Παράδειγμα ${i + 1}:`
          + `\n- Ερώτηση: "${p.exampleQuery}"`
          + `\n- Εργαλεία: ${toolChainStr}`
          + `\n- Αποτέλεσμα: ${p.exampleAnswer.substring(0, 150)}`;

        if (charCount + entry.length > MAX_PATTERN_CHARS) break;
        patternsText += entry;
        charCount += entry.length;
      }

      sections.push(patternsText);

      logger.info('Injected learned patterns into prompt', {
        patternCount: patterns.length,
        charCount,
      });
    }

    // Build warnings section
    if (warnings.length > 0) {
      let warningsText = '\n\nΠΡΟΣΟΧΗ:';
      let charCount = warningsText.length;

      for (const warning of warnings) {
        const line = `\n- ${warning}`;
        if (charCount + line.length > MAX_WARNING_CHARS) break;
        warningsText += line;
        charCount += line.length;
      }

      sections.push(warningsText);
    }

    return sections.join('');
  } catch (error) {
    // Non-fatal: enhancement failure must never break the pipeline
    logger.warn('Failed to enhance system prompt', {
      error: error instanceof Error ? error.message : String(error),
    });
    return '';
  }
}
