import "./globals.css";
import ClientLayout from "./ClientLayout";

export const metadata = {
  title: "ThumbFlip",
  description: "Automatically change YouTube thumbnails",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-100">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
