/**
 * =============================================================================
 * COPYABLE LINK FIELD — SSoT (ADR-315 Α11 · ADR-923 §5.11 «3γ» Α15)
 * =============================================================================
 *
 * The «Copy link» row of Google Drive / Figma: the link in a read-only field (the whole
 * text is selected on focus, so it can still be copied by hand when the clipboard refuses)
 * plus one copy button whose label confirms the copy. The link is ALWAYS visible — showing
 * it never waits for the clipboard.
 *
 * Labels arrive translated: the field is shared by surfaces in different namespaces
 * (`files` share dialog · `procurement` PO actions).
 *
 * @module components/sharing/fields/CopyableLinkField
 */

'use client';

import React from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface CopyableLinkFieldProps {
  readonly url: string;
  /** Accessible name of the field (e.g. «Σύνδεσμος»). */
  readonly fieldLabel: string;
  readonly copyLabel: string;
  /** Shown instead of `copyLabel` while `copied` is true (e.g. from `useCopyToClipboard`). */
  readonly copiedLabel?: string;
  readonly copied?: boolean;
  readonly onCopy: () => void;
}

export function CopyableLinkField({
  url, fieldLabel, copyLabel, copiedLabel, copied = false, onCopy,
}: CopyableLinkFieldProps): React.ReactElement {
  const showCopied = copied && copiedLabel !== undefined;
  return (
    <span className="flex gap-2">
      <Input readOnly value={url} aria-label={fieldLabel} onFocus={(e) => e.currentTarget.select()} />
      <Button type="button" variant="outline" onClick={onCopy} aria-live="polite">
        {showCopied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
        {showCopied ? copiedLabel : copyLabel}
      </Button>
    </span>
  );
}
