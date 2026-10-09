# VedaAI — AI Assessment Extraction & Answer Mapping

A production-style Next.js implementation for the VedaAI hiring assignment.

## What it does
- Upload question paper + student handwritten answer sheet (PDF/JPG/PNG)
- Converts PDF pages to optimized images in the browser
- Extracts printed questions in order, preserving labels and sub-parts
- Extracts handwritten answer blocks and normalized bounding boxes
- Maps out-of-order answers to questions with confidence + rationale
- Handles unanswered and unmatched answers
- Highlights the mapped answer region directly on the original page image
- Generates per-question feedback and a conservative score
- Responsive teacher review workspace.

## Stack
- Next.js + React + TypeScript
- Gemini 2.5 Flash for multimodal extraction/mapping
- PDF.js for browser-side PDF rendering
- Lucide icons
- No database / authentication

## Run locally
1. Install Node 20+
2. `npm install`
3. Copy `.env.example` to `.env.local`
4. Add `GEMINI_API_KEY`
5. `npm run dev`
6. Open `http://localhost:3000`

## Deploy
Deploy the repository to Vercel (or any Next.js host) and set `GEMINI_API_KEY` in the project's environment variables.

## Important assumptions / limitations
- Bounding-box accuracy depends on scan quality and the multimodal model. The prompt asks Gemini for normalized 0–1000 coordinates around the actual handwriting.
- Very large/multi-page files are rendered and compressed client-side before AI processing to reduce request size.
- Gemini API usage is required for extraction/mapping; API availability and free-tier limits depend on Google's current account/model policy.
- The current UI keeps all state in memory as permitted by the assignment.
- For a production system, page-level processing would normally be queued server-side with retries, persistent job state, stronger OCR validation and human correction tools.


## Submission copy

**Approach:** Browser-side PDF rendering produces page images, Gemini 2.5 Flash performs page-level question and handwriting extraction, then a second mapping pass matches labelled or content-similar answers to questions. Each answer contains normalized 0–1000 bounding boxes, allowing the review UI to draw the highlight over the original rendered page.

**AI model/API:** Google Gemini 2.5 Flash via the Gemini Generative Language REST API.

**Assumptions:** The model receives one page at a time; subparts are separate questions; answer coordinates are normalized to the rendered page; teacher review remains authoritative for ambiguous handwriting/mappings.

**Limitations:** Handwriting quality, glare, cropped pages, unusual layouts, and API rate limits can affect extraction and coordinates. The app exposes confidence/reasoning and unmatched/unanswered states rather than silently forcing uncertain matches.

**Important:** If `GEMINI_API_KEY` is not configured, the app runs a small built-in demo dataset so the review experience can still be inspected. Real uploaded documents require the Gemini key.
