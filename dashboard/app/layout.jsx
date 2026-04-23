import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata = {
  title: 'Flowlog – Focus Tracker with Real-Time Intervention',
  description:
    'Flowlog detects distractions in real time, triggers behavioral intervention popups, and gamifies your focus sessions. Most tools track your time. Flowlog corrects your behavior.',

  keywords: [
    'focus tracker',
    'distraction detection tool',
    'real time focus tracker',
    'anti procrastination tool',
    'cognitive focus tracker',
    'productivity intervention system',
    'focus quality tracker',
    'focus score tracker',
    'real-time behavioral intervention',
  ],

  metadataBase: new URL('https://flowlog-bay.vercel.app'), // 🔁 replace with custom domain later

  verification: {
    google: 'TpbORm9Npryew60XPoM2PSqV4k6xqJeNkzXoaH_I2Bo', // ✅ kept from your original
  },

  openGraph: {
    title: 'Flowlog – Focus Tracker with Real-Time Intervention',
    description:
      'Detects distractions. Triggers popups. Gamifies focus. Most tools track your time. Flowlog corrects your behavior.',
    url: 'https://flowlog-bay.vercel.app',
    siteName: 'Flowlog',
    type: 'website',
    // add this later: images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Flowlog – Focus Tracker with Real-Time Intervention',
    description:
      'Most tools track your time. Flowlog corrects your behavior.',
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}