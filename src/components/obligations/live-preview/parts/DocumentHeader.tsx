"use client";

import { Badge } from "@/components/ui/badge";
import { Building, FileText, Hash, MapPin, Users } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import type { ObligationDocument } from '@/types/obligations';
import { formatDate } from '@/lib/intl-utils'; // ✅ Using centralized function
import { getObligationStatusLabel } from "@/core/status/StatusConstants";

interface DocumentHeaderProps {
    doc: Partial<ObligationDocument>;
}

export function DocumentHeader({ doc }: DocumentHeaderProps) {
  const iconSizes = useIconSizes();

  return (
    <div className="text-center space-y-4 p-8 border-b bg-muted/30">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground uppercase tracking-wide">
          {doc.contractorCompany || "ΕΡΓΟΛΑΒΟΣ ΕΤΑΙΡΕΙΑ"}
        </h1>
        <div className="text-sm text-muted-foreground">ΤΕΧΝΙΚΗ ΕΤΑΙΡΕΙΑ ΚΑΤΑΣΚΕΥΩΝ</div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-primary underline decoration-2">
          ΣΥΓΓΡΑΦΗ ΥΠΟΧΡΕΩΣΕΩΝ
        </h2>
        <h3 className="text-lg font-medium">
          {doc.title || "Νέα Συγγραφή Υποχρεώσεων"}
        </h3>
        <div className="text-base text-foreground">
          {doc.projectName || "Όνομα Έργου"}
        </div>
      </div>

      {doc.projectDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t text-sm">
          {doc.projectDetails.location && (
            <div className="flex items-center gap-2">
              <MapPin className={`${iconSizes.sm} text-muted-foreground`} />
              <span className="text-muted-foreground">Τοποθεσία:</span>
              <span>{doc.projectDetails.location}</span>
            </div>
          )}
          {doc.projectDetails.address && (
            <div className="flex items-center gap-2">
              <Building className={`${iconSizes.sm} text-muted-foreground`} />
              <span className="text-muted-foreground">Διεύθυνση:</span>
              <span>{doc.projectDetails.address}</span>
            </div>
          )}
          {doc.projectDetails.plotNumber && (
            <div className="flex items-center gap-2">
              <Hash className={`${iconSizes.sm} text-muted-foreground`} />
              <span className="text-muted-foreground">Οικόπεδο:</span>
              <span>{doc.projectDetails.plotNumber}</span>
            </div>
          )}
          {doc.projectDetails.buildingPermitNumber && (
            <div className="flex items-center gap-2">
              <FileText className={`${iconSizes.sm} text-muted-foreground`} />
              <span className="text-muted-foreground">Οικ. Άδεια:</span>
              <span>{doc.projectDetails.buildingPermitNumber}</span>
            </div>
          )}
        </div>
      )}

      {doc.owners && doc.owners.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center gap-2 mb-3">
            <Users className={`${iconSizes.sm} text-muted-foreground`} />
            <span className="font-medium text-foreground">Ιδιοκτήτες:</span>
          </div>
          <div className="space-y-2 text-sm">
            {doc.owners.map((owner, index) => (
              <div key={owner.id ?? `owner-${index}`} className="flex justify-between items-center">
                <span>{owner.name || `Ιδιοκτήτης ${index + 1}`}</span>
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
          Κατάσταση:{" "}
          <Badge variant="outline">
            {getObligationStatusLabel(doc.status || "draft")}
          </Badge>
        </div>
        <div>{formatDate(doc.updatedAt || new Date())}</div>
      </div>
    </div>
  );
}
