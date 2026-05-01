'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface SubCategoryRecord {
  id: string;
  code: string;
  parentCode: string;
  nameEL: string;
  nameEN: string;
  sortOrder: number;
  isActive: boolean;
}

interface FormState {
  id: string | null;
  parentCode: string;
  code: string;
  nameEL: string;
  nameEN: string;
  sortOrder: number;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface GroupTableProps {
  subs: SubCategoryRecord[];
  onEdit: (item: SubCategoryRecord) => void;
  onToggleActive: (item: SubCategoryRecord) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  t: (key: string) => string;
}

function GroupTable({ subs, onEdit, onToggleActive, onDelete, onAdd, t }: GroupTableProps) {
  return (
    <section className="space-y-2">
      {subs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{t('orgStructure.boqCat.noItems')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-1 pr-4 font-medium w-24">{t('orgStructure.boqCat.code')}</th>
              <th className="pb-1 pr-4 font-medium">{t('orgStructure.boqCat.nameEL')}</th>
              <th className="pb-1 pr-4 font-medium hidden md:table-cell">{t('orgStructure.boqCat.nameEN')}</th>
              <th className="pb-1 pr-2 font-medium w-16 text-center">{t('orgStructure.boqCat.active')}</th>
              <th className="pb-1 font-medium w-20 text-right">{t('orgStructure.boqCat.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((sub) => (
              <tr key={sub.id} className={cn('border-b last:border-0', !sub.isActive && 'opacity-50')}>
                <td className="py-1.5 pr-4 font-mono text-xs text-muted-foreground">{sub.code}</td>
                <td className="py-1.5 pr-4">{sub.nameEL}</td>
                <td className="py-1.5 pr-4 hidden md:table-cell text-muted-foreground">{sub.nameEN}</td>
                <td className="py-1.5 pr-2 text-center">
                  <Switch
                    checked={sub.isActive}
                    onCheckedChange={() => onToggleActive(sub)}
                    aria-label={sub.code}
                  />
                </td>
                <td className="py-1.5 text-right">
                  <nav className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(sub)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onDelete(sub.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </nav>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        {t('orgStructure.boqCat.addSubCat')}
      </Button>
    </section>
  );
}

interface SubCatDialogProps {
  form: FormState | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onFormChange: (patch: Partial<FormState>) => void;
  t: (key: string) => string;
}

function SubCatDialog({ form, open, saving, onClose, onSave, onFormChange, t }: SubCatDialogProps) {
  if (!form) return null;
  const isEdit = !!form.id;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('orgStructure.boqCat.editTitle') : t('orgStructure.boqCat.addTitle')}
          </DialogTitle>
        </DialogHeader>

        <section className="space-y-3 py-2">
          <fieldset className="space-y-1.5">
            <Label htmlFor="subcat-code">{t('orgStructure.boqCat.code')}</Label>
            <Input
              id="subcat-code"
              value={form.code}
              onChange={(e) => onFormChange({ code: e.target.value })}
              disabled={isEdit}
              placeholder="OIK-1.8"
            />
          </fieldset>

          <fieldset className="space-y-1.5">
            <Label htmlFor="subcat-nameEL">{t('orgStructure.boqCat.nameEL')}</Label>
            <Input
              id="subcat-nameEL"
              value={form.nameEL}
              onChange={(e) => onFormChange({ nameEL: e.target.value })}
            />
          </fieldset>

          <fieldset className="space-y-1.5">
            <Label htmlFor="subcat-nameEN">{t('orgStructure.boqCat.nameEN')}</Label>
            <Input
              id="subcat-nameEN"
              value={form.nameEN}
              onChange={(e) => onFormChange({ nameEN: e.target.value })}
            />
          </fieldset>

          <fieldset className="space-y-1.5">
            <Label htmlFor="subcat-sort">Sort order</Label>
            <Input
              id="subcat-sort"
              type="number"
              value={form.sortOrder}
              onChange={(e) => onFormChange({ sortOrder: Number(e.target.value) })}
            />
          </fieldset>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('orgStructure.boqCat.cancel')}
          </Button>
          <Button onClick={onSave} disabled={saving || !form.nameEL.trim()}>
            {saving ? <Spinner size="small" /> : t('orgStructure.boqCat.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BOQCategoriesTab() {
  const { t } = useTranslation('org-structure');
  const { user } = useAuth();

  const [items, setItems] = useState<SubCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);

  const getHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await user!.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/settings/boq-subcategories', { headers: await getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: SubCategoryRecord[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setLoading(false);
    }
  }, [user, getHeaders]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const handleAdd = useCallback((parentCode: string) => {
    const existing = items.filter((i) => i.parentCode === parentCode);
    const nextSort = existing.length > 0 ? Math.max(...existing.map((i) => i.sortOrder)) + 1 : 1;
    setForm({ id: null, parentCode, code: `${parentCode}.${nextSort}`, nameEL: '', nameEN: '', sortOrder: nextSort });
    setDialogOpen(true);
  }, [items]);

  const handleEdit = useCallback((item: SubCategoryRecord) => {
    setForm({ id: item.id, parentCode: item.parentCode, code: item.code, nameEL: item.nameEL, nameEN: item.nameEN, sortOrder: item.sortOrder });
    setDialogOpen(true);
  }, []);

  const handleToggleActive = useCallback(async (item: SubCategoryRecord) => {
    setSaving(true);
    try {
      await fetch('/api/settings/boq-subcategories', {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
      });
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isActive: !i.isActive } : i));
    } finally {
      setSaving(false);
    }
  }, [getHeaders]);

