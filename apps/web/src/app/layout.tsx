import type { Metadata } from "next";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "waai. — răspunde singur. cu tonul tău.",
  description: "AI-ul care preia automat conversațiile și păstrează experiența personală a brandului tău.",
  openGraph: {
    title: "waai. — răspunde singur. cu tonul tău.",
    description: "AI-ul care preia automat conversațiile și păstrează experiența personală a brandului tău.",
    url: "https://waai.ro",
    siteName: "waai.",
    locale: "ro_RO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "waai. — răspunde singur. cu tonul tău.",
    description: "AI-ul care preia automat conversațiile și păstrează experiența personală a brandului tău.",
  },
};

const themeScript = `
(function(){
  try {
    var m = localStorage.getItem('wa-ai-theme');
    if (m === 'dark' || (!m && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e){}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased font-sans bg-base text-ink">
        {children}
        <CookieBanner />
        <Analytics />
      </body>
    </html>
  );
}
