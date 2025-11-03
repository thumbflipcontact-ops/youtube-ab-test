// pages/test/[id].js
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import axios from 'axios'

export default function TestResultsPage() {
  const router = useRouter()
  const { id } = router.query
  const { data: session, status } = useSession()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [testMeta, setTestMeta] = useState(null)

  useEffect(() => {
    if (!id || status !== 'authenticated') return

    async function fetchResults() {
      try {
        const [analyticsRes, testRes] = await Promise.all([
          axios.get(`/api/analytics?testId=${id}`),
          axios.get(`/api/my-tests`),
        ])

        const allTests = testRes.data.data || []
        const test = allTests.find((t) => t.id === Number(id))
        setTestMeta(test || null)

        setRows(analyticsRes.data.data || [])
      } catch (err) {
        console.error('❌ Failed to load analytics:', err)
        alert('Could not load test analytics.')
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [id, status])

  if (status === 'loading') return <p>Checking authentication…</p>
  if (status === 'unauthenticated') return <p>You must log in to view analytics.</p>

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">
        📊 A/B Test Results — Test #{id}
      </h2>

      {testMeta && (
        <div className="mb-6 border p-4 rounded bg-gray-50">
          <p><strong>Video ID:</strong> {testMeta.video_id}</p>
          <p><strong>Title:</strong> {testMeta.title || 'Untitled'}</p>
          <p><strong>Start:</strong> {new Date(testMeta.start_datetime).toLocaleString()}</p>
          <p><strong>End:</strong> {new Date(testMeta.end_datetime).toLocaleString()}</p>
        </div>
      )}

      {loading ? (
        <p>Loading analytics…</p>
      ) : rows.length === 0 ? (
        <p>No analytics data available yet.</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-sm border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Thumbnail</th>
                <th className="border p-2">Views</th>
                <th className="border p-2">Avg View Duration</th>
                <th className="border p-2">Likes</th>
                <th className="border p-2">Comments</th>
                <th className="border p-2">Collected At</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="border p-2">
                    <img
                      src={r.thumbnail_url}
                      alt="Thumbnail"
                      style={{ width: 120, borderRadius: 8 }}
                    />
                  </td>
                  <td className="border p-2 text-center">{r.views ?? '—'}</td>
                  <td className="border p-2 text-center">{r.average_view_duration ?? '—'}</td>
                  <td className="border p-2 text-center">{r.likes ?? '—'}</td>
                  <td className="border p-2 text-center">{r.comments ?? '—'}</td>
                  <td className="border p-2 text-center">
                    {new Date(r.collected_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={() => router.push('/my-tests')}
        className="mt-6 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
      >
        ← Back to My Tests
      </button>
    </div>
  )
}
