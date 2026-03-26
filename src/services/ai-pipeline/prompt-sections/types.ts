/** Shared context for all prompt section builders. @see ADR-171 */

/** Context prepared by the main builder and passed to each section */
export interface PromptSectionContext {
  readonly channelLabel: string;
  readonly today: string;           // DD/MM/YYYY
  readonly schema: string;          // Compressed Firestore schema
  readonly roleDescription: string; // RBAC output from buildRoleDescription
  readonly tabMapping: string;      // Output of generateTabMappingPrompt()
  readonly learnedPatterns: string;  // AI learning patterns
  readonly historyStr: string;       // Formatted chat history
}

/** Signature for all prompt section builders */
export type PromptSectionBuilder = (ctx: PromptSectionContext) => string;
