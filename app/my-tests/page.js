"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function MyTestsPage() {
  const router = useRouter();          // ✅ FIXED
  const { data: session, status } = useSession();

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (status === "loading") return <p>Checking authentication…</p>;
  if (status === "unauthenticated") return <p>You must log in to view your tests.</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">🧪 My A/B Tests</h2>

      {loading ? (
        <p>Loading your tests…</p>
      ) : tests.length === 0 ? (
        <p>You haven’t created any tests yet.</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border border-gray-700 border-collapse text-sm text-left">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-4 py-2 border border-gray-700">Test ID</th>
                <th className="px-4 py-2 border border-gray-700">Video ID</th>
                <th className="px-4 py-2 border border-gray-700">Start</th>
                <th className="px-4 py-2 border border-gray-700">End</th>
                <th className="px-4 py-2 border border-gray-700">Status</th>
                <th className="px-4 py-2 border border-gray-700">Action</th>
              </tr>
            </thead>

            <tbody>
              {tests.map((test) => {
                const now = new Date();
                const end = new Date(test.end_datetime);

                const isCompleted = now > end;

                return (
                  <tr key={test.id} className="hover:bg-gray-900 transition-none">
                    <td className="px-4 py-2 border border-gray-700">{test.id}</td>

                    <td className="px-4 py-2 border border-gray-700 font-mono text-gray-300">
                      {test.video_id}
                    </td>

                    <td className="px-4 py-2 border border-gray-700">
                      {new Date(test.start_datetime).toLocaleString()}
                    </td>

                    <td className="px-4 py-2 border border-gray-700">
                      {new Date(test.end_datetime).toLocaleString()}
                    </td>

                    <td className="px-4 py-2 border border-gray-700">
                      {isCompleted ? (
                        <span className="text-blue-400 font-medium">Completed</span>
                      ) : (
                        <span className="text-green-400 font-medium">Running</span>
                      )}
                    </td>

                    {/* ACTION COLUMN */}
                    <td className="px-4 py-2 border border-gray-700">
                      {isCompleted ? (
                        <button
                          onClick={() => router.push(`/test/${test.id}`)}  // ✅ FIXED
                          className="text-blue-400 underline hover:text-blue-300"
                        >
                          View Results
                        </button>
                      ) : (
                        <span className="text-gray-500 italic">Not ready</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
