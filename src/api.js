const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'

function getApiKey() {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!key) throw new Error('Missing VITE_ANTHROPIC_API_KEY. Add it to your .env file or Vercel environment variables.')
  return key
}

async function callClaude(prompt) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-calls': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${res.status}`)
  }

  const data = await res.json()
  const text = data.content?.find((b) => b.type === 'text')?.text ?? '{}'
  return text.replace(/```json|```/g, '').trim()
}

/**
 * Extract candidate name and role from raw CV text using Claude.
 * @param {string} cvText
 * @returns {Promise<{ name: string, role: string }>}
 */
export async function extractCandidateInfo(cvText) {
  const prompt = `Extract the candidate's full name and most recent job title or role from this CV text.

CV TEXT:
${cvText.slice(0, 3000)}

Respond ONLY with valid JSON (no markdown):
{"name":"<full name>","role":"<job title or role>"}`

  try {
    return JSON.parse(await callClaude(prompt))
  } catch {
    return { name: 'Unknown Candidate', role: 'Unknown Role' }
  }
}

/**
 * Score an applicant against a job description.
 * @param {{ name: string, role: string, text: string }} applicant
 * @param {string} jobDescription
 * @returns {Promise<{ score: number, summary: string, matched_skills: string[], missing_skills: string[] }>}
 */
export async function scoreApplicant(applicant, jobDescription) {
  const prompt = `You are an expert HR recruiter. Score this applicant's fit for the job description.

JOB DESCRIPTION:
${jobDescription}

APPLICANT:
Name: ${applicant.name}
Role: ${applicant.role}
CV: ${applicant.text}

Respond ONLY with valid JSON (no markdown):
{
  "score": <integer 0-100>,
  "summary": "<one concise sentence verdict>",
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill1", "skill2"]
}`

  try {
    return JSON.parse(await callClaude(prompt))
  } catch {
    throw new Error('Claude returned invalid JSON. Please try again.')
  }
}
