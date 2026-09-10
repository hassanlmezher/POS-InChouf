'use client';
import type { CSSProperties } from 'react';
import {
  defaultStorefrontConfig,
  money,
  type Settings,
  type StorefrontSection,
  type StorefrontTheme,
  type Tenant,
} from '@/lib/types';
import {
  StorefrontCommerceChrome,
  useStorefrontCommerce,
} from './storefront-commerce';
import { Search, ShoppingBag } from 'lucide-react';
import {
  StorefrontCategories,
  StorefrontNav,
  StorefrontProductCard,
  StorefrontProductGrid,
  StorefrontSections,
  type StorefrontViewModel,
} from './storefront-sections';
import type { Product, Zone } from '@/lib/types';

export function StorefrontTemplate({
  slug,
  tenant,
  products,
  zones,
  settings,
  refresh,
}: {
  slug: string;
  tenant: Tenant;
  products: Product[];
  zones: Zone[];
  settings: Settings;
  refresh: () => void | Promise<void>;
}) {
  const commerce = useStorefrontCommerce({
    slug,
    products,
    zones,
    settings,
    refresh,
  });
  const view: StorefrontViewModel = {
    tenant,
    displayName: slug === 'internal-demo' ? 'The Demo Collection' : tenant.name,
    logo: settings.branding?.logoId ? `/api/store/${slug}/logo` : '',
    commerce,
  };
  const sections = normalizedSections(settings.storefront.sections);
  const template = settings.storefront.template;
  const className = `store-page storefront-template-${template}`;

  if (template === 'editorial')
    return (
      <div className={className} style={themeStyle(settings.storefront.theme)}>
        <DemoBanner slug={slug} />
        <StorefrontNav view={view} />
        <main>
          <div className="sf-editorial-layout">
            <StorefrontSections view={view} sections={sections} />
          </div>
        </main>
        <StorefrontCommerceChrome commerce={commerce} />
      </div>
    );

  if (template === 'compact')
    return (
      <div className={className} style={themeStyle(settings.storefront.theme)}>
        <DemoBanner slug={slug} />
        <StorefrontNav view={view} />
        <main>
          <StorefrontProductGrid
            view={view}
            section={{
              id: 'products',
              type: 'featuredProducts',
              title: 'Shop now',
            }}
          />
          <StorefrontCategories
            view={view}
            section={{ id: 'collection', type: 'categories' }}
          />
          {sections
            .filter((section) => !['hero', 'categories', 'featuredProducts'].includes(section.type))
            .map((section) => (
              <StorefrontSections
                key={section.id}
                view={view}
                sections={[section]}
              />
            ))}
        </main>
        <StorefrontCommerceChrome commerce={commerce} />
      </div>
    );

  if (template === 'luxury-watches')
    return (
      <LuxuryWatchStorefront
        view={view}
        sections={sections}
        className={className}
        style={themeStyle(settings.storefront.theme)}
      />
    );

  if (template === 'custom')
    return (
      <div className={className} style={themeStyle(settings.storefront.theme)}>
        <DemoBanner slug={slug} />
        <StorefrontNav view={view} />
        <main>
          <StorefrontSections view={view} sections={sections} />
        </main>
        <StorefrontCommerceChrome commerce={commerce} />
      </div>
    );

  return (
    <div className={className} style={themeStyle(settings.storefront.theme)}>
      <DemoBanner slug={slug} />
      <StorefrontNav view={view} />
      <main>
        <StorefrontSections view={view} sections={sections} />
      </main>
      <StorefrontCommerceChrome commerce={commerce} />
    </div>
  );
}

