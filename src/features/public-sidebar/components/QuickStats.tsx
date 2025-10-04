'use client';

export function QuickStats({
  availableLabel,
  availableValue,
  pricesFromLabel,
  pricesFromValue,
}: {
  availableLabel: string;
  availableValue: string;
  pricesFromLabel: string;
  pricesFromValue: string;
}) {
  return (
    <div className="px-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Γρήγορα Στοιχεία</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{availableLabel}</span>
          <span className="font-medium text-green-600">{availableValue}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{pricesFromLabel}</span>
          <span className="font-medium">{pricesFromValue}</span>
        </div>
      </div>
    </div>
  );
}
