import { describe, expect, it } from 'vitest';
import { compact, currency, initials, relative, stockLabel, titleCase } from '../utils/format';

describe('formatters', () => {
  it('formats currency safely', () => {
    expect(currency(1234.5)).toBe('$1,234.50');
    expect(currency(Number.NaN)).toBe('$0.00');
  });

  it('formats compact numbers', () => {
    expect(compact(1500)).toBe('1.5K');
  });

  it('derives initials', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('')).toBe('U');
  });

  it('labels stock levels against the threshold', () => {
    expect(stockLabel(0, 5)).toBe('Out of stock');
    expect(stockLabel(3, 5)).toBe('Low stock');
    expect(stockLabel(20, 5)).toBe('In stock');
  });

  it('title-cases enum values', () => {
    expect(titleCase('out_of_stock')).toBe('Out Of Stock');
  });

  it('renders relative time for null input', () => {
    expect(relative(null)).toBe('—');
  });
});
