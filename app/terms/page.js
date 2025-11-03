export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto p-8 text-gray-100">
      <h1 className="text-3xl font-bold mb-6 text-white">Terms & Conditions</h1>
      <p className="mb-4">
        <strong>Last updated:</strong> October 2025
      </p>
      <p className="mb-4">
        Welcome to ThumbFlip. By accessing or using our platform, you agree to the following Terms
        and Conditions. Please read them carefully.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2 text-white">1. Service Description</h2>
      <p className="mb-4">
        ThumbFlip automates thumbnail rotation for YouTube videos. We are not affiliated with or endorsed by YouTube or Google.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2 text-white">2. User Responsibilities</h2>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>You must connect your own YouTube account via Google OAuth.</li>
        <li>You agree not to upload or schedule content that violates YouTube’s terms or copyright laws.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2 text-white">3. Subscription & Pricing</h2>
      <p className="mb-4">
        ThumbFlip offers a subscription plan priced at <strong>$17 per month (USD)</strong>.
        Prices may change with notice. Billing is handled securely via our payment processor.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2 text-white">4. Limitation of Liability</h2>
      <p className="mb-4">
        We provide the service “as is” without warranties of any kind. We are not liable for losses
        arising from API outages, rate limits, or changes in YouTube policies. YouTube API assigns a daily quota of 10000 units. We are in the process of requesting increase in the quota. If at all the quota gets exhausted and you see a message "No videos found", you will have to wait for one more day to resume.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2 text-white">5. Account Termination</h2>
      <p className="mb-4">
        We reserve the right to suspend or terminate accounts that violate these terms or misuse the
        service.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2 text-white">6. Contact</h2>
      <p className="mb-4">
        For questions, email us at{" "}
        <a href="mailto:thumbflip.contact@gmail.com" className="text-blue-400 underline">
          thumbflip.contact@gmail.com
        </a>
        .
      </p>

      <p className="mt-8 text-gray-400">
        © 2025 ThumbFlip. All rights reserved — Prices are in USD.
      </p>
    </div>
  );
}
