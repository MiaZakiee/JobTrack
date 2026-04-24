import React from "react"
import Link from "next/link"

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-black text-white py-20 px-4 md:px-8 max-w-4xl mx-auto">
      <Link href="/" className="text-zinc-400 hover:text-white mb-8 inline-block transition-colors">
        &larr; Back to Home
      </Link>
      
      <h1 className="text-4xl md:text-5xl font-bold mb-8">Privacy Policy</h1>
      
      <div className="space-y-8 text-zinc-300 leading-relaxed">
        <section>
          <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
          <p>
            At JobTracker, accessible from jobtracker.ninocabiltes.dev, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by JobTracker and how we use it.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">1. Information We Collect</h2>
          <p>
            We collect the following types of information when you use our service:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2">
            <li><strong>Google Account Information:</strong> To provide our services, we authenticate you via Google OAuth. We receive your email address and profile information.</li>
            <li><strong>Gmail Data:</strong> With your explicit consent, we access your Gmail account in a <strong>read-only</strong> capacity to identify and extract job application statuses. Your emails are processed securely during your active session.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">2. How We Use Your Information</h2>
          <p>We use the information we collect in various ways, including to:</p>
          <ul className="list-disc pl-6 mt-4 space-y-2">
            <li>Provide, operate, and maintain our website and its features.</li>
            <li>Extract data about job applications to populate your dashboard.</li>
            <li>Understand and analyze how you use our website.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">3. Data Storage and Security</h2>
          <p>
            <strong>We do not store your emails or personal job application data in any database.</strong> All email processing is done directly within your active browser session or via secure ephemeral connections. Once you log out or close your session, the fetched email data is cleared.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">4. Third-Party Access</h2>
          <p>
            We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties. Your emails may be temporarily processed by secure AI providers (e.g., Gemini or Groq) strictly for the purpose of classification, but this data is not retained by them or used to train models.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">5. Contact Us</h2>
          <p>
            If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact us.
          </p>
        </section>
      </div>
    </div>
  )
}
