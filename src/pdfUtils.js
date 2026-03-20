import * as pdfjsLib from 'pdfjs-dist'

// Use the CDN worker — more reliable than trying to resolve the local path with Vite
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

/**
 * Extract all text from a PDF File object.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer()

  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    // Suppress password/encryption warnings for regular CVs
    verbosity: 0,
  }).promise

  const pages = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    // Preserve line breaks by grouping items that share the same Y position
    let lastY = null
    let line = []
    const lines = []

    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = item.transform?.[5] ?? 0

      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.join(' '))
        line = []
      }
      line.push(item.str)
      lastY = y
    }
    if (line.length) lines.push(line.join(' '))

    pages.push(lines.join('\n'))
  }

  const text = pages.join('\n\n').replace(/[ \t]{3,}/g, '  ').trim()

  if (!text || text.length < 30) {
    throw new Error(
      'Could not extract readable text from this PDF. It may be scanned or image-based.'
    )
  }

  return text
}