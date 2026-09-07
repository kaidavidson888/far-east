import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container band stack-lg">
      <span className="label muted">404</span>
      <h1 className="display-lg">That page is not in the catalogue.</h1>
      <p className="body-lg measure">
        The link may be old, or the product may have been withdrawn from the market it was
        reviewed in. The full catalogue is the best place to start again.
      </p>
      <Link href="/catalog" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
        Browse the catalogue
      </Link>
    </div>
  );
}
