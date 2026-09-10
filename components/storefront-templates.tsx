'use client';
import type { CSSProperties } from 'react';
import {
  defaultStorefrontConfig,
  type Settings,
  type StorefrontSection,
  type StorefrontTheme,
  type Tenant,
} from '@/lib/types';
import {
  StorefrontCommerceChrome,
  useStorefrontCommerce,
} from './storefront-commerce';
import {
  StorefrontCategories,
  StorefrontNav,
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
