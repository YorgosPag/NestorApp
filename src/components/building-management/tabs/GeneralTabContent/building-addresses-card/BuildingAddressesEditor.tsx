import { Pencil, Plus, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ProjectAddress } from '@/types/project/addresses';
import { AddressFormSection } from '@/components/shared/addresses';
import { AddressMap } from '@/components/shared/addresses/AddressMap';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BuildingAddressEditorMode } from './building-addresses-card-types';

interface BuildingAddressesEditorProps {
  mode: BuildingAddressEditorMode;
  initialValues?: ProjectAddress;
  externalValues: Partial<ProjectAddress> | null;
  onExternalValuesChange: (address: Partial<ProjectAddress> | null) => void;
  onChange: (address: Partial<ProjectAddress> | null) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
}

interface EditorPresentation {
  titleKey: string;
  Icon: LucideIcon;
}

const EDITOR_PRESENTATION: Record<BuildingAddressEditorMode, EditorPresentation> = {
  create: { titleKey: 'address.labels.addAddress', Icon: Plus },
  edit: { titleKey: 'address.labels.editAddress', Icon: Pencil },
};

export function BuildingAddressesEditor({
  mode,
  initialValues,
  externalValues,
  onExternalValuesChange,
  onChange,
  onCancel,
  onSave,
  isSaving,
}: BuildingAddressesEditorProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('building');
  const presentation = EDITOR_PRESENTATION[mode];

  return (
    <section className="border-2 border-primary rounded-lg p-2 bg-card space-y-2">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <presentation.Icon className={iconSizes.md} />
          {t(presentation.titleKey)}
        </h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className={iconSizes.sm} />
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <AddressFormSection
            key={`${mode}-${initialValues?.id ?? 'new'}`}
            onChange={onChange}
            initialValues={initialValues}
            externalValues={externalValues}
          />
          <footer className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              {t('tabs.general.header.cancel')}
            </Button>
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving ? t('tabs.general.header.saving') : t('tabs.general.header.save')}
            </Button>
          </footer>
        </div>

        <aside className="lg:sticky lg:top-0 lg:self-start lg:h-[calc(100vh-12rem)]">
          <AddressMap
            addresses={initialValues ? [initialValues] : []}
            draggableMarkers
            onAddressDragUpdate={onExternalValuesChange}
            heightPreset="viewerFullscreen"
            className="rounded-lg border shadow-sm !h-full"
          />
        </aside>
      </div>
    </section>
  );
}
