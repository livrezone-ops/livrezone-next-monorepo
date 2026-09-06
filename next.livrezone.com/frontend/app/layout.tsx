import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toJsonLd } from "@/lib/safe-json-ld";
import { SITE_URL } from "@/lib/site-url";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-noto-sans",
  display: "swap",
});

const notoKufiArabic = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-noto-kufi-arabic",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#6D28D9",
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  title: {
    default: "LivreZone | Achat & Vente de Livres Neufs et d'Occasion au Maroc",
    template: "%s | LivreZone",
  },
  description:
    "Achetez et vendez vos livres neufs et d'occasion au Maroc. Des milliers d'annonces de librairies et particuliers partout dans le Royaume.",
  openGraph: {
    type: "website",
    locale: "fr_MA",
    url: SITE_URL,
    siteName: "LivreZone",
    title: "LivreZone | Achat & Vente de Livres Neufs et d'Occasion au Maroc",
    description:
      "Achetez et vendez vos livres neufs et d'occasion au Maroc. Des milliers d'annonces de librairies et particuliers partout dans le Royaume.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LivreZone - Marketplace de livres neufs et d'occasion au Maroc",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LivreZone | Achat & Vente de Livres Neufs et d'Occasion au Maroc",
    description:
      "Achetez et vendez vos livres neufs et d'occasion au Maroc. Des milliers d'annonces de librairies et particuliers partout dans le Royaume.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "LivreZone",
      url: SITE_URL,
      logo: `${SITE_URL}/og-image.png`,
      description: "Première marketplace de livres neufs et d'occasion au Maroc.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "LivreZone",
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/annonces?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className="h-full antialiased light"
      style={{ colorScheme: "light" }}
    >
      <body className={`${notoSans.variable} ${notoKufiArabic.variable} min-h-full flex flex-col bg-gray-50 text-gray-900`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }}
        />
        <Providers>
          <Header />
          <main className="flex-grow flex flex-col">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
