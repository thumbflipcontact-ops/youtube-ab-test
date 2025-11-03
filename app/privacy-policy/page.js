export default function PrivacyPolicyPage() {
 return (
    <div className="max-w-3xl mx-auto p-8 text-gray-100">
      <h1 className="text-3xl font-bold mb-6 text-white">Privacy Policy</h1>
      <p className="mb-4">
        <strong>Last updated:</strong> October 2025
      </p>
      <p className="mb-4">
        ThumbFlip (“we”, “our”, “us”) respects your privacy. This Privacy Policy explains how we
        collect, use, and protect your information when you use our service to upload and rotate
        YouTube thumbnails.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2 text-white">1. Information We Collect</h2>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>Google account information (via Google OAuth) for authentication.</li>
        <li>YouTube video and thumbnail data necessary for rotating thumbnails automatically.</li>
        <li>Basic usage and performance metrics for service improvement.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2 text-white">2. How We Use Your Information</h2>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>To manage thumbnail uploads and rotations.</li>
        <li>To maintain secure user authentication.</li>
        <li>To improve the reliability and features of ThumbFlip.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2 text-white">3. Data Storage & Security</h2>
      <p className="mb-4">
        We use Supabase and Google Cloud services to store and process data securely. Supabase stores your email, thumbnails and videos. Access tokens are encrypted and used only to interact with the YouTube API on your behalf.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2 text-white">4. Third-Party Services</h2>
      <p className="mb-4">
        Our app interacts with Google APIs. Your use of Google’s services through ThumbFlip is
        subject to the{" "}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          className="text-blue-400 underline"
        >
          Google Privacy Policy
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2 text-white">5. Your Rights</h2>
      <p className="mb-4">
        You can revoke access or delete your data at any time by disconnecting ThumbFlip from your
        Google Account
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2 text-white">6. Updates</h2>
      <p className="mb-4">
        We may update this policy from time to time. Continued use of the service means you accept
        the revised version.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2 text-white">7. GDPR Compliance</h2>
      <p className="mb-4">
        If you are located in the European Union (EU), you have the following rights under the General Data Protection Regulation (GDPR):
-Right to Access – You can request a copy of your data.
-Right to Rectification – You can request correction of inaccurate data.
-Right to Erasure (“Right to be Forgotten”) – You can request deletion of your personal data.
-Right to Data Portability – You can request transfer of your data to another service.
-Right to Object or Restrict Processing – You can limit or stop how your data is processed.
-To exercise any of these rights, please contact us at thumbflip.contact@gmail.com.
-We respond to all valid requests within 30 days.
      </p>
      
 <h2 className="text-xl font-semibold mt-6 mb-2 text-white">8. CCPA Compliance</h2>
      <p className="mb-4">
        Under the California Consumer Privacy Act (CCPA), users in California have the right to:
-Know what personal data we collect and how we use it.
-Request deletion of their personal information.
-Opt out of the sale of personal data (we do not sell user data).
-Receive equal service even if privacy rights are exercised.
-To make a CCPA request, email thumbflip.contact@gmail.com
 with the subject line “CCPA Request
      </p>
<p className="mt-8 text-gray-400">
        © 2025 ThumbFlip. All rights reserved.
      </p>
    </div>
  );
}
