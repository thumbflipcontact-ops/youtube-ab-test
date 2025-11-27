import "./globals.css";
import ClientLayout from "./ClientLayout";
import { Analytics } from "@vercel/analytics/react";

/* -------------------------------------------------------------------------- */
/*                          🔥 GLOBAL SEO METADATA                           */
/* -------------------------------------------------------------------------- */
export const metadata = {
  metadataBase: new URL("https://thumbflip.co"),
  title: {
    default: "ThumbFlip — YouTube Thumbnail A/B Testing Tool",
    template: "%s | ThumbFlip",
  },
  description:
    "A/B test up to 10 YouTube thumbnails automatically. Track CTR, views, watch time and optimize your video performance with ThumbFlip.",
  keywords: [
    "YouTube thumbnail A/B test",
    "YouTube CTR",
    "thumbnail testing tool",
    "YouTube growth tools",
    "A/B testing",
    "CTR optimization",
  ],
  authors: [{ name: "ThumbFlip" }],
  creator: "ThumbFlip",
  publisher: "ThumbFlip",

  /* Canonical URL */
  alternates: {
    canonical: "https://thumbflip.co/",
  },

  /* OpenGraph (social sharing) */
  openGraph: {
    title: "ThumbFlip — YouTube Thumbnail A/B Testing Tool",
    description:
      "Test up to 10 thumbnails per video and optimize YouTube CTR automatically.",
    url: "https://thumbflip.co",
    siteName: "ThumbFlip",
    type: "website",
    images: [
      {
        url: "https://thumbflip.co/og-image.png",
        width: 1200,
        height: 630,
        alt: "ThumbFlip Thumbnail A/B Testing",
      },
    ],
  },

  /* Twitter Cards */
  twitter: {
    card: "summary_large_image",
    title: "ThumbFlip — YouTube Thumbnail A/B Testing Tool",
    description:
      "Optimize your YouTube thumbnails with automated A/B testing.",
    images: ["https://thumbflip.co/og-image.png"],
    creator: "@thumbflip", // optional
  },

  /* Icons */
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },

  /* Robots (SEO crawling rules) */
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      maxSnippet: -1,
      maxImagePreview: "large",
      maxVideoPreview: -1,
    },
  },
};

/* -------------------------------------------------------------------------- */
/*                                ROOT LAYOUT                                 */
/* -------------------------------------------------------------------------- */
export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className="bg-gray-100 text-gray-900 antialiased">
        {/* Global Client Layout Wrapper */}
        <ClientLayout>{children}</ClientLayout>

        {/* Vercel Analytics */}
        <Analytics />

        {/* JSON-LD Schema: Organization + Website */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "ThumbFlip",
              url: "https://thumbflip.co",
              logo: "https://thumbflip.co/logo.png",
              sameAs: [
                "https://twitter.com/thumbflip",
                "https://www.youtube.com",
              ],
            }),
          }}
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "ThumbFlip",
              url: "https://thumbflip.co",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://thumbflip.co/?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </body>
    </html>
  );
}
