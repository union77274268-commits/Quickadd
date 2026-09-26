const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let currentBook=null, speaking=false, utterance=null, startedAt=0, elapsedTimer=null;

const state=JSON.parse(localStorage.getItem("storyteller_state")||'{"books":[],"settings":{}}');
$("#endpoint").value=state.settings.endpoint||"";
$("#apiKey").value=state.settings.apiKey||"";

function save(){localStorage.setItem("storyteller_state",JSON.stringify(state));}
function go(id){$$(".screen").forEach(x=>x.classList.toggle("active",x.id===id));$$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.go===id));window.scrollTo(0,0)}
$$("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));

$("#themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("dark",document.body.classList.contains("dark"))};
if(localStorage.getItem("dark")==="true")document.body.classList.add("dark");

function renderLibrary(){
 const lib=$("#library"); $("#bookCount").textContent=`${state.books.length} book${state.books.length===1?"":"s"}`;
 if(!state.books.length){lib.className="library empty";lib.innerHTML='<div class="empty-state">Your processed books will appear here.</div>';return}
 lib.className="library";lib.innerHTML=state.books.map((b,i)=>`<div class="book-item"><div class="book-thumb">📖</div><div class="info"><strong>${esc(b.title)}</strong><small>${b.pages} pages · ${b.words.toLocaleString()} words</small></div><button data-open="${i}">Listen</button></div>`).join("");
 $$("[data-open]").forEach(x=>x.onclick=()=>openBook(+x.dataset.open));
}
function esc(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
renderLibrary();

$("#fileInput").onchange=async e=>{
 const files=[...e.target.files]; if(!files.length)return;
 currentBook={title:files.length===1?files[0].name.replace(/\.[^.]+$/,""):"Untitled book",files,pages:files.length,words:0,text:""};
 $("#processTitle").textContent=currentBook.title;$("#processMeta").textContent=`${files.length} page file${files.length>1?"s":""}`;
 go("process"); await processFiles(files);
 e.target.value="";
};

async function processFiles(files){
 setStep("extract",0); let chunks=[];
 for(let i=0;i<files.length;i++){
   $("#processStatus").textContent=`Reading page ${i+1} of ${files.length}…`;
   addPage(i+1);
   let text="";
   if(files[i].type==="application/pdf"||files[i].name.toLowerCase().endsWith(".pdf")) text=await extractPdf(files[i]);
   else text=await ocrImage(files[i]);
   chunks.push(text);
   setProgress((i+1)/files.length*.48);
 }
 setStep("clean",1);$("#processStatus").textContent="Cleaning and structuring the extracted text…";
 const raw=chunks.join("\n\n"); await wait(350);
 const clean=cleanText(raw); currentBook.text=clean;currentBook.words=clean.split(/\s+/).filter(Boolean).length;
 setProgress(.62);
 setStep("story",1);$("#processStatus").textContent="Refining the text into a natural story narration…";await wait(600);
 currentBook.story=refineStory(clean);setProgress(.82);
 setStep("voice",1);$("#processStatus").textContent="Preparing narration…";await wait(450);
 setProgress(1); setStep("voice",1);$("#processStatus").textContent="Ready — your story is waiting.";
 state.books.unshift({title:currentBook.title,pages:files.length,words:currentBook.words,text:currentBook.text,story:currentBook.story});
 state.books=state.books.slice(0,20);save();renderLibrary();
 setTimeout(()=>openBook(0),450);
}

async function extractPdf(file){
 try{
   const pdfjs=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
   pdfjs.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
   const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let out=[];
   for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p);const c=await page.getTextContent();out.push(c.items.map(x=>x.str).join(" "))}
   return out.join("\n\n");
 }catch(e){return `[PDF extraction failed: ${e.message}]`;}
}
async function ocrImage(file){
 try{
   const {createWorker}=await import("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js");
   const worker=await createWorker("eng");
   const r=await worker.recognize(await file.arrayBuffer());
   await worker.terminate(); return r.data.text;
 }catch(e){return `[OCR unavailable: ${e.message}]`;}
}
function cleanText(t){
 return t.replace(/\r/g,"").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n")
   .replace(/(\w)-\n(\w)/g,"$1$2").replace(/\n(?=[a-z])/g," ").trim();
}
function refineStory(t){
 if(!t)return "No readable text was found. Try a clearer PDF or page image.";
 let paras=t.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 paras=paras.filter(x=>!/^page\s+\d+$/i.test(x));
 let out=paras.map(p=>{
   p=p.replace(/\s+/g," ").trim();
   if(p.length<25)return p;
   return p;
 }).join("\n\n");
 return `Let me tell you this story…\n\n${out}`;
}
function setProgress(n){$("#progressBar").style.width=(n*100)+"%"}
function setStep(name,done){const el=$(`[data-step="${name}"]`);if(done)el.classList.add("done")}
function addPage(n){$("#pageStrip").insertAdjacentHTML("beforeend",`<div class="page">Page<br>${n}</div>`)}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}

