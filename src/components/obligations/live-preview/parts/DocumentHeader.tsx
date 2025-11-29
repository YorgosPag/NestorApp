"use client";

import { CommonBadge } from "@/core/badges";
import { Building, FileText, Hash, MapPin, Users } from "lucide-react";
import type { ObligationDocument } from '@/types/obligations';
import { formatDate, getStatusLabel } from "@/lib/obligations-utils";

interface DocumentHeaderProps {
    doc: Partial<ObligationDocument>;
}

export function DocumentHeader({ doc }: DocumentHeaderProps) {
  return (
    <div className="text-center space-y-4 p-8 border-b bg-gray-50">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">
          {doc.contractorCompany || "ΕΡΓΟΛΑΒΟΣ ΕΤΑΙΡΕΙΑ"}
        </h1>
        <div className="text-sm text-gray-600">ΤΕΧΝΙΚΗ ΕΤΑΙΡΕΙΑ ΚΑΤΑΣΚΕΥΩΝ</div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-red-700 underline decoration-2">
          ΣΥΓΓΡΑΦΗ ΥΠΟΧΡΕΩΣΕΩΝ
        </h2>
        <h3 className="text-lg font-medium">
          {doc.title || "Νέα Συγγραφή Υποχρεώσεων"}
        </h3>
        <div className="text-base text-gray-700">
          {doc.projectName || "Όνομα Έργου"}
        </div>
      </div>

      {doc.projectDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t text-sm">
          {doc.projectDetails.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">Τοποθεσία:</span>
              <span>{doc.projectDetails.location}</span>
            </div>
          )}
          {doc.projectDetails.address && (
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">Διεύθυνση:</span>
              <span>{doc.projectDetails.address}</span>
            </div>
          )}
          {doc.projectDetails.plotNumber && (
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">Οικόπεδο:</span>
              <span>{doc.projectDetails.plotNumber}</span>
            </div>
          )}
          {doc.projectDetails.buildingPermitNumber && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">Οικ. Άδεια:</span>
              <span>{doc.projectDetails.buildingPermitNumber}</span>
            </div>
          )}
        </div>
      )}

      {doc.owners && doc.owners.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-gray-500" />
            <span className="font-medium text-gray-700">Ιδιοκτήτες:</span>
          </div>
          <div className="space-y-2 text-sm">
            {doc.owners.map((owner, index) => (
              <div key={owner.id ?? `owner-${index}`} className="flex justify-between items-center">
                <span>{owner.name || `Ιδιοκτήτης ${index + 1}`}</span>
                {typeof owner.share === "number" && (
                  <CommonBadge
                    status="company"
                    customLabel={`${owner.share}%`}
                    variant="outline"
                    className="text-xs"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mt-6 pt-6 border-t text-xs text-gray-500">
        <div>
          Κατάσταση:{" "}
          <CommonBadge
            status="company"
            customLabel={getStatusLabel(doc.status || "draft")}
            variant="outline"
          />
        </div>
        <div>{formatDate(doc.updatedAt || new Date())}</div>
      </div>
    </div>
  );
}
