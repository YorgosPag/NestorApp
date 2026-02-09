'use client';

import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Printer, Download, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Invoice } from '@/subapps/accounting/types';

interface InvoiceActionsMenuProps {
  invoice: Invoice;
  onRefresh: () => void;
}

export function InvoiceActionsMenu({ invoice, onRefresh }: InvoiceActionsMenuProps) {
  const { t } = useTranslation('accounting');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <Printer className="mr-2 h-4 w-4" />
          {t('forms.print')}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Download className="mr-2 h-4 w-4" />
          {t('forms.download')}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Mail className="mr-2 h-4 w-4" />
          {t('forms.sendEmail')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