function openBook(i){
 currentBook=state.books[i];$("#storyTitle").textContent=currentBook.title;
 $("#storyStats").textContent=`${currentBook.pages} pages · ${currentBook.words.toLocaleString()} words`;
 $("#scriptText").textContent=currentBook.story||currentBook.text;
 makeWave();go("story");
}
function makeWave(){const w=$("#wave");w.innerHTML="";for(let i=0;i<74;i++){const x=document.createElement("i");x.style.height=(10+Math.random()*42)+"px";w.appendChild(x)}}
$("#playBtn").onclick=()=>{if(speaking)stopSpeech();else startSpeech()};
$("#rewindBtn").onclick=()=>{stopSpeech();window.speechSynthesis.cancel();startSpeech(0)};
$("#forwardBtn").onclick=()=>{stopSpeech();startSpeech()};
$("#rateSlider").oninput=e=>{$("#rateLabel").textContent=e.target.value+"×";if(speaking){stopSpeech();startSpeech()}};
function startSpeech(){
 if(!("speechSynthesis" in window)){alert("Speech synthesis is not supported in this browser.");return}
 const text=currentBook?.story||currentBook?.text||""; if(!text)return;
 utterance=new SpeechSynthesisUtterance(text);utterance.rate=+$("#rateSlider").value;utterance.pitch=.98;
 const voices=speechSynthesis.getVoices(); if(voices.length) utterance.voice=voices.find(v=>/en-IN|en-US|en-GB/i.test(v.lang))||voices[0];
 utterance.onstart=()=>{speaking=true;$("#playBtn").textContent="Ⅱ";startedAt=Date.now();elapsedTimer=setInterval(updateTime,500)};
 utterance.onend=()=>{speaking=false;$("#playBtn").textContent="▶";clearInterval(elapsedTimer)};
 speechSynthesis.speak(utterance);
}
function stopSpeech(){speechSynthesis.cancel();speaking=false;$("#playBtn").textContent="▶";clearInterval(elapsedTimer)}
function updateTime(){const sec=Math.floor((Date.now()-startedAt)/1000);$("#elapsed").textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`}
$("#copyBtn").onclick=async()=>{await navigator.clipboard.writeText($("#scriptText").textContent);$("#copyBtn").textContent="Copied";setTimeout(()=>$("#copyBtn").textContent="Copy",1200)}
$("#saveSettings").onclick=()=>{state.settings={endpoint:$("#endpoint").value.trim(),apiKey:$("#apiKey").value};save();alert("Settings saved locally.")};
$("#voiceBtn").onclick=()=>alert("The MVP uses your device/browser's available speech voices. Cloud voices can be connected through the backend endpoint.");
$("#styleBtn").onclick=()=>alert("Current style: Refined storyteller. A production AI endpoint can apply deeper scene, dialogue and character-aware rewriting.");
speechSynthesis?.addEventListener?.("voiceschanged",()=>{});
