import React from "react"
import Link from "next/link"

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-black text-white py-20 px-4 md:px-8 max-w-4xl mx-auto">
      <Link href="/" className="text-zinc-400 hover:text-white mb-8 inline-block transition-colors">
        &larr; Back to Home
      </Link>
      
      <h1 className="text-4xl md:text-5xl font-bold mb-8">Terms of Service</h1>
      
      <div className="space-y-8 text-zinc-300 leading-relaxed">
        <section>
          <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
          <p>
            Welcome to JobTracker. By accessing or using our website, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, then you may not access the service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">1. Use of the Service</h2>
          <p>
            JobTracker is a tool designed to help you organize and track your job applications by parsing your emails. You agree to use the service only for lawful purposes and in accordance with these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">2. Account and Authentication</h2>
          <p>
            To use JobTracker, you must authenticate using your Google account. You are responsible for safeguarding your Google account credentials. We are not responsible for any unauthorized access to your account.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">3. Data Privacy</h2>
          <p>
            Your privacy is important to us. JobTracker accesses your Gmail account in read-only mode to extract job-related data. We do not store your emails in any permanent database. Please review our <Link href="/privacy" className="text-blue-500 hover:underline">Privacy Policy</Link> for more detailed information.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">4. Limitation of Liability</h2>
          <p>
            In no event shall JobTracker, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">5. Disclaimer</h2>
          <p>
            Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis. The classification and extraction of job data are performed by automated algorithms and AI, which may occasionally produce inaccuracies. You should always verify important application statuses directly.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">6. Changes to Terms</h2>
          <p>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days notice prior to any new terms taking effect.
          </p>
        </section>
      </div>
    </div>
  )
}
