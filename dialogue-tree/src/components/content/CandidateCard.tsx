import { memo } from 'react';
import type { CandidateCardState } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

const CARD_COLORS = [
  {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20',
    hoverBorder: 'hover:border-blue-500/60',
  },
  {
    bg: 'bg-green-500/10',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-500/30',
    badge: 'bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/20',
    hoverBorder: 'hover:border-green-500/60',
  },
  {
    bg: 'bg-orange-500/10',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500/30',
    badge: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20',
    hoverBorder: 'hover:border-orange-500/60',
  },
  {
    bg: 'bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/30',
    badge: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20',
    hoverBorder: 'hover:border-purple-500/60',
  },
] as const;

const STAGGER_DELAYS = ['0ms', '75ms', '150ms', '225ms'] as const;

interface CandidateCardProps {
  card: CandidateCardState;
  onSelect: (finalNodeId: string) => void;
  onExpand: (index: number) => void;
}

export const CandidateCard = memo(function CandidateCard({
  card,
  onSelect,
  onExpand,
}: CandidateCardProps) {
  const colors = CARD_COLORS[card.index];
  const delay = STAGGER_DELAYS[card.index];

  // empty
  if (card.status === 'empty') {
    return (
      <Card className="border-dashed border-muted-foreground/20 flex items-center justify-center p-6">
        <span className="text-muted-foreground/30 text-sm">Waiting...</span>
      </Card>
    );
  }

  // loading
  if (card.status === 'loading') {
    return (
      <Card
        className={`p-5 ${colors.border} border flex flex-col justify-center animate-card-in`}
        style={{ animationDelay: delay }}
      >
        <Skeleton className={`h-6 w-28 mb-3 ${colors.bg} rounded-md`} />
        <Skeleton className="h-4 w-full mb-2 bg-foreground/5 rounded" />
        <Skeleton className="h-4 w-4/5 mb-2 bg-foreground/5 rounded" />
        <Skeleton className="h-4 w-3/5 bg-foreground/5 rounded" />
      </Card>
    );
  }

  // error
  if (card.status === 'error') {
    return (
      <Card className="p-5 border-destructive/30 border flex flex-col justify-center animate-card-in">
        <p className="text-destructive text-sm mb-1">Generation failed</p>
        <p className="text-muted-foreground text-xs">{card.error}</p>
      </Card>
    );
  }

  const isClickable = card.status === 'complete' && card.finalNodeId;
  const isStreaming = card.status === 'streaming' || card.status === 'angle-ready';

  return (
    <Card
      className={`${colors.border} ${colors.bg} border p-5 flex flex-col justify-center transition-all duration-200 animate-card-in ${
        isClickable
          ? `cursor-pointer ${colors.hoverBorder} hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5`
          : ''
      }`}
      style={{ animationDelay: delay }}
      onClick={() => {
        if (isClickable) {
          onExpand(card.index);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Badge variant="secondary" className={`${colors.badge} text-sm px-3 py-1 mb-2`}>
            {card.angle?.name}
          </Badge>
          <p className="text-muted-foreground text-sm leading-relaxed mt-2">
            {card.angle?.rationale}
          </p>
        </div>
        {isStreaming && (
          <Loader2 className={`w-4 h-4 ${colors.text} animate-spin shrink-0 mt-1`} />
        )}
      </div>

      <div className="mt-3">
        {isStreaming && (
          <p className={`text-xs ${colors.text} opacity-70`}>Generating...</p>
        )}
        {isClickable && (
          <p className={`text-sm ${colors.text} font-medium`}>Click to view full response →</p>
        )}
      </div>
    </Card>
  );
});
