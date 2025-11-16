'use client';

import { useEffect, useState } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";

export default function MyTestsPage() {
  const { status } = useSession();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load tests
  useEffect(() => {
    async function fetchTests() {
      try {
        const res = await axios.get("/api/my-tests");
        setTests(res.data.data || []);
      } catch (err) {
        console.error("❌ Failed to fetch tests:", err);
        alert("Failed to load your tests.");
      } finally {
        setLoading(false);
      }
    }

    if (status === "authenticated") fetchTests();
  }, [status]);

  if (status === "loading") return <p className="p-6">Checking authentication…</p>;
  if (status === "unauthenticated") return <p className="p-6">You must log in to view your tests.</p>;

  // Determine test status
  function getStatus(test) {
    const now = new Date();
    const start = new Date(test.start_datetime);
    const end = new Date(test.end_datetime);

    if (now < start) {
      return (
        <span className="text-yellow-400 font-medium flex items-center gap-1">
          ⏳ Scheduled
        </span>
      );
    }

    if (now >= start && now <= end) {
      return (
        <span className="text-green-400 font-medium flex items-center gap-1">
          🟢 Running
        </span>
      );
    }

    return (
      <span className="text-blue-400 font-medium flex items-center gap-1">
        ✔️ Completed
      </span>
    );
  }

  return (
    <div className="p-6 text-white">
      <h2 className="text-3xl font-bold mb-6">🧪 My A/B Tests</h2>

      {loading ? (
        <p>Loading your tests…</p>
      ) : tests.length === 0 ? (
        <p>You haven’t created any tests yet.</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border border-gray-700 border-collapse text-sm">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="px-4 py-3 border border-gray-700">Test ID</th>
                <th className="px-4 py-3 border border-gray-700">Video ID</th>
                <th className="px-4 py-3 border border-gray-700">Start</th>
                <th className="px-4 py-3 border border-gray-700">End</th>
                <th className="px-4 py-3 border border-gray-700">Status</th>
                <th className="px-4 py-3 border border-gray-700">Action</th>
              </tr>
            </thead>

            <tbody>
              {tests.map((test) => (
                <tr key={test.id} className="bg-gray-900">
                  <td className="px-4 py-3 border border-gray-800">{test.id}</td>

                  <td className="px-4 py-3 border border-gray-800 font-mono text-gray-300">
                    {test.video_id}
                  </td>

                  <td className="px-4 py-3 border border-gray-800">
                    {new Date(test.start_datetime).toLocaleString()}
                  </td>

                  <td className="px-4 py-3 border border-gray-800">
                    {new Date(test.end_datetime).toLocaleString()}
                  </td>

                  <td className="px-4 py-3 border border-gray-800">
                    {getStatus(test)}
                  </td>

                  <td className="border px-4 py-2">
  {test.analytics_collected ? (
    <button
      onClick={() => router.push(`/test/${test.id}`)}
      className="text-blue-600 underline"
    >
      View Results
    </button>
  ) : (
    <span className="text-gray-500 italic">Waiting</span>
  )}
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
