const uid=()=>Math.random().toString(36).slice(2,9);
// Categorieën staan in S.cats ({name,color}); de volgorde daar is de volgorde overal in de app
const CAT_KLEUREN=['#2f6fb0','#b4552a','#1a7f7a','#7a4bb0','#b0306a','#4d7a1c','#8a5c00','#3949ab','#5c6b7a','#0e7490','#9c3d8f'];
const cats=()=>S.cats.map(c=>c.name);
const catColor=n=>S.cats.find(c=>c.name===n)?.color||'#5c6b7a';
const vrijeKleur=()=>CAT_KLEUREN.find(k=>!S.cats.some(c=>c.color===k))||CAT_KLEUREN[S.cats.length%CAT_KLEUREN.length];
const catRank=cid=>{const c=S.cards.find(x=>x.id===cid);return c?S.cats.findIndex(x=>x.name===c.cat):99};
// volgorde van de categorieën; binnen een categorie blijft de eigen volgorde
const sortItems=sc=>sc.items.sort((a,b)=>catRank(a.card)-catRank(b.card));
let catFilter='Alle';
let folded=Opslag.laadIngeklapt()||{'open-c1':true};
const isF=k=>!!folded[k];
const CHEV=`<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 6l3 3 3-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const foldHead=(k,inner)=>`<button class="fold" data-act="fold" data-k="${k}" aria-expanded="${!isF(k)}">${CHEV}${inner}</button>`;
let S=structuredClone(seed), done={};
// modus: 'laden', 'login', 'server' (ingelogd, gegevens in de database) of 'demo' (alleen deze browser)
let modus='laden', gebruiker=null, opslagStatus='', serverMelding='';
// Nieuwe database: wel de voorbeeldoefeningen en -schema's, maar geen (verzonnen) cliënten
const leegStart=()=>({...structuredClone(seed),clients:[],ratings:[]});
function gebruikGegevens(g,afgevinkt){
  S=g&&g.cards?g:modus==='server'?leegStart():structuredClone(seed);
  // oudere opslag heeft nog geen categorielijst; kaarten met een onbekende categorie krijgen er een
  if(!S.cats)S.cats=structuredClone(seed.cats);
  S.cards.forEach(c=>{if(!S.cats.some(x=>x.name===c.cat))S.cats.push({name:c.cat,color:vrijeKleur()})});
  done=afgevinkt||{};activeClient=S.clients[0]?.id||'';fbClient=activeClient;
  allSchemas().forEach(sortItems);
}
let view='ther', activeClient='c1', fbClient='c1', editSchema=null, editItem=null, sheet=null, linkCard=null, catBeheer=null;
const saveFold=()=>Opslag.bewaarIngeklapt(folded);
const save=()=>{allSchemas().forEach(sortItems);Opslag.bewaarGegevens(S);Opslag.bewaarAfgevinkt(done)};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const initials=n=>n.split(' ').filter(Boolean).map(w=>w[0]).filter(c=>c===c.toUpperCase()).slice(0,2).join('');
const card=id=>S.cards.find(c=>c.id===id);
const allSchemas=()=>[...S.schemas,...S.clients.filter(c=>c.custom).map(c=>c.custom)];
const schemaById=id=>allSchemas().find(s=>s.id===id);
const effective=c=>c.custom||schemaById(c.schema);
const sameDose=(a,b)=>['sets','reps','hold','rest'].every(f=>a[f]===b[f]);
const today=()=>new Date().toISOString().slice(0,10);
const doseText=d=>`${d.sets}×${d.reps}${d.hold?` · ${d.hold}s`:''}`;
const GRIP=`<span class="grip" aria-hidden="true"><svg viewBox="0 0 10 16"><g fill="currentColor"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></g></svg></span>`;

let undoFn=null;
function toast(t,undo){const el=$('#toast');undoFn=undo||null;
  el.innerHTML=esc(t)+(undo?`<button data-act="undo">Ongedaan maken</button>`:'');el.hidden=false;
  clearTimeout(toast.h);toast.h=setTimeout(()=>{el.hidden=true;undoFn=null},undo?5000:1800)}
function snapshot(){const before=JSON.stringify(S);return ()=>{S=JSON.parse(before);save();render();toast('Hersteld')}}

function render(){
  document.body.dataset.modus=modus;
  $('#uitloggen').hidden=modus!=='server';
  voetTekst();
  if(modus==='laden'){$('#app').innerHTML=`<p class="empty" style="margin-top:40px;text-align:center">Laden…</p>`;return}
  if(modus==='login'){$('#app').innerHTML=loginHtml();$('#overlay').innerHTML='';return}
  $('#v-ther').setAttribute('aria-pressed',view==='ther');
  $('#v-cli').setAttribute('aria-pressed',view==='cli');
  $('#app').innerHTML=demoBalk()+(view==='ther'?therapist():client());
  $('#overlay').innerHTML=sheet?sheetHtml():linkCard?linkHtml():imp?importHtml():catBeheer?catBeheerHtml():'';
}
const demoBalk=()=>modus==='demo'?`<p class="demo-balk" role="note"><b>Demo</b> · ${serverMelding?esc(serverMelding)+' ':''}Gegevens worden alleen in deze browser bewaard. Gebruik geen echte namen.</p>`:'';
function voetTekst(){
  const st={bezig:'Opslaan…',opgeslagen:'Opgeslagen ✓',fout:'Niet opgeslagen, nieuwe poging volgt…'}[opslagStatus]||'';
  $('#versie').textContent=[`RugSchema · versie ${VERSIE.nummer} · ${VERSIE.datum}`,gebruiker&&modus==='server'?`ingelogd als ${gebruiker.naam}`:'',modus==='server'?st:''].filter(Boolean).join(' · ');
}

/* ---------- Inloggen ---------- */
function loginHtml(fout=''){
  return `<form class="login" id="login-form" autocomplete="on">
    <img src="img/olifant.png" alt="" width="444" height="512"><h1>Inloggen</h1>
    <p class="lede">Log in om RugSchema te gebruiken.</p>
    <p class="imp-fout" id="login-fout" role="alert" ${fout?'':'hidden'}>${esc(fout)}</p>
    <label class="field"><span>E-mailadres</span><input id="li-email" type="email" autocomplete="username" required></label>
    <label class="field"><span>Wachtwoord</span><input id="li-ww" type="password" autocomplete="current-password" required></label>
    <button class="btn big">Inloggen</button></form>`;
}
const LOGIN_FOUT={onjuist:'E-mailadres of wachtwoord klopt niet.','te-vaak':'Te veel pogingen. Probeer het over een kwartier opnieuw.','geen-verbinding':'Geen verbinding met de server. Controleer je internet.'};
async function inloggen(){
  const knop=$('#login-form button'), f=$('#login-fout');knop.disabled=true;knop.textContent='Bezig…';
  const r=await Opslag.login($('#li-email').value.trim(),$('#li-ww').value);
  if(!r.ok){knop.disabled=false;knop.textContent='Inloggen';f.textContent=LOGIN_FOUT[r.fout]||'Inloggen lukt niet. Probeer het later opnieuw.';f.hidden=false;$('#li-ww').select();return}
  gebruiker=r.gebruiker;modus='server';
  const g=await Opslag.laad();
  if(!g){modus='login';render();return}
  gebruikGegevens(g.gegevens,g.afgevinkt);view='ther';render();
}
async function uitloggen(){
  await Opslag.uitloggen();modus='login';gebruiker=null;S=structuredClone(seed);done={};
  sheet=linkCard=imp=catBeheer=null;editSchema=editItem=null;opslagStatus='';render();
}
Opslag.opStatus(st=>{
  if(st==='conflict'){toonConflict();return}
  if(st==='uitgelogd'){modus='login';gebruiker=null;render();toast('Je bent uitgelogd. Log opnieuw in; je laatste wijziging is mogelijk niet opgeslagen.');return}
  opslagStatus=st;voetTekst();
  if(st==='fout')toast('Opslaan lukt niet. Controleer je internet; de app probeert het zo opnieuw.');
});
function toonConflict(){
  $('#overlay').innerHTML=`<div class="scrim"><div class="sheet" role="alertdialog" aria-label="Gegevens gewijzigd">
    <h2>Gegevens zijn ergens anders gewijzigd</h2>
    <p class="lede" style="margin:0">Op een ander apparaat of tabblad is intussen iets opgeslagen. Laad de nieuwste versie om verder te werken. Je laatste wijziging hier is niet opgeslagen.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" style="flex:0 0 auto" onclick="location.reload()">Nieuwste versie laden</button></div></div></div>`;
}

