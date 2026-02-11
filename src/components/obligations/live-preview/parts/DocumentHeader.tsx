"use client";

import { Badge } from "@/components/ui/badge";
import { FileText, Hash, MapPin, Users } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/design-system';
import { getSpacingClass } from '@/lib/design-system';
import type { ObligationDocument } from '@/types/obligations';
import { formatDate } from '@/lib/intl-utils';
import { getObligationStatusLabel } from "@/constants/property-statuses-enterprise";
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface DocumentHeaderProps {
    doc: Partial<ObligationDocument>;
}

export function DocumentHeader({ doc }: DocumentHeaderProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('obligations');
  const statusKeyOrValue = getObligationStatusLabel(doc.status || "draft");
  const statusLabel = statusKeyOrValue.includes(':') ? t(statusKeyOrValue) : statusKeyOrValue;

  return (
    <div className={`text-center space-y-4 ${getSpacingClass('p', 'xl')} border-b bg-muted/30`}>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground uppercase tracking-wide">
          {doc.contractorCompany || t('documentHeader.defaultContractor')}
        </h1>
        <div className="text-sm text-muted-foreground">{t('documentHeader.companyType')}</div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-primary underline decoration-2">
          {t('documentHeader.documentTitle')}
        </h2>
        <h3 className="text-lg font-medium">
          {doc.title || t('documentHeader.defaultTitle')}
        </h3>
        <div className="text-base text-foreground">
          {doc.projectName || t('documentHeader.defaultProjectName')}
        </div>
      </div>

      {doc.projectDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t text-sm">
          {doc.projectDetails.location && (
            <div className="flex items-center gap-2">
              <MapPin className={`${iconSizes.sm} text-muted-foreground`} />
              <span className="text-muted-foreground">{t('documentHeader.fields.location')}</span>
              <span>{doc.projectDetails.location}</span>
            </div>
          )}
          {doc.projectDetails.address && (
            <div className="flex items-center gap-2">
              {/* 🏢 ENTERPRISE: Using centralized building icon/color */}
              <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.building.color)} />
              <span className="text-muted-foreground">{t('documentHeader.fields.address')}</span>
              <span>{doc.projectDetails.address}</span>
            </div>
          )}
          {doc.projectDetails.plotNumber && (
            <div className="flex items-center gap-2">
              <Hash className={`${iconSizes.sm} text-muted-foreground`} />
              <span className="text-muted-foreground">{t('documentHeader.fields.plot')}</span>
              <span>{doc.projectDetails.plotNumber}</span>
            </div>
          )}
          {doc.projectDetails.buildingPermitNumber && (
            <div className="flex items-center gap-2">
              <FileText className={`${iconSizes.sm} text-muted-foreground`} />
              <span className="text-muted-foreground">{t('documentHeader.fields.buildingPermit')}</span>
              <span>{doc.projectDetails.buildingPermitNumber}</span>
            </div>
          )}
        </div>
      )}

      {doc.owners && doc.owners.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center gap-2 mb-3">
            <Users className={`${iconSizes.sm} text-muted-foreground`} />
            <span className="font-medium text-foreground">{t('documentHeader.fields.owners')}</span>
          </div>
          <div className="space-y-2 text-sm">
            {doc.owners.map((owner, index) => (
              <div key={owner.id ?? `owner-${index}`} className="flex justify-between items-center">
                <span>{owner.name || t('documentHeader.fields.ownerDefault', { index: index + 1 })}</span>
                {typeof owner.share === "number" && (
                  <Badge variant="outline" className="text-xs">
                    {owner.share}%
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mt-6 pt-6 border-t text-xs text-muted-foreground">
        <div>
          {t('documentHeader.fields.status')}{" "}
          <Badge variant="outline">
            {statusLabel}
          </Badge>
        </div>
        <div>{formatDate(doc.updatedAt || new Date())}</div>
      </div>
    </div>
  );
}

