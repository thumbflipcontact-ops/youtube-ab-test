'use client'

import Link from 'next/link'
import { Mail } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 text-sm py-6 mt-12 border-t border-gray-700">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 px-6">

        {/* Left Section Links */}
        <div className="flex gap-6 items-center">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white transition">Terms & Conditions</Link>

          <a
            href="mailto:thumbflip.contact@gmail.com"
            className="hover:text-white transition flex items-center gap-1"
          >
            <Mail size={16} /> Email
          </a>
        </div>

        {/* Social Icons */}
        <div className="flex gap-3 items-center">

          {/* ✅ YouTube Icon */}
          <a
            href="https://www.youtube.com/@thumbflip"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 576 512"
              fill="currentColor"
              className="text-gray-200"
            >
              <path d="M549.65 124.08c-6.28-23.65-24.87-42.24-48.52-48.52C458.81 64 288 64 288 
              64S117.19 64 74.87 75.56c-23.65 6.28-42.24 24.87-48.52 48.52C15.59 166.39 15.59 
              256.1 15.59 256.1s0 89.72 10.76 132.02c6.28 23.65 24.87 42.24 48.52 48.52C117.19 
              448 288 448 288 448s170.81 0 213.13-11.56c23.65-6.28 42.24-24.87 48.52-48.52 
              10.76-42.3 10.76-132.02 10.76-132.02s0-89.72-10.76-132.02zM232.15 338.4V173.8l142.2 
              82.3-142.2 82.3z" />
            </svg>
          </a>

          {/* ✅ LinkedIn Icon */}
          <a
            href="https://www.linkedin.com/in/amol-parikh-4442b0b/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 448 512"
              fill="currentColor"
              className="text-gray-200"
            >
              <path d="M100.28 448H7.4V148.9h92.88zm-46.44-338a53.69 53.69 0 1 
              1 53.69-53.68 53.7 53.7 0 0 1-53.69 53.68zM447.9 448h-92.68V302.4c0-34.7-12.42-58.4-43.54-58.4-23.74 
              0-37.88 16-44.1 31.4-2.28 5.6-2.85 13.4-2.85 21.3V448h-92.78s1.24-241.2 
              0-266.1h92.78v37.7c-.19.3-.43.6-.61.9h.61v-.9c12.32-19 
              34.32-46.1 83.48-46.1 60.92 0 106.72 39.8 106.72 125.2z"/>
            </svg>
          </a>

          {/* ✅ Twitter / X Icon */}
          <a
            href="https://x.com/AmolParikh40001"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 512 512"
              fill="currentColor"
              className="text-gray-200"
            >
              <path d="M389.2 48H475L303.1 
              224.2 512 464H354.9L232.5 316.8 93.1 464H7L191.7 
              275.5 0 48H162.1L273.9 178.6 389.2 48zM361.6 
              421.8h42.5L157.2 90.1H112L361.6 421.8z" />
            </svg>
          </a>

        </div>

        {/* Copyright */}
        <p className="text-gray-500 text-xs text-center md:text-right">
          © 2025 ThumbFlip. All rights reserved — Prices are in USD.
        </p>
      </div>
    </footer>
  );
}
