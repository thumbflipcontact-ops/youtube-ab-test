"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export default function BetaLandingPage() {
  const router = useRouter();

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState("");
  const [reason, setReason] = useState("");
  const [testimonial, setTestimonial] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = { name, email, channel, reason, testimonial };

    try {
      const res = await fetch("/api/beta-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        router.push("/beta/thank-you");
      } else {
        alert("There was an error. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Unexpected error. Try again.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white px-6 flex flex-col items-center py-16">
      <h1 className="text-4xl md:text-6xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-yellow-300 max-w-3xl">
        Join the ThumbFlip Private Beta
      </h1>

      <p className="text-gray-300 text-center max-w-2xl mt-6 text-lg leading-relaxed">
        Get early access to the most powerful YouTube thumbnail A/B testing tool.
        Free during beta. Spots are limited.
      </p>

      <div className="mt-12 w-full max-w-xl bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          <div>
            <label className="block text-sm text-gray-300">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300">YouTube Channel (optional)</label>
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300">Why join the beta?</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white h-28"
            ></textarea>
          </div>

          <div>
            <label className="block text-sm text-gray-300">Optional Testimonial</label>
            <textarea
              value={testimonial}
              onChange={(e) => setTestimonial(e.target.value)}
              className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white h-24"
            ></textarea>
          </div>

          <button
            disabled={loading}
            className="bg-gradient-to-r from-red-600 via-pink-600 to-orange-500 text-white px-6 py-3 rounded-full font-semibold text-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "Submitting..." : "Request Access"}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>

        </form>
      </div>
    </div>
  );
}
