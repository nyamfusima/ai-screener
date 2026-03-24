const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

function getApiKey() {
  const key = import.meta.env.VITE_GEMINI_API_KEY
  if (!key || key === 'your-gemini-api-key-here') {
    throw new Error(
      'VITE_GEMINI_API_KEY is not set. Add it to your .env file:\nVITE_GEMINI_API_KEY=AIza...'
    )
  }
  return key
}

/**
 * Robustly extract a JSON object from a model response string.
 */
function extractJSON(raw) {
  if (!raw) throw new Error('Empty response from Gemini.')
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON object found in response: "${cleaned.slice(0, 120)}"`)
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch (e) {
    throw new Error(`JSON parse failed: ${e.message}`)
  }
}

async function callGemini(prompt) {
  const apiKey = getApiKey()

  let res
  try {
    res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: 'You are a precise JSON API. You MUST respond with only a valid JSON object and nothing else — no explanation, no markdown, no prose before or after the JSON.',
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    })
  } catch (networkErr) {
    throw new Error(`Network request failed: ${networkErr.message}`)
  }

  if (!res.ok) {
    let errMsg = `Gemini API error ${res.status}`
    try {
      const errBody = await res.json()
      if (errBody?.error?.message) errMsg = errBody.error.message
    } catch (_) { /* ignore */ }
    throw new Error(errMsg)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!text) throw new Error('Empty response from Gemini.')
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
    raw = await callGemini(prompt)
    const result = extractJSON(raw)
    return {
      name: typeof result.name === 'string' && result.name.trim() ? result.name.trim() : 'Unknown Candidate',
      role: typeof result.role === 'string' && result.role.trim() ? result.role.trim() : 'Unknown Role',
    }
  } catch (e) {
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
    raw = await callGemini(prompt)
    const result = extractJSON(raw)
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