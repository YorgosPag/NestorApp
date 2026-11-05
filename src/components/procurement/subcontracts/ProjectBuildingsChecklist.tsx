'use client';

/**
 * Τα κτίρια **ενός** έργου ως λίστα επιλογής (ADR-928 §5.24) — ένα σημείο για το συμφωνητικό ενός έργου (μέρη) και για
 * την εντολή εργασίας. Ετικέτα από τον ίδιο κανόνα με το στιγμιότυπο του γραφέα (`buildingLabelOf`): ό,τι διαλέγει ο
 * άνθρωπος, αυτό τυπώνει το χαρτί.
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { buildingLabelOf } from '@/lib/buildings/building-label';

interface ProjectBuildingsChecklistProps {
  /** Πρόθεμα των `id` — μοναδικό ανά οθόνη (δύο λίστες στην ίδια σελίδα δεν μοιράζονται `id`). */
  readonly idPrefix: string;
  readonly projectId: string;
  readonly value: readonly string[];
  readonly onChange: (buildingIds: readonly string[]) => void;
  readonly disabled?: boolean;
}

export function ProjectBuildingsChecklist({ idPrefix, projectId, value, onChange, disabled }: ProjectBuildingsChecklistProps) {
  const { t } = useTranslation('procurement');
  const { buildings } = useFirestoreBuildings();
  const ofProject = buildings.filter((building) => building.projectId === projectId);
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((candidate) => candidate !== id));
  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-sm font-medium">{t('subcontracts.editor.parties.buildings')}</legend>
      {ofProject.length === 0 && <p className="text-sm text-muted-foreground">{t('subcontracts.editor.parties.noBuildings')}</p>}
      <ul className="flex flex-wrap gap-3">
        {ofProject.map((building) => (
          <li key={building.id} className="flex items-center gap-2">
            <Checkbox id={`${idPrefix}-${building.id}`} checked={value.includes(building.id)} onCheckedChange={(checked) => toggle(building.id, checked === true)} />
            <Label htmlFor={`${idPrefix}-${building.id}`}>{buildingLabelOf(building)}</Label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
