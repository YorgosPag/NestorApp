'use client';

import '@/lib/design-system';

/**
 * @module reports/sections/cash-flow/CashFlowSettings
 * @enterprise ADR-268 Phase 8 — Q2 initial balance + Q4/Q8 recurring payments CRUD
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { UseCashFlowSettingsReturn } from '@/hooks/reports/useCashFlowSettings';
import type {
  RecurringPayment,
  RecurringFrequency,
  RecurringCategory,
} from '@/services/cash-flow/cash-flow.types';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { nowISO } from '@/lib/date-local';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CashFlowSettingsProps {
  settings: UseCashFlowSettingsReturn;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREQUENCIES: RecurringFrequency[] = ['monthly', 'quarterly', 'annual'];
const CATEGORIES: RecurringCategory[] = [
  'rent', 'insurance', 'utilities', 'salaries', 'loan', 'taxes', 'maintenance', 'other',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CashFlowSettings({ settings }: CashFlowSettingsProps) {
  const { t } = useTranslation('cash-flow');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<RecurringPayment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAddPayment = () => {
    setEditingPayment(null);
    setDialogOpen(true);
  };

  const handleEditPayment = (payment: RecurringPayment) => {
    setEditingPayment(payment);
    setDialogOpen(true);
  };

  const handleSavePayment = (payment: RecurringPayment) => {
    if (editingPayment) {
      settings.updateRecurringPayment(editingPayment.id, payment);
    } else {
      settings.addRecurringPayment(payment);
    }
    setDialogOpen(false);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      settings.removeRecurringPayment(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t('settings.title')}</CardTitle>
        {settings.hasChanges && (
          <Button size="sm" onClick={settings.saveConfig} disabled={settings.saving}>
            <Save className="mr-1 h-4 w-4" />
            {t('settings.save', 'Save')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Initial Balance */}
        <fieldset className="space-y-2">
          <Label htmlFor="initial-balance">{t('settings.initialBalance')}</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">€</span>
            <Input
              id="initial-balance"
              type="number"
              value={settings.config.initialBalance}
              onChange={(e) => settings.setInitialBalance(Number(e.target.value) || 0)}
              className="max-w-[200px]"
            />
          </div>
        </fieldset>

        {/* Recurring Payments */}
        <section>
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">{t('settings.recurringPayments')}</h3>
            <Button variant="outline" size="sm" onClick={handleAddPayment}>
              <Plus className="mr-1 h-4 w-4" />
              {t('settings.addPayment')}
            </Button>
          </header>

          {settings.config.recurringPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('settings.noPayments', 'No recurring payments configured.')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('settings.paymentLabel', 'Label')}</TableHead>
                  <TableHead className="text-right">{t('settings.paymentAmount', 'Amount')}</TableHead>
                  <TableHead>{t('settings.paymentFrequency', 'Frequency')}</TableHead>
                  <TableHead>{t('settings.paymentCategory', 'Category')}</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.config.recurringPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.label}</TableCell>
                    <TableCell className="text-right">
                      €{payment.amount.toLocaleString('el-GR')}
                    </TableCell>
                    <TableCell>{t(`settings.frequency.${payment.frequency}`)}</TableCell>
                    <TableCell>{t(`settings.category.${payment.category}`)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost" size="icon-sm"
                          onClick={() => handleEditPayment(payment)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost" size="icon-sm"
                          onClick={() => setDeleteId(payment.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </CardContent>

      {/* Add/Edit Dialog */}
      <RecurringPaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        payment={editingPayment}
        onSave={handleSavePayment}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.deletePayment')}</AlertDialogTitle>
            <AlertDialogDescription>{t('settings.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('settings.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              {t('settings.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Recurring Payment Dialog
// ---------------------------------------------------------------------------

interface RecurringPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: RecurringPayment | null;
  onSave: (payment: RecurringPayment) => void;
}

function RecurringPaymentDialog({
  open,
  onOpenChange,
  payment,
  onSave,
}: RecurringPaymentDialogProps) {
  const { t } = useTranslation('cash-flow');
  const [label, setLabel] = useState(payment?.label ?? '');
  const [amount, setAmount] = useState(payment?.amount ?? 0);
  const [frequency, setFrequency] = useState<RecurringFrequency>(payment?.frequency ?? 'monthly');
  const [category, setCategory] = useState<RecurringCategory>(payment?.category ?? 'other');
  const [startDate, setStartDate] = useState(payment?.startDate ?? nowISO().substring(0, 10));

  // Reset form when payment changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && payment) {
      setLabel(payment.label);
      setAmount(payment.amount);
      setFrequency(payment.frequency);
      setCategory(payment.category);
      setStartDate(payment.startDate);
    } else if (isOpen) {
      setLabel('');
      setAmount(0);
      setFrequency('monthly');
      setCategory('other');
      setStartDate(nowISO().substring(0, 10));
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = () => {
    if (!label.trim() || amount <= 0) return;

    onSave({
      id: payment?.id ?? enterpriseIdService.generateRecurringPaymentId(),
      label: label.trim(),
      amount,
      frequency,
      category,
      startDate,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {payment ? t('settings.editPayment') : t('settings.addPayment')}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        >
          <fieldset className="space-y-2">
            <Label htmlFor="payment-label">{t('settings.paymentLabel', 'Label')}</Label>
            <Input
              id="payment-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('settings.labelPlaceholder', 'e.g., Office Rent')}
              required
            />
          </fieldset>

          <fieldset className="space-y-2">
            <Label htmlFor="payment-amount">{t('settings.paymentAmount', 'Amount (€)')}</Label>
            <Input
              id="payment-amount"
              type="number"
              min={1}
              step={0.01}
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              required
            />
          </fieldset>

          <fieldset className="space-y-2">
            <Label>{t('settings.paymentFrequency', 'Frequency')}</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>{t(`settings.frequency.${f}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>

          <fieldset className="space-y-2">
            <Label>{t('settings.paymentCategory', 'Category')}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as RecurringCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{t(`settings.category.${c}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>

          <fieldset className="space-y-2">
            <Label htmlFor="payment-start">{t('settings.startDate', 'Start Date')}</Label>
            <Input
              id="payment-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </fieldset>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('settings.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!label.trim() || amount <= 0}>
            {t('settings.save', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
