# ⚡ AI Application Screener

An AI-powered job application screener built with **React + Vite**, using the **Anthropic Claude API** to automatically parse, score, and filter candidate CVs against a job description.

Upload CVs as PDFs — Claude extracts the candidate's name and role automatically, then scores each one. Candidates below the configurable threshold (default **60%**) are automatically rejected.

---

## ✨ Features

- Paste any job description
- **Upload CVs as PDFs** — drag & drop or browse, multiple files at once
- Claude automatically extracts candidate name and job title from each PDF
- Adjustable rejection threshold (30–90%)
- Per-applicant match score (0–100%) with animated score ring
- Matched vs. missing skills breakdown per candidate
- One-sentence AI verdict per candidate
- Results sorted by score: Qualified · Borderline · Rejected
- Clean corporate UI — warm off-white palette, Cormorant serif + Outfit sans

---

## 🚀 Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/ai-application-screener.git
cd ai-application-screener
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add your Anthropic API key

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder:

```env
VITE_ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

> Get your key at [console.anthropic.com](https://console.anthropic.com/)

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🏗️ Project Structure

```
ai-application-screener/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx          # React entry point
│   ├── index.css         # Global styles & CSS variables
│   ├── App.jsx           # Main application component
│   ├── App.css           # Component styles
│   ├── pdfUtils.js       # PDF text extraction (pdfjs-dist)
│   └── api.js            # Anthropic API calls
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vercel.json
└── vite.config.js
```

---

## ☁️ Deploy to Vercel

### Option A — Vercel Dashboard (recommended)

1. Push your repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → Import your repo
3. Under **Environment Variables**, add:
   - Key: `VITE_ANTHROPIC_API_KEY`
   - Value: your Anthropic API key
4. Click **Deploy** ✅

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel
vercel env add VITE_ANTHROPIC_API_KEY
vercel --prod
```

---

## 🔑 Required Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | ^18.2.0 | UI framework |
| `react-dom` | ^18.2.0 | React DOM renderer |
| `pdfjs-dist` | ^3.11.174 | Client-side PDF text extraction |
| `vite` | ^5.0.8 | Build tool & dev server |
| `@vitejs/plugin-react` | ^4.2.1 | Vite React plugin |

---

## ⚙️ How It Works

1. **Upload PDF CVs** — drag & drop one or many
2. **Text extraction** — `pdfjs-dist` parses each PDF in the browser, no server needed
3. **Candidate identification** — Claude reads the raw text and extracts the person's name and role
4. **Scoring** — Claude compares each candidate's full CV text against the job description and returns:

```json
{
  "score": 82,
  "summary": "Strong React/TypeScript background with relevant testing experience.",
  "matched_skills": ["React", "TypeScript", "Jest"],
  "missing_skills": ["GraphQL"]
}
```

5. **Auto-filter** — candidates below the threshold are marked as Rejected

---

## 📄 License

MIT
