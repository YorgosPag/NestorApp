'use client';

import { useState, useEffect, useCallback } from 'react';
import { addTask } from '@/services/tasks.service';
import { getOpportunities } from '@/services/opportunities.service';
import toast from 'react-hot-toast';
import {
  X,
  Plus,
  Phone,
  Calendar,
  Users,
  Mail,
  FileText,
  AlertCircle,
  Clock,
  User,
  Loader2
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { Opportunity, CrmTask } from '@/types/crm';
import type { CrmTaskType, CrmTaskPriority } from '@/types/crm-extra';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toLocalDateInputValue, combineLocalDateTime } from '@/lib/date-local';

// 🏢 ENTERPRISE: Import centralized priority labels - ZERO HARDCODED VALUES
import { PRIORITY_LABELS } from '@/constants/property-statuses-enterprise';
import { HOVER_BORDER_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
  preselectedLead?: Opportunity | null;
}

interface FormState {
    title: string;
    description: string;
    type: CrmTaskType;
    leadId: string;
    dueDateStr: string;
    dueTime: string;
    priority: CrmTaskPriority;
    metadata: Record<string, unknown>;
}

const taskTypes: { id: CrmTaskType, name: string, icon: React.ElementType, description: string, defaultTitle: string }[] = [
    { id: 'call', name: 'Κλήση', icon: Phone, description: 'Τηλεφωνική επικοινωνία', defaultTitle: 'Κλήση πελάτη' },
    { id: 'meeting', name: 'Συνάντηση', icon: Users, description: 'Προσωπική συνάντηση', defaultTitle: 'Συνάντηση με πελάτη' },
    { id: 'viewing', name: 'Ξενάγηση', icon: Calendar, description: 'Ξενάγηση σε ακίνητο', defaultTitle: 'Ξενάγηση ακινήτου' },
    { id: 'follow_up', name: 'Follow-up', icon: AlertCircle, description: 'Παρακολούθηση πελάτη', defaultTitle: 'Follow-up με πελάτη' },
    { id: 'email', name: 'Email', icon: Mail, description: 'Αποστολή email', defaultTitle: 'Αποστολή email' },
    { id: 'document', name: 'Έγγραφο', icon: FileText, description: 'Προετοιμασία εγγράφου', defaultTitle: 'Προετοιμασία εγγράφου' },
    { id: 'other', name: 'Άλλο', icon: Clock, description: 'Άλλη εργασία', defaultTitle: 'Νέα εργασία' }
];

// ✅ CENTRALIZED: Using PRIORITY_LABELS from central system - ZERO HARDCODED VALUES
const priorityOptions: { value: CrmTaskPriority, label: string }[] = [
    { value: 'low', label: PRIORITY_LABELS.low },
    { value: 'medium', label: PRIORITY_LABELS.medium },
    { value: 'high', label: PRIORITY_LABELS.high },
    { value: 'urgent', label: PRIORITY_LABELS.urgent }
];

const initialFormData: FormState = {
  title: '',
  description: '',
  type: 'call',
  leadId: '',
  dueDateStr: '',
  dueTime: '10:00',
  priority: 'medium',
  metadata: {}
};

