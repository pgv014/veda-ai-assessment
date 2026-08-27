import { NextResponse } from 'next/server';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function gemini(prompt: string, image: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const base64 = image.replace(/^data:image\/[^;]+;base64,/, '');
  const mimeType = image.match(/^data:(image\/[^;]+);/)?.[1] || 'image/jpeg';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({contents:[{parts:[{text:prompt},{inline_data:{mime_type:mimeType,data:base64}}]}], generationConfig:{temperature:0.1,responseMimeType:'application/json'}})
  });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('') || '{}';
  return JSON.parse(text.replace(/^```json\s*/,'').replace(/\s*```$/,''));
}

function demoQuestions(page:number) { return {questions:[{label:'1',text:'Explain the difference between supervised and unsupervised learning.',marks:5,sourcePage:page},{label:'2',text:'Write two advantages of using a relational database.',marks:4,sourcePage:page},{label:'3 (a)',text:'What is an API?',marks:3,sourcePage:page},{label:'3 (b)',text:'Give one real-world example of an API.',marks:3,sourcePage:page}]}; }
function demoAnswers(page:number) { return {answers:[{label:'1',text:'Supervised learning uses labelled data while unsupervised learning finds patterns in data without labels.',regions:[{page,x:100,y:170,width:780,height:105}]},{label:'3 (b)',text:'A weather application calling a weather service API is one example.',regions:[{page,x:120,y:510,width:730,height:90}]},{label:'2',text:'Relational databases provide structured tables and support reliable relationships and queries.',regions:[{page,x:110,y:310,width:760,height:100}]}]}; }

export async function POST(req: Request) {
  try {
    const {type,image,page} = await req.json();
    if (!image || !type) return NextResponse.json({error:'Missing analysis input.'},{status:400});
    const prompt = type === 'questions' ? `You are an assessment document parser. Inspect this printed question-paper page. Return JSON only: {"questions":[{"label":"1","text":"...","marks":5,"sourcePage":${page}}]}. Extract EVERY distinct question in printed reading order. Treat labelled subparts such as 11(a), 11(b), (i), (ii) as separate entries while preserving their original label. Do not invent questions. Ignore instructions, headers, page numbers and decorative text. Keep question wording faithful. If marks are visible, include them; otherwise omit marks.` : `You are a handwriting assessment parser. Inspect this student's handwritten answer-sheet page. Return JSON only: {"answers":[{"label":"1","text":"transcription","regions":[{"page":${page},"x":100,"y":100,"width":800,"height":100}]}]}. Find every answer block. The label is the question number/subpart written by the student when visible. Transcribe readable handwriting. For each answer, return one or more bounding boxes around the actual handwritten answer region, using coordinates normalized to 0-1000 from the top-left of this page. Include multi-line answers in a box covering all lines. Ignore margins, headers and unrelated scribbles. If the answer has no visible question label, use a best-effort label such as "unlabeled".`;
    const result = await gemini(prompt,image);
    if (result) return NextResponse.json(result);
    return NextResponse.json(type === 'questions' ? demoQuestions(page) : demoAnswers(page));
  } catch (e:any) { return NextResponse.json({error:e?.message || 'Analysis failed.'},{status:500}); }
}
