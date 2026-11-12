import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { aiApi, productApi } from '../services/endpoints';
import { ApiClientError } from '../services/api';
import { useCategories, useCreateProduct, useUpdateProduct } from '../hooks/queries';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';
import { useToast } from './ui/Toast';
import type { Product } from '../types';

interface FormState {
  name: string;
  sku: string;
  price: string;
  stock: string;
  categoryId: string;
  imageUrl: string;
  shortDescription: string;
  description: string;
  status: 'active' | 'archived';
  tags: string;
}

const empty: FormState = {
  name: '',
  sku: '',
  price: '',
  stock: '0',
  categoryId: '',
  imageUrl: '',
  shortDescription: '',
  description: '',
  status: 'active',
  tags: '',
};

export default function ProductFormModal({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
}) {
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const { data: categories } = useCategories();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku,
        price: String(product.price),
        stock: String(product.stock),
        categoryId: product.categoryId ?? '',
        imageUrl: product.imageUrl ?? '',
        shortDescription: product.shortDescription ?? '',
        description: product.description ?? '',
        status: product.status,
        tags: (product.tags ?? []).join(', '),
      });
    } else {
      setForm(empty);
    }
  }, [open, product]);

  const set = <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value as FormState[K] }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Product name is required';
    if (!form.sku.trim()) next.sku = 'SKU is required';
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) next.price = 'Enter a valid price (0 or more)';
    const stock = Number(form.stock);
    if (!Number.isInteger(stock) || stock < 0) next.stock = 'Stock must be a whole number ≥ 0';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const generate = async () => {
    if (!form.name.trim()) {
      setErrors((e) => ({ ...e, name: 'Add a product name first' }));
      return;
    }
    setAiBusy(true);
    try {
      const categoryName = categories?.find((c) => c._id === form.categoryId)?.name;
      const data = await aiApi.describe({
        name: form.name.trim(),
        category: categoryName,
        specs: [form.tags && `Tags: ${form.tags}`, form.imageUrl && `Image: ${form.imageUrl}`]
          .filter(Boolean)
          .join('\n'),
      });
      setForm((f) => ({
        ...f,
        description: data.description || f.description,
        shortDescription: data.shortDescription || f.shortDescription,
      }));
      toast.success(
        data.source === 'ai'
          ? 'Draft generated — review before saving.'
          : 'Template draft generated (AI key not configured) — review before saving.',
      );
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Generation failed.');
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
      categoryId: form.categoryId || null,
      imageUrl: form.imageUrl.trim(),
      shortDescription: form.shortDescription.trim(),
      description: form.description.trim(),
      status: form.status,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    try {
      if (product) {
        await update.mutateAsync({ id: product._id, body: payload as never });
        toast.success('Product updated.');
      } else {
        await create.mutateAsync(payload as never);
        toast.success('Product created.');
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error('Could not save the product.');
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={product ? 'Edit product' : 'New product'}
      description="Stock quantity is managed by inventory operations, not this form."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="product-form" loading={create.isPending || update.isPending}>
            {product ? 'Save changes' : 'Create product'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <Field label="Product name" error={errors.name} htmlFor="p-name">
            <Input id="p-name" value={form.name} onChange={set('name')} invalid={!!errors.name} placeholder="Merino Wool Beanie" />
          </Field>
        </div>
        <Field label="SKU" error={errors.sku} htmlFor="p-sku" hint={product ? 'SKU is immutable' : undefined}>
          <Input id="p-sku" value={form.sku} onChange={set('sku')} invalid={!!errors.sku} disabled={!!product} placeholder="BEAN-001" />
        </Field>
        <Field label="Category" htmlFor="p-cat">
          <Select id="p-cat" value={form.categoryId} onChange={set('categoryId')}>
            <option value="">Uncategorised</option>
            {(categories ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Price (USD)" error={errors.price} htmlFor="p-price">
          <Input id="p-price" type="number" step="0.01" min="0" value={form.price} onChange={set('price')} invalid={!!errors.price} placeholder="29.00" />
        </Field>
        <Field label="Initial stock" error={errors.stock} htmlFor="p-stock" hint={product ? 'Use Inventory to adjust stock' : undefined}>
          <Input id="p-stock" type="number" min="0" step="1" value={form.stock} onChange={set('stock')} invalid={!!errors.stock} disabled={!!product} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Image URL" htmlFor="p-image" hint="Any public https image URL">
            <Input id="p-image" value={form.imageUrl} onChange={set('imageUrl')} placeholder="https://images.example.com/beanie.jpg" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Short summary" htmlFor="p-short">
            <Input id="p-short" value={form.shortDescription} onChange={set('shortDescription')} maxLength={300} placeholder="Warm, breathable merino beanie." />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0" htmlFor="p-desc">
              Description
            </label>
            <Button type="button" variant="secondary" className="px-2.5 py-1 text-[11px]" loading={aiBusy} onClick={() => void generate()}>
              <Sparkles className="h-3.5 w-3.5" /> Generate with AI
            </Button>
          </div>
          <Textarea id="p-desc" value={form.description} onChange={set('description')} placeholder="Describe materials, fit and care instructions…" />
        </div>
        <Field label="Tags" htmlFor="p-tags" hint="Comma separated">
          <Input id="p-tags" value={form.tags} onChange={set('tags')} placeholder="winter, wool, unisex" />
        </Field>
        <Field label="Status" htmlFor="p-status">
          <Select id="p-status" value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
      </form>
    </Modal>
  );
}
