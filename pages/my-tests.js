// pages/my-tests.js

'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function MyTestsPage() {
  const { data: session, status } = useSession();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
<table className="min-w-full border border-black border-collapse text-sm text-left">
  <thead className="bg-gray-100">
    <tr>
      <th className="px-4 py-2 border border-black">Test ID</th>
      <th className="px-4 py-2 border border-black">Video ID</th>
      <th className="px-4 py-2 border border-black">Start</th>
      <th className="px-4 py-2 border border-black">End</th>
      <th className="px-4 py-2 border border-black">Status</th>
      <th className="px-4 py-2 border border-black">Action</th>
    </tr>
  </thead>

  <tbody>
    {tests.map((test) => (
      <tr
        key={test.id}
        className="hover:bg-gray-50 transition-colors"
      >
        <td className="px-4 py-2 border border-black">{test.id}</td>
        <td className="px-4 py-2 border border-black font-mono text-sm text-gray-700">
          {test.video_id}
        </td>
        <td className="px-4 py-2 border border-black">
          {new Date(test.start_datetime).toLocaleString()}
        </td>
        <td className="px-4 py-2 border border-black">
          {new Date(test.end_datetime).toLocaleString()}
        </td>
        <td className="px-4 py-2 border border-black">
          {test.is_running ? (
            <span className="inline-flex items-center gap-1 text-green-700 font-medium">
              🟢 Running
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-yellow-700 font-medium">
              ⏳ Awaiting Results
            </span>
          )}
        </td>
        <td className="px-4 py-2 border border-black text-gray-600 italic">
          Not ready
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
