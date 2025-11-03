'use client'
import Link from 'next/link'

export default function VideoList({ videos }) {
  if (!videos.length) return <p>No videos found</p>

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {videos.map((video) => (
        <Link key={video.id} href={`/dashboard/video/${video.id}`}>
          <div className="bg-white shadow rounded p-2 cursor-pointer">
            <img src={video.thumbnail} className="w-full h-60 object-cover rounded" />
            <p className="mt-2 text-black font-medium">{video.title}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
