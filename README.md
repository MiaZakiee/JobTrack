# JobTracker

**JobTracker** is a modern, AI-powered job application tracking system that works directly with your Gmail. No manual data entry, no complex forms—just connect your inbox and let JobTracker do the rest.

![JobTracker Preview](public/screenshot.png) *(Note: Add a screenshot here)*

## 🚀 Features

- **Automated Tracking**: Scans your Gmail inbox for job application confirmations, interview invites, rejections, and offers.
- **AI Classification**: Uses Google Gemini (and Groq/Llama-3 fallback) to intelligently categorize emails, extract company names, and identify roles.
- **Real-time Synchronization**: Powered by Server-Sent Events (SSE) for a smooth, streaming synchronization experience.
- **Privacy First**: Only requests **read-only** Gmail access. Your email content is processed in your browser session and is not stored in a persistent database.
- **Interactive Dashboard**: Filter by status (Applied, Responded, Interview, Rejected, Offer), search through applications, and view your search statistics.
- **Modern UI**: A sleek, dark-themed interface built with Next.js 15, Tailwind CSS 4, and Lucide React.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org) (App Router)
- **Authentication**: [NextAuth.js v5 (Beta)](https://authjs.dev)
- **AI**: [Google Gemini SDK](https://ai.google.dev/) & [OpenAI SDK](https://openai.com/) (for Groq)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com)
- **Icons**: [Lucide React](https://lucide.dev)
- **API**: Google APIs (Gmail v1)

## 🚦 Getting Started

### Prerequisites

- Node.js 20+
- pnpm (recommended)
- A Google Cloud Project with Gmail API enabled
- A Gemini API Key from Google AI Studio

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/jobtracker.git
    cd jobtracker
    ```

2.  **Install dependencies**:
    ```bash
    pnpm install
    ```

3.  **Setup Environment Variables**:
    Create a `.env.local` file in the root directory and add the following:

    ```env
    # Google OAuth (https://console.cloud.google.com)
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret

    # Auth configuration
    # Generate with: openssl rand -base64 32
    AUTH_SECRET=your_auth_secret
    NEXTAUTH_URL=http://localhost:3000

    # AI Providers
    GOOGLE_GEMINI_API_KEY=your_gemini_api_key
    GROQ_API_KEY=your_groq_api_key (optional fallback)
    ```

4.  **Run the development server**:
    ```bash
    pnpm dev
    ```

5.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔒 Privacy & Security

JobTracker is designed with security in mind:
- **Read-Only Access**: We only request `https://www.googleapis.com/auth/gmail.readonly`.
- **Ephemeral Processing**: Your data is fetched and classified during your session.
- **No Database**: We do not store your emails or application details on our servers. Everything lives in the application state while you use it.

## 📄 License

MIT License. See [LICENSE](LICENSE) for more information.
