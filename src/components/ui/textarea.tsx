import * as React from 'react';

import {cn} from '@/lib/utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// =============================================================================
// 🏢 ENTERPRISE TEXTAREA COMPONENT
// =============================================================================
// SSoT size variants — eliminates className height overrides across codebase
// =============================================================================

type TextareaSize = 'sm' | 'md' | 'lg';

interface TextareaProps extends React.ComponentProps<'textarea'> {
  /** Controls the min-height of the textarea. Defaults to 'md'. */
  size?: TextareaSize;
}

// 🏢 ENTERPRISE: Size tokens — SSoT for textarea height (ADR audit 2026-03-28)
const TEXTAREA_SIZE: Record<TextareaSize, string> = {
  sm: 'min-h-[60px] md:min-h-[48px]',     // compact — comments, inline notes
  md: 'min-h-[100px] md:min-h-[80px]',    // default (current behavior)
  lg: 'min-h-[160px] md:min-h-[120px]',   // rich content — document templates
} as const;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({className, size = 'md', ...props}, ref) => {
    const { quick } = useBorderTokens();
    const colors = useSemanticColors();

    const baseStyles = [
      'flex w-full',
      quick.input,
      colors.bg.primary,
      'px-4 md:px-3 py-3 md:py-2',
      'text-base md:text-sm',
      'ring-offset-background',
      'placeholder:text-muted-foreground', // eslint-disable-line custom/no-hardcoded-strings -- Tailwind CSS pseudo-class
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:bg-muted/50',
    ].join(' ');

    return (
      <textarea
        className={cn(baseStyles, TEXTAREA_SIZE[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
export type { TextareaProps };
