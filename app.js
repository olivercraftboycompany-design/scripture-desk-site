'use strict';
const $=id=>document.getElementById(id), KEY='scripture-desk:v1:';
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(KEY+k))??d}catch{return d}};
const put=(k,v)=>{try{localStorage.setItem(KEY+k,JSON.stringify(v));return true}catch{return false}};
let library=[], ed, book, chapter, rows=[], marks=get('marks',[]), mode='explain', ai=false, bibleyReady=false, version=0, openInstall, pending=null;
const files=new Map();
async function local(path){const r=await fetch(path,{signal:AbortSignal.timeout?AbortSignal.timeout(15000):undefined});if(!r.ok)throw Error('read');return r.json()}
function fill(sel, values, selected){sel.replaceChildren(...values.map(([value,label])=>new Option(label,value)));sel.value=selected}
const ref=()=>`${book.name} ${chapter==='P'?'Prologue':chapter}`;
const current=()=>({edition:ed.id,book:book.id,chapter});
const same=(a,b)=>a.edition===b.edition&&a.book===b.book&&a.chapter===b.chapter;
const identity=x=>!!x&&typeof x.edition==='string'&&typeof x.book==='string'&&typeof x.chapter==='string';
const shortEdition={protestant:'WEB',catholic:'CPDV',vulgate:'Vulgate','orthodox-en':'Brenton/WEB','orthodox-ru':'Synodal',douay:'D–R'};
const sourceTitle={CPDV:'Catholic Public Domain Version',VULG:'Clementine Vulgate',LXXE:'Brenton Septuagint (1851)',WEB:'World English Bible',SYNOD:'Russian Synodal Bible',DRB:'Douay–Rheims'};
function moveFocus(){ $('reader').focus({preventScroll:true}); $('title').scrollIntoView({block:'start'}); }
function setBookmark(){const on=marks.some(x=>same(x,current()));$('bookmark').setAttribute('aria-pressed',on);$('bookmark').setAttribute('aria-label',on?'Remove chapter bookmark':'Bookmark this chapter');$('menu-mark-text').textContent=on?'Remove chapter bookmark':'Bookmark this chapter';$('menu-bookmark').setAttribute('aria-pressed',on)}
function status(t){$('status').textContent=t}
function hashSelection(){const a=new URLSearchParams(location.hash.slice(1));return a.has('edition')?{edition:a.get('edition'),book:a.get('book'),chapter:a.get('chapter'),verse:a.get('verse')}:null}
function navigate(selection={}, verse=null, focus=false){
  pending?.abort(); pending=null;
  ed=library.find(e=>e.id===selection.edition)||library.find(e=>e.id==='protestant')||library[0];book=ed.books.find(b=>b.id===selection.book)||ed.books[0];
  chapter=book.chapters.includes(selection.chapter)?selection.chapter:book.chapters[0];
  const state=current(); put('last',state);
  const hash=new URLSearchParams(state);if(verse)hash.set('verse',verse);history.replaceState(null,'','#'+hash);
  const step=++version; rows=[]; $('jump-note').textContent=''; $('verses').replaceChildren(); const chapterLabel=chapter==='P'?'Prologue':chapter;const index=document.createElement('span');index.className='chapter-index';index.textContent=chapterLabel;$('title').replaceChildren(book.name+' ',index);$('current-chapter').textContent=ref();$('current-edition').textContent=shortEdition[ed.id]||ed.tag;document.title=ref()+' · Scripture Desk';$('edition-tag').textContent=ed.tag;
  $('edition-note').textContent=ed.note;setBookmark();
  fill($('edition'),library.map(e=>[e.id,e.label]),ed.id);fill($('book'),ed.books.map(b=>[b.id,b.name]),book.id);
  fill($('chapter'),book.chapters.map(c=>[c,c==='P'?'Prologue':c]),chapter);
  $('prev').disabled=ed.books[0]===book&&book.chapters[0]===chapter;
  $('next').disabled=ed.books.at(-1)===book&&book.chapters.at(-1)===chapter;
  const cp=book.source==='CPDV', name=sourceTitle[book.source]; const link=document.createElement('a');
  link.href=cp?'https://www.sacredbible.org/catholic/':'https://bolls.life/';link.target='_blank';link.rel='noopener noreferrer';link.textContent=cp?'SacredBible.org':'Bolls Bible';$('source-tag').textContent=`${name} · ${cp?'SacredBible.org':'Bolls.life'}`;
  $('credit').replaceChildren(`${name} · Source: `,link,'. Verse numbering can vary by edition.');
  render(step,book,chapter,verse,focus);
}
async function render(step,b,c,target,focus){
  const path=`data/${b.source}/${b.id}.json`;status('Loading passage…');
  try{
    if(focus&&!target)moveFocus();
    if(!files.has(path))files.set(path,local(path).catch(err=>{files.delete(path);throw err}));
    const res=await files.get(path);
    if(step!==version)return;
    if(!Array.isArray(res[c])||!res[c].length)throw Error('chapter');
    rows=res[c];const frag=document.createDocumentFragment();
    let hit;
    for(const [n,text] of rows){const p=document.createElement('p'), v=document.createElement('sup'); v.textContent=n; p.append(v,document.createTextNode(text));
      if(target&&String(n)===String(target)&&!hit){hit=p;p.className='target';p.tabIndex=-1;}
      frag.append(p);
    }
    $('verses').replaceChildren(frag);status('');
    if(hit){hit.focus({preventScroll:true});hit.scrollIntoView({block:'center'});}else if(target){status(`Verse ${target} isn’t numbered that way in this edition.`);}
  }catch(e){if(step!==version)return;status('This passage isn’t available offline yet. Reconnect, then retry.');const btn=document.createElement('button');btn.textContent='Retry passage';btn.onclick=()=>render(step,b,c,target,focus);$('verses').replaceChildren(btn);}
}
function shift(d){let i=ed.books.indexOf(book),j=book.chapters.indexOf(chapter)+d;if(book.chapters[j])return navigate({...current(),chapter:book.chapters[j]},null,true);const adjacent=ed.books[i+d];if(adjacent)navigate({edition:ed.id,book:adjacent.id,chapter:d<0?adjacent.chapters.at(-1):adjacent.chapters[0]},null,true)}
const normalize=s=>s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\d]/gu,'');
$('jump').onsubmit=e=>{
 e.preventDefault();if(!ed)return;const m=$('reference').value.trim().match(/^(.+?)\s+(\d+|prologue)(?::(\d+))?$/i);
 const b=m&&ed.books.find(b=>[b.name,...b.aliases].some(a=>normalize(a)===normalize(m[1])));
 const c=m&&(m[2].toLowerCase()==='prologue'?'P':String(Number(m[2])));
 if(!b||!b.chapters.includes(c)){$('jump-note').textContent='Try a book and chapter in this edition, such as John 3:16.';return}
 if($('library').open)$('library').close();
 navigate({edition:ed.id,book:b.id,chapter:c},m[3]?String(Number(m[3])):null,true);
};
$('edition').onchange=()=>navigate({edition:$('edition').value});
$('book').onchange=()=>navigate({edition:ed.id,book:$('book').value});
$('chapter').onchange=()=>navigate({...current(),chapter:$('chapter').value});
$('return-reader').onclick=moveFocus;
$('menu-bookmark').onclick=()=>{if(!ed)return;$('bookmark').click();};
function openDialog(id,button){const old=button.closest('dialog');if(old?.open)old.close();const dialog=$(id);if(!dialog.open)dialog.showModal();if(button.dataset.focus)$(button.dataset.focus).focus();else if(button.id==='edition-trigger')$('edition').focus();}
for(const button of document.querySelectorAll('[data-open]'))button.onclick=()=>openDialog(button.dataset.open,button);
$('prev').onclick=()=>shift(-1);$('next').onclick=()=>shift(1);
$('bookmark').onclick=()=>{if(!ed)return;const s=current(), old=marks.findIndex(x=>same(x,s));const updated=old<0?[{...s,label:ref()},...marks].slice(0,500):marks.filter((_,i)=>i!==old);if(put('marks',updated)){marks=updated;setBookmark()}else status('This device isn’t allowing bookmarks to be saved.');};
function savedList(){const list=$('saved-list');list.replaceChildren();if(!marks.length)list.textContent='No bookmarks yet. Use the bookmark beside a chapter title.';for(const mark of marks){const e=library.find(x=>x.id===mark.edition);if(!e)continue;const row=document.createElement('div');row.className='saved-row';const open=document.createElement('button'),del=document.createElement('button');open.textContent=mark.label+' · '+e.tag;open.onclick=()=>{$('saved').close();navigate(mark,null,true);};del.textContent='Remove';del.setAttribute('aria-label','Remove bookmark for '+mark.label);del.onclick=()=>{const updated=marks.filter(x=>!same(x,mark));if(put('marks',updated)){marks=updated;savedList();if(ed)setBookmark()}};row.append(open,del);list.append(row);}}
for(const button of document.querySelectorAll('[data-panel]'))button.onclick=()=>{if(!ed)return;const id=button.dataset.panel;if(id==='saved')savedList();else{$('study-ref').textContent=ref()+' · '+ed.tag; $('copy').disabled=!rows.length;cleanStudy();if(ai==='bibley')checkBibley();}openDialog(id,button)};
for(const button of document.querySelectorAll('.close'))button.onclick=()=>button.closest('dialog').close();
$('study').addEventListener('close',()=>{pending?.abort();pending=null});
function bibleyRef(){
 if(!ed||!rows.length||chapter==='P')return null;
 const match=library.find(x=>x.id==='protestant')?.books.find(x=>x.id===book.id&&x.chapters.includes(chapter));
 const target=Number(hashSelection()?.verse), selected=Number.isInteger(target)&&target>0&&rows.some(([n])=>Number(n)===target);
 const start=selected?target:Number(rows[0][0]), end=selected?target:Number(rows.at(-1)[0]);
 if(!match||!Number.isInteger(start)||start<1)return null;
 return `${match.name} ${chapter}:${start}${Number.isInteger(end)&&end>start?'-'+Math.min(end,start+11):''}`;
}
function refreshBibley(){
 const ref=bibleyRef(), allowed=mode!=='compare'&&!!ref;
 $('ask').disabled=!bibleyReady||!allowed||!!pending;
 if(!allowed)$('ai-feedback').textContent=mode==='compare'?'Bibley uses the KJV only. Copy the prompt to compare traditions elsewhere.':'This passage is outside Bibley’s KJV library. You can still copy the study prompt.';
}
async function checkBibley(){
 try{const s=await local('api/bibley/status');bibleyReady=s.ready===true;$('ai-state').textContent=bibleyReady?'Bibley is ready. Its KJV-based commentary is separate from the edition you’re reading.':s.status==='starting'?'Bibley is loading. Check again when the Bibley window says Ready.':s.status==='error'?'Bibley couldn’t load. Check its Terminal window.':'Start Bibley on this computer, then check again.';}
 catch{bibleyReady=false;$('ai-state').textContent='The local Bibley connection is unavailable.';}
 $('bibley-check').hidden=bibleyReady;refreshBibley();
}
$('bibley-check').onclick=checkBibley;
function cleanStudy(){
 $('prompt-preview').hidden=true;$('ai-answer').hidden=true;$('ai-feedback').textContent='';
 $('ask').disabled=!rows.length;if(ai==='bibley')refreshBibley();
 if(!$('bibley-local').hidden)$('bibley-open').hash=location.hash;
}
const modeText={explain:'Explain this passage in context. Cite verse numbers and distinguish the passage from interpretation.',compare:'Compare Catholic and Eastern Orthodox readings of this passage if supported. Acknowledge variation and avoid inventing quotations or attributing unsupported views.',reflect:'Offer two open-ended reflection questions tied to verse numbers. Distinguish reflection from Scripture.'};
for(const button of document.querySelectorAll('[data-mode]'))button.onclick=()=>{if(mode!==button.dataset.mode){pending?.abort();pending=null;}mode=button.dataset.mode;for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',b===button);cleanStudy()};
function payload(){return {mode,reference:ref(),edition:ed.label,source:sourceTitle[book.source],question:$('question').value.trim(),verses:rows.map(([number,text])=>({number:String(number),text}))}}
$('copy').onclick=async()=>{if(!rows.length)return;const p=payload();const prompt=`${modeText[p.mode]}\n${p.question?'Question: '+p.question+'\n':''}\nPassage: ${p.reference} (${p.source})\n${p.verses.map(v=>v.number+' '+v.text).join('\n')}`;
 try{await navigator.clipboard.writeText(prompt);$('ai-feedback').textContent='Study prompt copied.';}catch{$('prompt-preview').hidden=false;$('prompt-preview').value=prompt;$('prompt-preview').select();$('ai-feedback').textContent='Select and copy the study prompt.';}};
$('ask').onclick=async()=>{
 if(!ai||!rows.length||pending||(ai==='bibley'&&(!bibleyReady||mode==='compare'||!bibleyRef())))return;
 const ctl=new AbortController(), usingBibley=ai==='bibley';pending=ctl;cleanStudy();$('ask').disabled=true;
 $('ai-feedback').textContent=usingBibley?'Bibley is thinking…':'Waiting for your AI…';
 const timeout=setTimeout(()=>ctl.abort(),usingBibley?120000:45000);
 try{
  const endpoint=usingBibley?'api/bibley/study':'api/study';
  const data=usingBibley?{mode,reference:bibleyRef(),question:$('question').value.trim()}:payload();
  const headers={'Content-Type':'application/json'};if(usingBibley)headers['X-Scripture-Desk']='bibley-v1';
  const res=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(data),signal:ctl.signal,credentials:'same-origin',redirect:'error'});
  if(!res.ok)throw Error(res.status===503?'starting':res.status===429?'busy':'failed');
  const reply=await res.json();if(typeof reply.answer!=='string'||!reply.answer.trim())throw Error('invalid');if(pending!==ctl)return;
  $('ai-answer').textContent=reply.answer.slice(0,30000);$('ai-answer').hidden=false;
  $('ai-feedback').textContent=usingBibley?'Bibley commentary · KJV references · not Scripture':'AI commentary · not Scripture';
 }catch(err){if(pending===ctl)$('ai-feedback').textContent=err.message==='starting'?'Bibley is still starting. Try again when it’s ready.':err.message==='busy'?'Bibley is finishing another question. Try again shortly.':usingBibley?'Bibley couldn’t answer. Check that it’s still running and try again.':'Your AI couldn’t answer. Try again in a moment.';}
 finally{clearTimeout(timeout);if(pending===ctl){pending=null;if(usingBibley)refreshBibley();else $('ask').disabled=false;}}
};
function applyPrefs(){for(const [k,a,b,id] of [['large','Smaller text','Larger text','text-size'],['dark','Light mode','Dark mode','theme']]){const on=get(k,k==='dark');document.body.classList.toggle(k,on);$(id).textContent=on?a:b;if(k==='dark')document.querySelector('meta[name=theme-color]').content=on?'#1c1916':'#f7f2e8';$(id).onclick=()=>{put(k,!on);applyPrefs()}}}
window.addEventListener('hashchange',()=>{if(library.length){const s=hashSelection();if(s)navigate(s,s.verse,true)}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();openInstall=e;$('install').hidden=false;$('install-group').hidden=false});
$('install').onclick=async()=>{if(openInstall){await openInstall.prompt();openInstall=null;$('install').hidden=true;$('install-group').hidden=true}};
if('serviceWorker' in navigator&&location.hostname!=='appassets.androidplatform.net')window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
applyPrefs();
if(location.protocol==='https:'&&location.hostname!=='appassets.androidplatform.net'&&location.hostname!=='127.0.0.1'&&location.hostname!=='localhost')$('bibley-local').hidden=false;
local('ai-config.json').then(c=>{
 if(c.enabled!==true||location.hostname==='appassets.androidplatform.net')return;
 ai=c.provider==='bibley'?'bibley':true;$('ask').hidden=false;$('ai-privacy').hidden=false;$('bibley-local').hidden=true;
 $('ai-state').textContent='AI commentary is separate from Scripture. Check citations against the passage.';
 if(ai==='bibley'){
  $('ask').textContent='Ask Bibley';$('ai-privacy').textContent='Only your question and a verse reference go to Bibley on this computer. Bibley keeps them in memory until it closes.';
  if($('study').open)checkBibley();else refreshBibley();
 }
}).catch(()=>{});
local('data/library.json').then(data=>{library=data;if(!library.length)throw Error('empty');const h=hashSelection();navigate(h||(identity(get('last',null))?get('last'):{}),h?.verse);}).catch(()=>status('Couldn’t open the library. Reload this page while connected.'));
