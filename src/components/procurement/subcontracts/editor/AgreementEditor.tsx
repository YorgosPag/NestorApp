'use client';

/**
 * Ο επεξεργαστής συμφωνητικού υπεργολαβίας (ADR-928 Φ3γ): φόρμα | ζωντανή προεπισκόπηση, όπως Figma/Procore.
 *
 * 🔑 Η κατάσταση ζει **ένα** επίπεδο πάνω (`useAgreementEditor`, στη σελίδα), ώστε η σελίδα να ξέρει αν υπάρχουν μη
 *    αποθηκευμένες αλλαγές (π.χ. «Έκδοση» ανενεργή ώσπου να αποθηκευτούν)· εδώ μόνο διάταξη.
 * 🔑 Οθόνη υπολογιστή ⇒ `ResizablePanelGroup` (δύο στήλες, ρυθμιζόμενες)· κινητό ⇒ καρτέλες «Φόρμα / Προεπισκόπηση»
 *    (δύο στήλες σε 390 px δεν διαβάζονται).
 * 🔑 Enter μέσα στη φόρμα = Αποθήκευση (μία διαδρομή με το κουμπί, `useAgreementEditor.save`, που ξέρει πότε επιτρέπεται).
 * Φορτώνεται με `import()` (ADR-744 §34): μοντέλο εγγράφου, bundles και ολογράφως δεν μπαίνουν στο slice της σελίδας.
 */

import type { FormEvent } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/useMobile';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AgreementLivePreview } from './AgreementLivePreview';
import { ClausesSection } from './ClausesSection';
import { ConflictBanner, EditorToolbar } from './EditorToolbar';
import { IdentitySection } from './IdentitySection';
import { PartiesSection } from './PartiesSection';
import type { AgreementEditor as Editor } from './useAgreementEditor';

interface AgreementEditorProps {
  readonly editor: Editor;
}

function EditorForm({ editor }: AgreementEditorProps) {
  const { t } = useTranslation('procurement');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void editor.save();
  };
  return (
    <form aria-label={t('subcontracts.editor.formLabel')} noValidate onSubmit={submit} className="space-y-6 p-4">
      <IdentitySection editor={editor} />
      <PartiesSection editor={editor} />
      <ClausesSection editor={editor} />
    </form>
  );
}

function DesktopSplit({ editor }: AgreementEditorProps) {
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-[calc(100dvh-16rem)] min-h-[32rem] rounded-lg border">
      <ResizablePanel defaultSize="55%" minSize="35%" className="overflow-y-auto">
        <EditorForm editor={editor} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="45%" minSize="30%" className="overflow-y-auto bg-muted/20 p-4">
        <AgreementLivePreview editor={editor} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function MobileTabs({ editor }: AgreementEditorProps) {
  const { t } = useTranslation('procurement');
  return (
    <Tabs defaultValue="form">
      <TabsList>
        <TabsTrigger value="form">{t('subcontracts.editor.tabs.form')}</TabsTrigger>
        <TabsTrigger value="preview">{t('subcontracts.editor.tabs.preview')}</TabsTrigger>
      </TabsList>
      <TabsContent value="form"><EditorForm editor={editor} /></TabsContent>
      <TabsContent value="preview"><AgreementLivePreview editor={editor} /></TabsContent>
    </Tabs>
  );
}

export default function AgreementEditor({ editor }: AgreementEditorProps) {
  const isMobile = useIsMobile();
  return (
    <section className="space-y-3">
      <EditorToolbar editor={editor} />
      <ConflictBanner editor={editor} />
      {isMobile ? <MobileTabs editor={editor} /> : <DesktopSplit editor={editor} />}
    </section>
  );
}
