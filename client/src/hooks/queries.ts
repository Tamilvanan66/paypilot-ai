import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiApi, analyticsApi, inventoryApi, notificationApi, orderApi, paymentApi, productApi } from '../services/endpoints';
import type { ProductQuery } from '../services/endpoints';

export const qk = {
  overview: ['analytics', 'overview'] as const,
  revenue: (days: number) => ['analytics', 'revenue', days] as const,
  productStats: ['analytics', 'products'] as const,
  orderStats: ['analytics', 'orders'] as const,
  products: (q: ProductQuery) => ['products', q] as const,
  categories: ['categories'] as const,
  orders: (q: Record<string, string | number | undefined>) => ['orders', q] as const,
  order: (id: string) => ['order', id] as const,
  payments: ['payments'] as const,
  paypalConfig: ['paypal', 'config'] as const,
  notifications: (unreadOnly: boolean) => ['notifications', unreadOnly] as const,
  inventory: (q: Record<string, string | number | undefined>) => ['inventory', q] as const,
  movements: (q: Record<string, string | number | undefined>) => ['movements', q] as const,
  insights: ['ai', 'insights'] as const,
};

export const useOverview = () => useQuery({ queryKey: qk.overview, queryFn: () => analyticsApi.overview() });
export const useRevenue = (days: number) =>
  useQuery({ queryKey: qk.revenue(days), queryFn: () => analyticsApi.revenue(days) });
export const useProductStats = () => useQuery({ queryKey: qk.productStats, queryFn: () => analyticsApi.products() });
export const useOrderStats = () => useQuery({ queryKey: qk.orderStats, queryFn: () => analyticsApi.orders() });

export const useProducts = (q: ProductQuery) =>
  useQuery({ queryKey: qk.products(q), queryFn: () => productApi.list(q), placeholderData: (prev) => prev });
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: () => productApi.categories() });

export const useOrders = (q: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: qk.orders(q), queryFn: () => orderApi.list(q), placeholderData: (prev) => prev });
export const useOrder = (id: string | null) =>
  useQuery({ queryKey: qk.order(id ?? ''), queryFn: () => orderApi.get(id as string), enabled: Boolean(id) });

export const usePayments = () => useQuery({ queryKey: qk.payments, queryFn: () => paymentApi.list({ limit: 25 }) });
export const usePayPalConfig = () =>
  useQuery({ queryKey: qk.paypalConfig, queryFn: () => paymentApi.config(), staleTime: 60_000 });

export const useNotifications = (unreadOnly = false) =>
  useQuery({ queryKey: qk.notifications(unreadOnly), queryFn: () => notificationApi.list(unreadOnly) });

export const useInventory = (q: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: qk.inventory(q), queryFn: () => inventoryApi.list(q), placeholderData: (prev) => prev });
export const useMovements = (q: Record<string, string | number | undefined> = {}) =>
  useQuery({ queryKey: qk.movements(q), queryFn: () => inventoryApi.movements(q) });

export const useInsights = () =>
  useQuery({ queryKey: qk.insights, queryFn: () => aiApi.insights(), staleTime: 5 * 60_000, retry: 0 });

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: Partial<import('../types').Product>) => productApi.create(body), onSuccess: () => qc.invalidateQueries() });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<import('../types').Product> }) => productApi.update(id, body),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => productApi.remove(id), onSuccess: () => qc.invalidateQueries() });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newStock, reason }: { id: string; newStock: number; reason: string }) =>
      inventoryApi.adjust(id, newStock, reason),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useSetOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      orderApi.setStatus(id, status, note),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => notificationApi.read(id), onSuccess: () => qc.invalidateQueries() });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => notificationApi.readAll(), onSuccess: () => qc.invalidateQueries() });
}
