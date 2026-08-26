import { ImageResponse } from "next/og";

export const alt = "LivreZone - Marketplace de livres neufs et d'occasion au Maroc";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a0a40 0%, #581c87 50%, #ea580c 100%)",
          color: "white",
          padding: "60px",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.15)",
            padding: "10px 24px",
            borderRadius: "9999px",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            fontSize: "24px",
            fontWeight: 800,
            letterSpacing: "2px",
            color: "#fde047",
            marginBottom: "28px",
          }}
        >
          📖 LIVREZONE.COM
        </div>

        <div
          style={{
            fontSize: "58px",
            fontWeight: 900,
            textAlign: "center",
            lineHeight: 1.15,
            maxWidth: "950px",
            marginBottom: "24px",
          }}
        >
          Marketplace de livres neufs et d’occasion au Maroc
        </div>

        <div
          style={{
            fontSize: "28px",
            color: "rgba(255, 255, 255, 0.9)",
            textAlign: "center",
            maxWidth: "850px",
          }}
        >
          Achetez, vendez et découvrez des milliers de livres partout dans le Royaume.
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
