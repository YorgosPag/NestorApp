'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { BUILDING_IDS } from '@/config/building-ids-config';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addUnit } from '@/services/units.service';
import { ContactsService } from '@/services/contacts.service';
import { useNotifications } from '@/providers/NotificationProvider';
import type { Property } from '@/types/property-viewer';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { Loader2 } from 'lucide-react';

interface AddUnitToContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  onUnitAdded: () => void;
}

interface UnitFormData {
    name: string;
    type: string;
    status: Property['status'];
    price: number | '';
    area: number | '';
    building: string;
    floor: number | '';
    project: string;
    buildingId: string;
    floorId: string;
    vertices: any[];
    description: string;
    soldTo: string;
}

const initialFormData: UnitFormData = {
  name: '',
  type: 'Διαμέρισμα 2Δ',
  status: 'sold',
  price: '',
  area: '',
  building: 'Κτίριο Alpha',
  floor: '',
  project: 'Έργο Κέντρο',
  buildingId: BUILDING_IDS.LEGACY_BUILDING_1,
  floorId: 'floor-3',
  vertices: [],
  description: '',
  soldTo: '',
};

export function AddUnitToContactDialog({ open, onOpenChange, contactId, onUnitAdded }: AddUnitToContactDialogProps) {
  const [formData, setFormData] = useState<UnitFormData>(initialFormData);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const notifications = useNotifications();

  useEffect(() => {
    let isMounted = true;
    if (open) {
      setFormData({ ...initialFormData, soldTo: contactId });
      
      const fetchContacts = async () => {
        try {
          const { contacts: fetchedContacts } = await ContactsService.getAllContacts({ limitCount: 1000 });
          if (isMounted) {
            setContacts(fetchedContacts);
          }
        } catch (error) {
          console.error("Failed to fetch contacts for dropdown:", error);
        }
      };
      fetchContacts();
    }
    return () => {
        isMounted = false;
    };
  }, [open, contactId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.name.trim() || !formData.soldTo || formData.price === '' || formData.area === '' || formData.floor === '') {
        notifications.error('❌ Συμπληρώστε όλα τα υποχρεωτικά πεδία');
        return;
    }

    setLoading(true);

    try {
      await addUnit({
        ...formData,
        price: Number(formData.price),
        area: Number(formData.area),
        floor: Number(formData.floor),
        saleDate: new Date().toISOString(),
      } as Omit<Property, 'id'>);
      notifications.success('✅ Το ακίνητο προστέθηκε στον πελάτη');
      onUnitAdded();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      notifications.error('❌ Δεν ήταν δυνατή η προσθήκη του ακινήτου');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'price' || name === 'area') {
        setFormData({ ...formData, [name]: value === '' ? '' : Math.max(0, parseFloat(value) || 0) });
    } else if (name === 'floor') {
        setFormData({ ...formData, [name]: value === '' ? '' : parseInt(value, 10) || 0 });
    } else {
        setFormData({ ...formData, [name]: value });
    }
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };
  
  const safeContacts = contacts.filter(c => !!c.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Προσθήκη Νέου Ακινήτου</DialogTitle>
          <DialogDescription>
            Καταχωρήστε τα στοιχεία του νέου ακινήτου για αυτόν τον πελάτη.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Κωδικός *</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleChange} className="col-span-3" required disabled={loading} />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">Τύπος</Label>
                <Select name="type" value={formData.type} onValueChange={(value) => handleSelectChange('type', value)} disabled={loading}>
                    <SelectTrigger className="col-span-3">
                    <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Διαμέρισμα 2Δ">Διαμέρισμα 2Δ</SelectItem>
                        <SelectItem value="Στούντιο">Στούντιο</SelectItem>
                        <SelectItem value="Μεζονέτα">Μεζονέτα</SelectItem>
                        <SelectItem value="Κατάστημα">Κατάστημα</SelectItem>
                        <SelectItem value="Αποθήκη">Αποθήκη</SelectItem>
                    </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="soldTo" className="text-right">Αγοραστής *</Label>
              <Select name="soldTo" value={formData.soldTo || ''} onValueChange={(value) => handleSelectChange('soldTo', value)} disabled={loading}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Επιλογή πελάτη..." />
                </SelectTrigger>
                <SelectContent>
                  {safeContacts.map(c => (
                    <SelectItem key={c.id} value={c.id!}>{getContactDisplayName(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="area" className="text-right">Εμβαδόν (τ.μ.) *</Label>
              <Input id="area" name="area" type="number" value={formData.area} onChange={handleChange} className="col-span-3" required disabled={loading}/>
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">Τιμή Πώλησης (€) *</Label>
              <Input id="price" name="price" type="number" value={formData.price} onChange={handleChange} className="col-span-3" required disabled={loading}/>
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="floor" className="text-right">Όροφος *</Label>
              <Input id="floor" name="floor" type="number" value={formData.floor} onChange={handleChange} className="col-span-3" required disabled={loading}/>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Άκυρο</Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Αποθήκευση...
                </>
              ) : 'Αποθήκευση Ακινήτου'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
