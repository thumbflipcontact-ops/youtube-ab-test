'use client'
import { useState, useEffect } from 'react'
import ThumbnailUploader from '../../../../components/ThumbnailUploader'
import ABTestForm from '../../../../components/ABTestForm'
import { useRouter } from 'next/navigation'

export default function VideoDetailPage({ params }) {
  const { videoId } = params
  const [thumbnails, setThumbnails] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const router = useRouter()
  
  // Rotate thumbnails every 15 seconds
  useEffect(() => {
    if (thumbnails.length === 0) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % thumbnails.length)
    }, 15000)

    return () => clearInterval(interval)
  }, [thumbnails])

  const currentThumbnail = thumbnails[currentIndex]

  return (
    <div className="p-6 flex flex-col items-center">
      <h1 className="text-base font-semibold mb-3">
        Upload Thumbnails & Create Rotation Schedule
      </h1>

      {/* Video container */}
      <div className="relative w-[560px] h-[315px] border rounded-lg overflow-hidden shadow-lg">
        {/* YouTube video */}
        <iframe
          className="absolute top-0 left-0 w-full h-full z-0"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=0`}
          allowFullScreen
        ></iframe>

        {/* Thumbnail overlay */}
        {currentThumbnail && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-1000"
            style={{ pointerEvents: 'none' }} // allows clicking video
          >
            <img
              key={currentThumbnail} // triggers transition on change
              src={currentThumbnail}
              alt="A/B test thumbnail"
              className="w-full h-full object-cover opacity-70 animate-fadeInOut"
            />
          </div>
        )}
      </div>
      {/* Back to videos link */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-blue-600 hover:text-blue-800 underline text-sm font-medium transition"
        >
          ← Back to My Videos
        </button>
      </div> 
      <div className="mt-8 w-full max-w-xl">
        <ThumbnailUploader
          thumbnails={thumbnails}
          setThumbnails={setThumbnails}
          videoId={videoId}
        />
      </div>

      <div className="mt-8 w-full max-w-xl">
        <ABTestForm videoId={videoId} thumbnails={thumbnails} />
      </div>
    </div>
  )
}
