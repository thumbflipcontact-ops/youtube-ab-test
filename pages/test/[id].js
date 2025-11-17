// pages/test/[id].js
'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import axios from 'axios';

export default function TestAnalyticsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [thumbs, setThumbs] = useState([]);
  const [testMeta, setTestMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      const [thumbRes, metaRes] = await Promise.all([
        axios.get(`/api/thumbnails?testId=${id}`),
        axios.get(`/api/my-tests`)
      ]);

      setThumbs(thumbRes.data.data || []);

      const list = metaRes.data.data || [];
      setTestMeta(list.find((t) => t.id == id) || null);

      setLoading(false);
    }

    load();
  }, [id]);

  if (loading) return <p className="p-6">Loading analytics...</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">
        📊 Analytics — Test #{id}
      </h2>

      {testMeta && (
        <div className="mb-6 p-4 bg-gray-100 rounded border">
          <p><strong>Video ID:</strong> {testMeta.video_id}</p>
          <p><strong>Start:</strong> {new Date(testMeta.start_datetime).toLocaleString()}</p>
          <p><strong>End:</strong> {new Date(testMeta.end_datetime).toLocaleString()}</p>
        </div>
      )}

      {!thumbs.length ? (
        <p>No analytics available yet.</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border border-gray-300 text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="border p-2">Thumbnail</th>
                <th className="border p-2">Views</th>
                <th className="border p-2">Avg Duration</th>
                <th className="border p-2">Likes</th>
                <th className="border p-2">Comments</th>
                <th className="border p-2">Impressions</th>
                <th className="border p-2">CTR</th>
                <th className="border p-2">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {thumbs.map((r) => (
                <tr key={r.thumbnail_url}>
                  <td className="border p-2">
                    <img src={r.thumbnail_url} width={120} className="rounded" />
                  </td>

                  <td className="border p-2 text-center">{r.views}</td>
                  <td className="border p-2 text-center">
                    {r.average_view_duration.toFixed(1)} sec
                  </td>
                  <td className="border p-2 text-center">{r.likes}</td>
                  <td className="border p-2 text-center">{r.comments}</td>
                  <td className="border p-2 text-center">{r.impressions}</td>
                  <td className="border p-2 text-center">
                    {(r.click_through_rate * 100).toFixed(2)}%
                  </td>
                  <td className="border p-2 text-center">
                    {new Date(r.latest_collected_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={() => router.push("/my-tests")}
        className="mt-6 bg-gray-600 text-white px-4 py-2 rounded"
      >
        ← Back
      </button>
    </div>
  );
}
