'use client';
import {useCallback,useMemo,useState} from 'react';
import {Upload,FileText,Trash2,CheckCircle2,AlertCircle,ChevronRight,RotateCcw,ArrowUpRight} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import type {Question,Answer,Mapping,BBox} from '../lib/types';

if(typeof window!=='undefined'){
  // pdfjs worker is loaded from the package CDN at runtime; this avoids a webpack worker bundle.
  pdfjsLib.GlobalWorkerOptions.workerSrc=`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

type PageImg={page:number;src:string};
const bytes=(n:number)=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;

async function fileToPages(file:File):Promise<PageImg[]>{
 if(file.type==='application/pdf'){
  const data=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data}).promise;const out:PageImg[]=[];
  for(let i=1;i<=pdf.numPages;i++){
   const p=await pdf.getPage(i);const base=p.getViewport({scale:1.5});const max=1500;const scale=Math.min(1,max/base.width);const v=p.getViewport({scale:1.5*scale});
   const c=document.createElement('canvas');c.width=v.width;c.height=v.height;await p.render({canvasContext:c.getContext('2d')!,viewport:v}).promise;out.push({page:i,src:c.toDataURL('image/jpeg',.72)});
  }return out;
 }
 return [{page:1,src:await new Promise<string>(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result as string);fr.readAsDataURL(file)})}];
}

function UploadCard({title,subtitle,file,setFile}:{title:string;subtitle:string;file:File|null;setFile:(f:File|null)=>void}){
 const [drag,setDrag]=useState(false);const onDrop=(e:React.DragEvent)=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files?.[0];if(f)setFile(f)};
 return <div className="upload-card"><div className="upload-head"><div><div className="upload-title">{title}</div><div className="muted" style={{marginTop:4}}>{subtitle}</div></div><FileText size={18} color="#7770d9"/></div>
 <div className={`drop ${drag?'drag':''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}>
  <div className="drop-icon"><Upload size={20}/></div><strong>{file?'File ready to process':'Drop your file here'}</strong><span>PDF, JPG or PNG · handwritten sheets supported</span>
  <label className="browse">{file?'Replace file':'Browse files'}<input hidden type="file" accept="application/pdf,image/*" onChange={e=>{const f=e.target.files?.[0];if(f)setFile(f)}}/></label>
 </div>
 {file&&<div className="file-row"><FileText className="file-icon" size={19}/><div style={{minWidth:0}}><div className="file-name">{file.name}</div><div className="file-size">{bytes(file.size)}</div></div><button className="remove" onClick={()=>setFile(null)}><Trash2 size={16}/></button></div>}
 </div>
}