/* ---------- Therapeut ---------- */
function cardHtml(c){
  const used=S.schemas.filter(s=>s.items.some(i=>i.card===c.id)).length;
  return `<div class="card" style="--cat:${catColor(c.cat)}" data-drag="card" data-card="${c.id}" data-act="link-card" data-id="${c.id}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="${esc(c.name)}: koppelen aan schema">
    ${GRIP}<div class="card-body"><div class="card-title">${esc(c.name)}</div>
      <div class="card-meta"><span class="cat">${esc(c.cat)}</span><span class="num">${doseText(c)}</span>${used?`<span>· in ${used} schema${used>1?"'s":''}</span>`:''}</div></div>
    <button class="icon-btn" data-act="edit-card" data-id="${c.id}" aria-label="${esc(c.name)} bewerken" title="Bewerken">✎</button>
  </div>`;
}
function itemHtml(s,it,idx){
  const c=card(it.card); if(!c)return '';
  const open=editItem&&editItem.s===s.id&&editItem.i===idx;
  let tag='';if(s.client){const b=schemaById(s.base)?.items.find(x=>x.card===it.card);tag=!b?'<span class="tag extra">Extra</span>':!sameDose(b,it)?'<span class="tag">Aangepast</span>':''}
  return `<div class="card item" style="--cat:${catColor(c.cat)}" data-drag="item" data-schema="${s.id}" data-idx="${idx}">
    ${GRIP}<div class="card-body"><div class="card-title">${esc(c.name)}</div>
      <div class="card-meta"><span class="cat">${esc(c.cat)}</span><span class="num">${doseText(it)}${it.rest?` · rust ${it.rest}s`:''}</span>${tag}</div>
      ${open?`<div class="dose-edit">${[['sets','Sets'],['reps','Herh.'],['hold','Vast (s)'],['rest','Rust (s)']].map(([f,l])=>
        `<label>${l}<input id="d-${s.id}-${idx}-${f}" type="number" min="0" value="${it[f]}" data-dose="${f}" data-s="${s.id}" data-i="${idx}"></label>`).join('')}</div>`:''}
    </div>
    <button class="icon-btn" data-act="dose" data-s="${s.id}" data-i="${idx}" aria-label="Dosering aanpassen" title="Dosering aanpassen">${open?'✓':'⚙'}</button>
    <button class="icon-btn" data-act="remove-item" data-s="${s.id}" data-i="${idx}" aria-label="Uit schema halen" title="Uit schema halen">✕</button>
  </div>`;
}
function columnHtml(s){
  const n=S.clients.filter(c=>c.schema===s.id).length, nc=S.clients.filter(c=>c.schema===s.id&&c.custom).length;
  const owner=s.client&&S.clients.find(c=>c.id===s.client), base=s.client&&schemaById(s.base);
  const editing=editSchema===s.id;
  const free=S.cards.filter(c=>!s.items.some(i=>i.card===c.id));
  const removed=base?base.items.filter(b=>!s.items.some(i=>i.card===b.card)).map(b=>card(b.card)).filter(Boolean):[];
  return `<section class="col ${s.client?'personal':''}" id="col-${s.id}" data-drop="schema" data-schema="${s.id}">
    ${editing?`<div class="row">
        ${s.client?`<input id="sn-${s.id}" type="hidden" value="${esc(s.name)}">`:`<label class="field" style="flex:1 1 100%"><span>Naam</span><input id="sn-${s.id}" value="${esc(s.name)}"></label>`}
        <label class="field"><span>Max. flexie (°)</span><input id="sf-${s.id}" type="number" min="0" max="120" value="${s.maxFlex}"></label>
        <label class="field"><span>Per week</span><input id="sd-${s.id}" type="number" min="1" max="7" value="${s.days}"></label>
        <label class="field"><span>Weken</span><input id="sw-${s.id}" type="number" min="1" max="52" value="${s.weeks}"></label></div>
      <div class="row" style="justify-content:space-between">${s.client?`<button class="btn danger small" style="flex:0 0 auto" data-act="reset-custom" data-id="${s.client}">Terug naar basisschema</button>`:`<button class="btn danger small" style="flex:0 0 auto" data-act="del-schema" data-id="${s.id}">Schema verwijderen</button>`}
        <button class="btn small" style="flex:0 0 auto" data-act="save-schema" data-id="${s.id}">Klaar</button></div>`
    :`<div class="col-head"><div style="min-width:0">${owner?`<h3>Persoonlijk schema van ${esc(owner.name.split(' ')[0])}</h3>`:foldHead('col-'+s.id,`<h3>${esc(s.name)}</h3>`)}
        <div class="chips" style="margin-top:6px"><span class="chip warn num">max ${s.maxFlex}°${base&&base.maxFlex!==s.maxFlex?` <s style="opacity:.6">${base.maxFlex}°</s>`:''}</span><span class="chip">${s.days}×/week</span><span class="chip">${s.weeks} wkn</span></div></div>
        <button class="icon-btn" data-act="edit-schema" data-id="${s.id}" aria-label="Schema-instellingen" title="Instellingen">⋯</button></div>`}
    ${isF('col-'+s.id)&&!editing?`<button class="folded-sum" data-act="fold" data-k="col-${s.id}">
        <span class="dots">${s.items.map(it=>{const c=card(it.card);return c?`<i style="background:${catColor(c.cat)}"></i>`:''}).join('')}</span>
        ${s.items.length} oefening${s.items.length===1?'':'en'}${s.client?'':` · ${n} cliënt${n===1?'':'en'}`}</button>`:`
    <div class="items">${s.items.map((it,i)=>itemHtml(s,it,i)).join('')}</div>
    ${removed.length?`<div class="removed">Weggelaten: ${removed.map(c=>`<s>${esc(c.name)}</s> <button class="btn ghost small" data-act="restore" data-s="${s.id}" data-card="${c.id}" style="padding:1px 6px">terugzetten</button>`).join(' ')}</div>`:''}
    <div class="col-foot row" style="align-items:center">
      <select id="add-${s.id}" data-act="add-to" data-s="${s.id}" aria-label="Kaart toevoegen aan ${esc(s.name)}">
        <option value="">+ Kaart toevoegen…</option>${cats().map(cat=>{const l=free.filter(c=>c.cat===cat);return l.length?`<optgroup label="${esc(cat)}">${l.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`:''}).join('')}</select>
      ${s.client?'':`<span style="flex:0 0 auto;font-size:.82rem;color:var(--muted)">${n} cliënt${n===1?'':'en'}${nc?` · ${nc} aangepast`:''}</span>`}</div>`}
  </section>`;
}
function therapist(){
  return `<div style="margin-top:20px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div><h1>Praktijkoverzicht</h1>
    <p class="lede">Sleep oefenkaarten naar een schema, of klik op een kaart om hem te koppelen. Sleep ze terug of naar de prullenbak om ze eruit te halen.</p></div>
    ${modus==='demo'?'<button class="btn danger small" data-act="reset-demo" style="flex:0 0 auto">Voorbeelddata herstellen</button>':''}</div>
  <section class="section">
    <div class="section-head"><div>${foldHead('lib','<h2>Kaartenbak</h2>')}<p class="lede" style="font-size:.92rem">${S.cards.length} oefeningen</p></div>
      <div class="filters" role="group" aria-label="Filter op categorie">${['Alle',...cats()].map(c=>{const n=c==='Alle'?S.cards.length:S.cards.filter(x=>x.cat===c).length;
        return `<button class="filter" data-act="filter" data-cat="${esc(c)}" aria-pressed="${catFilter===c}" style="--cat:${c==='Alle'?'var(--ink)':catColor(c)}">${c==='Alle'?'':'<i></i>'}${esc(c)} <span class="num">${n}</span></button>`}).join('')}
        <button class="filter cat-manage" data-act="cat-open">✎ Categorieën</button></div></div>
    ${isF('lib')?'':`<div class="library" data-drop="library">${cats().flatMap(cat=>S.cards.filter(c=>c.cat===cat)).filter(c=>catFilter==='Alle'||c.cat===catFilter).map(cardHtml).join('')}
      <button class="new-card" data-act="new-card">+ Nieuwe kaart</button>
      <div class="imp-tile"><button class="imp-tile-main" data-act="imp-open">⇪ Importeren uit Excel</button>
        <button class="imp-tile-sub" data-act="imp-voorbeeld">⤓ Voorbeeld downloaden</button></div></div>`}
  </section>
  <section class="section">
    <div class="section-head"><div>${foldHead('sch',"<h2>Schema's</h2>")}<p class="lede" style="font-size:.92rem">${S.schemas.length} basisschema's</p></div>
      ${isF('sch')?'':`<button class="btn ghost small" data-act="fold-all" data-ids="${S.schemas.map(x=>'col-'+x.id).join(',')}">${S.schemas.every(x=>isF('col-'+x.id))?'Alles openklappen':'Alles dichtklappen'}</button>`}</div>
    ${isF('sch')?'':`<div class="board">${S.schemas.map(columnHtml).join('')}<button class="new-col" data-act="new-schema">+ Nieuw schema</button></div>`}
  </section>
  <section class="section">
    <div class="section-head"><div>${foldHead('cli','<h2>Cliënten</h2>')}<p class="lede" style="font-size:.92rem">Open een cliënt om het schema te bekijken of persoonlijk aan te passen.</p></div>
      ${isF('cli')?'':`<button class="btn ghost small" data-act="open-all">${S.clients.every(c=>isOpen(c.id))?'Alles dichtklappen':'Alles openklappen'}</button>`}</div>
    ${isF('cli')?'':`<div class="clients">${S.clients.map(clientCard).join('')}
      <form id="add-client" class="row add-client">
        <input id="new-client" placeholder="Naam nieuwe cliënt" aria-label="Naam nieuwe cliënt" style="flex:2 1 160px">
        <input id="new-age" type="number" min="0" max="17" placeholder="Leeftijd" aria-label="Leeftijd" style="flex:1 1 80px">
        <button class="btn" style="flex:0 0 auto">Cliënt toevoegen</button></form>
      <p class="demo" style="margin:0">De namen, oefeningen en beoordelingen zijn voorbeelden.</p></div>`}
  </section>
  <div class="section">${feedback()}</div>`;
}
const isOpen=id=>!!folded['open-'+id];
function clientCard(c){
  const base=schemaById(c.schema), open=isOpen(c.id), first=esc(c.name.split(' ')[0]);
  const status=c.custom?`<span class="badge">Persoonlijk schema</span>`:base?`<span class="chip">${esc(base.name)}</span>`:`<span class="based">Geen schema</span>`;
  return `<article class="cl ${open?'open':''}" id="cl-${c.id}">
    <div class="cl-head">
      <button class="fold" data-act="open-client" data-id="${c.id}" aria-expanded="${open}">${CHEV}<span class="avatar">${initials(c.name)}</span>
        <span><strong>${esc(c.name)}</strong>${c.age?` <span class="num" style="color:var(--muted);font-size:.85rem">${c.age} jr</span>`:''}</span></button>
      <div class="cl-status">${status}${c.custom&&base?`<span class="based">op basis van ${esc(base.name)}</span>`:''}</div>
    </div>
    ${open?`<div class="cl-body">
      <label class="field" style="max-width:360px"><span>Basisschema</span>
        <select id="sel-${c.id}" data-act="assign" data-id="${c.id}">
          <option value="">Geen schema</option>${S.schemas.map(x=>`<option value="${x.id}" ${c.schema===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
      ${c.custom?columnHtml(c.custom)
       :base?`<div class="preview">
          <div class="label">${esc(base.name)} · max ${base.maxFlex}° · ${base.items.length} oefeningen</div>
          <ul>${base.items.map(it=>{const k=card(it.card);return k?`<li><i style="background:${catColor(k.cat)}"></i>${esc(k.name)} <span class="num">${doseText(it)}</span></li>`:''}).join('')}</ul>
          <button class="btn small" data-act="personalize" data-id="${c.id}">Aanpassen voor ${first}</button>
          <p class="demo" style="margin:0">Je maakt dan een persoonlijke kopie. Het basisschema blijft hetzelfde.</p></div>`
       :`<p class="empty">Kies een basisschema om te beginnen.</p>`}
    </div>`:''}
  </article>`;
}

const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const meter=(v,cls)=>`<span class="meter ${cls}" aria-label="${v==null?'geen':v.toFixed(1)} van 5">${[1,2,3,4,5].map(i=>`<i class="${v!=null&&i<=Math.round(v)?'on':''}"></i>`).join('')}</span>`;
function feedback(){
  const c=S.clients.find(x=>x.id===fbClient)||S.clients[0]; if(!c)return '<section class="panel"><p class="empty">Nog geen cliënten.</p></section>';
  fbClient=c.id; const s=effective(c);
  const rows=s?s.items.map(it=>{const e=card(it.card);if(!e)return '';
    const rs=S.ratings.filter(r=>r.c===c.id&&r.e===e.id);
    const h=avg(rs.map(r=>r.hard).filter(Boolean)), f=avg(rs.map(r=>r.fun).filter(Boolean));
    const flags=[]; if(h!=null&&h>=4)flags.push('Vindt dit zwaar'); if(f!=null&&f<=2)flags.push('Vindt dit niet leuk');
    return `<div class="fb-row"><span>${esc(e.name)} <span class="num" style="color:var(--muted);font-size:.8rem">(${rs.length}×)</span></span>${meter(h,'hard')}${meter(f,'fun')}
      ${flags.length?`<span class="flag">⚑ ${flags.join(' · ')}</span>`:''}</div>`}).join(''):'';
  return `<section class="panel">
    <div class="panel-head" style="${isF('fb')?'margin:0':''}"><div>${foldHead('fb','<h2>Feedback van cliënten</h2>')}${isF('fb')?'':'<p class="lede" style="font-size:.92rem">Hoe zwaar en hoe leuk een kind elke oefening vond.</p>'}</div>
      ${isF('fb')?'':`<select id="fb-pick" data-act="fb-pick" aria-label="Kies cliënt" style="width:auto">${S.clients.map(x=>`<option value="${x.id}" ${x.id===c.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`}</div>
    ${isF('fb')?'':!s?`<p class="empty">${esc(c.name)} heeft nog geen schema.</p>`:`<div><div class="fb-row fb-head"><span>Oefening</span><span>Zwaar</span><span>Leuk</span></div>${rows}</div>`}
  </section>`;
}

function sheetHtml(){
  const c=sheet; const isNew=!S.cards.some(x=>x.id===c.id);
  return `<div class="scrim" data-act="close-sheet"><form class="sheet" id="card-form" role="dialog" aria-label="${isNew?'Nieuwe kaart':'Kaart bewerken'}">
    <h2>${isNew?'Nieuwe oefenkaart':'Kaart bewerken'}</h2>
    <label class="field"><span>Naam oefening</span><input id="cf-name" value="${esc(c.name)}" required></label>
    <label class="field"><span>Categorie</span><select id="cf-cat">${cats().map(x=>`<option value="${esc(x)}" ${x===c.cat?'selected':''}>${esc(x)}</option>`).join('')}
      <option value="__nieuw">+ Nieuwe categorie…</option></select></label>
    <label class="field" id="cf-newcat-wrap" hidden><span>Naam nieuwe categorie</span><input id="cf-newcat" maxlength="30" placeholder="bijv. Ademhaling"></label>
    <div class="row">${[['sets','Sets'],['reps','Herhalingen'],['hold','Vasthouden (s)'],['rest','Rust (s)']].map(([f,l])=>
      `<label class="field" style="flex:1 1 100px"><span>${l}</span><input id="cf-${f}" type="number" min="0" value="${c[f]}"></label>`).join('')}</div>
    <label class="field"><span>Instructie voor het kind</span><textarea id="cf-note">${esc(c.note)}</textarea></label>
    <p class="demo" style="margin:0">Deze dosering is de standaard als je de kaart aan een schema toevoegt. Per schema kun je hem aanpassen.</p>
    <div class="row" style="justify-content:space-between;align-items:center">
      ${isNew?'<span></span>':`<button type="button" class="btn danger small" style="flex:0 0 auto" data-act="del-card" data-id="${c.id}">Kaart verwijderen</button>`}
      <span style="flex:0 0 auto;display:flex;gap:8px"><button type="button" class="btn ghost" data-act="close-sheet">Annuleren</button><button class="btn">Opslaan</button></span></div>
  </form></div>`;
}

/* Koppelen zonder slepen: klik op een kaart in de kaartenbak en kies de schema's */
function linkHtml(){
  const c=card(linkCard); if(!c){linkCard=null;return ''}
  const row=(sc,title,sub='')=>{const has=sc.items.some(i=>i.card===c.id);
    return `<button type="button" class="link-row" data-act="link-toggle" data-s="${sc.id}" aria-pressed="${has}">
      <span class="link-check" aria-hidden="true">${has?'✓':'+'}</span>
      <span class="link-name">${title}<small>${sub}${sc.items.length} oefening${sc.items.length===1?'':'en'}</small></span>
      <span class="link-state">${has?'Staat erin':'Toevoegen'}</span></button>`};
  const own=S.clients.filter(x=>x.custom);
  return `<div class="scrim" data-act="close-link"><div class="sheet" role="dialog" aria-label="${esc(c.name)} koppelen aan schema">
    <div><div class="label">Koppelen aan schema</div><h2>${esc(c.name)}</h2>
      <p class="lede" style="font-size:.92rem">${esc(c.cat)} · standaard <span class="num">${doseText(c)}</span>. Klik op een schema om de kaart toe te voegen of eruit te halen.</p></div>
    <div class="link-list">${S.schemas.map(sc=>row(sc,esc(sc.name))).join('')||'<p class="empty">Er zijn nog geen schema\'s.</p>'}</div>
    ${own.length?`<div class="label">Persoonlijke schema's</div><div class="link-list">${own.map(x=>row(x.custom,esc(x.name),esc(x.custom.name)+' · ')).join('')}</div>`:''}
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn" style="flex:0 0 auto" data-act="close-link">Klaar</button></div>
  </div></div>`;
}

/* ---------- Cliënt ---------- */
/* Stopwatch: telt op, blijft doorlopen als het scherm opnieuw wordt opgebouwd */
const sw={start:0,acc:0,run:false,h:null};
const swMs=()=>sw.acc+(sw.run?Date.now()-sw.start:0);
function swFmt(ms){const m=Math.floor(ms/60000),s=Math.floor(ms/1000)%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function stopwatch(){return `<div class="stopwatch"><div><div class="label">Stopwatch</div><div class="sw-time num" id="sw-time">${swFmt(swMs())}</div></div>
  <div class="sw-btns"><button class="btn big" data-act="sw-toggle">${sw.run?'❚❚ Pauze':swMs()?'▶ Verder':'▶ Start'}</button><button class="btn ghost big" data-act="sw-reset" ${swMs()?'':'disabled'}>Reset</button></div></div>`}
function swTick(){const el=$('#sw-time');if(el)el.innerHTML=swFmt(swMs())}
const HARD=[['😄','Heel makkelijk'],['🙂','Makkelijk'],['😐','Gaat wel'],['😣','Zwaar'],['😫','Heel zwaar']];
/* Zwaar-smileys: van heel zwaar (links) naar heel makkelijk (rechts); waarde 1 blijft heel makkelijk */
function rateBlock(cid,eid){
  const r=S.ratings.find(x=>x.c===cid&&x.e===eid&&x.d===today())||{};
  return `<div class="rate">
    <div class="rate-row"><span>Hoe zwaar?</span><div class="faces">${HARD.map(([f,l],i)=>`<button data-act="rate" data-k="hard" data-v="${i+1}" data-c="${cid}" data-e="${eid}" aria-pressed="${r.hard===i+1}" aria-label="${l}" title="${l}">${f}</button>`).reverse().join('')}</div></div>
    <div class="rate-row"><span>Hoe leuk?</span><div class="faces">${[1,2,3,4,5].map(i=>`<button data-act="rate" data-k="fun" data-v="${i}" data-c="${cid}" data-e="${eid}" aria-pressed="${r.fun===i}" aria-label="${i} van 5 sterren">${r.fun>=i?'⭐':'☆'}</button>`).join('')}</div></div>
  </div>`;
}
function client(){
  const c=S.clients.find(x=>x.id===activeClient)||S.clients[0];
  if(!c)return `<p class="empty" style="margin-top:20px">Er zijn nog geen cliënten.</p>`;
  activeClient=c.id;
  const s=effective(c), first=esc(c.name.split(' ')[0]);
  const picker=`<label class="field" style="max-width:320px;margin-top:20px"><span>Voorbeeld: bekijk als</span>
    <select id="cli-pick" data-act="pick">${S.clients.map(x=>`<option value="${x.id}" ${x.id===c.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`;
  if(!s)return picker+`<div class="panel" style="margin-top:16px;max-width:720px"><h2>Hoi ${first}!</h2><p class="empty">Je fysiotherapeut zet binnenkort je oefeningen voor je klaar.</p></div>`;
  const key=c.id+':'+today(), d=done[key]||{};
  const items=s.items.filter(it=>card(it.card));
  const n=items.filter(it=>d[it.card]).length, tot=items.length;
  return picker+`<div class="hero">
    <div><div class="label">Vandaag · ${new Date().toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'})}</div>
      <h1>Hoi ${first}! Dit zijn je oefeningen</h1><p class="lede">${esc(s.name)} · ${s.days}× per week · ${s.weeks} weken</p></div>
    <div class="reminder"><img src="img/olifant.png" alt="" width="444" height="512"><div><span class="label">Reminder</span>
      <strong>Denk aan je houding!</strong>
      <p>Rechte rug en ontspannen schouders, ook bij zitten, bukken en tillen. Vink een oefening af en vertel hoe het ging.</p></div></div>
    ${stopwatch()}
    <div><div style="display:flex;justify-content:space-between" class="label"><span>Voortgang vandaag</span><span class="num">${n}/${tot}</span></div>
      <div class="progress" style="margin-top:6px"><i style="width:${tot?n/tot*100:0}%"></i></div></div>
    <div class="list">${items.map(it=>{const e=card(it.card);return `
      <article class="ex ${d[e.id]?'done':''}" style="--cat:${catColor(e.cat)}">
        <button class="check" data-act="toggle" data-id="${e.id}" data-key="${key}" aria-label="${esc(e.name)} afvinken">${d[e.id]?'✓':''}</button>
        <div style="min-width:0"><h3>${esc(e.name)}</h3>
          <div class="dose"><div><b>${it.sets}</b><small>sets</small></div><div><b>${it.reps}</b><small>herhalingen</small></div>
            ${it.hold?`<div><b>${it.hold}s</b><small>vasthouden</small></div>`:''}${it.rest?`<div><b>${it.rest}s</b><small>rust</small></div>`:''}</div>
          ${e.note?`<p class="note">${esc(e.note)}</p>`:''}
          ${d[e.id]?rateBlock(c.id,e.id):''}
        </div></article>`}).join('')}</div>
    ${n===tot&&tot?`<div class="panel" style="text-align:center"><div style="font-size:2rem">🏆</div><strong style="color:var(--ok)">Alles gedaan voor vandaag. Super gedaan!</strong></div>`:''}
  </div>`;
}

/* ---------- Acties ---------- */
function addToSchema(sid,cid,at){
  const s=schemaById(sid), c=card(cid); if(!s||!c)return false;
  if(s.items.some(i=>i.card===cid)){toast('Deze kaart staat al in dit schema');return false}
  const item={card:cid,sets:c.sets,reps:c.reps,hold:c.hold,rest:c.rest};
  s.items.splice(at==null?s.items.length:at,0,item); return true;
}
function syncSchemaForm(id){const s=schemaById(id);if(!s||!$('#sn-'+id))return;
  s.name=$('#sn-'+id).value.trim()||s.name;s.maxFlex=+$('#sf-'+id).value||0;s.days=+$('#sd-'+id).value||1;s.weeks=+$('#sw-'+id).value||1}

document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-act]'); if(!b||b.tagName==='SELECT'||b.tagName==='FORM')return;
  if(drag&&drag.justDropped)return;
  const a=b.dataset.act;
  if(a==='close-sheet'){if(b.classList.contains('scrim')&&ev.target!==b)return;sheet=null;render()}
  if(a==='undo'&&undoFn){const f=undoFn;undoFn=null;f()}
  if(a==='new-card'){sheet={id:uid(),name:'',cat:catFilter==='Alle'?cats()[0]:catFilter,sets:3,reps:10,hold:0,rest:30,note:''};render();setTimeout(()=>$('#cf-name')?.focus(),0)}
  if(a==='link-card'){linkCard=b.dataset.id;render();$('#overlay .link-row')?.focus()}
  if(a==='close-link'){if(b.classList.contains('scrim')&&ev.target!==b)return;const id=linkCard;linkCard=null;render();document.querySelector(`.library [data-card="${id}"]`)?.focus()}
  if(a==='link-toggle'){const sc=schemaById(b.dataset.s), i=sc.items.findIndex(x=>x.card===linkCard), undo=snapshot();
    if(i>=0){sc.items.splice(i,1);toast('Uit schema gehaald',undo)}else if(addToSchema(sc.id,linkCard))toast('Kaart toegevoegd aan schema',undo);
    save();render();$(`#overlay [data-s="${sc.id}"]`)?.focus()}
  if(a==='edit-card'){sheet=structuredClone(card(b.dataset.id));render()}
  if(a==='del-card'){
    if(!b.dataset.confirm){b.dataset.confirm=1;b.textContent='Zeker weten? Klik nogmaals';return}
    const undo=snapshot();deleteCard(b.dataset.id);sheet=null;save();render();toast('Kaart verwijderd',undo)}
  if(a==='new-schema'){const s={id:uid(),name:'Nieuw schema',maxFlex:30,days:3,weeks:4,items:[]};S.schemas.push(s);editSchema=s.id;save();render();$('#sn-'+s.id)?.select()}
  if(a==='edit-schema'){if(editSchema)syncSchemaForm(editSchema);editSchema=b.dataset.id;render()}
  if(a==='save-schema'){syncSchemaForm(b.dataset.id);editSchema=null;save();render();toast('Schema opgeslagen')}
  if(a==='del-schema'){
    if(!b.dataset.confirm){b.dataset.confirm=1;b.textContent='Zeker weten?';return}
    const undo=snapshot();S.schemas=S.schemas.filter(x=>x.id!==b.dataset.id);S.clients.forEach(c=>{if(c.schema===b.dataset.id){c.schema='';c.custom=null}});
    editSchema=null;save();render();toast('Schema verwijderd',undo)}
  if(a==='reset-demo'){
    if(!b.dataset.confirm){b.dataset.confirm=1;b.textContent='Zeker weten? Klik nogmaals';return}
    const vS=JSON.stringify(S),vD=JSON.stringify(done);
    Opslag.wisAlles();S=structuredClone(seed);done={};sheet=null;editSchema=null;editItem=null;save();render();
    toast('Voorbeelddata hersteld',()=>{S=JSON.parse(vS);done=JSON.parse(vD);save();render();toast('Hersteld')})}
  if(a==='fold'){folded[b.dataset.k]=!folded[b.dataset.k];saveFold();render();return}
  if(a==='fold-all'){const ids=b.dataset.ids.split(','),close=!ids.every(isF);ids.forEach(k=>folded[k]=close);saveFold();render();return}
  if(a==='filter'){catFilter=b.dataset.cat;render();return}
  if(a==='personalize'){const c=S.clients.find(x=>x.id===b.dataset.id),b0=schemaById(c.schema);
    c.custom={...structuredClone(b0),id:'p-'+c.id,client:c.id,base:b0.id};save();render();
    folded['open-'+c.id]=true;saveFold();render();$('#cl-'+c.id)?.scrollIntoView({behavior:'smooth',block:'start'});toast('Persoonlijk schema gemaakt')}
  if(a==='open-client'){folded['open-'+b.dataset.id]=!folded['open-'+b.dataset.id];saveFold();render();return}
  if(a==='open-all'){const all=S.clients.every(c=>isOpen(c.id));S.clients.forEach(c=>folded['open-'+c.id]=!all);saveFold();render();return}
  if(a==='reset-custom'){if(!b.dataset.confirm){b.dataset.confirm=1;b.textContent='Aanpassingen wissen?';return}
    const undo=snapshot();S.clients.find(x=>x.id===b.dataset.id).custom=null;editSchema=null;save();render();toast('Terug naar basisschema',undo)}
  if(a==='restore'){const s=schemaById(b.dataset.s),bi=schemaById(s.base).items.find(x=>x.card===b.dataset.card);
    s.items.push(structuredClone(bi));save();render()}
  if(a==='dose'){const k={s:b.dataset.s,i:+b.dataset.i};editItem=(editItem&&editItem.s===k.s&&editItem.i===k.i)?null:k;render()}
  if(a==='remove-item'){const undo=snapshot();schemaById(b.dataset.s).items.splice(+b.dataset.i,1);editItem=null;save();render();toast('Uit schema gehaald',undo)}
  if(a==='sw-toggle'){if(sw.run){sw.acc+=Date.now()-sw.start;sw.run=false;clearInterval(sw.h)}else{sw.start=Date.now();sw.run=true;sw.h=setInterval(swTick,100)}render()}
  if(a==='sw-reset'){clearInterval(sw.h);Object.assign(sw,{start:0,acc:0,run:false});render()}
  if(a==='toggle'){const k=b.dataset.key;done[k]=done[k]||{};done[k][b.dataset.id]=!done[k][b.dataset.id];save();render()}
  if(a==='rate'){const {c,e,k,v}=b.dataset;let r=S.ratings.find(x=>x.c===c&&x.e===e&&x.d===today());
    if(!r){r={c,e,d:today()};S.ratings.push(r)} r[k]=+v;save();render();if(r.hard&&r.fun)toast('Bedankt voor je mening!')}
});
function deleteCard(id){S.cards=S.cards.filter(c=>c.id!==id);allSchemas().forEach(s=>s.items=s.items.filter(i=>i.card!==id))}
document.addEventListener('change',ev=>{
  const el=ev.target, a=el.dataset.act;
  if(a==='assign'){const c=S.clients.find(x=>x.id===el.dataset.id),undo=snapshot(),had=!!c.custom;c.schema=el.value;c.custom=null;save();render();
    toast(had?'Schema gekoppeld, persoonlijke aanpassingen vervallen':'Schema gekoppeld',had?undo:null)}
  if(a==='fb-pick'){fbClient=el.value;render()}
  if(a==='pick'){activeClient=el.value;render()}
  if(el.id==='cf-cat'){const nw=el.value==='__nieuw';$('#cf-newcat-wrap').hidden=!nw;if(nw)$('#cf-newcat').focus()}
  if(a==='add-to'&&el.value){if(addToSchema(el.dataset.s,el.value)){save();render();toast('Kaart toegevoegd')}}
  if(el.dataset.dose){const it=schemaById(el.dataset.s).items[+el.dataset.i];it[el.dataset.dose]=Math.max(0,+el.value||0);save()}
});
document.addEventListener('submit',ev=>{
  ev.preventDefault();
  if(ev.target.id==='add-client'){const n=$('#new-client').value.trim();if(!n)return;
    S.clients.push({id:uid(),name:n,age:+$('#new-age').value||null,schema:''});save();render();toast('Cliënt toegevoegd')}
  if(ev.target.id==='card-form'){const c=sheet;c.name=$('#cf-name').value.trim();if(!c.name)return;
    let cat=$('#cf-cat').value;
    if(cat==='__nieuw'){cat=$('#cf-newcat').value.trim().replace(/\s+/g,' ');if(!cat){$('#cf-newcat').focus();return}
      const al=S.cats.find(x=>x.name.toLowerCase()===cat.toLowerCase());if(al)cat=al.name;else S.cats.push({name:cat,color:vrijeKleur()})}
    c.cat=cat;['sets','reps','hold','rest'].forEach(f=>c[f]=Math.max(0,+$('#cf-'+f).value||0));c.note=$('#cf-note').value.trim();
    const i=S.cards.findIndex(x=>x.id===c.id);i>=0?S.cards[i]=c:S.cards.push(c);sheet=null;save();render();toast(i>=0?'Kaart opgeslagen':'Kaart toegevoegd aan de kaartenbak')}
});
document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape'&&sheet){sheet=null;render()}
  if(ev.key==='Escape'&&linkCard){linkCard=null;render()}
  if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches?.('.library .card')){ev.preventDefault();ev.target.click()}
});

