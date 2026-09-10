'use client';
import {
  ArrowRight,
  Menu,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { EmptyState, ProductImage } from './shared';
import { money, type Product, type StorefrontSection, type Tenant } from '@/lib/types';
import type { StorefrontCommerce } from './storefront-commerce';

export type StorefrontViewModel = {
  tenant: Tenant;
  displayName: string;
  logo: string;
  commerce: StorefrontCommerce;
};

export function StorefrontNav({ view }: { view: StorefrontViewModel }) {
  const { commerce } = view;
  return (
    <header className="store-nav">
      <div className="store-nav-inner">
        <a href={`/store/${commerce.slug}`} className="store-brand">
          {view.logo ? (
            <img
              className="tenant-logo"
              src={view.logo}
              alt={`${view.tenant.name} logo`}
            />
          ) : (
            <span className="brand-mark">i</span>
          )}
          {view.displayName}
        </a>

        <nav className="store-nav-links">
          <a href="#collection" className="nav-link">
            The collection
          </a>
          <a href="#store-info" className="nav-link">
            Delivery &amp; contact
          </a>
        </nav>

        <StorefrontNavActions commerce={commerce} size={18} />
        <StorefrontNavActions
          commerce={commerce}
          size={19}
          className="store-nav-mobile-actions"
        />
      </div>
    </header>
  );
}

function StorefrontNavActions({
  commerce,
  size,
  className = 'store-nav-actions',
}: {
  commerce: StorefrontCommerce;
  size: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        className="nav-icon-btn"
        onClick={commerce.focusCollectionSearch}
        aria-label="Search products"
        type="button"
      >
        <Search size={size} />
      </button>
      <button
        className="nav-icon-btn"
        onClick={() => commerce.setCartOpen(true)}
        aria-label={`Open cart, ${commerce.count} items`}
        type="button"
      >
        <ShoppingBag size={size} />
        {commerce.count > 0 && <span className="nav-cart-badge">{commerce.count}</span>}
      </button>
      <a className="nav-icon-btn" href="#store-info" aria-label="Open menu">
        <Menu size={size} />
      </a>
    </div>
  );
}

export function StorefrontSections({
  view,
  sections,
}: {
  view: StorefrontViewModel;
  sections: StorefrontSection[];
}) {
  return (
    <>
      {sections.map((section) => (
        <StorefrontSectionRenderer
          key={section.id}
          view={view}
          section={section}
        />
      ))}
    </>
  );
}

function StorefrontSectionRenderer({
  view,
  section,
}: {
  view: StorefrontViewModel;
  section: StorefrontSection;
}) {
  if (section.enabled === false) return null;
  switch (section.type) {
    case 'hero':
      return <StorefrontHero view={view} section={section} />;
    case 'categories':
      return <StorefrontCategories view={view} section={section} />;
    case 'featuredProducts':
      return <StorefrontProductGrid view={view} section={section} />;
    case 'banner':
      return <StorefrontBanner view={view} section={section} />;
    case 'deliveryInfo':
      return <StorefrontDeliveryInfo view={view} section={section} />;
    case 'contact':
      return <StorefrontContact view={view} section={section} />;
  }
}

export function StorefrontHero({
  view,
  section,
}: {
  view: StorefrontViewModel;
  section: StorefrontSection;
}) {
  const { commerce } = view;
  return (
    <section className="store-hero" id={section.id}>
      <div className="store-hero-inner">
        <div className="store-hero-copy">
          {section.title ? (
            <h1 className="hero-title">{section.title}</h1>
          ) : (
            <h1 className="hero-title">
              Discover what you&apos;ll <span>love.</span>
            </h1>
          )}
          <p className="hero-desc">
            {section.description ||
              commerce.settings.description ||
              'A curated collection, delivered to you.'}
          </p>
          <label className="sf-hero-search">
            <Search size={18} />
            <input
              ref={commerce.searchInputRef}
              aria-label="Search products"
              placeholder="Search products..."
              value={commerce.search}
              onChange={(e) => commerce.setSearch(e.target.value)}
            />
          </label>
        </div>
      </div>
    </section>
  );
}

export function StorefrontCategories({
  view,
  section,
}: {
  view: StorefrontViewModel;
  section: StorefrontSection;
}) {
  const { commerce } = view;
  return (
    <section className="sf-categories" id={section.id}>
      <div className="sf-section-header">
        <h2 className="sf-section-title">{section.title || 'Shop by category'}</h2>
        <button
          className="sf-section-link"
          onClick={commerce.showAllProducts}
          type="button"
        >
          View all <ArrowRight size={16} />
        </button>
      </div>
      <div className="category-scroll" aria-label="Product categories">
        {commerce.categories.map((category) => (
          <button
            className={commerce.category === category ? 'active' : ''}
            key={category}
            onClick={() => commerce.setCategory(category)}
            type="button"
          >
            {category === 'All products' ? 'All' : category}
          </button>
        ))}
      </div>
    </section>
  );
}

export function StorefrontProductGrid({
  view,
  section,
}: {
  view: StorefrontViewModel;
  section: StorefrontSection;
}) {
  const { commerce } = view;
  const products = section.category
    ? commerce.filteredProducts.filter((product) => product.category === section.category)
    : commerce.filteredProducts;
  return (
    <section className="sf-products" id={section.id}>
      <div className="sf-products-header">
        <h2 className="sf-section-title">{section.title || 'Featured products'}</h2>
        <button
          className="sf-section-link"
          onClick={commerce.showAllProducts}
          type="button"
        >
          See all <ArrowRight size={16} />
        </button>
      </div>

      {products.length ? (
        <div className="store-product-grid">
          {products.map((product) => (
            <StorefrontProductCard
              key={product.id}
              product={product}
              commerce={commerce}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No products match"
          description="Try a different search or browse all products."
          action={
            <button className="button secondary" onClick={commerce.showAllProducts}>
              See all products
            </button>
          }
        />
      )}
    </section>
  );
}

export function StorefrontProductCard({
  product,
  commerce,
}: {
  product: Product;
  commerce: StorefrontCommerce;
}) {
  return (
    <article className="store-product">
      <div
        className={`store-product-photo${product.stock === 0 ? ' disabled' : ''}`}
        role="button"
        tabIndex={product.stock > 0 ? 0 : -1}
        aria-disabled={product.stock === 0}
        aria-label={`View ${product.name}`}
        onClick={() => product.stock > 0 && commerce.setSelected(product)}
        onKeyDown={(e) => {
          if (product.stock > 0 && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            commerce.setSelected(product);
          }
        }}
      >
        <ProductImage src={product.image} name={product.name} />
        {product.stock === 0 && (
          <span className="badge red stock-badge">Out of stock</span>
        )}
      </div>
      <small className="store-product-category">{product.category}</small>
      <h3 className="store-product-name">
        <button onClick={() => commerce.setSelected(product)} type="button">
          {product.name}
        </button>
      </h3>
      <strong className="store-product-price">{money(product.price)}</strong>
      <button
        className="add-to-bag-btn"
        onClick={() => commerce.setSelected(product)}
        disabled={product.stock === 0}
        aria-label={`Add ${product.name} to bag`}
        type="button"
      >
        <ShoppingBag size={13} />
        {product.stock === 0 ? 'Out of stock' : 'Add to bag'}
      </button>
    </article>
  );
}

export function StorefrontBanner({
  section,
}: {
  view: StorefrontViewModel;
  section: StorefrontSection;
}) {
  return (
    <div className="sf-cta-banner" id={section.id}>
      <Truck size={24} />
      <div>
        <h2 className="sf-cta-title">{section.title || 'Simple. Fast. Private.'}</h2>
        <p>{section.description || 'Get your order, your way.'}</p>
      </div>
      <a href="#collection" className="sf-cta-arrow" aria-label="Browse">
        <ArrowRight size={20} />
      </a>
    </div>
  );
}

export function StorefrontDeliveryInfo({
  view,
  section,
}: {
  view: StorefrontViewModel;
  section: StorefrontSection;
}) {
  return (
    <section className="store-info" id={section.id === 'delivery' ? 'store-info' : section.id}>
      <div>
        <Truck size={22} />
        <h3>{section.title || 'Delivery that stays personal.'}</h3>
        {view.commerce.zones.map((zone) => (
          <p key={zone.id}>
            {zone.name}: {money(zone.fee)}. {zone.notes}
            {zone.freeAbove !== null
              ? ` Free delivery from ${money(zone.freeAbove)}.`
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
        <StorefrontContactDetails view={view} />
      </div>
    </section>
  );
}

export function StorefrontContact({
  view,
  section,
}: {
  view: StorefrontViewModel;
  section: StorefrontSection;
}) {
  return (
    <section className="store-info store-info-contact" id={section.id}>
      <div>
        <Package size={22} />
        <h3>{section.title || 'Contact the shop.'}</h3>
        <StorefrontContactDetails view={view} />
      </div>
    </section>
  );
}

function StorefrontContactDetails({ view }: { view: StorefrontViewModel }) {
  const settings = view.commerce.settings;
  return settings.contactEmail || settings.contactPhone || settings.address ? (
    <div className="store-contact-list">
      {settings.contactEmail && (
        <p>
          <small>Email</small>
          <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
        </p>
      )}
      {settings.contactPhone && (
        <p>
          <small>Phone</small>
          <a href={`tel:${settings.contactPhone.replace(/[^\d+]/g, '')}`}>
            {settings.contactPhone}
          </a>
        </p>
      )}
      {settings.address && (
        <p>
          <small>Address</small>
          <span>{settings.address}</span>
        </p>
      )}
    </div>
  ) : (
    <p>Business contact details have not been configured yet.</p>
  );
}
