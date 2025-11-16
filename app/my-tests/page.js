'use client';

import { useEffect, useState } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";

export default function MyTestsPage() {
  const { data: session, status } = useSession();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all tests for this user
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

  //  Auth guards
  if (status === "loading") return <p className="p-6">Checking authentication…</p>;
  if (status === "unauthenticated") return <p className="p-6">You must log in to view your tests.</p>;


  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">🧪 My A/B Tests</h2>

      {loading ? (
        <p>Loading your tests…</p>
      ) : tests.length === 0 ? (
        <p>You haven’t created any tests yet.</p>
      ) : (
        <div className="overflow-x-auto mt-6">

          <table className="min-w-full border border-slate-700 border-collapse text-sm text-left">
            <thead className="bg-slate-800 text-white font-semibold">
              <tr>
                <th className="px-4 py-3 border border-slate-700">Test ID</th>
                <th className="px-4 py-3 border border-slate-700">Video ID</th>
                <th className="px-4 py-3 border border-slate-700">Start</th>
                <th className="px-4 py-3 border border-slate-700">End</th>
                <th className="px-4 py-3 border border-slate-700">Status</th>
                <th className="px-4 py-3 border border-slate-700">Action</th>
              </tr>
            </thead>

            <tbody>
              {tests.map((test) => {
                const now = new Date();
                const start = new Date(test.start_datetime);
                const end = new Date(test.end_datetime);

                const isRunning = now >= start && now <= end;

                return (
                  <tr key={test.id} className={`${index % 2 === 0 ? "bg-slate-900" : "bg-slate-800"
            } text-gray-300`}>
                    <td className="px-4 py-2 border border-slate-700">{test.id}</td>

                    <td className="px-4 py-2 border border-slate-700">
                      {test.video_id}
                    </td>

                    <td className="px-4 py-2 border border-slate-700">
                      {start.toLocaleString()}
                    </td>

                    <td className="px-4 py-2 border border-slate-700">
                      {end.toLocaleString()}
                    </td>

                    <td className="px-4 py-2 border border-slate-700">
                      {isRunning ? (
                        <span className="text-green-400 font-medium flex items-center gap-1">
                          🟢 Running
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium flex items-center gap-1">
                          ⏳ Awaiting
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2 border border-slate-700 italic text-gray-400">
                      Not ready
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
