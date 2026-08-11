import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://freeessayscorer.com'),
  title: 'Free Essay Scorer · by Admitly',
  description:
    'Free AI-powered analysis of your college admissions essay. Hook score, cliché detection, AI writing check. No signup required.',
  keywords: [
    'college essay', 'essay scorer', 'admissions essay',
    'Common App essay', 'AI essay feedback', 'cliché detector',
    'AI detector', 'personal statement', 'hook analyzer',
  ],
  openGraph: {
    title: 'Free Essay Scorer · by Admitly',
    description: 'Score your college essay in 30 seconds. Free, no signup.',
    type: 'website',
    url: 'https://freeessayscorer.com',
    siteName: 'Free Essay Scorer',
  },
  twitter: {
    card: 'summary',
    title: 'Free Essay Scorer · by Admitly',
    description: 'Score your college essay in 30 seconds. Free, no signup.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
