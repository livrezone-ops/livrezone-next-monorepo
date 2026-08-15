import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "LivreZone — Livres d'occasion au Maroc",
    template: "%s | LivreZone",
  },
  description:
    "LivreZone, la marketplace marocaine des livres d'occasion. Achetez et vendez des livres scolaires, romans, professionnels et religieux à petit prix.",
  openGraph: {
    type: "website",
    locale: "fr_MA",
    siteName: "LivreZone",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
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
