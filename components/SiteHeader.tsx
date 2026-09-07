import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { favoriteCount } from '@/lib/db';
import { MobileNav } from './MobileNav';
import { SealDivider } from './SealDivider';

const CATALOGUE = { href: '/catalog', label: 'Full Catalogue' };
const SHELF = { href: '/favorites', label: 'My Shelf' };

export async function SiteHeader() {
  const user = await currentUser();
  const shelfCount = user ? await favoriteCount(user.id) : 0;

  return (
    <header className="top-nav">
      <div className="container top-nav-inner">
        <Link href="/" className="nav-logo" aria-label="Far East — home">
          {/* the logo swaps file, not colour; the nav is canvas-dark in both modes */}
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG lockup, no optimisation to do */}
          <img src="/logos/far-east-logo-horizontal.svg" alt="Far East" />
        </Link>

        <nav className="nav-menu" aria-label="Primary">
          <Link href={CATALOGUE.href} className="nav-link">{CATALOGUE.label}</Link>
        </nav>

        {/* The shelf and the account sit together on the right; the shelf stays
            visible at every width rather than collapsing into the menu. */}
        <div className="nav-right">
          {user ? (
            <>
              <Link href={SHELF.href} className="nav-link shelf-link">
                {SHELF.label}
                {shelfCount > 0 ? (
                  <span className="count-badge" aria-label={`${shelfCount} saved`}>{shelfCount}</span>
                ) : null}
              </Link>
              {/* Mobile reaches the account through the burger menu instead. */}
              <Link
                href="/account"
                className="btn-icon desktop-only"
                aria-label={`Account — ${user.display_name}`}
                title={user.display_name}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
                  strokeWidth="1.5" aria-hidden="true">
                  <circle cx="9" cy="6" r="3.2" />
                  <path d="M2.8 15.6a6.2 6.2 0 0 1 12.4 0" strokeLinecap="round" />
                </svg>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link desktop-only">Sign in</Link>
              <Link href="/register" className="btn btn-primary desktop-only" style={{ height: 40, padding: '0 20px' }}>
                Create account
              </Link>
            </>
          )}

          <MobileNav
            menu={[CATALOGUE]}
            account={user
              ? [{ href: '/account', label: 'Account' }]
              : [{ href: '/login', label: 'Sign in' }, { href: '/register', label: 'Create an account' }]}
          />
        </div>
      </div>
      <SealDivider />
    </header>
  );
}
