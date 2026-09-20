import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AgeGate } from '@/components/AgeGate';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { LOGIN_BLOCK_COOKIE } from '@/lib/loginState';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Far East — cigarettes, rated by readers', template: '%s · Far East' },
  description:
    'A catalogue of cigarettes from ten markets, rated and reviewed by the people who smoke them. Browse and read everything without an account.',
  icons: {
    icon: [
      { url: '/logos/far-east-favicon-32.svg', type: 'image/svg+xml', sizes: '32x32' },
      { url: '/logos/far-east-favicon-16.svg', type: 'image/svg+xml', sizes: '16x16' },
    ],
    apple: '/logos/far-east-icon-512.svg',
  },
};

/** Applied before paint so the surface never flashes. Browse pages default to dark. */
const BOOT = `(function(){try{var s=localStorage.getItem('fe-surface');if(s==='light'||s==='dark')document.documentElement.dataset.surface=s;}catch(e){}})();`;

/**
 * A BLOCKED READER GETS THE RED PAGE WHEREVER THEY GO.
 *
 * Three failures of one section of the login box shut the site for half an
 * hour (the owner's 2026-09-20 rule), and "fully block them from accessing the
 * site" means every page, not just the splash — so it is decided here, above
 * everything.
 *
 * IT READS A COOKIE AND NOTHING ELSE. The authoritative block is in Postgres,
 * keyed on the phone number as well as on the browser, and that is what stops
 * the login (lib/loginState.ts) — but consulting it here would be a database
 * round trip on every view of every page for the sake of a state almost nobody
 * is in. The cookie carries the moment the block lifts, is httpOnly, and
 * expires by itself.
 *
 * IT IS NOT MIDDLEWARE, because this project has none: the middleware was
 * removed to get past MIDDLEWARE_INVOCATION_FAILED on Vercel and has not come
 * back (see CLAUDE.md, Known gaps). Reading a cookie in the root layout makes
 * every page dynamic, which is the cost of that — the artwork pages are the
 * only ones this actually changes, everything else already reads the session.
 */
async function blockedFor(): Promise<boolean> {
  const jar = await cookies();
  const until = Number(jar.get(LOGIN_BLOCK_COOKIE)?.value);
  return Number.isFinite(until) && until > Date.now();
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  if (await blockedFor()) {
    return (
      <html lang="en" data-surface="dark" suppressHydrationWarning>
        <head>
          <link
            rel="preload"
            href="/fonts/far-east-3.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        </head>
        <body>
          <div className="blocked-page">
            <p className="blocked-page-say">TRY AGAIN IN 30 MINUTES</p>
          </div>
        </body>
      </html>
    );
  }
  return (
    <html lang="en" data-surface="dark" suppressHydrationWarning>
      <head>
        {/* The owner's own face: 6.4KB, self-hosted, and wanted by the very
            first field anyone types into — so it is fetched alongside the
            document rather than waiting for the stylesheet to ask for it.
            crossOrigin is not optional on a font preload even same-origin:
            fonts are fetched in CORS mode, and without it the browser
            downloads the file a second time. */}
        <link
          rel="preload"
          href="/fonts/far-east-3.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: this is the document head */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Unicase:wght@400;500;700&family=Exo+2:wght@400;500;600;700;800&family=Noto+Serif:wght@400;600;700&family=Noto+Serif+TC:wght@400;700&family=JetBrains+Mono:wght@500&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <a href="#main" className="sr-only">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <AgeGate />
      </body>
    </html>
  );
}
