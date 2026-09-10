'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import Checkout, { isValidQuantity, type CartLine } from './checkout';
import { Field, Choice, EmptyState, Modal, ProductImage } from './shared';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import {
  money,
  type CustomField,
  type Product,
  type Settings,
  type Variant,
  type Zone,
} from '@/lib/types';

type CheckoutResult = {
  trackingUrl: string;
  reference: string;
  total: number;
};

export type StorefrontCommerce = ReturnType<typeof useStorefrontCommerce>;

export function useStorefrontCommerce({
  slug,
  products,
  zones,
  settings,
  refresh,
}: {
  slug: string;
  products: Product[];
  zones: Zone[];
  settings: Settings;
  refresh: () => void | Promise<void>;
}) {
  const [search, setSearch] = useState(''),
    [category, setCategory] = useState('All products'),
    [selected, setSelected] = useState<Product | null>(null),
    [cart, setCart] = useState<CartLine[]>([]),
    [cartOpen, setCartOpen] = useState(false),
    [checkout, setCheckout] = useState(false),
    [done, setDone] = useState<CheckoutResult | null>(null),
    [copyFeedback, setCopyFeedback] = useState<'success' | 'error' | null>(
      null,
    );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);

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

  const filteredProducts = products.filter(
    (p) =>
      (category === 'All products' || p.category === category) &&
      `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  const categories = [
    'All products',
    ...new Set([...settings.categories, ...products.map((p) => p.category)]),
  ];
  const count = cart.reduce(
    (s, l) => s + (isValidQuantity(l.quantity) ? l.quantity : 0),
    0,
  );
  const priceOf = (line: CartLine) => {
    const product = products.find((p) => p.id === line.productId);
    if (!product) return 0;
    return (
      (JSON.parse(product.variants) as Variant[]).find(
        (v) => v.name === line.variant,
      )?.price ?? product.price
    );
  };
  const total = cart.reduce(
    (s, l) => s + priceOf(l) * (isValidQuantity(l.quantity) ? l.quantity : 0),
    0,
  );
  const cartStockIssue = cart.some((line) => {
    const product = products.find((p) => p.id === line.productId);
    return (
      !product ||
      !isValidQuantity(line.quantity) ||
      product.stock <= 0 ||
      line.quantity > Math.min(product.stock, 100)
    );
  });

  const add = (line: CartLine) => {
    const product = products.find((p) => p.id === line.productId);
    if (!product || product.stock <= 0 || !isValidQuantity(line.quantity))
      return;
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

  const completeOrder = (result: CheckoutResult) => {
    setDone(result);
    setCart([]);
    void refresh();
  };

  return {
    slug,
    products,
    zones,
    settings,
    search,
    setSearch,
    category,
    setCategory,
    selected,
    setSelected,
    cart,
    setCart,
    cartOpen,
    setCartOpen,
    checkout,
    setCheckout,
    done,
    copyFeedback,
    count,
    total,
    cartStockIssue,
    filteredProducts,
    categories,
    searchInputRef,
    priceOf,
    add,
    focusCollectionSearch,
    showAllProducts,
    copyTrackingLink,
    completeOrder,
  };
}

export function StorefrontCommerceChrome({
  commerce,
}: {
  commerce: StorefrontCommerce;
}) {
  return (
    <>
      {commerce.selected && (
        <ProductDialog
          product={commerce.selected}
          onClose={() => commerce.setSelected(null)}
          add={commerce.add}
        />
      )}
      <CartSheet commerce={commerce} />
      {commerce.copyFeedback && (
        <div
          className={`toast-message ${commerce.copyFeedback}`}
          role={commerce.copyFeedback === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {commerce.copyFeedback === 'success'
            ? 'Tracking link copied. Save it somewhere safe.'
            : 'Could not copy the link automatically. Select the link below to copy it.'}
        </div>
      )}
    </>
  );
}

function CartSheet({ commerce }: { commerce: StorefrontCommerce }) {
  return (
    <Sheet
      open={commerce.cartOpen}
      onOpenChange={(open) => {
        commerce.setCartOpen(open);
        if (!open && !commerce.done) commerce.setCheckout(false);
      }}
    >
      <SheetContent className="details-sheet">
        <div className="sheet-inner">
          <SheetHeader>
            <SheetTitle>
              {commerce.done
                ? 'Order received.'
                : commerce.checkout
                  ? 'Delivery & checkout'
                  : 'Your bag'}
            </SheetTitle>
            <SheetDescription>
              {commerce.done
                ? 'Save your private tracking link.'
                : `${commerce.count} items, chosen by you.`}
            </SheetDescription>
          </SheetHeader>
          <div style={{ marginTop: 28 }}>
            {commerce.done ? (
              <OrderComplete commerce={commerce} />
            ) : commerce.checkout ? (
              <CheckoutPanel commerce={commerce} />
            ) : commerce.cart.length ? (
              <CartLines commerce={commerce} />
            ) : (
              <EmptyState
                title="A little room for something good"
                description="Explore the collection and add a product to your bag."
                action={
                  <button
                    className="button"
                    onClick={() => commerce.setCartOpen(false)}
                    type="button"
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
  );
}

function OrderComplete({ commerce }: { commerce: StorefrontCommerce }) {
  const done = commerce.done!;
  return (
    <div className="form-stack">
      <div className="success-box">
        {done.reference} · {money(done.total)}
      </div>
      <p>
        Your order is in the shop&apos;s queue. Copy this private link and save
        it somewhere safe before tracking your order. You will need it to check
        the order status later.
      </p>
      <div className="tracking-save-note">
        <strong>Save your link before you continue.</strong>
        <span>
          The link is private and is the only way to access your order status
          later.
        </span>
      </div>
      <button
        className="button secondary"
        onClick={commerce.copyTrackingLink}
        type="button"
      >
        {commerce.copyFeedback === 'success'
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
  );
}

function CheckoutPanel({ commerce }: { commerce: StorefrontCommerce }) {
  return (
    <>
      <button
        className="text-link"
        style={{ marginBottom: 20 }}
        onClick={() => commerce.setCheckout(false)}
        type="button"
      >
        ← Back to bag
      </button>
      <Checkout
        products={commerce.products}
        zones={commerce.zones}
        settings={commerce.settings}
        lines={commerce.cart}
        endpoint={`store/${commerce.slug}/orders`}
        onComplete={commerce.completeOrder}
      />
    </>
  );
}

function CartLines({ commerce }: { commerce: StorefrontCommerce }) {
  return (
    <div className="form-stack">
      {commerce.cart.map((line, index) => {
        const product = commerce.products.find((p) => p.id === line.productId);
        if (!product) return null;
        const max = Math.min(product.stock, 100);
        const quantity = isValidQuantity(line.quantity) ? line.quantity : 0;
        const overStock =
          !isValidQuantity(line.quantity) ||
          quantity > max ||
          product.stock === 0;
        return (
          <div className="cart-line" key={index}>
            <div className="cart-photo">
              <ProductImage src={product.image} name={product.name} />
            </div>
            <div>
              <h3>{product.name}</h3>
              <small>{line.variant}</small>
              <strong>{money(commerce.priceOf(line))}</strong>
              {overStock && (
                <small className="danger-text">
                  Only {Math.max(0, max)} units available.
                </small>
              )}
              <div className="quantity-control">
                <button
                  aria-label={`Decrease ${product.name}`}
                  onClick={() =>
                    commerce.setCart(
                      quantity <= 1
                        ? commerce.cart.filter((_, n) => n !== index)
                        : commerce.cart.map((x, n) =>
                            n === index ? { ...x, quantity: quantity - 1 } : x,
                          ),
                    )
                  }
                  type="button"
                >
                  <Minus size={14} />
                </button>
                <span>{line.quantity}</span>
                <button
                  aria-label={`Increase ${product.name}`}
                  disabled={quantity >= max}
                  onClick={() =>
                    commerce.setCart(
                      commerce.cart.map((x, n) =>
                        n === index ? { ...x, quantity: quantity + 1 } : x,
                      ),
                    )
                  }
                  type="button"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <button
              className="text-link"
              onClick={() =>
                commerce.setCart(commerce.cart.filter((_, n) => n !== index))
              }
              type="button"
            >
              Remove
            </button>
          </div>
        );
      })}
      <div className="order-total final">
        <span>Subtotal</span>
        <span>{money(commerce.total)}</span>
      </div>
      <small>Delivery calculated at checkout.</small>
      <button
        className="button"
        disabled={commerce.cartStockIssue}
        onClick={() => commerce.setCheckout(true)}
        type="button"
      >
        Continue to checkout <ArrowRight size={16} />
      </button>
    </div>
  );
}

function ProductDialog({
  product,
  onClose,
  add,
}: {
  product: Product;
  onClose: () => void;
  add: (line: CartLine) => void;
}) {
  const variants = JSON.parse(product.variants) as Variant[],
    fields = JSON.parse(product.customFields) as CustomField[];
  const [variant, setVariant] = useState(variants[0]?.name || ''),
    [quantity, setQuantity] = useState<number | ''>(1),
    [custom, setCustom] = useState<Record<string, string>>({});
  const price = variants.find((v) => v.name === variant)?.price ?? product.price;
  const max = Math.min(product.stock, 100);
  const validQuantity =
    product.stock > 0 && isValidQuantity(quantity) && quantity <= max;
  return (
    <Modal
      open
      title={product.name}
      description={product.description}
      onClose={onClose}
    >
      <div className="product-detail-photo">
        <ProductImage src={product.image} name={product.name} />
      </div>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!validQuantity) return;
          add({ productId: product.id, quantity, variant, custom });
        }}
      >
        <div className="section-heading">
          <strong style={{ fontSize: 25 }}>{money(price)}</strong>
          <span className={'badge ' + (product.stock === 0 ? 'red' : 'green')}>
            {product.stock === 0 ? 'Out of stock' : `${product.stock} available`}
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
          .map((field) => (
            <Field
              key={field.name}
              label={`${field.name}${field.required ? ' *' : ' (optional)'}`}
            >
              <input
                maxLength={1000}
                required={field.required}
                value={custom[field.name] || ''}
                onChange={(e) =>
                  setCustom({ ...custom, [field.name]: e.target.value })
                }
              />
            </Field>
          ))}
        <button className="button" disabled={!validQuantity} type="submit">
          {product.stock === 0
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

export type SearchInputRef = RefObject<HTMLInputElement | null>;
