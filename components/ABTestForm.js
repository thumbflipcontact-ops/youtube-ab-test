"use client";

import { useState } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { PaywallButton } from "@/components/Paywall";
import { useSubscription } from "@/hooks/useSubscription";

export default function ABTestForm({ videoId, thumbnails }) {
  const { data: session } = useSession();
  const { status: subStatus, loading: subLoading } = useSubscription();

  const [startDatetime, setStartDatetime] = useState("");
  const [endDatetime, setEndDatetime] = useState("");
  const [intervalValue, setIntervalValue] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState("hours");
  const [saving, setSaving] = useState(false);

  const toUTC = (localDateTime) => new Date(localDateTime).toISOString();

  // ✅ This is the SAME logic you already had – now reusable.
  const createRotationSchedule = async () => {
    if (!startDatetime || !endDatetime) {
      alert("⚠️ Please choose both start and end date & time.");
      return;
    }

    if (parseInt(intervalValue) <= 0) {
      alert("⚠️ Interval must be greater than 0.");
      return;
    }

    const start = new Date(startDatetime);
    const end = new Date(endDatetime);

    if (end <= start) {
      alert("⚠️ End time must be after start time.");
      return;
    }

    const payload = {
      videoId,
      thumbnailUrls: thumbnails,
      start_datetime: toUTC(startDatetime),
      end_datetime: toUTC(endDatetime),
      rotation_interval_value: parseInt(intervalValue),
      rotation_interval_unit: intervalUnit,
      access_token: session?.accessToken || null,
    };

    setSaving(true);

    try {
      const response = await axios.post("/api/ab-test", payload);

      if (response.status === 200 || response.status === 201) {
        alert("✅ Thumbnail Rotation Schedule created successfully!");
      } else {
        throw new Error(response.status);
      }
    } catch (err) {
      console.error("❌ Error creating schedule:", err);
      alert("❌ Failed to create Thumbnail Rotation Schedule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-5 text-green-600">
      <h3 className="text-xl font-bold mb-3">Create Thumbnail Rotation Schedule</h3>

      {/* Start Date */}
      <div className="flex flex-col gap-1 mb-3">
        <label className="font-medium">Start Date & Time</label>
        <input
          type="datetime-local"
          value={startDatetime}
          onChange={(e) => setStartDatetime(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* End Date */}
      <div className="flex flex-col gap-1 mb-3">
        <label className="font-medium">End Date & Time</label>
        <input
          type="datetime-local"
          value={endDatetime}
          onChange={(e) => setEndDatetime(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* Interval */}
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

      {/* ✅ MAIN BUTTON LOGIC */}
      {subLoading ? (
        <button className="bg-gray-300 px-4 py-2 rounded" disabled>
          Checking subscription...
        </button>
      ) : subStatus === "active" ? (
        // ✅ Already subscribed — run rotation immediately
        <button
          onClick={createRotationSchedule}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mt-3"
          disabled={saving}
        >
          {saving ? "Saving..." : "Create Thumbnail Rotation Schedule"}
        </button>
      ) : (
        // ✅ Not subscribed — open Paywall, then run rotation automatically
        <PaywallButton onActivated={createRotationSchedule}>
          Subscribe to unlock & create schedule
        </PaywallButton>
      )}
    </div>
  );
}
