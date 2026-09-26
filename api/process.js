import busboy from "busboy";

export const config = {
  api: { bodyParser: false },
};

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

function readMultipart(req) {
  return new Promise((resolve, reject) => {
    let bb;
    try { bb = busboy({ headers: req.headers }); }
    catch (e) { reject(e); return; }

    const files = [];
    bb.on("file", (_field, stream, info) => {
      const chunks = [];
      stream.on("data", c => chunks.push(c));
      stream.on("end", () => files.push({
        name: info.filename,
        type: info.mimeType || "application/octet-stream",
        buffer: Buffer.concat(chunks)
      }));
      stream.on("error", reject);
    });
    bb.on("finish", () => resolve(files));
    bb.on("error", reject);
    req.pipe(bb);
  });
}

async function gemini(parts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is missing in Vercel Environment Variables.");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }] })
    }
  );

  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error(`Gemini returned HTTP ${response.status}: ${raw.slice(0,200)}`); }

  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini API error ${response.status}`);
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map(p => p.text || "").join("") || "";

  if (!text) throw new Error("Gemini returned no text.");
  return text;
}

async function transcribeFile(file) {
  const base64 = file.buffer.toString("base64");
  return gemini([
    {
      text:
        "Extract the readable book text from this uploaded document/page. " +
        "Preserve paragraphs and dialogue. Remove page numbers and obvious scan artifacts. " +
        "Return ONLY the book text. Do not describe the image or document."
    },
    {
      inlineData: {
        mimeType: file.type,
        data: base64
      }
    }
  ]);
}

function clean(text) {
  return text
    .replace(/\r/g, "")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function refine(text) {
  // Keep this MVP bounded. Chapter-wise processing will remove this limit later.
  const source = text.slice(0, 60000);

  return gemini([{
    text:
      "You are an expert audiobook story editor. Rewrite the supplied book text " +
      "into polished, natural spoken storytelling. Preserve characters, events, " +
      "chronology, facts and meaning. Fix obvious OCR errors. Remove headers, " +
      "footers, page numbers and repetitive artifacts. Improve transitions and " +
      "dialogue readability. Do not invent major events. Return ONLY the finished narration.\n\n" +
      "BOOK TEXT:\n" + source
  }]);
}

export default async function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST required" });
  }

  try {
    const files = await readMultipart(req);

    if (!files.length) {
      return res.status(400).json({ error: "No files were uploaded." });
    }

    // Basic guard against accidentally huge uploads on the free MVP.
    const totalBytes = files.reduce((n, f) => n + f.buffer.length, 0);
    if (totalBytes > 15 * 1024 * 1024) {
      return res.status(413).json({
        error: "Upload is over the 15 MB MVP limit. Use a smaller PDF or fewer page images."
      });
    }

    let extracted = "";
    for (const file of files) {
      extracted += "\n\n" + await transcribeFile(file);
    }

    extracted = clean(extracted);
    if (!extracted) {
      return res.status(422).json({ error: "No readable text was found." });
    }

    const story = await refine(extracted);

    return res.status(200).json({
      title: files.length === 1
        ? files[0].name.replace(/\.[^.]+$/, "")
        : "Untitled Story",
      pages: files.length,
      words: extracted.split(/\s+/).filter(Boolean).length,
      story
    });
  } catch (error) {
    console.error("STORYTELLER_API_ERROR", error);
    return res.status(500).json({
      error: error?.message || "The Vercel processing function failed."
    });
  }
}