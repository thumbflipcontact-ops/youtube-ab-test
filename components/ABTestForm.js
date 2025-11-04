'use client'
import { useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function ABTestForm({ videoId, thumbnails }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [startDatetime, setStartDatetime] = useState('')
  const [endDatetime, setEndDatetime] = useState('')
  const [intervalValue, setIntervalValue] = useState(1)
  const [intervalUnit, setIntervalUnit] = useState('hours')
  const [saving, setSaving] = useState(false)

  const handleCreateTest = async () => {
    if (!startDatetime || !endDatetime || !intervalValue || !intervalUnit) {
      alert("⚠️ Please fill in all fields before creating the Rotation Cycle.")
      return
    }

    setSaving(true)
    try {
      const payload = {
        videoId,
        thumbnailUrls: thumbnails, // array of Supabase public URLs
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        rotation_interval_value: parseInt(intervalValue),
        rotation_interval_unit: intervalUnit,
        access_token: session?.accessToken || null,
      }

      const response = await axios.post("/api/ab-test", payload)

      if (response.status === 200 || response.status === 201) {
        console.log("✅ Thumbnail Rotation Schedule created successfully:", response.data)
        alert("✅ Thumbnail Rotation Schedule created successfully!")

        // Slight delay to allow alert to close before navigation
        setTimeout(() => {
          router.reload()
        }, 300)
      } else {
        throw new Error(`Unexpected response: ${response.status}`)
      }
    } catch (err) {
      console.error("❌ Failed to create Thumbnail Rotation Schedule:", err.response?.data || err.message)
      alert("Failed to create Thumbnail Rotation Schedule. Check console for details.")
    } finally {
      setSaving(false)
    }
  }

  return (
<div className="bg-white shadow rounded-lg p-5 text-green-600">
      <h3 className="text-xl font-bold mb-3">Create Thumbnail Rotation Schedule</h3>
     {/* Start Date & Time */}
      <div className="flex flex-col gap-1 mb-3">
        <label className="font-medium">Start Date & Time</label>
        <input
          type="datetime-local"
          value={startDatetime}
          onChange={(e) => setStartDatetime(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* End Date & Time */}
      <div className="flex flex-col gap-1 mb-3">
        <label className="font-medium">End Date & Time</label>
        <input
          type="datetime-local"
          value={endDatetime}
          onChange={(e) => setEndDatetime(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* Rotation Interval */}
      <div className="flex flex-col gap-1 mb-3">
        <label className="font-medium">Rotate Every</label>
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

      {/* Submit Button */}
      <button
        onClick={handleCreateTest}
        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mt-3"
        disabled={saving}
      >
        {saving ? "Saving..." : "Create Thumbnail Rotation Schedule"}
      </button>
    </div>
  )
}
