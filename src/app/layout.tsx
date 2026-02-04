import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PDF座標エディタ',
  description: 'PDF上のフィールド座標をGUIでマッピングするツール',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-bp-bg text-bp-text" suppressHydrationWarning>{children}</body>
    </html>
  );
}
