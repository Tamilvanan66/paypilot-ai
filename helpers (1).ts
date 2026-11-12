import { customAlphabet } from 'nanoid';

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const money = (n: number) => round2(Number.isFinite(n) ? n : 0);

const orderAlphabet = customAlphabet('0123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);
export const generateOrderNumber = () =>
  `PP-${Date.now().toString(36).toUpperCase()}-${orderAlphabet()}`;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasMore: page * limit < total,
  };
}

export const parsePagination = (q: Record<string, unknown>, defaultLimit = 20, max = 100) => {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(max, Math.max(1, Number(q.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};
