'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Search,
  ShoppingBag,
  ArrowRight,
  Truck,
  ShieldCheck,
  Package,
  Plus,
  Minus,
  Menu,
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
import Checkout, { isValidQuantity, type CartLine } from './checkout';
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
    } | null>(null),
    [copyFeedback, setCopyFeedback] = useState<'success' | 'error' | null>(
      null,
    );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);

  const copyTrackingLink = async () => {
    if (!done) return;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(window.location.origin + done.trackingUrl);
      setCopyFeedback('success');
    } catch {
      setCopyFeedback('error');
    }
    if (copyFeedbackTimerRef.current !== null)
      window.clearTimeout(copyFeedbackTimerRef.current);
    copyFeedbackTimerRef.current = window.setTimeout(
      () => setCopyFeedback(null),
      3200,
    );
  };

  useEffect(
    () => () => {
      if (copyFeedbackTimerRef.current !== null)
        window.clearTimeout(copyFeedbackTimerRef.current);
    },
    [],
  );

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

  const count = cart.reduce(
    (s, l) => s + (isValidQuantity(l.quantity) ? l.quantity : 0),
    0,
  );
  const priceOf = (l: CartLine) => {
    const p = products.find((p) => p.id === l.productId)!;
    return (
      (JSON.parse(p.variants) as Variant[]).find((v) => v.name === l.variant)
        ?.price ?? p.price
    );
  };
  const total = cart.reduce(
    (s, l) => s + priceOf(l) * (isValidQuantity(l.quantity) ? l.quantity : 0),
    0,
  );
  const cartStockIssue = cart.some((line) => {
    const p = products.find((product) => product.id === line.productId);
    return (
      !p ||
      !isValidQuantity(line.quantity) ||
      p.stock <= 0 ||
      line.quantity > Math.min(p.stock, 100)
    );
  });
  const add = (line: CartLine) => {
    const product = products.find((p) => p.id === line.productId);
    if (!product || product.stock <= 0) return;
    const max = Math.min(product.stock, 100);
    if (!isValidQuantity(line.quantity)) return;
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
          ? {
              ...item,
              quantity: Math.min(
                max,
                (isValidQuantity(item.quantity) ? item.quantity : 0) + quantity,
              ),
            }
          : item,
      );
    });
    setSelected(null);
    setCartOpen(true);
  };

  const categories = [
    'All products',
    ...new Set([...s.categories, ...products.map((p) => p.category)]),
  ];

  const focusCollectionSearch = () => {
    searchInputRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    window.setTimeout(
      () => searchInputRef.current?.focus({ preventScroll: true }),
      300,
    );
  };

  const showAllProducts = () => {
    setSearch('');
    setCategory('All products');
    document
      .getElementById('products')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="store-page">
      {slug === 'internal-demo' && (
        <div className="demo-banner">
          INTERNAL DEMO · Sample products, no real purchases or deliveries.
        </div>
      )}

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
            <a href="#collection" className="nav-link">
              The collection
            </a>
            <a href="#store-info" className="nav-link">
              Delivery &amp; contact
            </a>
          </nav>

          <div className="store-nav-actions">
            <button
              className="nav-icon-btn"
              onClick={focusCollectionSearch}
              aria-label="Search products"
            >
              <Search size={18} />
            </button>
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
            <a
              className="nav-icon-btn"
              href="#store-info"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </a>
          </div>

          <div className="store-nav-mobile-actions">
            <button
              className="nav-icon-btn"
              onClick={focusCollectionSearch}
              aria-label="Search products"
            >
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
            <a
              className="nav-icon-btn"
              href="#store-info"
              aria-label="Open menu"
            >
              <Menu size={19} />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="store-hero">
          <div className="store-hero-inner">
            <div className="store-hero-copy">
              <h1 className="hero-title">
                Discover what you&apos;ll <span>love.</span>
              </h1>
              <p className="hero-desc">
                {s.description ||
                  'A curated collection, delivered to you.'}
              </p>
              <label className="sf-hero-search">
                <Search size={18} />
                <input
                  ref={searchInputRef}
                  aria-label="Search products"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="sf-categories" id="collection">
          <div className="sf-section-header">
            <h2 className="sf-section-title">Shop by category</h2>
            <button
              className="sf-section-link"
              onClick={showAllProducts}
              type="button"
            >
              View all <ArrowRight size={16} />
            </button>
          </div>
          <div className="category-scroll" aria-label="Product categories">
            {categories.map((c) => (
              <button
                className={category === c ? 'active' : ''}
                key={c}
                onClick={() => setCategory(c)}
                type="button"
              >
                {c === 'All products' ? 'All' : c}
              </button>
            ))}
          </div>
        </section>

        <section className="sf-products" id="products">
          <div className="sf-products-header">
            <h2 className="sf-section-title">Featured products</h2>
            <button
              className="sf-section-link"
              onClick={showAllProducts}
              type="button"
            >
              See all <ArrowRight size={16} />
            </button>
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
                    {p.stock === 0 && (
                      <span className="badge red stock-badge">
                        Out of stock
                      </span>
                    )}
                  </div>
                  <small className="store-product-category">{p.category}</small>
                  <h3 className="store-product-name">
                    <button onClick={() => setSelected(p)}>{p.name}</button>
                  </h3>
                  <strong className="store-product-price">{money(p.price)}</strong>
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

        <div className="sf-cta-banner">
          <Truck size={24} />
          <div>
            <h2 className="sf-cta-title">Simple. Fast. Private.</h2>
            <p>Get your order, your way.</p>
          </div>
          <a href="#collection" className="sf-cta-arrow" aria-label="Browse">
            <ArrowRight size={20} />
          </a>
        </div>

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
      <Sheet
        open={cartOpen}
        onOpenChange={(open) => {
          setCartOpen(open);
          if (!open && !done) setCheckout(false);
        }}
      >
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
                    Your order is in the shop&apos;s queue. Copy this private link
                    and save it somewhere safe before tracking your order. You
                    will need it to check the order status later.
                  </p>
                  <div className="tracking-save-note">
                    <strong>Save your link before you continue.</strong>
                    <span>
                      The link is private and is the only way to access your
                      order status later.
                    </span>
                  </div>
                  <button
                    className="button secondary"
                    onClick={copyTrackingLink}
                  >
                    {copyFeedback === 'success'
                      ? 'Tracking link copied'
                      : 'Copy tracking link'}
                  </button>
                  <a className="button" href={done.trackingUrl}>
                    Track your order <ArrowRight size={16} />
                  </a>
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
                    const quantity = isValidQuantity(l.quantity)
                      ? l.quantity
                      : 0;
                    const overStock =
                      !isValidQuantity(l.quantity) ||
                      quantity > max ||
                      p.stock === 0;
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
                                  quantity <= 1
                                    ? cart.filter((_, n) => n !== i)
                                    : cart.map((x, n) =>
                                        n === i
                                          ? { ...x, quantity: quantity - 1 }
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
                              disabled={quantity >= max}
                              onClick={() =>
                                setCart(
                                  cart.map((x, n) =>
                                    n === i
                                      ? { ...x, quantity: quantity + 1 }
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

      {copyFeedback && (
        <div
          className={`toast-message ${copyFeedback}`}
          role={copyFeedback === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {copyFeedback === 'success'
            ? 'Tracking link copied. Save it somewhere safe.'
            : 'Could not copy the link automatically. Select the link below to copy it.'}
        </div>
      )}
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
    [quantity, setQuantity] = useState<number | ''>(1),
    [custom, setCustom] = useState<Record<string, string>>({});
  const price = variants.find((v) => v.name === variant)?.price ?? p.price;
  const max = Math.min(p.stock, 100);
  const validQuantity = p.stock > 0 && isValidQuantity(quantity) && quantity <= max;
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
              const value = e.target.value;
              setQuantity(value === '' ? '' : Number(value));
            }}
            required
          />
        </Field>
        {!validQuantity && quantity === '' && (
          <small className="danger-text">Enter a quantity before continuing.</small>
        )}
        {isValidQuantity(quantity) && quantity > max && (
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
            : validQuantity
              ? `Add to bag · ${money(price * quantity)}`
              : 'Enter a valid quantity'}
          <Plus size={16} />
        </button>
      </form>
    </Modal>
  );
}
