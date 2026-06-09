import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { headers } from "next/headers";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Fonturi self-hostate (non-blocking) — înlocuiesc <link> sincron spre Google Fonts (~2s mobil în Lighthouse).
// Space Grotesk prin next/font/google (`latin-ext` = diacritice RO ș/ț/ă/â/î).
// Geist Mono prin pachetul oficial `geist`: în Next 14.2.x `next/font/google` NU expune subset-uri pentru
// Geist Mono (array gol) → orice `subsets` aruncă la build. `geist` îl livrează ca next/font/local, cu glyph-urile complete.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: '#0d0d0d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL("https://waai.ro"),
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // F3: nonce-ul generat în middleware, necesar pentru scriptul inline de temă sub noul CSP
  // (fără `'unsafe-inline'`). Citirea header-elor optează randarea dinamică — compromis acceptat.
  // Next 16: `headers()` e async → await.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="ro" className={`${spaceGrotesk.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased font-sans bg-base text-ink">
        {children}
        <CookieBanner />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
