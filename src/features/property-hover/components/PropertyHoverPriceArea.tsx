'use client';
import { Euro, Ruler } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export function PropertyHoverPriceArea({
  hasPrice, price, priceLabel, isRentLike,
  hasArea, area, pricePerSqm
}:{
  hasPrice: boolean; price?: number; priceLabel: string; isRentLike: boolean;
  hasArea: boolean; area?: number; pricePerSqm?: string;
}) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <div className="space-y-2">
      {hasPrice && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{priceLabel}:</p>
          <div className="flex items-center gap-1">
            <Euro className={`${iconSizes.sm} ${colors.text.success}`} />
            {price && price > 0 ? (
              <span className={`font-semibold text-sm ${colors.text.success}`}>
                {price.toLocaleString('el-GR')}€
                {isRentLike && <span className="text-xs text-muted-foreground">/μήνα</span>}
              </span>
            ) : (
              <span className="italic text-muted-foreground text-xs">Κατόπιν συνεννόησης</span>
            )}
          </div>
        </div>
      )}

      {hasArea && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Εμβαδόν:</p>
          <div className="flex items-center gap-1">
            <Ruler className={`${iconSizes.xs} text-muted-foreground`} />
            <span className="text-sm font-medium">{area}τμ</span>
          </div>
        </div>
      )}

      {hasPrice && hasArea && price && price > 0 && area && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Τιμή ανά τμ:</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs font-medium cursor-help underline decoration-dotted">
                {pricePerSqm}{isRentLike && '/μήνα'}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Υπολογισμένο από συνολική τιμή / εμβαδόν.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