  const handleDelete = useCallback(async (id: string) => {
    setSaving(true);
    try {
      await fetch(`/api/settings/boq-subcategories?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setSaving(false);
    }
  }, [getHeaders]);

  const handleSave = useCallback(async () => {
    if (!form) return;
    setSaving(true);
    try {
      if (form.id) {
        await fetch('/api/settings/boq-subcategories', {
          method: 'PATCH',
          headers: await getHeaders(),
          body: JSON.stringify({ id: form.id, nameEL: form.nameEL, nameEN: form.nameEN, sortOrder: form.sortOrder }),
        });
        setItems((prev) => prev.map((i) => i.id === form.id ? { ...i, nameEL: form.nameEL, nameEN: form.nameEN, sortOrder: form.sortOrder } : i));
      } else {
        const res = await fetch('/api/settings/boq-subcategories', {
          method: 'POST',
          headers: await getHeaders(),
          body: JSON.stringify({ parentCode: form.parentCode, code: form.code, nameEL: form.nameEL, nameEN: form.nameEN, sortOrder: form.sortOrder }),
        });
        const data = (await res.json()) as { item: SubCategoryRecord };
        setItems((prev) => [...prev, data.item]);
      }
      setDialogOpen(false);
      setForm(null);
    } finally {
      setSaving(false);
    }
  }, [form, getHeaders]);

  if (loading) {
    return (
      <section className="flex items-center justify-center py-12">
        <Spinner size="large" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex items-center gap-2 py-6 text-destructive text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </section>
    );
  }

  const grouped = ATOE_MASTER_CATEGORIES.map((cat) => ({
    cat,
    subs: items.filter((i) => i.parentCode === cat.code).sort((a, b) => a.sortOrder - b.sortOrder),
  }));

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-base font-semibold">{t('orgStructure.boqCat.title')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('orgStructure.boqCat.subtitle')}</p>
      </header>

      <Accordion type="multiple" defaultValue={ATOE_MASTER_CATEGORIES.map((c) => c.code)}>
        {grouped.map(({ cat, subs }) => (
          <AccordionItem key={cat.code} value={cat.code}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{cat.code}</span>
                <span>{cat.nameEL}</span>
                <Badge variant="secondary" className="ml-1">
                  {subs.filter((s) => s.isActive).length}
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <GroupTable
                subs={subs}
                onEdit={handleEdit}
                onToggleActive={(item) => void handleToggleActive(item)}
                onDelete={(id) => void handleDelete(id)}
                onAdd={() => handleAdd(cat.code)}
                t={t}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <SubCatDialog
        form={form}
        open={dialogOpen}
        saving={saving}
        onClose={() => { setDialogOpen(false); setForm(null); }}
        onSave={() => void handleSave()}
        onFormChange={(patch) => setForm((prev) => prev ? { ...prev, ...patch } : prev)}
        t={t}
      />
    </section>
  );
}
