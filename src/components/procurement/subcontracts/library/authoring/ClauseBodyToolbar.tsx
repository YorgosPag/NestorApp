'use client';

/**
 * **Η γραμμή εργαλείων του σώματος ρήτρας** (ADR-928 §5.22): λίστες · «Παράμετρος» (μενού, και με `{`) · «Κάνε το
 * παράμετρο». Κάθε κουμπί που δεν προσφέρεται λέει γιατί (`title` όχι — ορατή λέξη, CHECK 3.23).
 */

import { Braces, List, ListOrdered, Plus, WandSparkles } from 'lucide-react';
import { useEditorState, type Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { CLAUSE_AUTHORITATIVE_LANGUAGE } from '@/subapps/procurement/subcontracts/types/clause';
import type { ClauseParameterDefinition } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import { selectedPlainText } from './clause-param-node';

interface ClauseBodyToolbarProps {
  readonly editor: Editor | null;
  readonly parameters: readonly ClauseParameterDefinition[];
  readonly menuOpen: boolean;
  readonly onMenuOpenChange: (open: boolean) => void;
  readonly onInsert: (key: string) => void;
  readonly onNewParameter: (selection: string | null) => void;
}

function useToolbarState(editor: Editor | null) {
  return useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bullet: current?.isActive('bulletList') ?? false,
      ordered: current?.isActive('orderedList') ?? false,
      selection: current ? selectedPlainText(current) : null,
    }),
  }) ?? { bullet: false, ordered: false, selection: null };
}

function ParameterMenu({ parameters, menuOpen, onMenuOpenChange, onInsert, onNewParameter }: Omit<ClauseBodyToolbarProps, 'editor'>) {
  const { t } = useTranslation('procurement');
  return (
    <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline"><Braces className="mr-1 h-4 w-4" aria-hidden />{t('subcontracts.library.authoring.body.insertParameter')}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {parameters.length > 0 && <DropdownMenuLabel>{t('subcontracts.library.authoring.body.existingParameters')}</DropdownMenuLabel>}
        {parameters.map((parameter) => (
          <DropdownMenuItem key={parameter.key} onSelect={() => onInsert(parameter.key)}>
            {localizedIn(parameter.label, CLAUSE_AUTHORITATIVE_LANGUAGE) || parameter.key}
          </DropdownMenuItem>
        ))}
        {parameters.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={() => onNewParameter(null)}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('subcontracts.library.authoring.body.newParameter')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ClauseBodyToolbar(props: ClauseBodyToolbarProps) {
  const { t } = useTranslation('procurement');
  const { editor } = props;
  const state = useToolbarState(editor);
  return (
    <nav aria-label={t('subcontracts.library.authoring.body.toolbar')} className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant={state.bullet ? 'secondary' : 'ghost'} aria-pressed={state.bullet} disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
        <List className="mr-1 h-4 w-4" aria-hidden />{t('subcontracts.library.authoring.body.bulletList')}
      </Button>
      <Button type="button" size="sm" variant={state.ordered ? 'secondary' : 'ghost'} aria-pressed={state.ordered} disabled={!editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="mr-1 h-4 w-4" aria-hidden />{t('subcontracts.library.authoring.body.orderedList')}
      </Button>
      <ParameterMenu {...props} />
      <Button type="button" size="sm" variant="outline" disabled={state.selection === null} onClick={() => props.onNewParameter(state.selection)}>
        <WandSparkles className="mr-1 h-4 w-4" aria-hidden />{t('subcontracts.library.authoring.body.makeParameter')}
      </Button>
      {state.selection === null && <span className="text-xs text-muted-foreground">{t('subcontracts.library.authoring.body.makeParameterHint')}</span>}
    </nav>
  );
}