export default function Home(){
 const [qFile,setQFile]=useState<File|null>(null),[aFile,setAFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[stage,setStage]=useState(''),[error,setError]=useState('');
 const [qPages,setQPages]=useState<PageImg[]>([]),[aPages,setAPages]=useState<PageImg[]>([]),[questions,setQuestions]=useState<Question[]>([]),[answers,setAnswers]=useState<Answer[]>([]),[maps,setMaps]=useState<Mapping[]>([]),[selected,setSelected]=useState<string|null>(null);
 const selectedQ=questions.find(q=>q.id===selected)||questions[0];
 const selectedMap=maps.find(m=>m.questionId===selectedQ?.id);const selectedAnswer=answers.find(a=>a.id===selectedMap?.answerId);
 const counts=useMemo(()=>({answered:maps.filter(m=>m.answerId).length,unanswered:maps.filter(m=>!m.answerId).length,total:questions.length,unmatched:answers.filter(a=>!maps.some(m=>m.answerId===a.id)).length}),[maps,questions,answers]);
 const process=useCallback(async()=>{
  if(!qFile||!aFile)return;setBusy(true);setError('');setProgress(3);
  try{
   setStage('Rendering documents');const qp=await fileToPages(qFile),ap=await fileToPages(aFile);setQPages(qp);setAPages(ap);setProgress(10);
   const qs:any[]=[];for(let i=0;i<qp.length;i++){setStage(`Extracting questions · page ${i+1}/${qp.length}`);const r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'questions',image:qp[i].src,page:i+1})});const d=await r.json();if(!r.ok)throw Error(d.error);qs.push(...(d.questions||[]));setProgress(10+Math.round(((i+1)/qp.length)*35));}
   const finalQ=qs.map((q,i)=>({...q,id:`q${i+1}`,sourcePage:q.sourcePage||1}));setQuestions(finalQ);if(finalQ[0])setSelected(finalQ[0].id);
   const ans:any[]=[];for(let i=0;i<ap.length;i++){setStage(`Reading handwriting · page ${i+1}/${ap.length}`);const r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'answers',image:ap[i].src,page:i+1})});const d=await r.json();if(!r.ok)throw Error(d.error);ans.push(...(d.answers||[]));setProgress(45+Math.round(((i+1)/ap.length)*35));}
   const finalA=ans.map((a,i)=>({...a,id:`a${i+1}`,regions:(a.regions||[]).map((x:any)=>({...x,page:x.page||1}))}));setAnswers(finalA);
   setStage('Mapping answers and generating feedback');const r=await fetch('/api/map',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questions:finalQ,answers:finalA})});const d=await r.json();if(!r.ok)throw Error(d.error);setMaps(d.mappings||[]);setProgress(100);setStage('Review ready');
  }catch(e:any){setError(e.message||'Something went wrong.');setStage('Processing failed')}finally{setBusy(false)}
 },[qFile,aFile]);
 if(questions.length>0)return <Review questions={questions} answers={answers} maps={maps} selected={selectedQ?.id||null} setSelected={setSelected} qPages={qPages} aPages={aPages} selectedAnswer={selectedAnswer} selectedMap={selectedMap} counts={counts} reset={()=>{setQuestions([]);setAnswers([]);setMaps([]);setQPages([]);setAPages([]);setSelected(null)}}/>;
 return <div className="shell"><header className="topbar"><div className="brand"><div className="logo">V</div>VedaAI</div><div className="top-actions"><span className="pill">Assessment workspace</span></div></header><main className="main"><div className="hero"><div><div className="eyebrow">AI Assessment Review</div><h1 className="title">Extract, map & review answers</h1><p className="sub">Upload a question paper and handwritten answer sheet. VedaAI finds every question, maps answers and highlights exactly where they appear.</p></div></div>
 <div className="upload-grid"><UploadCard title="Question paper" subtitle="The printed assessment" file={qFile} setFile={setQFile}/><UploadCard title="Student answer sheet" subtitle="Handwritten responses" file={aFile} setFile={setAFile}/></div>
 {busy&&<div className="process"><div className="process-row"><div className="spinner"/><div><b>{stage}</b><div className="muted" style={{marginTop:3}}>AI extraction and mapping are running in sequence.</div></div><b style={{marginLeft:'auto'}}>{progress}%</b></div><div className="progress"><div className="bar" style={{width:`${progress}%`}}/></div></div>}
 {error&&<div className="error"><AlertCircle size={15} style={{verticalAlign:'-3px',marginRight:7}}/>{error}</div>}
 <div className="notice">Tip: For the strongest region highlighting, upload a clear scan or photo with the full page visible and minimal glare.</div>
 <div style={{marginTop:22,display:'flex',justifyContent:'flex-end'}}><button className="primary" disabled={!qFile||!aFile||busy} onClick={process}>{busy?'Processing…':'Start assessment review'} <ArrowUpRight size={15} style={{verticalAlign:'-3px',marginLeft:5}}/></button></div>
 </main></div>
}

