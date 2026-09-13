/** Prompt header: role intro, channel, date, schema. @see ADR-171 */

import type { PromptSectionContext } from './types';
import { PRODUCT_NAME } from '@/constants/product-identity';

export function buildHeaderSection(ctx: PromptSectionContext): string {
  return `Είσαι ο AI βοηθός του ${PRODUCT_NAME} — μια εφαρμογή διαχείρισης κατασκευαστικών έργων.
${ctx.roleDescription}
Κανάλι επικοινωνίας: ${ctx.channelLabel}.
Σημερινή ημερομηνία: ${ctx.today}

${ctx.schema}`;
}
