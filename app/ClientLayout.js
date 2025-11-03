"use client";

import { SessionProvider } from "next-auth/react";
import Navbar from "../components/Navbar"; 
import Footer from "../components/Footer"; // ✅ import footer

export default function ClientLayout({ children }) {
  return (
    <SessionProvider>
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        {/* Top Navbar */}
        <Navbar />

        {/* Main page content */}
        <main className="flex-grow p-6">{children}</main>

        {/* Bottom Footer */}
        <Footer />
      </div>
    </SessionProvider>
  );
}
