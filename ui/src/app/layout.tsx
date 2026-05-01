import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VanityEngine | Fast EVM Vanity Address Generator',
  description: 'Browser-based, high-performance vanity address generator for EVM chains. 100% client-side, zero private key leakage.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-slate-900 text-slate-50 antialiased selection:bg-brand-500/30">
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-900/20 via-slate-900 to-slate-900"></div>
        {children}
      </body>
    </html>
  )
}
