const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'

function getApiKey() {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!key)
    throw new Error(
      'Missing VITE_ANTHROPIC_API_KEY. Add it to your .env file or Vercel environment variables.'
    )
  return key
}

/**
 * Robustly extract a JSON object from a Claude response string.
 * Handles: plain JSON, ```json fences, leading/trailing prose.
 */
function extractJSON(raw) {
  if (!raw) throw new Error('Empty response from Claude.')

  // 1. Strip markdown code fences
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim()

  // 2. Find the first { ... } block (handles prose before/after the JSON)
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON object found in response: "${cleaned.slice(0, 120)}"`)
  }

  const jsonStr = cleaned.slice(start, end + 1)

  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    throw new Error(`JSON parse failed: ${e.message}. Raw: "${jsonStr.slice(0, 120)}"`)
  }
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
      max_tokens: 1024,
      // System prompt forces JSON-only output at the model level
      system:
        'You are a precise JSON API. You MUST respond with only a valid JSON object and nothing else — no explanation, no markdown, no prose before or after the JSON.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Anthropic API error ${res.status}`)
  }

  const data = await res.json()
  const text = data.content?.find((b) => b.type === 'text')?.text ?? ''
  return text
}

/**
 * Extract candidate name and role from raw CV text.
 * @param {string} cvText
 * @returns {Promise<{ name: string, role: string }>}
 */
export async function extractCandidateInfo(cvText) {
  const snippet = cvText.slice(0, 4000)

  const prompt = `Extract the candidate's full name and most recent job title from this CV.

CV TEXT:
${snippet}

Return this exact JSON structure:
{"name":"<full name>","role":"<most recent job title>"}`

  let raw = ''
  try {
    raw = await callClaude(prompt)
    const result = extractJSON(raw)

    return {
      name: typeof result.name === 'string' && result.name.trim() ? result.name.trim() : 'Unknown Candidate',
      role: typeof result.role === 'string' && result.role.trim() ? result.role.trim() : 'Unknown Role',
    }
  } catch (e) {
    // Don't block the whole flow — fall back gracefully
    console.warn('extractCandidateInfo failed:', e.message, '| raw:', raw)
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
  // Trim CV to avoid exceeding context limits
  const cvSnippet = applicant.text.slice(0, 6000)

  const prompt = `Score how well this candidate matches the job description. Be objective and precise.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE:
Name: ${applicant.name}
Role: ${applicant.role}
CV: ${cvSnippet}

Return this exact JSON structure:
{
  "score": <integer between 0 and 100>,
  "summary": "<one sentence explaining the score>",
  "matched_skills": ["<skill>", "<skill>"],
  "missing_skills": ["<skill>", "<skill>"]
}`

  let raw = ''
  try {
    raw = await callClaude(prompt)
    const result = extractJSON(raw)

    // Validate and sanitise the returned object
    return {
      score: Math.min(100, Math.max(0, Math.round(Number(result.score) || 0))),
      summary: typeof result.summary === 'string' ? result.summary : 'No summary available.',
      matched_skills: Array.isArray(result.matched_skills) ? result.matched_skills : [],
      missing_skills: Array.isArray(result.missing_skills) ? result.missing_skills : [],
    }
  } catch (e) {
    console.error('scoreApplicant failed:', e.message, '| raw:', raw)
    throw new Error(`Scoring failed for ${applicant.name}: ${e.message}`)
  }
}