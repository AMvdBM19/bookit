import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas text-fg flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-5xl font-bold text-fg">404</h1>
      <p className="mt-3 text-fg-muted text-sm">This page or account does not exist.</p>
      <Link
        href="/"
        className="mt-6 text-sm text-fg-muted hover:text-fg transition-colors"
      >
        Go to home
      </Link>
    </div>
  );
}
