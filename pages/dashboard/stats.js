'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { useSession } from 'next-auth/react'

export default function StatsPage() {
  const { data: session, status } = useSession()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await axios.get('/api/analytics')
        setRows(res.data.data || [])
      } catch (err) {
        console.error('Failed to load analytics:', err)
        setError('Failed to load analytics. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated') fetchAnalytics()
  }, [status])

  if (status === 'loading') return <p className="p-6">Checking authentication…</p>
  if (status === 'unauthenticated') return <p className="p-6">You must log in to view analytics.</p>

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">📊 Your Thumbnail Performance</h2>

      {loading && <p>Loading analytics…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p>No analytics data found yet.</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Test ID</th>
                <th className="px-4 py-2 text-left">Video</th>
                <th className="px-4 py-2 text-left">Thumbnail</th>
                <th className="px-4 py-2 text-left">Views</th>
                <th className="px-4 py-2 text-left">Avg View Duration (s)</th>
                <th className="px-4 py-2 text-left">Collected At</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">{r.ab_test_id}</td>
                  <td className="px-4 py-2">{r.video_id}</td>
                  <td className="px-4 py-2">
                    <img
                      src={r.thumbnail_url}
                      alt="Thumbnail"
                      className="rounded-md"
                      width={100}
                    />
                  </td>
                  <td className="px-4 py-2">{r.views}</td>
                  <td className="px-4 py-2">{r.average_view_duration}</td>
                  <td className="px-4 py-2">
                    {new Date(r.collected_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
