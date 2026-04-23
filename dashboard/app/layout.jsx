import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata = {
  title: 'Focus Tracker — Digital Productivity Dashboard',
  description: 'Monitor your digital focus habits. Track productive vs distracting web usage, get a focus score, and receive data-driven insights.',
  verification: {
    google: 'TpbORm9Npryew60XPoM2PSqV4k6xqJeNkzXoaH_I2Bo'
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
