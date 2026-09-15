'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="section">
      <h1>We could not load this page.</h1>
      <p style={{ margin: '20px 0' }}>Please try again in a moment.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
      <a className="button secondary" href="/">
        Go to Varelys Perfumes
      </a>
    </main>
  );
}
