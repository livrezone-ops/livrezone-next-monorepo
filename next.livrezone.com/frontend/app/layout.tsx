import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://next.livrezone.com"),
  alternates: {
    canonical: "/",
  },
  title: {
    default: "LivreZone | Livres neufs et d'occasion au Maroc",
    template: "%s | LivreZone",
  },
  description:
    "Achetez et vendez vos livres neufs et d'occasion au Maroc. Des milliers d'annonces de librairies et particuliers partout dans le Royaume.",
  openGraph: {
    type: "website",
    locale: "fr_MA",
    siteName: "LivreZone",
    title: "LivreZone | Livres neufs et d'occasion au Maroc",
    description:
      "Achetez et vendez vos livres neufs et d'occasion au Maroc. Des milliers d'annonces de librairies et particuliers partout dans le Royaume.",
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
