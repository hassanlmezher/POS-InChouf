'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="section"><h1>We couldn’t load this page.</h1><p style={{margin:'20px 0'}}>Please try again. Your saved orders remain in your workspace.</p><button className="button" onClick={reset}>Try again</button><a className="button secondary" href="/">Go to InChouf</a></main>}
