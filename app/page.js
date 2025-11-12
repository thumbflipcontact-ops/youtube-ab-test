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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white px-6">
      {/* Headline */}
      <motion.h1
        className="text-4xl md:text-6xl font-extrabold text-center mb-4 bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-yellow-300 drop-shadow-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        Change YouTube Thumbnails Automatically and Skyrocket Your CTR 🚀
      </motion.h1>

      {/* Subheadline */}
      <motion.p
        className="text-gray-300 text-center max-w-2xl mb-10 leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        Sign in with Google for free. Select a video from your YouTube channel. Upload up to 10 thumbnails per video and schedule hourly, daily or weekly rotations using <span className="text-red-400 font-semibold">ThumbFlip</span> — so you can focus on creating. Get more views, subs, and ad revenue, automatically!
      </motion.p>

      {/* Call to Action */}
      <motion.button
        onClick={() => router.push('/api/auth/signin')}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 bg-gradient-to-r from-red-600 via-pink-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white px-8 py-4 rounded-full font-semibold text-lg shadow-[0_0_15px_rgba(255,0,0,0.4)] transition-all duration-300"
      >
        Get Started <ArrowRight className="w-5 h-5" />
      </motion.button>

      {/* Pricing Tag */}
      <motion.div
        className="mt-8 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 shadow-md"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <span className="text-gray-300 text-sm md:text-base">
          Just <span className="text-yellow-300 font-bold text-lg">$17/month</span> — grow like a pro creator.
        </span>
      </motion.div>

      {/* Footer Text */}
      <motion.p
        className="mt-12 text-gray-500 text-sm tracking-wide"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        ✨ Built for creators.
      </motion.p>

      {/* ✅ Autoplay video (no loop) with rounded corners */}
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
    </div>
  )
}
