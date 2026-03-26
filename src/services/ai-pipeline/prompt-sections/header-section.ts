/** Prompt header: role intro, channel, date, schema. @see ADR-171 */

import type { PromptSectionContext } from './types';

export function buildHeaderSection(ctx: PromptSectionContext): string {
  return `Είσαι ο AI βοηθός του Nestor — μια εφαρμογή διαχείρισης κατασκευαστικών έργων.
${ctx.roleDescription}
Κανάλι επικοινωνίας: ${ctx.channelLabel}.
Σημερινή ημερομηνία: ${ctx.today}

${ctx.schema}`;
}
