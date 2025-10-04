
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Edit3,
  Download,
  Printer,
  Share2,
  MoreHorizontal
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ObligationDocument } from "@/types/obligations";
import { formatDate, getStatusLabel } from "@/lib/obligations-utils";
import PDFExportButton, { QuickPDFExportButton, PrintButton } from "@/components/obligations/pdf-export-button";
import Link from "next/link";

interface HeaderBarProps {
  obligation: ObligationDocument;
}

export function HeaderBar({ obligation }: HeaderBarProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {obligation.title}
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <Badge variant="outline">
              {getStatusLabel(obligation.status)}
            </Badge>
            <span className="text-gray-600 text-sm">
              Ενημερώθηκε: {formatDate(obligation.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <QuickPDFExportButton document={obligation} />
        <PrintButton document={obligation} />

        <Link href={`/obligations/${obligation.id}/edit`}>
          <Button>
            <Edit3 className="h-4 w-4 mr-2" />
            Επεξεργασία
          </Button>
        </Link>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Share2 className="h-4 w-4 mr-2" />
              Κοινοποίηση
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <PDFExportButton document={obligation} variant="ghost" />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
