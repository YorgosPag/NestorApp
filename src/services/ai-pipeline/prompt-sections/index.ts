/** Barrel exports for prompt sections. @see ADR-171 */

export type { PromptSectionContext, PromptSectionBuilder } from './types';
export { buildHeaderSection } from './header-section';
export { buildCoreRulesSection } from './core-rules-section';
export { buildDataQuerySection } from './data-query-section';
export { buildContactRulesSection } from './contact-rules-section';
export { buildResponseFormatSection } from './response-format-section';
