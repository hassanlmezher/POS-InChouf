'use client';
import { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
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
          <div className="eyebrow">VARELYS PERFUMES</div>
          <h1>
            Manage every
            <br />
            scent, order,
            <br />
            <span>and delivery.</span>
          </h1>
          <p>
            A polished workspace for the perfume catalog
            <br />
            and cash-on-delivery orders.
          </p>
          <div className="login-flow">
            <span>Catalog</span>
            <ArrowRight />
            <span>Orders</span>
            <ArrowRight />
            <span>Delivery</span>
          </div>
        </div>
        <small>Varelys Perfumes admin workspace</small>
      </section>
      <section className="login-form">
        <div>
          <span className="badge violet">ADMIN WORKSPACE</span>
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
            <Submit busy={busy || !ready} busyLabel="Signing in…">
              Sign in <ArrowRight size={16} />
            </Submit>
          </form>
          <div className="login-help">
            <ShieldCheck size={18} />
            <span>
              Need access? Your business owner can help.
              <br />
              Owners can reset access from the admin workspace.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
