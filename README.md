# Storyteller MVP

Mobile-first book-to-audio-story web app.

## Current MVP
- PDF upload
- Multiple page-image upload
- PDF text extraction in browser
- OCR for page images
- Basic text cleanup
- Refined-story script preview
- Browser/device speech narration
- Playback rate control
- Local library using localStorage
- PWA manifest
- Backend endpoint settings placeholder

## Run
Open `index.html` through a local web server (recommended because browser modules/CORS can be restricted by file://).

Examples:
- VS Code Live Server
- `python -m http.server 8080`

Then open `http://localhost:8080`.

## Production architecture
For true AI refinement and downloadable MP3, connect:
1. PDF/image ingestion
2. OCR
3. LLM story refinement
4. TTS
5. Audio storage
6. Job queue/status

Keep API secrets on the server/Edge Function, not in client HTML.
