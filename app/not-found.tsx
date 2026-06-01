import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-5xl font-bold text-white">404</h1>
      <p className="mt-3 text-zinc-400 text-sm">This page or account does not exist.</p>
      <Link
        href="/"
        className="mt-6 text-sm text-zinc-500 hover:text-white transition-colors"
      >
        Go to home
      </Link>
    </div>
  );
}
