import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="text-5xl font-extrabold text-accent">404</p>
        <h1 className="mt-3 text-lg font-semibold text-ink">Page not found</h1>
        <p className="mt-1 text-sm text-muted">The page you're looking for doesn't exist.</p>
        <Link to="/dashboard" className="btn-primary mt-5">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
