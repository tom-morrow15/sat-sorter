import { cn } from '@/lib/utils';

const QUICK_ACTIONS = [
  'Can I spend $20?',
  'How am I doing?',
  'Where can I save?',
  'Stacking opportunity?',
];

export interface QuickActionChipsProps {
  onSelect: (text: string) => void;
}

export function QuickActionChips({ onSelect }: QuickActionChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action}
          onClick={() => onSelect(action)}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium',
            'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            'transition-colors border border-border/50'
          )}
        >
          {action}
        </button>
      ))}
    </div>
  );
}
