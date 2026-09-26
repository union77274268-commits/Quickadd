import Busboy from "busboy";
import { PDFParse } from "pdf-parse";

export const config={api:{bodyParser:false}};
const MODEL=process.env.GEMINI_MODEL||"gemini-2.5-flash-lite";

function filesFrom(req){return new Promise((resolve,reject)=>{const bb=Busboy({headers:req.headers});const out=[];bb.on("file",(n,s,i)=>{const c=[];s.on("data",x=>c.push(x));s.on("end",()=>out.push({name:i.filename,type:i.mimeType,buffer:Buffer.concat(c)}))});bb.on("finish",()=>resolve(out));bb.on("error",reject);req.pipe(bb)})}

async function gemini(contents){
 const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:contents}]})});
 const d=await r.json();if(!r.ok)throw Error(d.error?.message||"Gemini request failed");return d.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";
}
async function extract(file){
 if(file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf")){
   const p=new PDFParse({data:file.buffer});const r=await p.getText();return r.text||"";
 }
 const base=file.buffer.toString("base64");
 return await gemini([{text:"Transcribe this page accurately. Return only the visible book text. Preserve paragraphs and dialogue. Do not describe the image."},{inlineData:{mimeType:file.type||"image/jpeg",data:base}}]);
}
function clean(t){return t.replace(/\r/g,"").replace(/(\w)-\n(\w)/g,"$1$2").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim()}
async function refine(text){
 const limit=60000;const source=text.length>limit?text.slice(0,limit):text;
 return await gemini([{text:`You are an audiobook story editor. Transform the supplied book text into polished spoken storytelling. Preserve characters, events, chronology, facts and meaning. Fix obvious OCR errors. Remove headers, footers, page numbers and repetitive artifacts. Improve transitions and dialogue readability. Do not invent major events. Make it engaging when spoken aloud. Return ONLY the finished narration.\n\nBOOK TEXT:\n${source}`}]);
}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"POST required"});
 if(!process.env.GEMINI_API_KEY)return res.status(500).json({error:"GEMINI_API_KEY is missing"});
 try{const fs=await filesFrom(req);if(!fs.length)return res.status(400).json({error:"No files uploaded"});
 let text="";for(const f of fs)text+="\n\n"+await extract(f);text=clean(text);if(!text)return res.status(422).json({error:"No readable text found"});
 const story=await refine(text);return res.status(200).json({title:fs.length===1?fs[0].name.replace(/\.[^.]+$/,""):"Untitled Story",pages:fs.length,words:text.split(/\s+/).filter(Boolean).length,story});
 }catch(e){console.error(e);return res.status(500).json({error:e.message||"Processing failed"})}
}