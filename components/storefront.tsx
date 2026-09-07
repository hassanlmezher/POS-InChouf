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
  ChevronDown,
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

  // Split tagline into two visual lines (at first '. ')
  const taglineRaw = s.tagline || tenant.name;
  const splitIdx = taglineRaw.indexOf('. ');
  const tagline1 =
    splitIdx > -1 ? taglineRaw.substring(0, splitIdx + 1) : taglineRaw;
  const tagline2 = splitIdx > -1 ? taglineRaw.substring(splitIdx + 2) : '';

  const categories = [
    'All products',
    ...new Set([...s.categories, ...products.map((p) => p.category)]),
  ];

  return (
    <div className="store-page">
      {slug === 'internal-demo' && (
        <div className="demo-banner">
          INTERNAL DEMO · Sample products, no real purchases or deliveries.
        </div>
      )}

      {/* ===== NAV ===== */}
      <header className="store-nav">
        <div className="store-nav-inner">
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

          <nav className="store-nav-links">
            <a href={`/store/${slug}`} className="nav-link nav-link-active">
              Home
            </a>
            <a href="#collection" className="nav-link">
              The collection
            </a>
            <a href="#store-info" className="nav-link">
              Delivery &amp; contact
            </a>
          </nav>

          <div className="store-nav-search">
            <Search size={14} />
            <input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
          </div>

          <div className="store-nav-actions">
            <button
              className="nav-icon-btn"
              onClick={() => setCartOpen(true)}
              aria-label={`Open cart, ${count} items`}
            >
              <ShoppingBag size={18} />
              {count > 0 && (
                <span className="nav-cart-badge">{count}</span>
              )}
            </button>
          </div>

          {/* Mobile actions */}
          <div className="store-nav-mobile-actions">
            <button className="nav-icon-btn" aria-label="Search">
              <Search size={19} />
            </button>
            <button
              className="nav-icon-btn"
              onClick={() => setCartOpen(true)}
              aria-label={`Open cart, ${count} items`}
            >
              <ShoppingBag size={19} />
              {count > 0 && (
                <span className="nav-cart-badge">{count}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ===== HERO ===== */}
        <section className="store-hero">
          <div className="store-hero-inner">
            {/* Left: main copy */}
            <div className="store-hero-left">
              <p className="sf-eyebrow">YOUR SHOP · ONLINE</p>
              <h1 className="hero-title">
                <span>{tagline1}</span>
                {tagline2 && (
                  <span className="sf-highlight">
                    <br />
                    {tagline2}
                  </span>
                )}
              </h1>
              <p className="hero-desc">
                {s.description ||
                  'Explore our curated collection and order directly from our shop. Simple, fast, and private.'}
              </p>
              <div className="hero-actions">
                <a className="hero-btn-primary" href="#collection">
                  Browse the collection <ArrowRight size={14} />
                </a>
                <a className="hero-btn-secondary" href="#store-info">
                  Learn more
                </a>
              </div>
            </div>

            {/* Right: blob + secondary panel */}
            <div className="store-hero-right" aria-hidden="true">
              <div className="hero-blob">
                <div className="hero-blob-s1" />
                <div className="hero-blob-s2" />
              </div>
              <div className="hero-secondary-panel">
                <p className="sf-eyebrow">EVERYDAY ESSENTIALS</p>
                <h2 className="hero-panel-title">
                  Good Things
                  <br />
                  <span className="sf-highlight">Find You.</span>
                </h2>
                <div className="hero-panel-rule" />
                <p className="hero-panel-sub">
                  Quality products.
                  <br />A simpler way to shop.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== CATEGORIES ===== */}
        <section className="sf-categories" id="collection">
          <div className="sf-section-header">
            <div>
              <p className="sf-eyebrow">SHOP BY CATEGORY</p>
              <h2 className="sf-section-title">The collection.</h2>
            </div>
          </div>
          <div className="filter-pills">
            {categories.map((c) => (
              <button
                key={c}
                className={category === c ? 'active' : ''}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        {/* ===== PRODUCTS ===== */}
        <section className="sf-products">
          <div className="sf-products-header">
            <div>
              <p className="sf-eyebrow">FEATURED PRODUCTS</p>
              <h2 className="sf-section-title">Our products.</h2>
            </div>
            <div className="sf-products-controls">
              <div className="sf-search-wrap">
                <Search size={14} />
                <input
                  className="sf-search-input"
                  aria-label="Search collection"
                  placeholder="Search the collection..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="sf-sort-wrap">
                <span>Sort by</span>
                <strong>Featured</strong>
                <ChevronDown size={13} />
              </div>
            </div>
          </div>

          {filtered.length ? (
            <div className="store-product-grid">
              {filtered.map((p) => (
                <article className="store-product" key={p.id}>
                  <div
                    className={`store-product-photo${p.stock === 0 ? ' disabled' : ''}`}
                    role="button"
                    tabIndex={p.stock > 0 ? 0 : -1}
                    aria-disabled={p.stock === 0}
                    aria-label={`View ${p.name}`}
                    onClick={() => p.stock > 0 && setSelected(p)}
                    onKeyDown={(e) => {
                      if (
                        p.stock > 0 &&
                        (e.key === 'Enter' || e.key === ' ')
                      ) {
                        e.preventDefault();
                        setSelected(p);
                      }
                    }}
                  >
                    <ProductImage src={p.image} name={p.name} />
                    {JSON.parse(p.customFields).length > 0 && (
                      <span className="badge violet custom-badge">
                        Make it yours
                      </span>
                    )}
                    {p.stock === 0 && (
                      <span className="badge red stock-badge">
                        Out of stock
                      </span>
                    )}
                  </div>
                  <div className="store-product-meta">
                    <small>{p.category}</small>
                    <strong>{money(p.price)}</strong>
                  </div>
                  <h3 className="store-product-name">
                    <button onClick={() => setSelected(p)}>{p.name}</button>
                  </h3>
                  <button
                    className="add-to-bag-btn"
                    onClick={() => setSelected(p)}
                    disabled={p.stock === 0}
                    aria-label={`Add ${p.name} to bag`}
                  >
                    <ShoppingBag size={13} />
                    {p.stock === 0 ? 'Out of stock' : 'Add to bag'}
                  </button>
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

        {/* ===== CTA BANNER ===== */}
        <div className="sf-cta-banner">
          <div>
            <p className="sf-eyebrow">A BETTER WAY TO SHOP</p>
            <h2 className="sf-cta-title">Simple. Fast. Private.</h2>
          </div>
          <a href="#collection" className="sf-cta-arrow" aria-label="Browse">
            <ArrowRight size={20} />
          </a>
        </div>

        {/* ===== STORE INFO ===== */}
        <section className="store-info" id="store-info">
          <div>
            <Truck size={22} />
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
            <ShieldCheck size={22} />
            <h3>Shop directly. Track privately.</h3>
            <p>
              No account needed. Your order comes with a private tracking link.
              Please keep it safe.
            </p>
          </div>
          <div>
            <Package size={22} />
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
                    <a href={`tel:${s.contactPhone.replace(/[^\d+]/g, '')}`}>
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

      {/* ===== PRODUCT DIALOG ===== */}
      {selected && (
        <ProductDialog
          product={selected}
          onClose={() => setSelected(null)}
          add={add}
        />
      )}

      {/* ===== CART SHEET ===== */}
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
                    Your order is in the shop&apos;s queue. Use this private
                    link to follow its progress.
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
