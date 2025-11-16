'use client'

import { useEffect, useState } from "react";

export default function MyTestsPage() {
  const [tests, setTests] = useState([]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/my-tests");
      const json = await res.json();
      setTests(json.data || []);
    }
    load();
  }, []);

  return (
    <div>
      <h1>Your A/B Tests</h1>
      <ul>
        {tests.map(t => (
          <li key={t.id}>
            Video: {t.video_id}  
            <br />
            Start: {t.start_datetime}
            <br />
            End: {t.end_datetime}
          </li>
        ))}
      </ul>
    </div>
  );
}
