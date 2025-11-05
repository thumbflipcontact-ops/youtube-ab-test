import "./globals.css";
import ClientLayout from "./ClientLayout";
import { Analytics } from "@vercel/analytics/react"; // ✅ Add this import

export const metadata = {
  title: "ThumbFlip",
  description: "Automatically change YouTube thumbnails",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-100">
        <ClientLayout>{children}</ClientLayout>
        <Analytics /> {/* ✅ Add this just before closing </body> */}
      </body>
    </html>
  );
}
