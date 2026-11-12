import { useState } from 'react';
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../hooks/queries';
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { relative } from '../utils/format';
import { cx } from '../components/ui';

const icon = (severity: string) => {
  if (severity === 'error') return <XCircle className="h-4 w-4 text-rose-400" />;
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-300" />;
  if (severity === 'success') return <CheckCircle2 className="h-4 w-4 text-accent" />;
  return <Info className="h-4 w-4 text-accent2" />;
};

export default function Notifications() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading, isError, error, refetch } = useNotifications(unreadOnly);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const toast = useToast();

  const all = async () => {
    try {
      const res = await markAll.mutateAsync();
      toast.success(`${res.updated} notification(s) marked as read.`);
    } catch {
      toast.error('Could not mark notifications as read.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="New orders, payment results, low stock and status changes."
        actions={
          <>
            <Button variant="secondary" className="text-xs" onClick={() => setUnreadOnly((v) => !v)}>
              {unreadOnly ? 'Show all' : 'Unread only'}
            </Button>
            <Button className="text-xs" onClick={() => void all()} loading={markAll.isPending} disabled={!data?.unreadCount}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          </>
        }
      />

      <Card className="p-0">
        {isError ? (
          <ErrorState message={(error as Error)?.message ?? 'Could not load notifications.'} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState
            title="Nothing here"
            description="Notifications appear when orders, payments, stock or order statuses change."
            icon={<Bell className="h-5 w-5" />}
          />
        ) : (
          <div className="divide-y divide-line/50">
            {data.items.map((n) => (
              <div
                key={n._id}
                className={cx('flex items-start gap-3 px-5 py-3.5 transition', !n.read && 'bg-accent/[0.04]')}
              >
                <span className="mt-0.5 shrink-0">{icon(n.severity)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cx('text-sm', n.read ? 'font-medium text-muted' : 'font-semibold text-ink')}>{n.title}</p>
                    <span className="shrink-0 text-[10px] text-muted">{relative(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.body}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="chip border-line bg-white/5 text-[10px] text-muted">{n.type.replace(/_/g, ' ')}</span>
                    {!n.read && (
                      <button
                        onClick={() => void markRead.mutateAsync(n._id)}
                        className="text-[10px] font-semibold text-accent hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
