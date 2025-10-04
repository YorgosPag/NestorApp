'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Opportunity } from '@/types/crm';
import { stageDefinitions } from '../../utils/opportunity-utils';

const initialFormData = {
  title: '',
  fullName: '',
  email: '',
  phone: '',
  stage: 'initial_contact' as Opportunity['stage'],
  notes: '',
  estimatedValue: 0,
};

interface AddOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<Opportunity>) => Promise<void>;
}

export function AddOpportunityDialog({ open, onOpenChange, onSubmit }: AddOpportunityDialogProps) {
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({
        ...formData,
        title: formData.title || `Ευκαιρία για ${formData.fullName}`,
    });
    setLoading(false);
    onOpenChange(false);
    setFormData(initialFormData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value as Opportunity['stage'] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Προσθήκη Νέου Lead</DialogTitle>
          <DialogDescription>
            Καταχωρήστε τις πληροφορίες για τη νέα ευκαιρία.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fullName" className="text-right">Όνομα</Label>
              <Input id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">Τηλέφωνο</Label>
              <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="stage" className="text-right">Στάδιο</Label>
              <Select name="stage" value={formData.stage} onValueChange={(value) => handleSelectChange('stage', value)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Επιλογή σταδίου..." />
                </SelectTrigger>
                <SelectContent>
                  {stageDefinitions.map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">Σημειώσεις</Label>
              <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Άκυρο</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Αποθήκευση...' : 'Αποθήκευση Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
