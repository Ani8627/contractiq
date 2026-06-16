import type { Metadata } from 'next';
// @ts-ignore: allow importing global CSS without type declarations
import './globals.css';
import AuthButton from '@/components/AuthButton';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contract Negotiator — AI-powered contract analysis',
  description:
    'Upload any contract and get clause-by-clause risk analysis, plain-English summaries, market benchmarks, and rewrite suggestions — powered by AI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link href="/" className="font-bold text-gray-900 text-lg tracking-tight">
              ContractIQ
            </Link>
            <nav className="flex items-center gap-4">
            <Link
  href="/history"
  className="text-sm text-red-600"
>
  History TEST
</Link>
              <AuthButton />
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
