'use client';

import { useState, useEffect, useCallback } from 'react';
import { updateOpportunity } from '@/services/opportunities.service';
import { useNotifications } from '@/providers/NotificationProvider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2 } from 'lucide-react';
import type { Opportunity } from '@/types/crm';

interface EditOpportunityModalProps {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated: () => void;
}

type OpportunityStage = Opportunity['stage'];

const stageDefinitions: { id: OpportunityStage; label: string }[] = [
    { id: 'initial_contact', label: 'Αρχική Επαφή' },
    { id: 'qualification', label: 'Αξιολόγηση' },
    { id: 'viewing', label: 'Ξενάγηση' },
    { id: 'proposal', label: 'Πρόταση' },
    { id: 'negotiation', label: 'Διαπραγμάτευση' },
    { id: 'contract', label: 'Συμβόλαιο' },
    { id: 'closed_won', label: 'Κερδισμένη' },
    { id: 'closed_lost', label: 'Χαμένη' },
];

const EMPTY_FORM_DATA: Partial<Opportunity> = {};

export function EditOpportunityModal({ opportunity, isOpen, onClose, onLeadUpdated }: EditOpportunityModalProps) {
  const [formData, setFormData] = useState<Partial<Opportunity>>(EMPTY_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && opportunity) {
      setFormData(opportunity);
    } else {
      setFormData(EMPTY_FORM_DATA);
    }
  }, [isOpen, opportunity]);

  const handleClose = useCallback(() => {
    setFormData(EMPTY_FORM_DATA);
    onClose();
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !opportunity?.id) return;
    
    setLoading(true);

    try {
      await updateOpportunity(opportunity.id, formData);
      toast({
        title: "Επιτυχία",
        description: "Η ευκαιρία ενημερώθηκε επιτυχώς!",
        variant: "success",
      });
      onLeadUpdated();
      handleClose();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: "Δεν ήταν δυνατή η ενημέρωση της ευκαιρίας.",
        variant: "destructive",
      });
      console.error('Error updating opportunity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSelectChange = (name: keyof Opportunity, value: OpportunityStage) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Επεξεργασία Ευκαιρίας</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Όνομα</Label>
            <Input id="fullName" name="fullName" value={formData.fullName || ''} onChange={handleChange} required disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} required disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Τηλέφωνο</Label>
            <Input id="phone" name="phone" value={formData.phone || ''} onChange={handleChange} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactId">ID Πελάτη (soldTo)</Label>
            <Input id="contactId" name="contactId" value={formData.contactId || ''} onChange={handleChange} placeholder="Εισάγετε το ID της επαφής..." disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stage">Στάδιο</Label>
            <Select 
              name="stage" 
              value={formData.stage ?? undefined} 
              onValueChange={(value) => handleSelectChange('stage', value as OpportunityStage)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Επιλογή σταδίου..." />
              </SelectTrigger>
              <SelectContent>
                {stageDefinitions.map(stage => (
                  <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Σημειώσεις</Label>
            <Textarea id="notes" name="notes" value={formData.notes || ''} onChange={handleChange} disabled={loading} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>Ακύρωση</Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Αποθήκευση...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Αποθήκευση
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
