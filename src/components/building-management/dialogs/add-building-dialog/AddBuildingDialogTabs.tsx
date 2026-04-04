import { Checkbox } from '@/components/ui/checkbox';
import { FormField, FormGrid, FormInput } from '@/components/ui/form/FormComponents';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ProjectListItem } from '../../building-services';
import type { CompanyContact } from '@/types/contacts';
import {
  BUILDING_CATEGORY_OPTIONS,
  BUILDING_STATUS_OPTIONS,
  BUILDING_TYPE_OPTIONS,
  ENERGY_CLASS_OPTIONS,
  PRIORITY_OPTIONS,
  type BuildingDialogTabProps,
} from './add-building-dialog.config';

interface BasicInfoTabProps extends Pick<BuildingDialogTabProps, 'formData' | 'loading' | 'errors' | 't' | 'handleChange' | 'handleSelectChange'> {
  companies: CompanyContact[];
  companiesLoading: boolean;
  filteredProjects: ProjectListItem[];
  projectsLoading: boolean;
  selectedCompanyFilter: string;
  setSelectedCompanyFilter: (value: string) => void;
}

export function AddBuildingBasicInfoTab({
  formData,
  loading,
  errors,
  t,
  handleChange,
  handleSelectChange,
  companies,
  companiesLoading,
  filteredProjects,
  projectsLoading,
  selectedCompanyFilter,
  setSelectedCompanyFilter,
}: BasicInfoTabProps) {
  return (
    <FormGrid>
      <FormField label={t('dialog.fields.name')} htmlFor="name" required>
        <FormInput>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={t('dialog.fields.namePlaceholder')}
            disabled={loading}
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name}</p> : null}
        </FormInput>
      </FormField>

      <FormField label={t('dialog.fields.companyFilter')} htmlFor="companyFilter">
        <FormInput>
          <Select
            value={selectedCompanyFilter}
            onValueChange={(value) => {
              setSelectedCompanyFilter(value === '__all__' ? '' : value);
              handleSelectChange('projectId', '');
            }}
            disabled={loading || companiesLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('dialog.fields.companyFilterPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('dialog.fields.companyFilterPlaceholder')}</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id ?? ''}>
                  {company.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormInput>
      </FormField>

      <FormField label={t('dialog.fields.project')} htmlFor="projectId" required>
        <FormInput>
          <Select
            value={formData.projectId}
            onValueChange={(value) => handleSelectChange('projectId', value)}
            disabled={loading || projectsLoading}
          >
            <SelectTrigger className={errors.projectId ? 'border-destructive' : ''}>
              <SelectValue placeholder={t('dialog.fields.projectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {filteredProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.projectId ? <p className="mt-1 text-xs text-destructive">{errors.projectId}</p> : null}
        </FormInput>
      </FormField>

      <FormField label={t('dialog.fields.status')} htmlFor="status">
        <FormInput>
          <Select
            value={formData.status}
            onValueChange={(value) => handleSelectChange('status', value)}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('dialog.fields.statusPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {BUILDING_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormInput>
      </FormField>

      <FormField label={t('dialog.fields.category')} htmlFor="category">
        <FormInput>
          <Select
            value={formData.category}
            onValueChange={(value) => handleSelectChange('category', value)}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('dialog.fields.categoryPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {BUILDING_CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormInput>
      </FormField>

      <FormField label={t('dialog.fields.description')} htmlFor="description">
        <FormInput>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder={t('dialog.fields.descriptionPlaceholder')}
            disabled={loading}
            rows={3}
          />
        </FormInput>
      </FormField>
    </FormGrid>
  );
}

export function AddBuildingDetailsTab({
  formData,
  loading,
  errors,
  t,
  handleChange,
  handleNumberChange,
}: Pick<BuildingDialogTabProps, 'formData' | 'loading' | 'errors' | 't' | 'handleChange' | 'handleNumberChange'>) {
  return (
    <FormGrid>
      <FormField label={t('dialog.fields.address')} htmlFor="address" required>
        <FormInput>
          <Input id="address" name="address" value={formData.address} onChange={handleChange} placeholder={t('dialog.fields.addressPlaceholder')} disabled={loading} className={errors.address ? 'border-destructive' : ''} />
          {errors.address ? <p className="mt-1 text-xs text-destructive">{errors.address}</p> : null}
        </FormInput>
      </FormField>
      <FormField label={t('dialog.fields.city')} htmlFor="city"><FormInput><Input id="city" name="city" value={formData.city} onChange={handleChange} placeholder={t('dialog.fields.cityPlaceholder')} disabled={loading} /></FormInput></FormField>
      <FormField label={t('dialog.fields.totalArea')} htmlFor="totalArea"><FormInput><Input id="totalArea" name="totalArea" type="number" value={formData.totalArea} onChange={(event) => handleNumberChange('totalArea', event.target.value)} placeholder={t('dialog.fields.totalAreaPlaceholder')} disabled={loading} className={errors.totalArea ? 'border-destructive' : ''} />{errors.totalArea ? <p className="mt-1 text-xs text-destructive">{errors.totalArea}</p> : null}</FormInput></FormField>
      <FormField label={t('dialog.fields.builtArea')} htmlFor="builtArea"><FormInput><Input id="builtArea" name="builtArea" type="number" value={formData.builtArea} onChange={(event) => handleNumberChange('builtArea', event.target.value)} placeholder={t('dialog.fields.builtAreaPlaceholder')} disabled={loading} className={errors.builtArea ? 'border-destructive' : ''} />{errors.builtArea ? <p className="mt-1 text-xs text-destructive">{errors.builtArea}</p> : null}</FormInput></FormField>
      <FormField label={t('dialog.fields.floors')} htmlFor="floors"><FormInput><Input id="floors" name="floors" type="number" value={formData.floors} onChange={(event) => handleNumberChange('floors', event.target.value)} placeholder={t('dialog.fields.floorsPlaceholder')} disabled={loading} className={errors.floors ? 'border-destructive' : ''} />{errors.floors ? <p className="mt-1 text-xs text-destructive">{errors.floors}</p> : null}</FormInput></FormField>
      <FormField label={t('dialog.fields.units')} htmlFor="units"><FormInput><Input id="units" name="units" type="number" value={formData.units} onChange={(event) => handleNumberChange('units', event.target.value)} placeholder={t('dialog.fields.unitsPlaceholder')} disabled={loading} className={errors.units ? 'border-destructive' : ''} />{errors.units ? <p className="mt-1 text-xs text-destructive">{errors.units}</p> : null}</FormInput></FormField>
      <FormField label={t('dialog.fields.totalValue')} htmlFor="totalValue"><FormInput><Input id="totalValue" name="totalValue" type="number" value={formData.totalValue} onChange={(event) => handleNumberChange('totalValue', event.target.value)} placeholder={t('dialog.fields.totalValuePlaceholder')} disabled={loading} /></FormInput></FormField>
      <FormField label={t('dialog.fields.startDate')} htmlFor="startDate"><FormInput><Input id="startDate" name="startDate" type="date" value={formData.startDate} onChange={handleChange} disabled={loading} /></FormInput></FormField>
      <FormField label={t('dialog.fields.completionDate')} htmlFor="completionDate"><FormInput><Input id="completionDate" name="completionDate" type="date" value={formData.completionDate} onChange={handleChange} disabled={loading} /></FormInput></FormField>
    </FormGrid>
  );
}

export function AddBuildingFeaturesTab({
  formData,
  loading,
  t,
  handleCheckboxChange,
  handleSelectChange,
}: Pick<BuildingDialogTabProps, 'formData' | 'loading' | 't' | 'handleCheckboxChange' | 'handleSelectChange'>) {
  return (
    <>
      <section className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        {[
          ['hasParking', t('filters.checkboxes.hasParking')],
          ['hasElevator', t('filters.checkboxes.hasElevator')],
          ['hasGarden', t('filters.checkboxes.hasGarden')],
          ['hasPool', t('filters.checkboxes.hasPool')],
          ['accessibility', t('filters.checkboxes.accessibility')],
        ].map(([fieldName, label]) => (
          <div key={fieldName} className="flex items-center space-x-2">
            <Checkbox
              id={fieldName}
              checked={Boolean(formData[fieldName as keyof typeof formData])}
              onCheckedChange={(checked) => handleCheckboxChange(fieldName as keyof typeof formData, checked as boolean)}
              disabled={loading}
            />
            <Label htmlFor={fieldName} className="text-sm font-medium">{label}</Label>
          </div>
        ))}
      </section>

      <FormGrid>
        <FormField label={t('dialog.fields.type')} htmlFor="type">
          <FormInput>
            <Select value={formData.type} onValueChange={(value) => handleSelectChange('type', value)} disabled={loading}>
              <SelectTrigger><SelectValue placeholder={t('dialog.fields.typePlaceholder')} /></SelectTrigger>
              <SelectContent>
                {BUILDING_TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{t(option.labelKey)}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormInput>
        </FormField>
        <FormField label={t('dialog.fields.priority')} htmlFor="priority">
          <FormInput>
            <Select value={formData.priority} onValueChange={(value) => handleSelectChange('priority', value)} disabled={loading}>
              <SelectTrigger><SelectValue placeholder={t('dialog.fields.priorityPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{t(option.labelKey)}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormInput>
        </FormField>
        <FormField label={t('dialog.fields.energyClass')} htmlFor="energyClass">
          <FormInput>
            <Select value={formData.energyClass} onValueChange={(value) => handleSelectChange('energyClass', value)} disabled={loading}>
              <SelectTrigger><SelectValue placeholder={t('dialog.fields.energyClassPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {ENERGY_CLASS_OPTIONS.map((energyClass) => <SelectItem key={energyClass} value={energyClass}>{energyClass}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormInput>
        </FormField>
      </FormGrid>
    </>
  );
}