export default function CreateTaskModal({ isOpen, onClose, onTaskCreated, preselectedLead = null }: CreateTaskModalProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const [formData, setFormData] = useState<FormState>(initialFormData);
  const [leads, setLeads] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (isOpen) {
      setLoadingLeads(true);
      getOpportunities()
        .then(leadsData => {
          if (isMounted) setLeads(leadsData);
        })
        .catch(error => {
          if (isMounted) {
            console.error('Error fetching leads:', error);
            toast.error('Σφάλμα φόρτωσης leads');
          }
        })
        .finally(() => {
          if (isMounted) setLoadingLeads(false);
        });
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      setFormData({
        ...initialFormData,
        leadId: preselectedLead?.id || '',
        dueDateStr: toLocalDateInputValue(tomorrow),
        dueTime: '10:00'
      });
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, preselectedLead]);

  const handleTypeChange = useCallback((typeId: CrmTaskType) => {
    const selectedType = taskTypes.find(t => t.id === typeId);
    setFormData(prev => ({
      ...prev,
      type: typeId,
      // Only set default title if the current one is empty or was a default title
      title: !prev.title || taskTypes.some(t => t.defaultTitle === prev.title)
             ? selectedType?.defaultTitle || ''
             : prev.title,
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    if (!formData.title?.trim() || !formData.dueDateStr) {
      toast.error('Παρακαλώ συμπληρώστε τον τίτλο και την ημερομηνία.');
      return;
    }

    setLoading(true);

    try {
      const dueAt = combineLocalDateTime(formData.dueDateStr, formData.dueTime);
      
      const taskData: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'reminderSent'> = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        leadId: formData.leadId || undefined,
        assignedTo: process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'current-user-id',
        assignedBy: process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'current-user-id',
        dueDate: dueAt,
        priority: formData.priority,
        status: 'pending',
        metadata: formData.metadata,
      };

      await addTask(taskData);
      toast.success('✅ Η εργασία δημιουργήθηκε επιτυχώς!');
      
      onClose();
      onTaskCreated?.();
    } catch (error) {
      toast.error('❌ Σφάλμα κατά τη δημιουργία εργασίας');
      console.error('Error creating task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const selectedType = taskTypes.find(t => t.id === formData.type);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className={iconSizes.md} />
            Δημιουργία Νέας Εργασίας
          </DialogTitle>
          <DialogDescription>
            Οργανώστε τις ενέργειές σας για καλύτερη παρακολούθηση.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} id="task-form" className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
          <div>
            <Label>Τύπος Εργασίας</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              {taskTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleTypeChange(type.id)}
                  className={`p-2 border rounded-lg text-left text-xs ${TRANSITION_PRESETS.STANDARD_COLORS} ${
                    formData.type === type.id ? `${getStatusBorder('info')} bg-primary/10` : HOVER_BORDER_EFFECTS.PRIMARY_SUBTLE
                  }`}
                  disabled={loading}
                >
                  <div className="flex items-center gap-2 font-medium"><type.icon className={iconSizes.xs} />{type.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="title">Τίτλος *</Label>
            <Input id="title" name="title" value={formData.title} onChange={handleChange} required placeholder={selectedType?.defaultTitle} disabled={loading} />
          </div>

          <div>
            <Label htmlFor="leadId">Σύνδεση με Lead</Label>
            <select id="leadId" name="leadId" value={formData.leadId} onChange={handleChange} className={`w-full mt-1 h-10 px-3 border border-input rounded-md ${colors.bg.primary} text-sm`} disabled={loading || loadingLeads}>
              <option value="">{loadingLeads ? 'Φόρτωση...' : 'Επιλέξτε πελάτη (προαιρετικό)'}</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id!}>{lead.fullName}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dueDateStr">Ημερομηνία *</Label>
              <Input id="dueDateStr" type="date" name="dueDateStr" value={formData.dueDateStr} onChange={handleChange} required disabled={loading} />
            </div>
            <div>
              <Label htmlFor="dueTime">Ώρα</Label>
              <Input id="dueTime" type="time" name="dueTime" value={formData.dueTime} onChange={handleChange} disabled={loading} />
            </div>
          </div>

          <div>
            <Label htmlFor="priority">Προτεραιότητα</Label>
            <select id="priority" name="priority" value={formData.priority} onChange={handleChange} className={`w-full mt-1 h-10 px-3 border border-input rounded-md ${colors.bg.primary} text-sm`} disabled={loading}>
              {priorityOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          
          <div>
            <Label htmlFor="description">Περιγραφή</Label>
            <Textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Επιπλέον λεπτομέρειες..." disabled={loading} />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Άκυρο</Button>
          <Button type="submit" form="task-form" disabled={loading}>
            {loading ? <><Loader2 className={`${iconSizes.sm} mr-2 animate-spin`} />Δημιουργία...</> : 'Δημιουργία Εργασίας'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
