export type Role = 'owner' | 'manager';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  storeId: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  currency: string;
  description?: string;
  supportEmail?: string;
  lowStockThreshold?: number;
  aiPersona?: string;
  paypalConnected?: boolean;
}

export interface AuthPayload {
  user: User;
  store: Store | null;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface Product {
  _id: string;
  name: string;
  sku: string;
  description: string;
  shortDescription: string;
  categoryId: string | null;
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  stock: number;
  lowStockThreshold?: number | null;
  imageUrl: string;
  status: 'active' | 'archived';
  tags: string[];
  stockStatus?: StockStatus;
  salesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  lineTotal: number;
  imageUrl?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: string;
  notes?: string;
  createdAt: string;
  paidAt?: string | null;
}

export interface Customer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: Record<string, string>;
  totalOrders?: number;
  totalSpent?: number;
}

export interface Payment {
  _id: string;
  orderId: string;
  paypalOrderId: string;
  captureId: string | null;
  status: 'created' | 'approved' | 'captured' | 'failed' | 'refunded' | 'cancelled';
  amount: number;
  currency: string;
  payerEmail?: string;
  createdAt: string;
}

export interface Transaction {
  _id: string;
  type: 'sale' | 'refund' | 'chargeback' | 'adjustment';
  providerTransactionId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface Notification {
  _id: string;
  type: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface InventoryMovement {
  _id: string;
  productId: { _id: string; name: string; sku: string } | string;
  type: string;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason: string;
  createdAt: string;
}

export interface Recommendation {
  productId: string;
  name: string;
  price: number;
  currency: string;
  category: string;
  stock: number;
  available: boolean;
  imageUrl: string;
  shortDescription: string;
  reason: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'ai' | 'fallback';
  recommendations?: Recommendation[];
}

export interface AnalyticsOverview {
  revenue: { gross: number; refunds: number; net: number; last30Days: number };
  orders: {
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
    pendingPayments: number;
    pendingPaymentValue: number;
    last30Days: number;
    averageOrderValue: number;
  };
  products: {
    total: number;
    lowStock: number;
    outOfStock: number;
    inventoryUnits: number;
    inventoryValue: number;
  };
  customers: { total: number };
  recentOrders: Order[];
  recentTransactions: Transaction[];
  activity: { email: string; name: string; orders: number; spend: number; lastOrderAt: string }[];
  computedAt: string;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface Insight {
  headline: string;
  observations: string[];
  actions: string[];
  source: 'ai' | 'deterministic';
  aiEnabled: boolean;
  generatedAt: string;
  warning?: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}
