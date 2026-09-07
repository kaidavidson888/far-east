import Link from 'next/link';
import { SurfaceToggle } from './SurfaceToggle';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container stack-xl">
        <div className="footer-cols">
          <div>
            <h3>Catalogue</h3>
            <ul>
              <li><Link href="/catalog">All cigarettes</Link></li>
              <li><Link href="/catalog?sort=rating">Highest reader rated</Link></li>
              <li><Link href="/catalog?flavour=Clove">Kretek</Link></li>
              <li><Link href="/catalog?filterType=Unfiltered">Unfiltered</Link></li>
            </ul>
          </div>
          <div>
            <h3>Reading</h3>
            <ul>
              <li><Link href="/catalog?sort=reviews">Most reviewed</Link></li>
              <li><Link href="/catalog?sort=rating">Highest rated</Link></li>
              <li><Link href="/catalog?sort=tar_asc">Sorted by tar</Link></li>
            </ul>
          </div>
          <div>
            <h3>Account</h3>
            <ul>
              <li><Link href="/register">Create an account</Link></li>
              <li><Link href="/login">Sign in</Link></li>
              <li><Link href="/favorites">My shelf</Link></li>
            </ul>
          </div>
          <div>
            <h3>Legal</h3>
            <ul>
              <li><Link href="/register">Rate a cigarette</Link></li>
              <li><Link href="/catalog?sort=name">Browse A–Z</Link></li>
            </ul>
          </div>
          <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG lockup, no optimisation to do */}
            <img src="/logos/far-east-logo-stacked.svg" alt="Far East" style={{ width: 120, height: 'auto' }} />
          </div>
        </div>

        <hr className="hairline" style={{ background: '#333' }} />

        <div className="stack-sm">
          <p className="body-sm" style={{ color: '#c4c0ba', border: '2px solid #c4c0ba', padding: 'var(--md)' }}>
            <strong>Smoking kills.</strong> Cigarette smoke contains over 70 known carcinogens. There is no
            safe level of tobacco use, and no product reviewed here is safer than any other. Tar and
            nicotine figures on this site are manufacturer or market-label declarations measured by
            machine; they do not describe what any individual smoker inhales.
          </p>
          <p className="body-sm">
            Far East takes no money from tobacco manufacturers, carries no affiliate links, and sells
            nothing. We publish assessments of products that already exist. Nothing here is a
            recommendation to start or continue smoking. If you want to stop, your national quitline
            can help.
          </p>
          <div className="row-between wrap" style={{ gap: 'var(--md)' }}>
            <p className="caption">© {new Date().getFullYear()} Far East · 遠東</p>
            <div className="row" style={{ gap: 'var(--sm)' }}>
              <span className="caption">Appearance</span>
              <SurfaceToggle />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
