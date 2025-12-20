
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Trash2 } from "lucide-react";
import type { Owner } from "@/types/obligations";
import { useCallback } from "react";

interface OwnersCardProps {
  owners: Owner[];
  updateOwners: (newOwners: Owner[]) => void;
}

export function OwnersCard({ owners = [], updateOwners }: OwnersCardProps) {
  const updateOwner = useCallback((index: number, field: keyof Owner, value: any) => {
    const newOwners = [...owners];
    newOwners[index] = { ...newOwners[index], [field]: value };
    updateOwners(newOwners);
  }, [owners, updateOwners]);

  const addOwner = useCallback(() => {
    const newOwner: Owner = {
      id: Date.now().toString(),
      name: '',
      share: 0,
    };
    updateOwners([...owners, newOwner]);
  }, [owners, updateOwners]);

  const removeOwner = useCallback((index: number) => {
    if (owners.length > 1) {
      const newOwners = owners.filter((_, i) => i !== index);
      updateOwners(newOwners);
    } else {
      alert("Πρέπει να υπάρχει τουλάχιστον ένας ιδιοκτήτης.");
    }
  }, [owners, updateOwners]);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ιδιοκτήτες
          </CardTitle>
          <Button onClick={addOwner} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Προσθήκη
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {owners.map((owner, index) => (
            <div key={owner.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="flex-1">
                <Input
                  placeholder="Όνομα ιδιοκτήτη"
                  value={owner.name}
                  onChange={(e) => updateOwner(index, 'name', e.target.value)}
                />
              </div>
              <div className="w-24">
                <Input
                  type="text"
                  placeholder="Μερίδιο %"
                  value={owner.share ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    const parsedValue = value === '' ? '' : parseFloat(value) || 0;
                    updateOwner(index, 'share', parsedValue as any);
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeOwner(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
