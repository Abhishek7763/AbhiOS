import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#0f766e',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'AbhiOS',
  description:
    "Abhishek's Personal Operating System (AbhiOS): A calm, mobile-first system built around a Brain Dump first workflow, quality-gated goals, duty-aware daily execution, and guilt-free reviews.",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AbhiOS',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'AbhiOS',
    description:
      "Abhishek's Personal Operating System (AbhiOS): Brain Dump first, quality-gated goals, duty-aware daily execution, and guilt-free reviews.",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AbhiOS',
    description:
      "Abhishek's Personal Operating System (AbhiOS): Brain Dump first, quality-gated goals, duty-aware daily execution, and guilt-free reviews.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="min-h-screen bg-[#FAF8F5] dark:bg-[#0D1117] text-[#14171A] dark:text-[#F0F4F8] antialiased font-sans selection:bg-teal-600/20"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}