function Review({questions,answers,maps,selected,setSelected,qPages,aPages,selectedAnswer,selectedMap,counts,reset}:{questions:Question[];answers:Answer[];maps:Mapping[];selected:string|null;setSelected:(s:string)=>void;qPages:PageImg[];aPages:PageImg[];selectedAnswer?:Answer;selectedMap?:Mapping;counts:{answered:number;unanswered:number;total:number;unmatched:number};reset:()=>void}){
 return <div className="shell"><header className="topbar"><div className="brand"><div className="logo">V</div>VedaAI</div><div className="top-actions"><button className="secondary" onClick={reset}><RotateCcw size={14} style={{verticalAlign:'-2px',marginRight:5}}/>New assessment</button></div></header><main className="main"><div className="review"><aside className="sidebar"><div className="side-head"><div className="eyebrow">Assessment summary</div><div className="score"><b>{counts.answered}</b><span className="muted">/ {counts.total} answered</span></div><div className="stat-grid"><div className="stat"><b>{counts.total}</b><span>Questions</span></div><div className="stat"><b>{counts.answered}</b><span>Mapped</span></div><div className="stat"><b>{counts.unanswered}</b><span>Unanswered</span></div><div className="stat"><b>{counts.unmatched}</b><span>Unmatched</span></div></div></div><div className="q-list">{questions.map((q,i)=>{const m=maps.find(x=>x.questionId===q.id);return <button key={q.id} className={`q-item ${selected===q.id?'active':''}`} onClick={()=>setSelected(q.id)}><div className="q-num">{i+1}</div><div className="q-main"><div className="q-label">{q.label}</div><div className="q-preview">{q.text}</div></div><span className={`status-dot ${!m?.answerId?'warn':''}`}/><ChevronRight size={14} color="#aaa"/></button>})}{counts.unmatched>0&&<div className="unmatched"><b>Unmatched answers</b>{answers.filter(a=>!maps.some(m=>m.answerId===a.id)).map(a=><div key={a.id} className="unmatched-row"><span>{a.label}</span><small>{a.text}</small></div>)}</div>}</div></aside>
 <section className="workspace"><div className="work-head"><div><div className="work-title">Answer mapping</div><div className="muted" style={{marginTop:3}}>Click a question to jump to its handwritten answer region.</div></div><div className="toolbar"><span className="tag">{selectedMap?.confidence?`${Math.round(selectedMap.confidence*100)}% match`:'No answer'}</span></div></div><div className="work-body"><div className="question-pane"><div className="label">Question {selectedQIndex(questions,selected)}</div><div className="question-text">{questions.find(q=>q.id===selected)?.text||'Select a question'}</div><div className="meta"><span className="tag">{questions.find(q=>q.id===selected)?.label}</span>{selectedMap?.answerId?<span className="tag">Answered</span>:<span className="tag" style={{background:'#fff5df',color:'#a56e00'}}>Unanswered</span>}</div>{selectedMap&&<div style={{marginTop:25}}><div className="label">AI review</div><div style={{fontSize:14,lineHeight:1.6,marginTop:10}}>{selectedMap.feedback||'No feedback generated.'}</div><div style={{marginTop:16,fontSize:13,color:'#686b7b'}}><b>Score:</b> {selectedMap.marks ?? '—'}{questions.find(q=>q.id===selected)?.marks?` / ${questions.find(q=>q.id===selected)?.marks}`:''}</div><div className="notice"><b>Mapping rationale:</b> {selectedMap.reason}</div></div>}</div><div className="answer-pane"><div className="label">Student answer sheet</div><div className="answer-scroll" style={{marginTop:12}}>{aPages.map(p=><div className="page" key={p.page}><img src={p.src}/><div className="page-num">Page {p.page}</div>{selectedAnswer?.regions.filter(r=>r.page===p.page).map((r,i)=><div key={i} className="highlight" style={{left:`${r.x/10}%`,top:`${r.y/10}%`,width:`${r.width/10}%`,height:`${r.height/10}%`}}/>)}</div>)}{!selectedAnswer&&<div className="empty">No mapped answer for this question.<br/>The question is currently marked unanswered.</div>}</div></div></div></section></div></main></div>
}
function selectedQIndex(qs:Question[],id:string|null){const i=qs.findIndex(q=>q.id===id);return i<0?'—':i+1}
