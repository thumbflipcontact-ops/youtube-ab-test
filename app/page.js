'use client'

import Head from 'next/head'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, Check, X } from 'lucide-react'

export default function HomePage() {
  const { data: session } = useSession()
  const router = useRouter()

  if (session) {
    router.push('/dashboard')
    return null
  }

  const comparisonRows = [
    ["Thumbnails per test", "Up to 10", "3 max"],
    [
      "Metrics tracked per thumbnail",
      "Views, AVD, Likes, Comments, CTR, Shares, Subs, AVP",
      "Watch time only",
    ],
    ["Test scheduling", "Hourly, Daily, Weekly", "Daily only"],
    ["Set custom test duration", "Yes", "Fixed duration"],
    ["Choose winning metric", "You decide", "Predefined"],
  ]

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* SEO HEAD TAGS (CLIENT-SAFE) */}
      {/* ------------------------------------------------------------- */}
      <Head>
        <title>ThumbFlip — YouTube Thumbnail A/B Testing Tool</title>

        <meta
          name="description"
          content="A/B test up to 10 thumbnails per video, track CTR, views, watch time, and schedule automatic tests. Boost your YouTube video performance with ThumbFlip."
        />

        <link rel="canonical" href="https://thumbflip.co/" />

        {/* OpenGraph */}
        <meta property="og:title" content="ThumbFlip — YouTube Thumbnail A/B Testing Tool" />
        <meta
          property="og:description"
          content="A/B test up to 10 thumbnails and optimize your YouTube CTR automatically."
        />
        <meta property="og:url" content="https://thumbflip.co/" />
        <meta property="og:image" content="https://thumbflip.co/og-image.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="ThumbFlip — YouTube Thumbnail A/B Testing Tool" />
        <meta
          name="twitter:description"
          content="Optimize YouTube click-through rate with automatic thumbnail A/B tests."
        />
        <meta name="twitter:image" content="https://thumbflip.co/og-image.png" />

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "ThumbFlip",
              url: "https://thumbflip.co",
              description:
                "A tool for A/B testing YouTube thumbnails with up to 10 variations, custom schedules, and CTR optimization.",
              applicationCategory: "Utility",
            }),
          }}
        />
      </Head>

      {/* ------------------------------------------------------------- */}
      {/* PAGE CONTENT */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white px-6 pb-32">

        {/* HERO TITLE (H1 IS CRITICAL FOR SEO) */}
        <motion.h1
          className="text-4xl md:text-6xl font-extrabold text-center mb-4 bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-yellow-300 drop-shadow-md"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          ThumbFlip — A/B Test YouTube Thumbnails & Boost Your CTR 🚀
        </motion.h1>

        {/* SUBTITLE */}
        <motion.p
          className="text-gray-300 text-center max-w-2xl mb-10 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          Upload up to 10 thumbnails per video and automatically test performance metrics like CTR, views, watch time,
          likes, and more. <span className="text-red-400 font-semibold">ThumbFlip</span> helps creators grow faster with
          data-driven thumbnail optimization.
        </motion.p>

        {/* CTA BUTTON */}
        <motion.button
          onClick={() => router.push('/api/auth/signin')}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 bg-gradient-to-r from-red-600 via-pink-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white px-8 py-4 rounded-full font-semibold text-lg shadow-[0_0_15px_rgba(255,0,0,0.4)] transition-all duration-300"
        >
          Get Started <ArrowRight className="w-5 h-5" />
        </motion.button>

        {/* TAG */}
        <motion.div
          className="mt-8 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 shadow-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <span className="text-gray-300 text-sm md:text-base">
            Try <span className="text-yellow-300 font-bold text-lg">for Free</span> — no credit card needed.
          </span>
        </motion.div>

        {/* FOOTER TEXT */}
        <motion.p
          className="mt-12 text-gray-500 text-sm tracking-wide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          ✨ Built for creators.
        </motion.p>

        {/* DEMO VIDEO */}
        <motion.div
          className="mt-8 w-full max-w-3xl rounded-xl overflow-hidden shadow-xl border border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <video
            src="/videos/demo.mp4"
            autoPlay
            muted
            controls
            playsInline
            aria-label="Demo of how to A/B test YouTube thumbnails using ThumbFlip"
            className="w-full h-auto rounded-xl"
          />
        </motion.div>

        {/* COMPARISON TABLE SECTION */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          className="mt-16 w-full max-w-5xl px-4"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-red-400">
            How ThumbFlip Outperforms YouTube’s Test & Compare
          </h2>

          <p className="text-center text-gray-400 max-w-3xl mx-auto mb-8 text-sm leading-relaxed">
            Compare ThumbFlip with YouTube’s built-in thumbnail testing tool: more variations, better scheduling, more
            metrics, and full creator control.
          </p>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
            <table className="w-full text-left text-gray-200 table-fixed">
              <colgroup>
                <col style={{ width: '40%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '30%' }} />
              </colgroup>

              <thead className="bg-white/10">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold">Feature</th>
                  <th className="px-6 py-4 text-sm font-semibold text-blue-400">ThumbFlip</th>
                  <th className="px-6 py-4 text-sm font-semibold text-blue-400">YouTube Test & Compare</th>
                </tr>
              </thead>

              <tbody>
                {comparisonRows.map(([feature, thumb, yt], idx) => (
                  <motion.tr
                    key={idx}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.6 + idx * 0.08 }}
                    className="border-t border-white/10 even:bg-white/5"
                  >
                    <td className="px-6 py-6 text-sm align-top">{feature}</td>

                    <td className="px-6 py-6 text-sm align-top">
                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-400 mt-0.5" />
                        <span className="text-green-300">{thumb}</span>
                      </div>
                    </td>

                    <td className="px-6 py-6 text-sm align-top">
                      <div className="flex items-start gap-2">
                        <X className="w-4 h-4 text-red-400 mt-0.5" />
                        <span className="text-red-300">{yt}</span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.4 }}
            className="text-center mt-6 text-yellow-300 text-lg font-semibold"
          >
            More thumbnails. More metrics. More control. More growth. 🚀
          </motion.p>
        </motion.div>
      </div>
    </>
  )
}
