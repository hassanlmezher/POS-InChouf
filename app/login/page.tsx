'use client';
import { useState, useEffect } from 'react';
import { ArrowLeft, ShieldCheck, ArrowRight } from 'lucide-react';
import { Brand, Field, ErrorBox, Submit } from '@/components/shared';
import { api, message } from '@/lib/client';
export default function Login() {
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div>
          <div className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</div>
          <h1>
            Good morning.
            <br />
            Let’s get things
            <br />
            <span>moving.</span>
          </h1>
          <p>
            A clear workspace for the people
            <br />
            behind every delivery.
          </p>
          <div className="login-flow">
            <span>Order</span>
            <ArrowRight />
            <span>Prepare</span>
            <ArrowRight />
            <span>Deliver</span>
          </div>
        </div>
        <small>InChouf OrderPilot · Your business, in order.</small>
      </section>
      <section className="login-form">
        <a href="/" className="back-link">
          <ArrowLeft size={16} /> Back to InChouf
        </a>
        <div>
          <span className="badge violet">YOUR WORKSPACE</span>
          <h2>Welcome back.</h2>
          <p>Sign in with your business account.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                const r = await api<{ role: string }>('login', 'POST', {
                  email,
                  password,
                });
                location.href = r.role === 'super_admin' ? '/admin' : '/pos';
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Email address">
              <input disabled={!ready}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@yourbusiness.com"
              />
            </Field>
            <Field label="Password">
              <input disabled={!ready}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <ErrorBox error={error} />
            <Submit busy={busy || !ready}>
              Sign in <ArrowRight size={16} />
            </Submit>
          </form>
          <div className="login-help">
            <ShieldCheck size={18} />
            <span>
              Need access? Your business owner can help.
              <br />
              Owners can contact InChouf for an access reset.
            </span>
          </div>
          <a className="text-link" href="/store/internal-demo">
            Explore the internal demo storefront ↗
          </a>
        </div>
      </section>
    </main>
  );
}
