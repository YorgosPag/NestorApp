/**
 * =============================================================================
 * UTILITY HANDLER — Schema Lookup & DOY Code Search
 * =============================================================================
 *
 * Lightweight tools that don't require Firestore writes or complex security.
 *
 * Tools:
 * - get_collection_schema: Return schema info about a collection
 * - lookup_doy_code: Search Greek Tax Office (ΔΟΥ) by name/keyword
 *
 * @module services/ai-pipeline/tools/handlers/utility-handler
 * @see ADR-171 (Autonomous AI Agent)
 */

import { getCollectionSchemaInfo } from '@/config/firestore-schema-map';
import {
  ALLOWED_READ_COLLECTIONS,
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
} from '../executor-shared';
import { searchEscoOccupations, searchEscoSkills } from '../esco-search-utils';

// ============================================================================
// HANDLER
// ============================================================================

export class UtilityHandler implements ToolHandler {
  readonly toolNames = [
    'get_collection_schema',
    'lookup_doy_code',
    'search_esco_occupations',
    'search_esco_skills',
  ] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    _ctx: AgenticContext
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'get_collection_schema':
        return this.executeGetCollectionSchema(args);
      case 'lookup_doy_code':
        return this.executeLookupDoyCode(args);
      case 'search_esco_occupations':
        return this.executeSearchEscoOccupations(args);
      case 'search_esco_skills':
        return this.executeSearchEscoSkills(args);
      default:
        return { success: false, error: `Unknown utility tool: ${toolName}` };
    }
  }

  // --------------------------------------------------------------------------
  // get_collection_schema
  // --------------------------------------------------------------------------

  private executeGetCollectionSchema(
    args: Record<string, unknown>
  ): ToolResult {
    const collection = String(args.collection ?? '');
    const schema = getCollectionSchemaInfo(collection);

    if (!schema) {
      return {
        success: false,
        error: `No schema info for collection "${collection}". Available: ${[...ALLOWED_READ_COLLECTIONS].join(', ')}`,
      };
    }

    return { success: true, data: schema };
  }

  // --------------------------------------------------------------------------
  // lookup_doy_code
  // --------------------------------------------------------------------------

  private async executeLookupDoyCode(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const query = String(args.query ?? '').toLowerCase().trim();
    if (!query) {
      return { success: false, error: 'query is required' };
    }

    const { GREEK_TAX_OFFICES } = await import(
      '@/subapps/accounting/data/greek-tax-offices'
    );

    const normalizeGreek = (s: string): string =>
      s.toLowerCase()
        .replace(/ά/g, 'α').replace(/έ/g, 'ε').replace(/ή/g, 'η')
        .replace(/ί/g, 'ι').replace(/ό/g, 'ο').replace(/ύ/g, 'υ').replace(/ώ/g, 'ω')
        .replace(/ϊ/g, 'ι').replace(/ΐ/g, 'ι').replace(/ϋ/g, 'υ').replace(/ΰ/g, 'υ')
        .replace(/'/g, '').replace(/'/g, '').replace(/\\/g, '');

    const normalizedQuery = normalizeGreek(query);
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length >= 2);

    const matches = GREEK_TAX_OFFICES.filter(office => {
      const normalizedName = normalizeGreek(office.name);
      const normalizedRegion = normalizeGreek(office.region);
      const fullText = `${normalizedName} ${normalizedRegion} ${office.code}`;
      return queryWords.every(w => fullText.includes(w));
    }).slice(0, 10);

    if (matches.length === 0) {
      return {
        success: false,
        error: `Δεν βρέθηκε ΔΟΥ για "${query}". Δοκίμασε με μέρος του ονόματος (π.χ. "Ιωνία", "Καλλιθέα").`,
      };
    }

    return {
      success: true,
      data: matches.map(m => ({
        code: m.code,
        name: m.name,
        region: m.region,
      })),
      count: matches.length,
    };
  }

  // --------------------------------------------------------------------------
  // ESCO Search — Occupations & Skills (ADR-132)
  // Delegates to shared esco-search-utils.ts
  // --------------------------------------------------------------------------

  private async executeSearchEscoOccupations(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const query = String(args.query ?? '').trim();
    if (query.length < 2) {
      return { success: false, error: 'query must be at least 2 characters' };
    }

    const results = await searchEscoOccupations(query, 10);
    return { success: true, data: results, count: results.length };
  }

  private async executeSearchEscoSkills(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const query = String(args.query ?? '').trim();
    if (query.length < 2) {
      return { success: false, error: 'query must be at least 2 characters' };
    }

    const results = await searchEscoSkills(query, 10);
    return { success: true, data: results, count: results.length };
  }
}
