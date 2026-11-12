import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  Boxes,
  BrainCircuit,
  ChevronLeft,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/queries';
import { initials, relative } from '../utils/format';
import { cx } from '../components/ui';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/assistant', label: 'AI Assistant', icon: BrainCircuit },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout() {
  const { user, store, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const { data: notifications } = useNotifications(false);

  const unread = notifications?.unreadCount ?? 0;

  useEffect(() => {
    setMobileOpen(false);
    setBellOpen(false);
  }, [navigate]);

  const initialsText = useMemo(() => (user ? initials(user.name) : 'PP'), [user]);

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const sidebar = (
    <aside
      className={cx(
        'flex h-full flex-col border-r border-line bg-surface/80 backdrop-blur-xl transition-all duration-200',
        collapsed ? 'w-[74px]' : 'w-[248px]',
      )}
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-line px-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent2 text-[#062B27]">
          <Sparkles className="h-4.5 w-4.5" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-ink">PayPilot AI</p>
            <p className="truncate text-[10px] uppercase tracking-wider text-muted">
              {store?.name ?? 'Commerce OS'}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2.5" aria-label="Main navigation">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cx(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:bg-white/5 hover:text-ink',
                collapsed && 'justify-center px-0',
              )
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
            {!collapsed && to === '/notifications' && unread > 0 && (
              <span className="ml-auto rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                {unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line p-2.5">
        <div className={cx('flex items-center gap-2.5 rounded-xl px-1.5 py-1.5', collapsed && 'justify-center')}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent2/20 text-xs font-bold text-accent2">
            {initialsText}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{user?.name}</p>
              <p className="truncate text-[10px] capitalize text-muted">{user?.role}</p>
            </div>
          )}
        </div>
        <button
          onClick={() => void onLogout()}
          className={cx('btn-ghost mt-1 w-full text-xs', collapsed ? 'px-0' : 'justify-start')}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && 'Sign out'}
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="btn-ghost mt-1 hidden w-full text-xs lg:flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={cx('h-4 w-4 transition', collapsed && 'rotate-180')} />
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 h-full">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-base/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="btn-ghost px-2 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{store?.name ?? 'Your store'}</p>
            <p className="hidden text-[11px] text-muted sm:block">
              Build Smarter. Sell Better. Grow Faster.
            </p>
          </div>

          <div className="relative">
            <button
              onClick={() => setBellOpen((o) => !o)}
              className="btn-secondary relative px-2.5 py-2"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-[#062B27]">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="panel absolute right-0 top-12 z-40 w-[min(90vw,340px)] p-0">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <p className="text-sm font-semibold">Notifications</p>
                  <button onClick={() => setBellOpen(false)} aria-label="Close notifications">
                    <X className="h-4 w-4 text-muted" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {(notifications?.items ?? []).slice(0, 6).map((n) => (
                    <div key={n._id} className="border-b border-line/60 px-4 py-2.5 last:border-0">
                      <p className={cx('text-xs font-semibold', n.read ? 'text-muted' : 'text-ink')}>{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{n.body}</p>
                      <p className="mt-1 text-[10px] text-muted/70">{relative(n.createdAt)}</p>
                    </div>
                  ))}
                  {!notifications?.items.length && (
                    <p className="px-4 py-6 text-center text-xs text-muted">You're all caught up.</p>
                  )}
                </div>
                <NavLink
                  to="/notifications"
                  onClick={() => setBellOpen(false)}
                  className="block border-t border-line px-4 py-2.5 text-center text-xs font-semibold text-accent"
                >
                  View all notifications
                </NavLink>
              </div>
            )}
          </div>

          <NavLink to="/dashboard" className="btn-primary hidden text-xs sm:inline-flex">
            <Sparkles className="h-3.5 w-3.5" />
            AI Console
          </NavLink>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>

        <footer className="border-t border-line px-6 py-4 text-[11px] text-muted">
          PayPilot AI · {new Date().getFullYear()} — payments verified server-side, never trusted from the browser.
        </footer>
      </div>
    </div>
  );
}
