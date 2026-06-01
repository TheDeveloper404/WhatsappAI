import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";
import { Analytics } from "@vercel/analytics/next";

// Fonturi self-hostate prin next/font (non-blocking) — înlocuiesc <link> sincron spre Google Fonts,
// care bloca randarea (~2s pe mobil în Lighthouse). `latin-ext` = diacritice românești (ș/ț/ă/â/î).
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: '#0d0d0d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: "waai. — răspunde ca tine. chiar când nu ești.",
  description: "AI-ul care preia automat conversațiile și păstrează experiența personală a brandului tău.",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'waai.',
  },
  openGraph: {
    title: "waai. — răspunde ca tine. chiar când nu ești.",
    description: "AI-ul care preia automat conversațiile și păstrează experiența personală a brandului tău.",
    url: "https://waai.ro",
    siteName: "waai.",
    locale: "ro_RO",
    type: "website",
    images: [{ url: "https://waai.ro/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "waai. — răspunde ca tine. chiar când nu ești.",
    description: "AI-ul care preia automat conversațiile și păstrează experiența personală a brandului tău.",
    images: ["https://waai.ro/opengraph-image"],
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
    <html lang="ro" className={`${spaceGrotesk.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased font-sans bg-base text-ink">
        {children}
        <CookieBanner />
        <Analytics />
      </body>
    </html>
  );
}
