'use client';

/**
 * **Φόρμα | ζωντανή προεπισκόπηση** — η μία διάταξη των επεξεργαστών της υπεργολαβίας (συμφωνητικό · ρήτρα · πρότυπο,
 * ADR-928 Φ3γ · §5.22), όπως Figma/Procore.
 *
 * 🔑 Οθόνη υπολογιστή ⇒ `ResizablePanelGroup` (δύο στήλες, ρυθμιζόμενες)· κινητό ⇒ καρτέλες «Φόρμα / Προεπισκόπηση»
 *    (δύο στήλες σε 390 px δεν διαβάζονται).
 * 🔑 Εξήχθη από το `AgreementEditor` (Φ3γ-0b): ο επεξεργαστής ρήτρας και προτύπου χρειάζονται **την ίδια** διάταξη, και
 *    δεύτερο αντίγραφο θα απέκλινε στο πρώτο νέο breakpoint.
 */

import type { ReactNode } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/useMobile';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface EditorSplitLayoutProps {
  readonly form: ReactNode;
  readonly preview: ReactNode;
}

function DesktopSplit({ form, preview }: EditorSplitLayoutProps) {
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-[calc(100dvh-16rem)] min-h-[32rem] rounded-lg border">
      <ResizablePanel defaultSize="55%" minSize="35%" className="overflow-y-auto">
        {form}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="45%" minSize="30%" className="overflow-y-auto bg-muted/20 p-4">
        {preview}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function MobileTabs({ form, preview }: EditorSplitLayoutProps) {
  const { t } = useTranslation('procurement');
  return (
    <Tabs defaultValue="form">
      <TabsList>
        <TabsTrigger value="form">{t('subcontracts.editor.tabs.form')}</TabsTrigger>
        <TabsTrigger value="preview">{t('subcontracts.editor.tabs.preview')}</TabsTrigger>
      </TabsList>
      <TabsContent value="form">{form}</TabsContent>
      <TabsContent value="preview">{preview}</TabsContent>
    </Tabs>
  );
}

export function EditorSplitLayout(props: EditorSplitLayoutProps) {
  return useIsMobile() ? <MobileTabs {...props} /> : <DesktopSplit {...props} />;
}