function LuxuryWatchStorefront({
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
  const section = (type: StorefrontSection['type']) =>
    sections.find((item) => item.type === type && item.enabled !== false);
  const hero = section('hero');
  const categories = section('categories');
  const products = section('featuredProducts');
  const banner = section('banner');
  const delivery = section('deliveryInfo');
  const shownProducts = products?.category
    ? commerce.filteredProducts.filter(
        (product) => product.category === products.category,
      )
    : commerce.filteredProducts;
  const featured = shownProducts.slice(0, 2);

  return (
    <div className={className} style={style}>
      <main>
        {hero && (
          <section className="lw-hero" id={hero.id}>
            <nav className="lw-nav" aria-label="Storefront">
              <a href={`/store/${commerce.slug}`} className="lw-brand">
                {view.logo ? (
                  <img src={view.logo} alt={`${view.tenant.name} logo`} />
                ) : (
                  <span>{view.displayName.slice(0, 1)}</span>
                )}
                <strong>{view.displayName}</strong>
              </a>
              <div className="lw-nav-actions">
                <button
                  onClick={commerce.focusCollectionSearch}
                  aria-label="Search products"
                  type="button"
                >
                  <Search size={18} />
                </button>
                <button
                  onClick={() => commerce.setCartOpen(true)}
                  aria-label={`Open cart, ${commerce.count} items`}
                  type="button"
                >
                  <ShoppingBag size={18} />
                  {commerce.count > 0 && <span>{commerce.count}</span>}
                </button>
              </div>
            </nav>
            <div className="lw-hero-grid">
              <div className="lw-hero-copy">
                <small>Swiss-inspired curation</small>
                <h1>{hero.title || 'Designed Timepieces'}</h1>
                <p>
                  {hero.description ||
                    commerce.settings.description ||
                    'Precision watches selected with a collector’s eye.'}
                </p>
                <label className="lw-search">
                  <Search size={18} />
                  <input
                    ref={commerce.searchInputRef}
                    aria-label="Search products"
                    placeholder="Search watches"
                    value={commerce.search}
                    onChange={(e) => commerce.setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="lw-featured" aria-label="Featured timepieces">
                {featured.map((product) => (
                  <div
                    key={product.id}
                    className="lw-featured-watch"
                  >
                    <StorefrontProductCard
                      product={product}
                      commerce={commerce}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {categories && (
          <section className="lw-categories-shell">
            <StorefrontCategories view={view} section={categories} />
          </section>
        )}

        {products && (
          <StorefrontProductGrid
            view={view}
            section={{
              ...products,
              title: products.title || 'The current edit',
            }}
          />
        )}

        {banner && (
          <section className="lw-service" id={banner.id}>
            <span>01</span>
            <div>
              <h2>{banner.title || 'Private appointments. Careful delivery.'}</h2>
              <p>
                {banner.description ||
                  'Every order is prepared directly by the boutique and tracked through a private link.'}
              </p>
            </div>
          </section>
        )}

        {delivery && (
          <section className="lw-concierge" id="store-info">
            <div>
              <small>Concierge</small>
              <h2>{delivery.title || 'Delivery and boutique details'}</h2>
            </div>
            <div className="lw-concierge-grid">
              <div>
                <h3>Delivery</h3>
                {commerce.zones.map((zone) => (
                  <p key={zone.id}>
                    {zone.name}: {zone.fee === 0 ? 'Included' : money(zone.fee)}
                    {zone.notes ? ` · ${zone.notes}` : ''}
                    {zone.freeAbove !== null
                      ? ` · Complimentary from ${money(zone.freeAbove)}`
                      : ''}
                  </p>
                ))}
              </div>
              <div>
                <h3>Contact</h3>
                {commerce.settings.contactPhone && (
                  <p>
                    <a
                      href={`tel:${commerce.settings.contactPhone.replace(/[^\d+]/g, '')}`}
                    >
                      {commerce.settings.contactPhone}
                    </a>
                  </p>
                )}
                {commerce.settings.contactEmail && (
                  <p>
                    <a href={`mailto:${commerce.settings.contactEmail}`}>
                      {commerce.settings.contactEmail}
                    </a>
                  </p>
                )}
                {commerce.settings.address && <p>{commerce.settings.address}</p>}
              </div>
            </div>
          </section>
        )}
      </main>
      <StorefrontCommerceChrome commerce={commerce} />
    </div>
  );
}

function DemoBanner({ slug }: { slug: string }) {
  return slug === 'internal-demo' ? (
    <div className="demo-banner">
      INTERNAL DEMO · Sample products, no real purchases or deliveries.
    </div>
  ) : null;
}

function normalizedSections(sections: StorefrontSection[]) {
  return sections.length ? sections : defaultStorefrontConfig.sections;
}

function themeStyle(theme: StorefrontTheme): CSSProperties {
  const tokens: Record<string, string | undefined> = {
    '--sf-bg': theme.background,
    '--sf-hero-bg': theme.heroBackground,
    '--sf-accent': theme.accent,
    '--sf-highlight': theme.highlight || theme.accent,
    '--sf-text': theme.text,
    '--sf-text-muted': theme.muted,
    '--sf-text-dim': theme.dim,
    '--sf-border': theme.border,
    '--sf-card-bg': theme.cardBackground,
    '--sf-card-border': theme.cardBorder,
  };
  return Object.fromEntries(
    Object.entries(tokens).filter(([, value]) => value),
  ) as CSSProperties;
}
