# Storyteller AI — Gemini Free Mode

Vercel-ready book-to-story app.

## Environment variable
Set in Vercel:
`GEMINI_API_KEY=...`

Optional:
`GEMINI_MODEL=gemini-2.5-flash-lite`

The app uses Gemini for OCR of uploaded images and story refinement. Audio is spoken by the device/browser SpeechSynthesis API, so there is no TTS API charge.

## Deploy
1. Replace your existing repo files with this project.
2. Push to GitHub.
3. Vercel redeploys.
4. Add `GEMINI_API_KEY` in Vercel Environment Variables.
5. Redeploy.

Free-tier limits still apply. Large books should later be processed chapter-by-chapter.
