# Storyteller AI — Vercel Fix v3

This version fixes the misleading `Unexpected token 'A' ... is not valid JSON` frontend error by safely reading the API response first.

It also removes `pdf-parse` from the server. Gemini receives PDFs/images directly, which reduces serverless dependency/runtime failures.

## GitHub structure

storyteller/
├── index.html
├── package.json
├── vercel.json
└── api/
    └── process.js

## Vercel

Add:

GEMINI_API_KEY = your Gemini API key

Optional:

GEMINI_MODEL = gemini-3.5-flash-lite

Redeploy after changing the environment variable.

## MVP upload limit

15 MB total per request.

## If Vercel still returns a server error

Open Vercel:
Project → Deployments → latest deployment → Functions → api/process

The function log will now contain `STORYTELLER_API_ERROR` followed by the actual cause.


## Runtime fix
`vercel.json` intentionally does NOT set `runtime: nodejs24.x`. Official Node.js Functions need no runtime property; Vercel selects Node.js automatically. The Node version is pinned through `package.json` as `24.x`.
