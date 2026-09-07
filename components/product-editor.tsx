'use client';
import { useState } from 'react';
import { Modal, Field, Toggle, ErrorBox, Submit } from './shared';
import { api, message, uploadFile } from '@/lib/client';
import type { Product, Variant, CustomField } from '@/lib/types';
export default function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name || ''),
    [description, setDescription] = useState(product?.description || ''),
    [category, setCategory] = useState(product?.category || 'General'),
    [price, setPrice] = useState((product?.price ?? 0) / 100),
    [stock, setStock] = useState(product?.stock ?? 0),
    [lowStock, setLow] = useState(product?.lowStock ?? 5),
    [active, setActive] = useState(product?.active !== 0),
    [image, setImage] = useState(product?.image || ''),
    [variants, setVariants] = useState<Variant[]>(
      JSON.parse(product?.variants || '[]'),
    ),
    [fields, setFields] = useState<CustomField[]>(
      JSON.parse(product?.customFields || '[]'),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      title={product ? 'Edit product' : 'Add a product'}
      description="Prices are in USD. Stock is shared across product options."
      open
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api(
              product ? `products/${product.id}` : 'products',
              product ? 'PATCH' : 'POST',
              {
                name,
                description,
                category,
                price: Math.round(price * 100),
                stock,
                lowStock,
                active,
                image,
                variants,
                customFields: fields,
              },
            );
            onSaved();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Product name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label="Category">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </Field>
          <Field label="Price ($)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(+e.target.value)}
              required
            />
          </Field>
          <Field label="Stock quantity">
            <input
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(+e.target.value)}
              required
            />
          </Field>
          <Field label="Low-stock threshold">
            <input
              type="number"
              min="0"
              value={lowStock}
              onChange={(e) => setLow(+e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Product image" hint="PNG or JPEG, up to 5 MB.">
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (!['image/png', 'image/jpeg'].includes(f.type)) {
                setError('Choose a PNG or JPEG product image.');
                e.currentTarget.value = '';
                return;
              }
              if (f.size > 5 * 1024 * 1024) {
                setError('Product image must be smaller than 5 MB.');
                e.currentTarget.value = '';
                return;
              }
              setBusy(true);
              setError('');
              try {
                const r = await uploadFile('files', f);
                setImage(`/api/images/${r.id}`);
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          />
          {image && <small>Image selected</small>}
        </Field>
        <Toggle
          label="Visible in storefront"
          value={active}
          onChange={setActive}
        />
        <div className="section-heading">
          <h3>Product options</h3>
          <button
            type="button"
            className="button secondary small"
            onClick={() =>
              setVariants([
                ...variants,
                { name: '', price: Math.round(price * 100), sku: '' },
              ])
            }
          >
            Add option
          </button>
        </div>
        {variants.map((v, i) => (
          <div className="form-grid" key={i}>
            <Field label={`Option ${i + 1} name`}>
              <input
                placeholder="e.g. Black / Medium"
                value={v.name}
                onChange={(e) =>
                  setVariants(
                    variants.map((x, n) =>
                      n === i ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
                required
              />
            </Field>
            <Field label="Option price ($)">
              <input
                type="number"
                min="0"
                step=".01"
                value={v.price / 100}
                onChange={(e) =>
                  setVariants(
                    variants.map((x, n) =>
                      n === i
                        ? { ...x, price: Math.round(+e.target.value * 100) }
                        : x,
                    ),
                  )
                }
              />
            </Field>
            <button
              type="button"
              className="text-link"
              onClick={() => setVariants(variants.filter((_, n) => n !== i))}
            >
              Remove option
            </button>
          </div>
        ))}
        <div className="section-heading">
          <h3>Optional custom fields</h3>
          <button
            type="button"
            className="button secondary small"
            onClick={() =>
              setFields([
                ...fields,
                { name: '', required: false, type: 'text' },
              ])
            }
          >
            Add text field
          </button>
        </div>
        {fields.map((f, i) => (
          <div key={i} className="form-grid">
            <Field label="Field label">
              <input
                value={f.name}
                onChange={(e) =>
                  setFields(
                    fields.map((x, n) =>
                      n === i ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
                required
              />
            </Field>
            <Toggle
              label="Required"
              value={f.required}
              onChange={(v) =>
                setFields(
                  fields.map((x, n) => (n === i ? { ...x, required: v } : x)),
                )
              }
            />
            <button
              type="button"
              className="text-link"
              onClick={() => setFields(fields.filter((_, n) => n !== i))}
            >
              Remove field
            </button>
          </div>
        ))}
        <p>
          <small>Custom fields collect text details during checkout.</small>
        </p>
        <ErrorBox error={error} />
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <Submit busy={busy} busyLabel="Saving product…" />
        </div>
      </form>
    </Modal>
  );
}
