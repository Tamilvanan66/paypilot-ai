import { api, qs } from './api';
import type {
  AnalyticsOverview,
  AuthPayload,
  Category,
  Customer,
  Insight,
  InventoryMovement,
  Notification,
  Order,
  Paginated,
  Payment,
  Product,
  Recommendation,
  RevenuePoint,
  Transaction,
  User,
} from '../types';

export const authApi = {
  register: (body: { name: string; email: string; password: string; storeName: string }) =>
    api.post<AuthPayload>('/auth/register', body),
  login: (body: { email: string; password: string }) => api.post<AuthPayload>('/auth/login', body),
  logout: () => api.post<{ message: string }>('/auth/logout'),
  me: () => api.get<AuthPayload>('/auth/me'),
  forgot: (email: string) =>
    api.post<{ message: string; resetToken: string | null }>('/auth/forgot-password', { email }),
  reset: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }),
};

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  stock?: string;
  sort?: string;
}

export const productApi = {
  list: (q: ProductQuery = {}) => api.get<Paginated<Product>>(`/products${qs({ ...q })}`),
  get: (id: string) => api.get<{ product: Product; movements: InventoryMovement[] }>(`/products/${id}`),
  create: (body: Partial<Product>) => api.post<Product>('/products', body),
  update: (id: string, body: Partial<Product>) => api.put<Product>(`/products/${id}`, body),
  remove: (id: string) =>
    api.del<{ deleted?: boolean; archived?: boolean; message?: string }>(`/products/${id}`),
  categories: () => api.get<Category[]>('/products/categories'),
  createCategory: (body: { name: string; description?: string }) =>
    api.post<Category>('/products/categories', body),
};

export const orderApi = {
  list: (q: Record<string, string | number | undefined> = {}) =>
    api.get<Paginated<Order> & { statusCounts: Record<string, number> }>(`/orders${qs(q)}`),
  get: (id: string) => api.get<{ order: Order; customer: Customer | null }>(`/orders/${id}`),
  create: (body: unknown) => api.post<Order>('/orders', body),
  setStatus: (id: string, status: string, note?: string) =>
    api.put<Order>(`/orders/${id}/status`, { status, note }),
  recent: () => api.get<Order[]>('/orders/recent'),
};

export const paymentApi = {
  config: () =>
    api.get<{ configured: boolean; environment: string; currency: string; clientId: string | null; webhookConfigured: boolean }>(
      '/payments/paypal/config',
    ),
  list: (q: Record<string, string | number | undefined> = {}) =>
    api.get<Paginated<Payment> & { transactions: Transaction[] }>(`/payments${qs(q)}`),
  createOrder: (orderId: string, orderNumber: string) =>
    api.post<{ paypalOrderId: string; amount: number; currency: string; reused: boolean }>(
      '/payments/paypal/create-order',
      { orderId, orderNumber },
    ),
  captureOrder: (paypalOrderId: string) =>
    api.post<{ order: Order; payment: Payment; alreadyProcessed: boolean; verified: boolean }>(
      '/payments/paypal/capture-order',
      { paypalOrderId },
    ),
};

export const aiApi = {
  status: () => api.get<{ configured: boolean }>('/ai/status'),
  chat: (body: { message: string; conversationId?: string | null }) =>
    api.post<{
      conversationId: string;
      reply: string;
      source: 'ai' | 'fallback';
      aiEnabled: boolean;
      recommendations: Recommendation[];
    }>('/ai/chat', body),
  recommend: (body: { query: string; limit?: number; budget?: number | null }) =>
    api.post<{ items: Recommendation[]; source: string; engine: string; appliedBudget: number | null }>(
      '/ai/recommendations',
      body,
    ),
  describe: (body: { name: string; category?: string; specs?: string; tone?: string }) =>
    api.post<{
      description: string;
      shortDescription: string;
      seoTitle: string;
      keywords: string[];
      source: 'ai' | 'template';
      aiEnabled: boolean;
      warning?: string;
    }>('/ai/generate-description', body),
  insights: () => api.post<Insight>('/ai/business-insights', {}),
  conversations: () => api.get<{ _id: string; title: string; lastMessageAt: string }[]>('/ai/conversations'),
};

export const analyticsApi = {
  overview: () => api.get<AnalyticsOverview>('/analytics/overview'),
  revenue: (days = 30) => api.get<RevenuePoint[]>(`/analytics/revenue?days=${days}`),
  products: () =>
    api.get<{
      performance: { productId: string; name: string; unitsSold: number; revenue: number; stock: number }[];
      categories: { category: string; revenue: number; units: number }[];
      inventory: { units: number; value: number; lowCount: number; outCount: number; productCount: number };
    }>('/analytics/products'),
  orders: () =>
    api.get<{
      statuses: { status: string; count: number; value: number }[];
      series: RevenuePoint[];
      activity: { email: string; name: string; orders: number; spend: number }[];
    }>('/analytics/orders'),
};

export const inventoryApi = {
  list: (q: Record<string, string | number | undefined> = {}) =>
    api.get<Paginated<Product> & { summary: { units: number; value: number; low: number; out: number } }>(
      `/inventory${qs(q)}`,
    ),
  adjust: (productId: string, newStock: number, reason: string) =>
    api.put<{ unchanged: boolean }>(`/inventory/${productId}`, { newStock, reason }),
  movements: (q: Record<string, string | number | undefined> = {}) =>
    api.get<Paginated<InventoryMovement>>(`/inventory/movements${qs(q)}`),
};

export const notificationApi = {
  list: (unreadOnly = false) =>
    api.get<Paginated<Notification> & { unreadCount: number }>(
      `/notifications${qs({ unreadOnly: String(unreadOnly), limit: 30 })}`,
    ),
  read: (id: string) => api.put<Notification>(`/notifications/${id}/read`),
  readAll: () => api.put<{ updated: number }>('/notifications/read-all'),
};

export type { User };
