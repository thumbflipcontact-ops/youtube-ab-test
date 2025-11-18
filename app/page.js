'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function HomePage() {
  const { data: session } = useSession()
  const router = useRouter()

  if (session) {
    router.push('/dashboard')
    return null
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white px-6 pb-32">
      {/* Headline */}
      <motion.h1
        className="text-4xl md:text-6xl font-extrabold text-center mb-4 bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-yellow-300 drop-shadow-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        A/B test up to 10 Thumbnails and Increase Your CTR 🚀
      </motion.h1>

      {/* Subheadline */}
      <motion.p
        className="text-gray-300 text-center max-w-2xl mb-10 leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        Sign in with Google for free. Select a video from your YouTube channel,
        upload up to 10 thumbnails per video, and run hourly/daily/weekly tests
        with <span className="text-red-400 font-semibold">ThumbFlip</span> —
        the smarter way to grow views automatically.
      </motion.p>

      {/* CTA */}
      <motion.button
        onClick={() => router.push('/api/auth/signin')}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 bg-gradient-to-r from-red-600 via-pink-600 to-orange-500 
          hover:from-red-500 hover:to-orange-400 text-white px-8 py-4 rounded-full 
          font-semibold text-lg shadow-[0_0_15px_rgba(255,0,0,0.4)] transition-all duration-300"
      >
        Get Started <ArrowRight className="w-5 h-5" />
      </motion.button>

      {/* Pricing */}
      <motion.div
        className="mt-8 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 shadow-md"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <span className="text-gray-300 text-sm md:text-base">
          Try <span className="text-yellow-300 font-bold text-lg">for Free</span> — grow like a pro creator.
        </span>
      </motion.div>

      {/* Footer */}
      <motion.p
        className="mt-12 text-gray-500 text-sm tracking-wide"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        ✨ Built for creators.
      </motion.p>

      {/* Video */}
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
          className="w-full h-auto rounded-xl"
        ></video>
      </motion.div>

      {/* ⭐ COMPARISON SECTION */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="mt-24 w-full max-w-5xl"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-10 bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-red-400">
          Why Creators Choose ThumbFlip Over YouTube Test & Compare
        </h2>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
          <table className="w-full text-left text-gray-200">
            <thead className="bg-white/10">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold">Feature</th>
                <th className="px-6 py-4 text-sm font-semibold text-red-300">ThumbFlip</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-400">YouTube Test & Compare</th>
              </tr>
            </thead>
            <tbody className="backdrop-blur-xl">
              {[
                ["Thumbnails per test", "Up to 10", "3 max"],
                ["Metrics tracked per thumbnail", "Views, AVD, Likes, Comments, CTR, Shares, Subs, AVP", "Watch time only"],
                ["Test scheduling", "Hourly, Daily, Weekly", "Daily only"],
                ["Set custom test duration", "Yes", "Fixed duration"],
                ["Choose winning metric", "You decide", "Predefined"],
              ].map(([feature, thumb, yt], idx) => (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.6 + idx * 0.15 }}
                  className="border-t border-white/10 hover:bg-white/10 transition-all"
                >
                  <td className="px-6 py-4 text-sm">{feature}</td>
                  <td className="px-6 py-4 text-sm flex items-center gap-2 text-green-300">
                    <Check className="w-4 h-4 text-green-400" /> {thumb}
                  </td>
                  <td className="px-6 py-4 text-sm flex items-center gap-2 text-red-300">
                    <X className="w-4 h-4 text-red-400" /> {yt}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Highlight Tagline */}
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
  )
}
