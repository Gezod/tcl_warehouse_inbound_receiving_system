import { describe, it, expect } from 'vitest';
import {
  productCreateSchema,
  productQuerySchema,
  productUpdateSchema,
} from '@/src/lib/validation/product.schema';

describe('Product Validation Unit Tests', () => {
  it('productCreateSchema accepts valid inputs and normalizes SKU regex', () => {
    const valid = {
      sku: 'WIDGET-01.A_b',
      name: 'Standard Widget',
      baseUnit: 'box',
    };
    const parsed = productCreateSchema.parse(valid);
    expect(parsed.sku).toBe('WIDGET-01.A_b');
    expect(parsed.name).toBe('Standard Widget');
    expect(parsed.baseUnit).toBe('box');
  });

  it('productCreateSchema applies default "pcs" for baseUnit if omitted', () => {
    const valid = {
      sku: 'SKU-DEFAULT',
      name: 'Item without unit',
    };
    const parsed = productCreateSchema.parse(valid);
    expect(parsed.baseUnit).toBe('pcs');
  });

  it('productCreateSchema rejects invalid SKU formats', () => {
    // Leading special character
    expect(() =>
      productCreateSchema.parse({ sku: '-INVALID', name: 'Item' })
    ).toThrow();

    // Contains spaces
    expect(() =>
      productCreateSchema.parse({ sku: 'SKU WITH SPACE', name: 'Item' })
    ).toThrow();

    // Exceeds 32 characters
    expect(() =>
      productCreateSchema.parse({
        sku: 'A'.repeat(33),
        name: 'Item',
      })
    ).toThrow();
  });

  it('productUpdateSchema requires at least one field', () => {
    expect(() => productUpdateSchema.parse({})).toThrowError(
      /At least one field must be provided/
    );

    const validUpdate = productUpdateSchema.parse({ name: 'Updated Name' });
    expect(validUpdate.name).toBe('Updated Name');
  });

  it('productQuerySchema transforms query parameters correctly', () => {
    const query = productQuerySchema.parse({
      q: 'box',
      active: 'true',
      page: '2',
      pageSize: '50',
    });

    expect(query.q).toBe('box');
    expect(query.active).toBe(true);
    expect(query.page).toBe(2);
    expect(query.pageSize).toBe(50);
  });
});
