'use client';
import { useState } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useRouter } from "next/navigation";

/**
 * Convert datetime-local (local timezone) → true UTC ISO string
 */
function toUTC(localDateTimeString) {
  if (!localDateTimeString) return '';
  return new Date(localDateTimeString).toISOString();
}

const router = useRouter();

export default function ABTestForm({ videoId, thumbnails }) {
  const { data: session } = useSession();

  const [startDatetime, setStartDatetime] = useState('');
  const [endDatetime, setEndDatetime] = useState('');
  const [intervalValue, setIntervalValue] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState('hours');
  const [saving, setSaving] = useState(false);

  const handleCreateTest = async () => {
    if (!startDatetime || !endDatetime) {
      alert('⚠️ Please enter both start and end times.');
      return;
    }

    if (parseInt(intervalValue) <= 0) {
      alert('⚠️ Interval must be > 0');
      return;
    }

    const startLocal = new Date(startDatetime);
    const endLocal = new Date(endDatetime);

    if (endLocal <= startLocal) {
      alert('⚠️ End time must be AFTER start time.');
      return;
    }

    // ✔ Convert to proper UTC before sending
    const startUTC = toUTC(startDatetime);
    const endUTC = toUTC(endDatetime);

    console.log("🚀 Sending UTC:", { startUTC, endUTC });

    setSaving(true);

    try {
      const payload = {
        videoId,
        thumbnailUrls: thumbnails,
        start_datetime: startUTC,
        end_datetime: endUTC,
        rotation_interval_value: parseInt(intervalValue),
        rotation_interval_unit: intervalUnit,
        access_token: session?.accessToken || null,
      };

      const res = await axios.post('/api/ab-test', payload);

      if (res.status === 200 || res.status === 201) {
        alert('✅ A/B Test Created Successfully!');
        //router.push('api/my-tests');   // <-- redirect to summary page
      }
    } catch (err) {
      console.error(err);
      alert('❌ Failed to create test.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-5 text-green-600">
      <h3 className="text-xl font-bold mb-3">Create A/B Test</h3>

      {/* Start */}
      <div className="flex flex-col gap-1 mb-3">
        <label>Start (Local Time)</label>
        <input
          type="datetime-local"
          value={startDatetime}
          onChange={(e) => setStartDatetime(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* End */}
      <div className="flex flex-col gap-1 mb-3">
        <label>End (Local Time)</label>
        <input
          type="datetime-local"
          value={endDatetime}
          onChange={(e) => setEndDatetime(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* Interval */}
      <div className="flex flex-col gap-1 mb-3">
        <label>Rotate Every</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            value={intervalValue}
            onChange={(e) => setIntervalValue(e.target.value)}
            className="border p-2 rounded w-1/3"
          />
          <select
            value={intervalUnit}
            onChange={(e) => setIntervalUnit(e.target.value)}
            className="border p-2 rounded w-2/3"
          >
            <option value="hours">Hours</option>
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleCreateTest}
        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mt-3"
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Create A/B Test'}
      </button>
    </div>
  );
}
