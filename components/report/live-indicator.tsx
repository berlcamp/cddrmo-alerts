import type { ConnectionStatus } from '@/hooks/use-live-report';
import { formatClock } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  live: 'LIVE',
  reconnecting: 'Reconnecting…',
};

export function LiveIndicator({ status, lastUpdated }: { status: ConnectionStatus; lastUpdated: string }) {
  const live = status === 'live';
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="relative flex size-3" aria-hidden>
        {live && <span className="absolute inline-flex size-full rounded-full bg-danger opacity-75 motion-safe:animate-ping" />}
        <span className={cn('relative inline-flex size-3 rounded-full', live ? 'bg-danger' : 'bg-muted-foreground')} />
      </span>
      <span role="status" className="font-bold">{STATUS_TEXT[status]}</span>
      <span className="tabular text-muted-foreground">Updated {formatClock(lastUpdated)}</span>
    </div>
  );
}
