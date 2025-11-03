'use client'
import { useEffect, useState } from 'react'
import { getSession } from 'next-auth/react'
import VideoList from '../../components/VideoList'
import axios from 'axios'

export default function DashboardPage() {
  const [videos, setVideos] = useState([])

  useEffect(() => {
  const fetchVideos = async () => {
    const session = await getSession()
    if (!session) return

    try {
      const res = await axios.get("/api/youtube/videos");
      setVideos(res.data);
    } catch (error) {
      console.error("Failed to fetch videos", error);
    }
  };
  fetchVideos();
}, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Your YouTube Videos</h2>
      <VideoList videos={videos} />
    </div>
  )
}