/* ---------- Slepen (muis én touch) ---------- */
let drag=null;
document.addEventListener('pointerdown',e=>{
  const el=e.target.closest('[data-drag]'); if(!el||e.button>0)return;
  if(e.target.closest('button,input,select,textarea'))return;
  if(e.pointerType!=='mouse'&&!e.target.closest('.grip'))return; // op touch alleen via het grip-icoon, zodat scrollen blijft werken
  drag={el,x:e.clientX,y:e.clientY,started:false};
});
function startDrag(){
  const r=drag.el.getBoundingClientRect();
  const g=drag.el.cloneNode(true);g.classList.add('drag-ghost');g.style.width=r.width+'px';g.removeAttribute('data-drop');
  document.body.appendChild(g);drag.ghost=g;drag.dx=drag.x-r.left;drag.dy=drag.y-r.top;
  drag.el.classList.add('source');document.body.classList.add('dragging');
  const t=$('#trash');t.hidden=false;t.textContent=drag.el.dataset.drag==='card'?'🗑 Kaart verwijderen':'🗑 Uit schema halen';
  drag.started=true;autoScroll();
}
function autoScroll(){if(!drag||!drag.started)return;
  const y=drag.cy, m=70; if(y<m+60)scrollBy(0,-14);else if(y>innerHeight-m-70)scrollBy(0,14);
  requestAnimationFrame(autoScroll)}
