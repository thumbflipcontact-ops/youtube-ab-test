'use client'

import { signIn, signOut, useSession } from 'next-auth/react'
import { motion } from 'framer-motion'

export default function Navbar() {
  const { data: session } = useSession()

  return (
    <motion.nav
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 shadow-lg text-white px-8 py-4 flex justify-between items-center sticky top-0 z-50"
    >
      {/* Brand */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="flex items-center gap-2 cursor-pointer"
      >
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-white to-pink-200 drop-shadow-md">
          ThumbFlip
        </h1>
      </motion.div>

      {/* Tagline */}
      <div className="hidden md:block text-center">
        <p className="text-lg font-semibold tracking-wide">
          Automate Thumbnail Change • Boost CTR • Grow Your Channel 🚀 <span className="text-yellow-300"></span>
        </p>
      </div>

      {/* Auth Buttons */}
      <div className="flex items-center gap-4">
        {session ? (
          <>
            <span className="text-sm font-medium opacity-90">
              Hi, {session.user?.name?.split(' ')[0]} 👋
            </span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => signOut({ callbackUrl: '/' })}
              className="bg-white text-pink-600 font-semibold px-5 py-2 rounded-full shadow-md hover:shadow-lg transition-all duration-300"
            >
              Logout
            </motion.button>
          </>
        ) : (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => signIn('google')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition-all duration-200 hover:scale-105"
          >
            Login with Google
          </motion.button>
        )}
      </div>
    </motion.nav>
  )
}
