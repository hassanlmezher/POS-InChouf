'use client';

import {
  ArrowDownRight,
  ArrowRight,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Menu,
  Search,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { money, type Product, type StorefrontSection } from '@/lib/types';
import { ProductImage, EmptyState } from './shared';
import {
  StorefrontCommerceChrome,
  type StorefrontCommerce,
} from './storefront-commerce';
import type { StorefrontViewModel } from './storefront-sections';

export default function VarelysStorefront({
  view,
  sections,
  className,
  style,
}: {
  view: StorefrontViewModel;
  sections: StorefrontSection[];
  className: string;
  style: CSSProperties;
}) {
  const { commerce } = view;
  const hero = sections.find(
    (section) => section.type === 'hero' && section.enabled !== false,
  );
  const collection = sections.find(
    (section) =>
      section.type === 'featuredProducts' && section.enabled !== false,
  );
  const delivery = sections.find(
    (section) => section.type === 'deliveryInfo' && section.enabled !== false,
  );
  const products = commerce.filteredProducts;
  const carouselProducts = useMemo(
    () => (commerce.products.length ? commerce.products : products),
    [commerce.products, products],
  );
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const activeHeroProduct = carouselProducts[activeHeroIndex] || carouselProducts[0];
  const title = hero?.title || commerce.settings.tagline || view.tenant.name;
  const description = hero?.description || commerce.settings.description;
  const productCount = commerce.products.length;
  const paymentMethod = commerce.settings.paymentOptions[0];
  const heroTotal = Math.max(carouselProducts.length, 1);

  useEffect(() => {
    setActiveHeroIndex((current) =>
      carouselProducts.length ? current % carouselProducts.length : 0,
    );
  }, [carouselProducts.length]);

  useEffect(() => {
    if (carouselProducts.length < 2) return undefined;

    const timer = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % carouselProducts.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [carouselProducts.length]);

  const scrollToCollection = () => {
    document.getElementById('collection')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const showPreviousHeroProduct = () => {
    setActiveHeroIndex((current) =>
      (current - 1 + carouselProducts.length) % carouselProducts.length,
    );
  };

  const showNextHeroProduct = () => {
    setActiveHeroIndex((current) => (current + 1) % carouselProducts.length);
  };

  return (
    <div className={`${className} vp3-store`} style={style}>
      <header className="vp3-header">
        <a href={`/store/${commerce.slug}`} className="vp3-brand" aria-label={view.tenant.name}>
          <span className="vp3-brand-mark">
            <img src={view.logo} alt="" />
          </span>
          <span className="vp3-brand-copy">
            <strong>{view.tenant.name}</strong>
            <small>Perfume atelier</small>
          </span>
        </a>

        <nav className="vp3-nav" aria-label="Storefront navigation">
          <a href="#collection">Collection</a>
          <a href="#the-house">The house</a>
          <a href="#delivery">Delivery</a>
        </nav>

        <div className="vp3-header-actions">
          <button
            className="vp3-icon-button vp3-menu-button"
            type="button"
            aria-label="Open navigation"
            onClick={scrollToCollection}
          >
            <Menu size={18} />
          </button>
          <button
            className="vp3-icon-button"
            type="button"
            aria-label="Search the collection"
            onClick={commerce.focusCollectionSearch}
          >
            <Search size={18} />
          </button>
          <button
            className="vp3-bag-button"
            type="button"
            onClick={() => commerce.setCartOpen(true)}
            aria-label={`Open bag, ${commerce.count} items`}
          >
            <span className="vp3-bag-icon" aria-hidden="true">
              <ShoppingBag size={18} />
              <span className="vp3-bag-count">{commerce.count}</span>
            </span>
            <span className="vp3-bag-label">Bag</span>
          </button>
        </div>
      </header>

      <main>
        <section className="vp3-hero" id={hero?.id || 'hero'}>
          <div className="vp3-hero-copy">
            <div className="vp3-kicker">
              <Sparkles size={14} />
              <span>{view.tenant.name}</span>
            </div>
            <h1>{title}</h1>
            <p>{description}</p>
            <div className="vp3-hero-actions">
              <button className="vp3-primary-button" type="button" onClick={scrollToCollection}>
                Explore the collection <ArrowRight size={16} />
              </button>
              <span className="vp3-hero-note">
                {productCount} {productCount === 1 ? 'scent' : 'scents'} available
              </span>
            </div>
          </div>

          <div className="vp3-hero-stage" aria-label="Featured scent carousel">
            {activeHeroProduct ? (
              <>
                <div className="vp3-carousel-window" aria-live="polite">
                  <button
                    className="vp3-hero-product-image"
                    type="button"
                    onClick={() => activeHeroProduct.stock > 0 && commerce.setSelected(activeHeroProduct)}
                    disabled={activeHeroProduct.stock === 0}
                    aria-label={`View ${activeHeroProduct.name}`}
                  >
                    <ProductImage src={activeHeroProduct.image} name={activeHeroProduct.name} />
                  </button>
                </div>
                <div className="vp3-hero-product-card">
                  <span>Featured scent</span>
                  <strong>{activeHeroProduct.name}</strong>
                  <small>{activeHeroProduct.category}</small>
                  <b>{money(activeHeroProduct.price)}</b>
                  <button
                    type="button"
                    onClick={() => activeHeroProduct.stock > 0 && commerce.setSelected(activeHeroProduct)}
                    disabled={activeHeroProduct.stock === 0}
                  >
                    {activeHeroProduct.stock === 0 ? 'Unavailable' : 'Discover scent'}
                  </button>
                </div>
                {carouselProducts.length > 1 && (
                  <div className="vp3-carousel-controls" aria-label="Featured scent controls">
                    <button
                      type="button"
                      onClick={showPreviousHeroProduct}
                      aria-label="Show previous scent"
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <div className="vp3-carousel-dots">
                      {carouselProducts.map((product, index) => (
                        <button
                          key={product.id}
                          className={index === activeHeroIndex ? 'active' : ''}
                          type="button"
                          onClick={() => setActiveHeroIndex(index)}
                          aria-label={`Show ${product.name}`}
                          aria-current={index === activeHeroIndex ? 'true' : undefined}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={showNextHeroProduct}
                      aria-label="Show next scent"
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="vp3-hero-empty">{view.tenant.name}</div>
            )}
            <span className="vp3-stage-index">
              {String(activeHeroProduct ? activeHeroIndex + 1 : 1).padStart(2, '0')} / {String(heroTotal).padStart(2, '0')}
            </span>
          </div>
        </section>

        <section className="vp3-collection" id="collection">
          <div className="vp3-section-heading">
            <div>
              <span className="vp3-overline">The edit</span>
              <h2>{collection?.title || 'The collection'}</h2>
            </div>
            <p>{collection?.description || commerce.settings.description}</p>
          </div>

          <div className="vp3-catalog-toolbar">
            <div className="vp3-category-list" aria-label="Filter by category">
              {commerce.categories.map((category) => (
                <button
                  className={commerce.category === category ? 'active' : ''}
                  key={category}
                  type="button"
                  onClick={() => commerce.setCategory(category)}
                >
                  {category === 'All products' ? 'All' : category}
                </button>
              ))}
            </div>
            <label className="vp3-search-field">
              <Search size={16} />
              <input
                ref={commerce.searchInputRef}
                aria-label="Search the collection"
                placeholder="Search scents"
                value={commerce.search}
                onChange={(event) => commerce.setSearch(event.target.value)}
              />
            </label>
          </div>

          {products.length ? (
            <div className="vp3-product-grid">
              {products.map((product) => (
                <VarelysProductTile
                  key={product.id}
                  product={product}
                  commerce={commerce}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No scent found"
              description="Try another search or return to the full collection."
              action={
                <button
                  className="vp3-secondary-button"
                  type="button"
                  onClick={commerce.showAllProducts}
                >
                  View all scents <ArrowRight size={15} />
                </button>
              }
            />
          )}
        </section>

        <section className="vp3-house" id="the-house">
          <div className="vp3-house-intro">
            <span className="vp3-overline">The house</span>
            <h2>{view.tenant.name}</h2>
            <p>{commerce.settings.description}</p>
          </div>
          <div className="vp3-house-points">
            <div>
              <span className="vp3-point-number">01</span>
              <div>
                <h3>Selected with intention</h3>
                <p>{productCount} scents currently in the collection.</p>
              </div>
            </div>
            <div>
              <span className="vp3-point-number">02</span>
              <div>
                <h3>Cash on delivery</h3>
                <p>{paymentMethod || 'Payment details are provided at checkout.'}</p>
              </div>
            </div>
          </div>
          <ArrowDownRight className="vp3-house-arrow" size={36} />
        </section>

        <section className="vp3-details" id="delivery">
          <div>
            <span className="vp3-overline">At your door</span>
            <h2>{delivery?.title || 'Delivery and details'}</h2>
          </div>
          <div className="vp3-detail-list">
            {commerce.zones.map((zone) => (
              <div className="vp3-detail-row" key={zone.id}>
                <div>
                  <span>{zone.name}</span>
                  <p>{zone.notes}</p>
                </div>
                <strong>
                  {zone.fee === 0 ? 'Included' : money(zone.fee)}
                  {zone.freeAbove !== null && (
                    <small>Free from {money(zone.freeAbove)}</small>
                  )}
                </strong>
              </div>
            ))}
            {paymentMethod && (
              <div className="vp3-detail-row">
                <div>
                  <span>Payment</span>
                  <p>Pay when your order arrives.</p>
                </div>
                <strong>{paymentMethod}</strong>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="vp3-footer">
        <div className="vp3-footer-brand">
          <span className="vp3-brand-mark">
            <img src={view.logo} alt="" />
          </span>
          <div>
            <strong>{view.tenant.name}</strong>
            <span>{commerce.settings.address}</span>
          </div>
        </div>
        <div className="vp3-footer-contact">
          {commerce.settings.contactEmail && (
            <a href={`mailto:${commerce.settings.contactEmail}`}>
              {commerce.settings.contactEmail}
            </a>
          )}
          {commerce.settings.contactPhone && (
            <a href={`tel:${commerce.settings.contactPhone.replace(/[^\d+]/g, '')}`}>
              {commerce.settings.contactPhone}
            </a>
          )}
        </div>
        <span className="vp3-footer-note">© {new Date().getFullYear()} {view.tenant.name}</span>
      </footer>

      <StorefrontCommerceChrome commerce={commerce} />
    </div>
  );
}

function VarelysProductTile({
  product,
  commerce,
}: {
  product: Product;
  commerce: StorefrontCommerce;
}) {
  return (
    <article className={`vp3-product-tile${product.stock === 0 ? ' is-sold-out' : ''}`}>
      <button
        className="vp3-product-media"
        type="button"
        onClick={() => product.stock > 0 && commerce.setSelected(product)}
        disabled={product.stock === 0}
        aria-label={`View ${product.name}`}
      >
        <ProductImage src={product.image} name={product.name} />
        <span className="vp3-media-index">{product.category}</span>
        {product.stock === 0 && <span className="vp3-stock-label">Sold out</span>}
      </button>
      <div className="vp3-product-info">
        <div>
          <span className="vp3-product-category">{product.category}</span>
          <h3>{product.name}</h3>
        </div>
        <div className="vp3-product-bottom">
          <strong>{money(product.price)}</strong>
          <button
            type="button"
            className="vp3-product-link"
            onClick={() => product.stock > 0 && commerce.setSelected(product)}
            disabled={product.stock === 0}
          >
            {product.stock === 0 ? 'Unavailable' : 'Discover'}
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