function clearOver(){document.querySelectorAll('.over').forEach(x=>x.classList.remove('over'));document.querySelectorAll('.drop-line').forEach(x=>x.remove())}
document.addEventListener('pointermove',e=>{
  if(!drag||!drag.el)return;
  if(!drag.started){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;startDrag()}
  e.preventDefault();drag.cy=e.clientY;
  drag.ghost.style.left=(e.clientX-drag.dx)+'px';drag.ghost.style.top=(e.clientY-drag.dy)+'px';
  clearOver();drag.target=null;
  const zone=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-drop]'); if(!zone)return;
  zone.classList.add('over');drag.target={type:zone.dataset.drop,schema:zone.dataset.schema};
  if(zone.dataset.drop==='schema'){
    const list=zone.querySelector('.items');
    if(!list){drag.target.idx=schemaById(zone.dataset.schema).items.length;return}
    const kids=[...list.querySelectorAll('.item')].filter(k=>k!==drag.el);
    let idx=kids.findIndex(k=>{const r=k.getBoundingClientRect();return e.clientY<r.top+r.height/2});if(idx<0)idx=kids.length;
    const line=document.createElement('div');line.className='drop-line';list.insertBefore(line,kids[idx]||null);
    drag.target.idx=idx;
  }
},{passive:false});
function endDrag(cancel){
  if(!drag||!drag.el)return; const d=drag;
  if(!d.started){drag=null;return}
  d.ghost.remove();d.el.classList.remove('source');document.body.classList.remove('dragging');$('#trash').hidden=true;clearOver();
  drag={justDropped:true};setTimeout(()=>{if(drag&&drag.justDropped)drag=null},0);
  if(cancel||!d.target)return;
  const t=d.target, isCard=d.el.dataset.drag==='card';
  const undo=snapshot();
  if(isCard){const cid=d.el.dataset.card;
    if(t.type==='schema'){if(addToSchema(t.schema,cid,t.idx)){save();render();toast('Kaart toegevoegd aan schema',undo)}}
    else if(t.type==='trash'){const nm=card(cid).name;deleteCard(cid);save();render();toast(`"${nm}" verwijderd`,undo)}
  }else{const from=schemaById(d.el.dataset.schema), i=+d.el.dataset.idx, it=from.items[i];
    if(t.type==='schema'){
      if(t.schema===from.id){from.items.splice(i,1);from.items.splice(t.idx,0,it)}
      else{const to=schemaById(t.schema);if(to.items.some(x=>x.card===it.card)){toast('Deze kaart staat al in dat schema');return}
        from.items.splice(i,1);to.items.splice(t.idx,0,it)}
      editItem=null;save();render();if(t.schema!==from.id)toast('Kaart verplaatst',undo);
    }else{from.items.splice(i,1);editItem=null;save();render();toast('Uit schema gehaald',undo)}
  }
}
document.addEventListener('pointerup',()=>endDrag(false));
document.addEventListener('pointercancel',()=>endDrag(true));

$('#v-ther').onclick=()=>{view='ther';render()};
$('#v-cli').onclick=()=>{view='cli';sheet=null;linkCard=null;imp=null;catBeheer=null;editSchema=null;render()};
$('#to-top').onclick=()=>scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
$('#uitloggen').onclick=uitloggen;
document.addEventListener('submit',ev=>{if(ev.target.id==='login-form')inloggen()});
render();
Opslag.start().then(r=>{
  modus=r.modus;gebruiker=r.gebruiker||null;serverMelding=r.melding||'';
  if(modus!=='login')gebruikGegevens(r.gegevens,r.afgevinkt);
  render();
});
