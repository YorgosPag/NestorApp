
'use client';

import React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export function CalendarTab() {
  const colors = useSemanticColors();
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  
  return (
    <div className={`${colors.bg.primary} rounded-lg shadow p-6`}>
      <h2 className="text-lg font-semibold mb-4">Ημερολόγιο</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border"
          />
        </div>
        <div>
          <h3 className="font-medium mb-2">Ραντεβού για {date?.toLocaleDateString('el-GR') || 'σήμερα'}</h3>
          <div className="space-y-3">
            <div className={`${colors.bg.infoSubtle} p-3 rounded-lg`}>
              <p className="font-medium text-sm">10:00 - Ξενάγηση με Γ. Παπαδόπουλο</p>
              <p className={`text-xs ${colors.text.info}`}>Έργο "Κέντρο", Διαμέρισμα Α3</p>
            </div>
             <div className={`${colors.bg.accentSubtle} p-3 rounded-lg`}>
              <p className="font-medium text-sm">14:30 - Τηλεδιάσκεψη με TechCorp</p>
              <p className={`text-xs ${colors.text.accent}`}>Online Meeting</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
