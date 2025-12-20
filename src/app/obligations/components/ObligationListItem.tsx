
"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CommonBadge } from "@/core/badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Eye, Edit, Copy, Trash2, Download } from "lucide-react";
import { ObligationDocument } from "@/types/obligations";
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { formatDate } from "@/lib/intl-utils";
import { getStatusColor, getStatusLabel } from "@/lib/obligations-utils";

interface ObligationListItemProps {
  obligation: ObligationDocument;
  onDelete: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
}

export function ObligationListItem({ obligation, onDelete, onDuplicate }: ObligationListItemProps) {
  const safeLocation = obligation.projectDetails?.location ?? 'N/A';
  const safeOwners = Array.isArray(obligation.owners) ? obligation.owners.map(o => o.name).join(", ") : 'N/A';
  
  const createdDate = formatDate(new Date(obligation.createdAt));
  const updatedDate = formatDate(new Date(obligation.updatedAt));

  return (
    <Card className={INTERACTIVE_PATTERNS.CARD_STANDARD}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">{obligation.title}</CardTitle>
              <CommonBadge
                status="company"
                customLabel={getStatusLabel(obligation.status)}
                variant="secondary"
                className={getStatusColor(obligation.status)}
              />
            </div>
            <CardDescription className="text-sm text-muted-foreground">
              <div className="space-y-1">
                <div><strong>Έργο:</strong> {obligation.projectName}</div>
                <div><strong>Εργολάβος:</strong> {obligation.contractorCompany}</div>
                <div><strong>Τοποθεσία:</strong> {safeLocation}</div>
                <div><strong>Ιδιοκτήτες:</strong> {safeOwners}</div>
              </div>
            </CardDescription>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/obligations/${obligation.id}`} className="flex items-center gap-2 cursor-pointer">
                  <Eye className="h-4 w-4" />
                  Προβολή
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/obligations/${obligation.id}/edit`} className="flex items-center gap-2 cursor-pointer">
                  <Edit className="h-4 w-4" />
                  Επεξεργασία
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => onDuplicate(obligation.id)}
              >
                <Copy className="h-4 w-4" />
                Δημιουργία Αντιγράφου
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                <Download className="h-4 w-4" />
                Εξαγωγή PDF
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2 text-destructive cursor-pointer"
                onClick={() => onDelete(obligation.id, obligation.title)}
              >
                <Trash2 className="h-4 w-4" />
                Διαγραφή
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <footer className="flex justify-between text-sm text-muted-foreground">
          <time dateTime={obligation.createdAt}>Δημιουργήθηκε: {createdDate}</time>
          <time dateTime={obligation.updatedAt}>Τελευταία ενημέρωση: {updatedDate}</time>
        </footer>
      </CardContent>
    </Card>
  );
}

    