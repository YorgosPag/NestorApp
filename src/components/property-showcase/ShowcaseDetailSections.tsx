'use client';

/**
 * Property Showcase — detail section cards (ADR-312 Phase 4).
 *
 * Every section mirrors one container of the `Πληροφορίες` tab on the
 * property detail page so the public showcase achieves full parity with the
 * internal UI. Each card is a presentation-only component — all data comes
 * from the SSoT `ShowcasePropertySnapshot` returned by the public API.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  ShowcasePropertySnapshot,
  ShowcaseCommercialInfo,
  ShowcaseProjectInfo,
  ShowcaseSystemsInfo,
  ShowcaseFinishesInfo,
  ShowcaseFeaturesInfo,
  ShowcaseEnergyInfo,
  ShowcaseLinkedSpace,
  ShowcaseViewInfo,
} from './types';
import { AddressMapPicker } from './AddressMapPicker';

type Pair = [label: string, value: string];
type Translator = (key: string) => string;

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
      <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-4">{title}</h2>
      {children}
    </section>
  );
}

function KeyValueGrid({ pairs }: { pairs: Pair[] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      {pairs.map(([label, value]) => (
        <div
          key={label}
          className="flex justify-between gap-3 border-b border-[hsl(var(--showcase-border))] pb-2"
        >
          <dt className="text-[hsl(var(--showcase-muted-fg))]">{label}</dt>
          <dd className="text-[hsl(var(--showcase-fg))] font-medium text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm text-[hsl(var(--showcase-muted-fg))]">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-[hsl(var(--showcase-bg))] text-[hsl(var(--showcase-fg))] border border-[hsl(var(--showcase-border))]"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ShowcaseProjectCard({ project, t }: { project: ShowcaseProjectInfo; t: Translator }) {
  if (!project.name && !project.address) return null;
  return (
    <SectionCard title={t('project.sectionTitle')}>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {project.name && (
          <div className="flex justify-between gap-3 border-b border-[hsl(var(--showcase-border))] pb-2">
            <dt className="text-[hsl(var(--showcase-muted-fg))]">{t('project.name')}</dt>
            <dd className="text-[hsl(var(--showcase-fg))] font-medium text-right">{project.name}</dd>
          </div>
        )}
        {project.address && (
          <div className="flex justify-between gap-3 border-b border-[hsl(var(--showcase-border))] pb-2">
            <dt className="text-[hsl(var(--showcase-muted-fg))]">{t('project.address')}</dt>
            <dd className="text-[hsl(var(--showcase-fg))] font-medium text-right">
              <AddressMapPicker address={project.address} />
            </dd>
          </div>
        )}
      </dl>
    </SectionCard>
  );
}

export function ShowcaseCommercialCard({
  commercial,
  t,
  locale,
}: {
  commercial: ShowcaseCommercialInfo;
  t: Translator;
  locale: string;
}) {
  const pairs: Pair[] = [];
  const status = commercial.statusLabel || commercial.status;
  if (status) pairs.push([t('commercial.availability'), status]);
  const operational = commercial.operationalStatusLabel || commercial.operationalStatus;
  if (operational) pairs.push([t('commercial.operational'), operational]);
  if (commercial.askingPrice !== undefined) {
    const priceLocale = locale === 'el' ? 'el-GR' : 'en-US';
    const formatted = new Intl.NumberFormat(priceLocale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(commercial.askingPrice);
    pairs.push([t('commercial.price'), formatted]);
  }
  if (pairs.length === 0) return null;
  return (
    <SectionCard title={t('commercial.sectionTitle')}>
      <KeyValueGrid pairs={pairs} />
    </SectionCard>
  );
}

export function ShowcaseSystemsCard({ systems, t }: { systems: ShowcaseSystemsInfo; t: Translator }) {
  const pairs: Pair[] = [];
  const heating = systems.heatingLabel || systems.heatingType;
  if (heating) pairs.push([t('systems.heating'), heating]);
  if (systems.heatingFuel) pairs.push([t('systems.heatingFuel'), systems.heatingFuel]);
  const cooling = systems.coolingLabel || systems.coolingType;
  if (cooling) pairs.push([t('systems.cooling'), cooling]);
  if (systems.waterHeating) pairs.push([t('systems.waterHeating'), systems.waterHeating]);
  if (pairs.length === 0) return null;
  return (
    <SectionCard title={t('systems.sectionTitle')}>
      <KeyValueGrid pairs={pairs} />
    </SectionCard>
  );
}

export function ShowcaseFinishesCard({ finishes, t }: { finishes: ShowcaseFinishesInfo; t: Translator }) {
  const pairs: Pair[] = [];
  const flooring = finishes.flooringLabels ?? finishes.flooring;
  if (flooring && flooring.length > 0) pairs.push([t('finishes.flooring'), flooring.join(', ')]);
  const frames = finishes.windowFramesLabel || finishes.windowFrames;
  if (frames) pairs.push([t('finishes.frames'), frames]);
  const glazing = finishes.glazingLabel || finishes.glazing;
  if (glazing) pairs.push([t('finishes.glazing'), glazing]);
  if (pairs.length === 0) return null;
  return (
    <SectionCard title={t('finishes.sectionTitle')}>
      <KeyValueGrid pairs={pairs} />
    </SectionCard>
  );
}

export function ShowcaseFeaturesCard({ features, t }: { features: ShowcaseFeaturesInfo; t: Translator }) {
  const interior = features.interiorLabels ?? features.interior ?? [];
  const security = features.securityLabels ?? features.security ?? [];
  const amenities = features.amenities ?? [];
  if (interior.length === 0 && security.length === 0 && amenities.length === 0) return null;
  return (
    <SectionCard title={t('features.sectionTitle')}>
      <div className="space-y-4">
        <TagList label={t('features.interior')} items={interior} />
        <TagList label={t('features.security')} items={security} />
        <TagList label={t('features.amenities')} items={amenities} />
      </div>
    </SectionCard>
  );
}

export function ShowcaseEnergyExtrasCard({ energy, t }: { energy: ShowcaseEnergyInfo; t: Translator }) {
  const pairs: Pair[] = [];
  if (energy.class) pairs.push([t('energy.energyClass'), energy.class]);
  if (energy.certificateId) pairs.push([t('energy.certificateId'), energy.certificateId]);
  if (energy.certificateDate) pairs.push([t('energy.certificateDate'), energy.certificateDate]);
  if (energy.validUntil) pairs.push([t('energy.validUntil'), energy.validUntil]);
  if (pairs.length === 0) return null;
  return (
    <SectionCard title={t('energy.sectionTitle')}>
      <KeyValueGrid pairs={pairs} />
    </SectionCard>
  );
}

export function ShowcaseLinkedSpacesCardView({
  linkedSpaces,
  t,
}: {
  linkedSpaces: ShowcaseLinkedSpace[];
  t: Translator;
}) {
  if (linkedSpaces.length === 0) return null;
  return (
    <SectionCard title={t('linkedSpaces.sectionTitle')}>
      <ul className="flex flex-col divide-y divide-[hsl(var(--showcase-border))]">
        {linkedSpaces.map((space, idx) => (
          <li key={`${space.spaceType}-${space.allocationCode ?? idx}`} className="py-2 flex flex-col gap-1">
            <p className="text-sm font-medium text-[hsl(var(--showcase-fg))]">
              {t(space.spaceType === 'parking' ? 'linkedSpaces.parking' : 'linkedSpaces.storage')}
              {space.allocationCode ? ` · ${space.allocationCode}` : ''}
            </p>
            <p className="text-xs text-[hsl(var(--showcase-muted-fg))]">
              {buildSpaceDetail(space, t)}
            </p>
            {space.description && (
              <p className="text-xs text-[hsl(var(--showcase-muted-fg))] whitespace-pre-wrap">
                {space.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function buildSpaceDetail(space: ShowcaseLinkedSpace, t: Translator): string {
  const parts: string[] = [];
  if (space.floor) parts.push(`${t('linkedSpaces.floor')}: ${space.floor}`);
  if (space.area !== undefined) parts.push(`${space.area} ${t('specs.areaUnit')}`);
  if (space.inclusion) {
    const key = `linkedSpaces.inclusions.${space.inclusion}`;
    const label = t(key);
    parts.push(`${t('linkedSpaces.inclusion')}: ${label || space.inclusion}`);
  }
  return parts.join(' · ');
}

export function ShowcaseOrientationCard({
  orientations,
  orientationLabels,
  t,
}: {
  orientations?: string[];
  orientationLabels?: string[];
  t: Translator;
}) {
  const items = orientationLabels && orientationLabels.length > 0
    ? orientationLabels
    : orientations ?? [];
  if (items.length === 0) return null;
  return (
    <SectionCard title={t('orientation.sectionTitle')}>
      <TagList label={t('orientation.sectionTitle')} items={items} />
    </SectionCard>
  );
}

export function ShowcaseViewsCard({ views, t }: { views: ShowcaseViewInfo[]; t: Translator }) {
  if (views.length === 0) return null;
  const items = views.map((v) => (v.quality ? `${v.type} (${v.quality})` : v.type));
  return (
    <SectionCard title={t('views.sectionTitle')}>
      <TagList label={t('views.sectionTitle')} items={items} />
    </SectionCard>
  );
}

export function ShowcaseDetailSections({
  property,
  locale,
}: {
  property: ShowcasePropertySnapshot;
  locale: string;
}) {
  const { t } = useTranslation('showcase');
  return (
    <>
      {property.project && <ShowcaseProjectCard project={property.project} t={t} />}
      {property.commercial && (
        <ShowcaseCommercialCard commercial={property.commercial} t={t} locale={locale} />
      )}
      {property.views && property.views.length > 0 && (
        <ShowcaseViewsCard views={property.views} t={t} />
      )}
      {property.systems && <ShowcaseSystemsCard systems={property.systems} t={t} />}
      {property.finishes && <ShowcaseFinishesCard finishes={property.finishes} t={t} />}
      {property.features && <ShowcaseFeaturesCard features={property.features} t={t} />}
      {property.energy && <ShowcaseEnergyExtrasCard energy={property.energy} t={t} />}
      {property.linkedSpaces && property.linkedSpaces.length > 0 && (
        <ShowcaseLinkedSpacesCardView linkedSpaces={property.linkedSpaces} t={t} />
      )}
    </>
  );
}
