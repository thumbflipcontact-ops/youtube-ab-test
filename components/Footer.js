'use client'

import Link from 'next/link'
import { Mail } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 text-sm py-6 mt-12 border-t border-gray-700">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 px-6">
        <div className="flex gap-6">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white transition">Terms & Conditions</Link>
          <a href="mailto:thumbflip.contact@gmail.com" className="hover:text-white transition">Send us an email</a>
        </div>
        <p className="text-gray-500 text-xs text-center md:text-right">
          © 2025 ThumbFlip. All rights reserved — Prices are in USD.
        </p>
      </div>
    </footer>
  );
}
