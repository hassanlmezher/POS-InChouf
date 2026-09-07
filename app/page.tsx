import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Package,
  Truck,
  MousePointer2,
  Layers,
  CheckCircle2,
  ShoppingBag,
} from 'lucide-react';
import { contact, configured } from '@/config/contact';
export default function Home() {
  return (
    <div className="marketing">
      <nav className="public-nav">
        <a className="brand" href="/">
          <span className="brand-mark">i</span>InChouf
          <span className="brand-product">OrderPilot</span>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
        </div>
        <a className="button secondary" href="/login">
          Sign in <ArrowUpRight size={16} />
        </a>
      </nav>
      <main>
        <section className="hero">
          <div className="eyebrow">
            <span className="live-dot" /> YOUR BUSINESS. IN ORDER.
          </div>
          <h1>
            Turn online orders
            <br />
            into <span>organized deliveries.</span>
          </h1>
          <p>
            Your storefront, your team, your delivery process.
            <br />
            One clear workspace from the first click to the last mile.
          </p>
          <div className="hero-actions">
            <a className="button" href="/store/internal-demo">
              Explore the demo <ArrowRight size={17} />
            </a>
            <a className="button secondary" href="#contact">
              Get Started
            </a>
          </div>
          <div className="hero-note">
            $20 / month <span>·</span> No payment gateway required{' '}
            <span>·</span> Made for your shop
          </div>
          <div className="product-preview">
            <aside>
              <div className="brand small">✦ OrderPilot</div>
              <div className="preview-shop">
                Internal demo <span>DEMO</span>
              </div>
              {[
                'Overview',
                'Orders',
                'Work queues',
                'Products',
                'Delivery',
                'Customers',
              ].map((x, i) => (
                <div
                  className={'preview-nav ' + (!i ? 'selected' : '')}
                  key={x}
                >
                  {
                    [
                      <Layers key="preview-0" size={16} />,
                      <ShoppingBag key="preview-1" size={16} />,
                      <CheckCircle2 key="preview-2" size={16} />,
                      <Package key="preview-3" size={16} />,
                      <Truck key="preview-4" size={16} />,
                      <MousePointer2 key="preview-5" size={16} />,
                    ][i]
                  }
                  {x}
                </div>
              ))}
              <div className="preview-bottom">
                A little more clarity.
                <br />A lot less busywork.
              </div>
            </aside>
            <div className="preview-main">
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR DAILY PICTURE</div>
                  <h2>Everything is moving.</h2>
                  <p>Illustrative internal demo workspace</p>
                </div>
                <span className="badge green">● Store is open</span>
              </div>
              <div className="metric-grid">
                {[
                  ['Orders to prepare', '08', 'Ready for your team'],
                  ['Out for delivery', '04', 'On their way'],
                  ['Delivered today', '12', 'From checkout to doorstep'],
                ].map(([a, b, c]) => (
                  <div className="metric" key={a}>
                    <span>{a}</span>
                    <strong>{b}</strong>
                    <small>{c}</small>
                  </div>
                ))}
              </div>
              <div className="preview-orders">
                <div className="section-heading">
                  <h3>Keep every order moving</h3>
                  <span>Order workflow →</span>
                </div>
                {[
                  ['#DEMO-104', 'Studio headphones', 'Picking', 'violet'],
                  ['#DEMO-103', 'Everyday tote', 'Packed', 'violet'],
                  [
                    '#DEMO-102',
                    'Desk essentials',
                    'Out for Delivery',
                    'orange',
                  ],
                ].map(([id, name, status, color]) => (
                  <div className="preview-row" key={id}>
                    <div className="product-icon">
                      <Package size={20} />
                    </div>
                    <strong>{id}</strong>
                    <span>{name}</span>
                    <span className={'badge ' + color}>{status}</span>
                    <ArrowUpRight size={16} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="section" id="how">
          <div className="eyebrow">LESS CHASING. MORE DOING.</div>
          <div className="section-intro">
            <h2>
              A clear next step.
              <br />
              For every order.
            </h2>
            <p>
              Keep the details together and give everyone a job they can act on.
            </p>
          </div>
          <div className="steps">
            {[
              [
                '01',
                'A customer orders',
                'Products, options and delivery details arrive together.',
              ],
              [
                '02',
                'Your team prepares',
                'Focused picking and packing queues show what comes next.',
              ],
              [
                '03',
                'You assign delivery',
                'Choose your driver, follow progress and record cash collected.',
              ],
              [
                '04',
                'Your customer tracks',
                'A private link gives customers a simple order timeline.',
              ],
            ].map(([n, t, d]) => (
              <article key={n}>
                <span className="step-number">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="feature-section section" id="features">
          <div className="eyebrow">ONE WORKSPACE, FROM END TO END</div>
          <h2>
            Built around the way
            <br />
            your shop works.
          </h2>
          <div className="feature-grid">
            {[
              [
                'A storefront of your own',
                'Show your catalog, variants and prices. Customers check out without an account.',
              ],
              [
                'A team with a clear task',
                'Role-based access and ready-to-pick, ready-to-pack and exception queues.',
              ],
              [
                'Delivery on your terms',
                'Your zones, your fees, your drivers. No courier API needed.',
              ],
              [
                'Inventory that keeps up',
                'Stock is reserved when orders arrive. Know when products are running low.',
              ],
              [
                'Custom when you need it',
                'Collect text details at checkout and keep preparation instructions with the order.',
              ],
            ].map(([t, d]) => (
              <article className="feature-card" key={t}>
                <CheckCircle2 size={23} />
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
          <p className="business-types">
            Music · Clothing · Electronics · Cosmetics · Gifts · Groceries ·
            Furniture · Custom products
          </p>
        </section>
        <section className="section pricing-section" id="pricing">
          <div>
            <div className="eyebrow">SIMPLE BY DESIGN</div>
            <h2>
              One shop.
              <br />
              One straightforward plan.
            </h2>
            <p>
              Start with the tools your business needs.
              <br />
              Subscription activation is managed by InChouf.
            </p>
          </div>
          <article className="price-card">
            <div className="section-heading">
              <h3>Starter</h3>
              <span className="badge violet">Your daily essentials</span>
            </div>
            <div className="price">
              $20<span>/ month</span>
            </div>
            <ul>
              {[
                'One business and storefront',
                'One owner + up to two employees',
                'Orders, products and inventory',
                'Delivery management and tracking',
                'Optional custom-product workflow',
              ].map((x) => (
                <li key={x}>
                  <Check size={17} />
                  {x}
                </li>
              ))}
            </ul>
            <a className="button" href="#contact">
              Get Started <ArrowRight size={17} />
            </a>
          </article>
        </section>
        <section className="section" id="video">
          <div className="video-panel">
            <span className="eyebrow">MEET ORDERPILOT</span>
            <h2>
              From scattered details
              <br />
              to a shared process.
            </h2>
            <p>See the entire flow in the interactive internal demo.</p>
            <a className="button white" href="/store/internal-demo">
              Try the storefront <ArrowUpRight size={18} />
            </a>
          </div>
        </section>
        <section className="section faq">
          <h2>A few things to know.</h2>
          {[
            [
              'Do I need WhatsApp or another platform?',
              'No. The core system uses its own storefront, order workspace and tracking pages.',
            ],
            [
              'Can I use cash on delivery?',
              'Yes. Record cash on delivery and manual payment status without a payment gateway.',
            ],
            [
              'Is this only for custom products?',
              'No. Standard products are the core workflow. Custom text fields are optional.',
            ],
            [
              'Can my employees use it?',
              'Yes. The Starter plan supports an owner and up to two employees, with permissions for their work.',
            ],
            [
              'How does delivery work?',
              'You configure delivery zones and fees, then assign your own employees to deliveries.',
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <section className="section contact-section" id="contact">
          <div className="eyebrow">LET’S GET YOUR BUSINESS IN ORDER</div>
          <h2>
            Less back and forth.
            <br />
            More out the door.
          </h2>
          {configured(contact.CONTACT_EMAIL) ? (
            <a className="button" href={`mailto:${contact.CONTACT_EMAIL}`}>
              Contact{' '}
              {configured(contact.CONTACT_NAME)
                ? contact.CONTACT_NAME
                : 'Hassan'}{' '}
              <ArrowUpRight size={17} />
            </a>
          ) : (
            <>
              <p>
                Demo requests will open when Hassan’s contact details are
                configured.
              </p>
              <a className="button" href="/store/internal-demo">
                Explore the demo <ArrowUpRight size={17} />
              </a>
              <span className="button secondary disabled">
                Contact Hassan · coming soon
              </span>
            </>
          )}
          {Object.entries(contact)
            .filter(([k, v]) => configured(v) && k !== 'CONTACT_NAME')
            .map(([k, v]) => (
              <p key={k}>{v}</p>
            ))}
        </section>
      </main>
      <footer>
        <a className="brand" href="/">
          <span className="brand-mark">i</span>InChouf
        </a>
        <span>OrderPilot. From order to doorstep.</span>
        <a href="/login">Business sign in ↗</a>
      </footer>
    </div>
  );
}
