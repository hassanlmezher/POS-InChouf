'use client';
import { useEffect, useState } from 'react';
import {
  Search,
  ShoppingBag,
  ArrowRight,
  Truck,
  ShieldCheck,
  Package,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Modal,
  Loading,
  ErrorBox,
  EmptyState,
  Field,
  Choice,
  ProductImage,
} from './shared';
import Checkout, { type CartLine } from './checkout';
import { useResource } from '@/lib/client';
import {
  type Tenant,
  type Product,
  type Variant,
  type CustomField,
  type Zone,
  settingsOf,
  money,
} from '@/lib/types';
export default function Storefront({ slug }: { slug: string }) {
  const r = useResource<{ tenant: Tenant; products: Product[]; zones: Zone[] }>(
    `store/${slug}`,
  );
  const [search, setSearch] = useState(''),
    [category, setCategory] = useState('All products'),
    [selected, setSelected] = useState<Product | null>(null),
    [cart, setCart] = useState<CartLine[]>([]),
    [cartOpen, setCartOpen] = useState(false),
    [checkout, setCheckout] = useState(false),
    [done, setDone] = useState<{
      trackingUrl: string;
      reference: string;
      total: number;
    } | null>(null);
  useEffect(() => {
    const ctx = (
      document as unknown as {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => unknown;
        };
      }
    ).modelContext;
    if (!ctx) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        ctx.registerTool(
          {
            name: 'filter_store_products',
            description: 'Filter the visible product catalog by a search term.',
            inputSchema: {
              type: 'object',
              properties: { query: { type: 'string', maxLength: 100 } },
              required: ['query'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input: unknown) {
              if (
                typeof input !== 'object' ||
                !input ||
                !('query' in input) ||
                typeof input.query !== 'string' ||
                input.query.length > 100
              )
                throw new Error('Use a search query of up to 100 characters.');
              setSearch(input.query);
              return { query: input.query };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, []);
  if (r.loading) return <Loading />;
  if (r.error || !r.data)
    return (
      <main className="section">
        <h1>Store unavailable</h1>
        <ErrorBox error={r.error} retry={r.refresh} />
        <a className="button secondary" href="/">
          Back to InChouf
        </a>
      </main>
    );
  const { tenant, products, zones } = r.data,
    s = settingsOf(tenant),
    logo = s.branding?.logoId ? `/api/store/${slug}/logo` : '',
    filtered = products.filter(
      (p) =>
        (category === 'All products' || p.category === category) &&
        `${p.name} ${p.description}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const priceOf = (l: CartLine) => {
    const p = products.find((p) => p.id === l.productId)!;
    return (
      (JSON.parse(p.variants) as Variant[]).find((v) => v.name === l.variant)
        ?.price ?? p.price
    );
  };
  const total = cart.reduce((s, l) => s + priceOf(l) * l.quantity, 0);
  const cartStockIssue = cart.some((line) => {
    const p = products.find((product) => product.id === line.productId);
    return !p || p.stock <= 0 || line.quantity > Math.min(p.stock, 100);
  });
  const add = (line: CartLine) => {
    const product = products.find((p) => p.id === line.productId);
    if (!product || product.stock <= 0) return;
    const max = Math.min(product.stock, 100);
    const quantity = Math.min(max, line.quantity);
    setCart((existing) => {
      const index = existing.findIndex(
        (item) =>
          item.productId === line.productId &&
          item.variant === line.variant &&
          JSON.stringify(item.custom) === JSON.stringify(line.custom),
      );
      if (index === -1) return [...existing, { ...line, quantity }];
      return existing.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, quantity: Math.min(max, item.quantity + quantity) }
          : item,
      );
    });
    setSelected(null);
    setCartOpen(true);
  };
  return (
    <div className="store-page">
      {slug === 'internal-demo' && (
        <div className="demo-banner">
          INTERNAL DEMO · Sample products, no real purchases or deliveries.
        </div>
      )}
      <header className="store-nav">
        <a href={`/store/${slug}`} className="store-brand">
          {logo ? (
            <img
              className="tenant-logo"
              src={logo}
              alt={`${tenant.name} logo`}
            />
          ) : (
            <span className="brand-mark">i</span>
          )}
          {slug === 'internal-demo' ? 'The Demo Collection' : tenant.name}
        </a>
        <div className="store-nav-links">
          <a href="#collection">The collection</a>
          <a href="#store-info">Delivery & contact</a>
        </div>
        <button
          className="button secondary"
          onClick={() => setCartOpen(true)}
          aria-label={`Open bag, ${count} items`}
        >
          <ShoppingBag size={18} />
          <span>Bag</span>
          <span className="cart-count">{count}</span>
        </button>
      </header>
      <main>
        <section className="store-hero">
          <div className="store-hero-copy">
            <div className="eyebrow">YOUR SHOP · ONLINE</div>
            <h1>{s.tagline}</h1>
            <p>{s.description}</p>
            <a className="button" href="#collection">
              Browse the collection <ArrowRight size={16} />
            </a>
            <div className="store-trust">
              <Truck size={16} />
              <span>Delivered by your shop</span>
              <span>·</span>
              <ShieldCheck size={16} />
              <span>Private tracking</span>
              <span>·</span>
              <span>No account needed</span>
            </div>
          </div>
          <div className="store-hero-visual">
            <div className="store-hero-orbs">
              <div className="orb orb-ring" />
              <div className="orb orb-1" />
              <div className="orb orb-2" />
              <div className="orb orb-3" />
              <div className="sf-stat-pill sf-stat-pill-1">
                <ShieldCheck size={15} />
                Private tracking
              </div>
              <div className="sf-stat-pill sf-stat-pill-2">
                <Sparkles size={15} />
                <span>{products.length} items available</span>
              </div>
            </div>
          </div>
        </section>
        <section className="collection-section" id="collection">
          <div className="section-heading">
            <div>
              <div className="eyebrow">BROWSE THE CATALOG</div>
              <h2>Our products.</h2>
            </div>
            <span className="collection-count">
              {products.length} items
            </span>
          </div>
          <div className="store-filters">
            <div className="filter-pills">
              {[
                'All products',
                ...new Set([
                  ...s.categories,
                  ...products.map((p) => p.category),
                ]),
              ].map((c) => (
                <button
                  className={category === c ? 'active' : ''}
                  key={c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="search-wrap">
              <Search />
              <input
                className="search-input"
                aria-label="Search collection"
                placeholder="Search the collection"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {filtered.length ? (
            <div className="store-product-grid">
              {filtered.map((p) => (
                <article className="store-product" key={p.id}>
                  <button
                    className={
                      'store-product-photo ' + (p.stock === 0 ? 'disabled' : '')
                    }
                    onClick={() => setSelected(p)}
                    aria-label={`View ${p.name}`}
                  >
                    <ProductImage src={p.image} name={p.name} />
                    {JSON.parse(p.customFields).length > 0 && (
                      <span className="badge violet custom-badge">
                        Make it yours
                      </span>
                    )}
                    <span className="product-open">
                      <Plus size={20} />
                    </span>
                    {p.stock === 0 && (
                      <span className="badge red stock-badge">
                        Out of stock
                      </span>
                    )}
                  </button>
                  <div className="store-product-info">
                    <div>
                      <small>{p.category}</small>
                      <h3>
                        <button onClick={() => setSelected(p)}>{p.name}</button>
                      </h3>
                    </div>
                    <strong>{money(p.price)}</strong>
                  </div>
                  {p.stock === 0 && <small>Out of stock</small>}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No products match"
              description="Try a different search or browse all products."
              action={
                <button
                  className="button secondary"
                  onClick={() => {
                    setSearch('');
                    setCategory('All products');
                  }}
                >
                  See all products
                </button>
              }
            />
          )}
        </section>
        <section className="store-info" id="store-info">
          <div>
            <Truck size={24} />
            <h3>Delivery that stays personal.</h3>
            {zones.map((z) => (
              <p key={z.id}>
                {z.name}: {money(z.fee)}. {z.notes}
                {z.freeAbove !== null
                  ? ` Free delivery from ${money(z.freeAbove)}.`
                  : ''}
              </p>
            ))}
          </div>
          <div>
            <ShieldCheck size={24} />
            <h3>Shop directly. Track privately.</h3>
            <p>
              No account needed. Your order comes with a private tracking link.
              Please keep it safe.
            </p>
          </div>
          <div>
            <Package size={24} />
            <h3>Here to help.</h3>
            {s.contactEmail || s.contactPhone || s.address ? (
              <div className="store-contact-list">
                {s.contactEmail && (
                  <p>
                    <small>Email</small>
                    <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a>
                  </p>
                )}
                {s.contactPhone && (
                  <p>
                    <small>Phone</small>
                    <a
                      href={`tel:${s.contactPhone.replace(/[^\d+]/g, '')}`}
                    >
                      {s.contactPhone}
                    </a>
                  </p>
                )}
                {s.address && (
                  <p>
                    <small>Address</small>
                    <span>{s.address}</span>
                  </p>
                )}
              </div>
            ) : (
              <p>Business contact details have not been configured yet.</p>
            )}
          </div>
        </section>
      </main>
      <footer className="store-footer">
        <span>{tenant.name}</span>
        <a href="/">Powered by InChouf OrderPilot ↗</a>
      </footer>
      {selected && (
        <ProductDialog
          product={selected}
          onClose={() => setSelected(null)}
          add={add}
        />
      )}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="details-sheet">
          <div className="sheet-inner">
            <SheetHeader>
              <SheetTitle>
                {done
                  ? 'Order received.'
                  : checkout
                    ? 'Delivery & checkout'
                    : 'Your bag'}
              </SheetTitle>
              <SheetDescription>
                {done
                  ? 'Save your private tracking link.'
                  : `${count} items, chosen by you.`}
              </SheetDescription>
            </SheetHeader>
            <div style={{ marginTop: 28 }}>
              {done ? (
                <div className="form-stack">
                  <div className="success-box">
                    {done.reference} · {money(done.total)}
                  </div>
                  <p>
                    Your order is in the shop’s queue. Use this private link to
                    follow its progress.
                  </p>
                  <a className="button" href={done.trackingUrl}>
                    Track your order <ArrowRight size={16} />
                  </a>
                  <button
                    className="button secondary"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(location.origin + done.trackingUrl)
                        .catch(() => {});
                    }}
                  >
                    Copy tracking link
                  </button>
                  <small style={{ overflowWrap: 'anywhere' }}>
                    {location.origin + done.trackingUrl}
                  </small>
                </div>
              ) : checkout ? (
                <>
                  <button
                    className="text-link"
                    style={{ marginBottom: 20 }}
                    onClick={() => setCheckout(false)}
                  >
                    ← Back to bag
                  </button>
                  <Checkout
                    products={products}
                    zones={zones}
                    settings={s}
                    lines={cart}
                    endpoint={`store/${slug}/orders`}
                    onComplete={(d) => {
                      setDone(d);
                      setCart([]);
                      void r.refresh();
                    }}
                  />
                </>
              ) : cart.length ? (
                <div className="form-stack">
                  {cart.map((l, i) => {
                    const p = products.find((p) => p.id === l.productId)!;
                    const max = Math.min(p.stock, 100);
                    const overStock = l.quantity > max || p.stock === 0;
                    return (
                      <div className="cart-line" key={i}>
                        <div className="cart-photo">
                          <ProductImage src={p.image} name={p.name} />
                        </div>
                        <div>
                          <h3>{p.name}</h3>
                          <small>{l.variant}</small>
                          <strong>{money(priceOf(l))}</strong>
                          {overStock && (
                            <small className="danger-text">
                              Only {Math.max(0, max)} units available.
                            </small>
                          )}
                          <div className="quantity-control">
                            <button
                              aria-label={`Decrease ${p.name}`}
                              onClick={() =>
                                setCart(
                                  l.quantity === 1
                                    ? cart.filter((_, n) => n !== i)
                                    : cart.map((x, n) =>
                                        n === i
                                          ? { ...x, quantity: x.quantity - 1 }
                                          : x,
                                      ),
                                )
                              }
                            >
                              <Minus size={14} />
                            </button>
                            <span>{l.quantity}</span>
                            <button
                              aria-label={`Increase ${p.name}`}
                              disabled={l.quantity >= max}
                              onClick={() =>
                                setCart(
                                  cart.map((x, n) =>
                                    n === i
                                      ? { ...x, quantity: x.quantity + 1 }
                                      : x,
                                  ),
                                )
                              }
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                        <button
                          className="text-link"
                          onClick={() =>
                            setCart(cart.filter((_, n) => n !== i))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                  <div className="order-total final">
                    <span>Subtotal</span>
                    <span>{money(total)}</span>
                  </div>
                  <small>Delivery calculated at checkout.</small>
                  <button
                    className="button"
                    disabled={cartStockIssue}
                    onClick={() => setCheckout(true)}
                  >
                    Continue to checkout <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <EmptyState
                  title="A little room for something good"
                  description="Explore the collection and add a product to your bag."
                  action={
                    <button
                      className="button"
                      onClick={() => setCartOpen(false)}
                    >
                      Keep browsing
                    </button>
                  }
                />
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
function ProductDialog({
  product: p,
  onClose,
  add,
}: {
  product: Product;
  onClose: () => void;
  add: (l: CartLine) => void;
}) {
  const variants = JSON.parse(p.variants) as Variant[],
    fields = JSON.parse(p.customFields) as CustomField[];
  const [variant, setVariant] = useState(variants[0]?.name || ''),
    [quantity, setQuantity] = useState(1),
    [custom, setCustom] = useState<Record<string, string>>({});
  const price = variants.find((v) => v.name === variant)?.price ?? p.price;
  const max = Math.min(p.stock, 100);
  const validQuantity = p.stock > 0 && quantity >= 1 && quantity <= max;
  return (
    <Modal open title={p.name} description={p.description} onClose={onClose}>
      <div className="product-detail-photo">
        <ProductImage src={p.image} name={p.name} />
      </div>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!validQuantity) return;
          add({ productId: p.id, quantity, variant, custom });
        }}
      >
        <div className="section-heading">
          <strong style={{ fontSize: 25 }}>{money(price)}</strong>
          <span className={'badge ' + (p.stock === 0 ? 'red' : 'green')}>
            {p.stock === 0 ? 'Out of stock' : `${p.stock} available`}
          </span>
        </div>
        {variants.length > 0 && (
          <Choice
            label="Choose an option"
            value={variant}
            onChange={setVariant}
            options={variants.map((v) => v.name)}
          />
        )}
        <Field label="Quantity">
          <input
            type="number"
            min="1"
            max={max}
            value={quantity}
            onChange={(e) => {
              const next = Number(e.target.value);
              setQuantity(
                Number.isFinite(next)
                  ? Math.min(Math.max(1, next), max || 1)
                  : 1,
              );
            }}
            required
          />
        </Field>
        {quantity > max && (
          <small className="danger-text">Only {max} units available.</small>
        )}
        {fields
          .filter((f) => f.type === 'text')
          .map((f) => (
            <Field
              key={f.name}
              label={`${f.name}${f.required ? ' *' : ' (optional)'}`}
            >
              <input
                maxLength={1000}
                required={f.required}
                value={custom[f.name] || ''}
                onChange={(e) =>
                  setCustom({ ...custom, [f.name]: e.target.value })
                }
              />
            </Field>
          ))}
        <button className="button" disabled={!validQuantity} type="submit">
          {p.stock === 0
            ? 'Out of stock'
            : `Add to bag · ${money(price * quantity)}`}
          <Plus size={16} />
        </button>
      </form>
    </Modal>
  );
}
