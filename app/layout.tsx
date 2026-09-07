import type { Metadata } from 'next';
import { AgeGate } from '@/components/AgeGate';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-surface="dark" suppressHydrationWarning>
      <head>
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
