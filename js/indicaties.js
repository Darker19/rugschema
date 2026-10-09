// Indicaties met subcategorieën, zelf te beheren. Voorbeeld: Voet › Tenen, Rug › Scoliose.
//   S.indLijst = [{name:'Voet', subs:['Tenen','Enkel']}, ...]   volgorde = volgorde in lijsten
// Cliënten en schema's bewaren de keuze als tekst: x.indicatie ('Voet') en x.subcategorie ('Tenen' of leeg).
// Hernoemen past die overal aan. indBeheer: null (dicht) of {weg: 'i:<n>' of 's:<n>:<m>' voor een bevestiging,
// open: {naam: true} voor opengeklapte indicaties}. Zoeken in het venster gaat via zoek.ind (zie app.js).

let indBeheer=null;
const indEq=(a,b)=>indNorm(a)===indNorm(b);
const indTop=n=>S.indLijst.find(x=>indEq(x.name,n));
const subsVan=n=>indTop(n)?.subs||[];
const indLabel=x=>x.indicatie?x.indicatie+(x.subcategorie?' › '+x.subcategorie:''):'';
const indGebruik=(top,sub)=>{const past=x=>indEq(x.indicatie,top)&&(sub==null||indEq(x.subcategorie,sub));
  return {clienten:S.clients.filter(past).length,schemas:S.schemas.filter(past).length}};

// Zorgt dat S.indLijst bestaat en alles bevat wat bij cliënten of schema's staat.
// Zet ook de vorige opbouw om (S.indGroepen + S.indicaties: daar was "Rug" de groep en "Scoliose" de indicatie).
function registreerIndicaties(){
  if(!S.indLijst){
    let L;
    if(S.indGroepen||S.indicaties){
      L=(S.indGroepen||[]).map(g=>({name:g,subs:[]}));
      for(const i of S.indicaties||[]){const g=i.groep&&L.find(x=>x.name===i.groep);if(g)g.subs.push(i.name);else L.push({name:i.name,subs:[]})}
    }else L=structuredClone(seed.indLijst);
    delete S.indGroepen;delete S.indicaties;S.indLijst=L;
    // een oude waarde die nu een subcategorie is, wordt indicatie › subcategorie
    for(const x of [...S.clients,...S.schemas]){
      if(!x.indicatie||x.subcategorie||indTop(x.indicatie))continue;
      const top=L.find(t=>t.subs.some(s=>indEq(s,x.indicatie)));
      if(top){x.subcategorie=top.subs.find(s=>indEq(s,x.indicatie));x.indicatie=top.name}
    }
  }
  for(const x of [...S.clients,...S.schemas]){
    const n=(x.indicatie||'').trim();if(!n)continue;
    let t=indTop(n);if(!t){t={name:n,subs:[]};S.indLijst.push(t)}
    const s=(x.subcategorie||'').trim();if(s&&!t.subs.some(y=>indEq(y,s)))t.subs.push(s);
  }
}

// Keuzelijsten voor een cliënt of schema: indicatie en (afhankelijk daarvan) subcategorie
function indKeuzes(x,idI,idS,actI,actS,extra=''){
  const subs=subsVan(x.indicatie);
  return `<label class="field"><span>Indicatie</span><select id="${idI}" ${actI?`data-act="${actI}"`:''} ${extra}>
      <option value="">Geen indicatie</option>${S.indLijst.map(t=>`<option value="${esc(t.name)}" ${indEq(t.name,x.indicatie)?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Subcategorie</span><select id="${idS}" ${actS?`data-act="${actS}"`:''} ${extra} ${x.indicatie&&subs.length?'':'disabled'}>
      <option value="">${!x.indicatie?'Kies eerst een indicatie':subs.length?'Geen subcategorie':'Geen subcategorieën'}</option>${subs.map(s=>`<option value="${esc(s)}" ${indEq(s,x.subcategorie)?'selected':''}>${esc(s)}</option>`).join('')}</select></label>`;
}
// Na het kiezen van een andere indicatie de subcategorielijst bijwerken zonder het hele scherm opnieuw op te bouwen
function vulSubs(selI,selS){
  const subs=subsVan(selI.value);selS.disabled=!selI.value||!subs.length;
  selS.innerHTML=`<option value="">${!selI.value?'Kies eerst een indicatie':subs.length?'Geen subcategorie':'Geen subcategorieën'}</option>`+subs.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
}

function indBeheerHtml(){
  const st=indBeheer, q=zoek.ind.trim(), open=st.open||(st.open={});
  // bij zoeken: indicaties die passen (met al hun subcategorieën) of met passende subcategorieën; die staan dan open
  const blokken=S.indLijst.map((t,i)=>{const heel=past([t.name],q);
    return {t,i,open:q?true:!!open[t.name],subs:t.subs.map((s,j)=>({s,j})).filter(x=>heel||past([x.s],q)),toon:heel||t.subs.some(s=>past([s],q))}}).filter(b=>b.toon);
  const allesOpen=S.indLijst.length&&S.indLijst.every(t=>open[t.name]);
  const bevestig=(sleutel,naam,u,uitleg)=>st.weg===sleutel?`<div class="cat-weg"><span>"${esc(naam)}" wordt ook weggehaald bij ${u.clienten} cliënt${u.clienten===1?'':'en'}${u.schemas?` en ${u.schemas} schema${u.schemas===1?'':"'s"}`:''}. ${uitleg}</span>
    <button type="button" class="btn danger small" data-act="ind-weg-ok" data-k="${sleutel}">Verwijderen</button><button type="button" class="btn ghost small" data-act="ind-weg-nee">Annuleren</button></div>`:'';
  return `<div class="scrim" data-act="ind-close"><div class="sheet wide" role="dialog" aria-label="Indicaties beheren" tabindex="-1">
    <div><div class="label">Cliënten</div><h2>Indicaties</h2>
      <p class="lede" style="font-size:.92rem">Maak indicaties (bijv. Voet) met subcategorieën eronder (bijv. Tenen). Een nieuwe naam passen we ook aan bij cliënten en schema's.</p></div>
    <div class="zoekbalk" style="margin:0"><input type="search" class="zoek" id="zoek-ind" data-zoek="ind" value="${esc(zoek.ind)}" placeholder="Zoek een indicatie of subcategorie" aria-label="Zoek een indicatie of subcategorie">
      ${q?'':`<button type="button" class="btn ghost small" style="flex:0 0 auto" data-act="ind-alles">${allesOpen?'Alles dichtklappen':'Alles openklappen'}</button>`}</div>
    ${q&&!blokken.length?`<p class="empty">Niets gevonden voor "${esc(q)}".</p>`:''}
    ${blokken.map(({t,i,open:isOpen,subs})=>{const u=indGebruik(t.name);return `<section class="ind-groep ${isOpen?'open':''}">
      <div class="ind-kop">
        <button type="button" class="fold ind-fold" data-act="ind-fold" data-i="${i}" aria-expanded="${isOpen}" aria-label="${esc(t.name)} ${isOpen?'dichtklappen':'openklappen'}" ${q?'disabled':''}>${CHEV}</button>
        <input class="ind-groepnaam" value="${esc(t.name)}" data-act="it-naam" data-i="${i}" maxlength="40" aria-label="Naam indicatie">
        <span class="cat-count">${t.subs.length} sub · ${u.clienten} cl.${u.schemas?` · ${u.schemas} sch.`:''}</span>
        <span class="cat-btns">
          <button type="button" class="icon-btn" data-act="it-op" data-i="${i}" ${i===0?'disabled':''} aria-label="${esc(t.name)} omhoog" title="Omhoog">↑</button>
          <button type="button" class="icon-btn" data-act="it-neer" data-i="${i}" ${i===S.indLijst.length-1?'disabled':''} aria-label="${esc(t.name)} omlaag" title="Omlaag">↓</button>
          <button type="button" class="icon-btn" data-act="it-weg" data-i="${i}" aria-label="Indicatie ${esc(t.name)} verwijderen" title="Indicatie verwijderen">🗑</button></span></div>
      ${bevestig('i:'+i,t.name,u,'Ook de subcategorieën verdwijnen; automatisch gekoppelde cliënten worden ontkoppeld.')}
      ${isOpen?`<ul class="ind-lijst">${subs.map(({s,j})=>{const us=indGebruik(t.name,s);return `<li>
        <div class="ind-rij"><input value="${esc(s)}" data-act="is-naam" data-i="${i}" data-j="${j}" maxlength="60" aria-label="Naam subcategorie">
          <span class="cat-count">${us.clienten} cl.${us.schemas?` · ${us.schemas} sch.`:''}</span>
          <button type="button" class="icon-btn" data-act="is-weg" data-i="${i}" data-j="${j}" aria-label="${esc(s)} verwijderen" title="Verwijderen">🗑</button></div>
        ${bevestig(`s:${i}:${j}`,s,us,'De cliënten houden de indicatie '+esc(t.name)+(us.schemas?'; het schema verliest zijn indicatiekoppeling.':'.'))}</li>`}).join('')||'<li class="empty" style="padding:2px 0">Nog geen subcategorieën.</li>'}</ul>
      <form class="ind-new" data-i="${i}"><input maxlength="60" placeholder="Subcategorie toevoegen aan ${esc(t.name)}" aria-label="Nieuwe subcategorie in ${esc(t.name)}"><button class="btn ghost small">+ Toevoegen</button></form>`:''}
    </section>`}).join('')||(q?'':'<p class="empty">Nog geen indicaties.</p>')}
    <form class="cat-new" id="it-new-form"><input id="it-new" maxlength="40" placeholder="Nieuwe indicatie, bijv. Voet" aria-label="Naam nieuwe indicatie"><button class="btn">+ Indicatie</button></form>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" style="flex:0 0 auto" data-act="ind-close">Klaar</button></div>
  </div></div>`;
}

const indSchoon=v=>String(v||'').trim().replace(/\s+/g,' ');
function indOpnieuw(focus){render();if(focus)$(focus)?.focus()}
// Haalt een indicatie (sub==null) of alleen een subcategorie weg bij cliënten en schema's.
// Cliënten houden bij een weggehaalde subcategorie hun indicatie; een schema verliest dan zijn hele koppeling,
// anders kan het samenvallen met een ander schema dat al bij alleen die indicatie hoort.
function indWeg(top,sub){
  for(const x of S.clients){if(!indEq(x.indicatie,top))continue;if(sub==null){x.indicatie='';x.subcategorie=''}else if(indEq(x.subcategorie,sub))x.subcategorie=''}
  for(const x of S.schemas){if(!indEq(x.indicatie,top))continue;if(sub==null||indEq(x.subcategorie,sub)){x.indicatie='';x.subcategorie=''}}
}

document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-act]');if(!b)return;const a=b.dataset.act, i=+b.dataset.i, j=+b.dataset.j;
  if(a==='ind-open'){registreerIndicaties();indBeheer={open:{}};zoek.ind='';render();$('#zoek-ind')?.focus()}
  if(a==='ind-fold'){const n=S.indLijst[i].name;indBeheer.open[n]=!indBeheer.open[n];indOpnieuw(`[data-act="ind-fold"][data-i="${i}"]`)}
  if(a==='ind-alles'){const dicht=S.indLijst.every(t=>indBeheer.open[t.name]);S.indLijst.forEach(t=>indBeheer.open[t.name]=!dicht);indOpnieuw('[data-act="ind-alles"]')}
  if(a==='ind-close'){if(b.classList.contains('scrim')&&ev.target!==b)return;indBeheer=null;render()}
  if(a==='it-op'||a==='it-neer'){const k=a==='it-op'?i-1:i+1;if(k<0||k>=S.indLijst.length)return;
    [S.indLijst[i],S.indLijst[k]]=[S.indLijst[k],S.indLijst[i]];indBeheer.weg=null;save();indOpnieuw(`[data-act="${a}"][data-i="${k}"]`)}
  if(a==='it-weg'||a==='is-weg'){
    const t=S.indLijst[i], sub=a==='is-weg'?t.subs[j]:null, u=indGebruik(t.name,sub), sleutel=a==='it-weg'?'i:'+i:`s:${i}:${j}`;
    if(u.clienten||u.schemas){indBeheer.weg=sleutel;render();return}
    const undo=snapshot();if(sub==null)S.indLijst.splice(i,1);else t.subs.splice(j,1);
    indBeheer.weg=null;save();render();toast(`${sub==null?'Indicatie':'Subcategorie'} "${sub??t.name}" verwijderd`,undo)}
  if(a==='ind-weg-ok'){
    const [soort,x,y]=b.dataset.k.split(':'), t=S.indLijst[+x], sub=soort==='s'?t.subs[+y]:null, undo=snapshot();
    indWeg(t.name,sub);if(sub==null)S.indLijst.splice(+x,1);else t.subs.splice(+y,1);cliInd='';
    const k=koppelIndicaties();indBeheer.weg=null;save();render();
    toast([`${sub==null?'Indicatie':'Subcategorie'} "${sub??t.name}" verwijderd`,koppelTekst(k)].filter(Boolean).join(' · '),undo)}
  if(a==='ind-weg-nee'){indBeheer.weg=null;render()}
});
document.addEventListener('change',ev=>{
  const el=ev.target, a=el.dataset?.act;
  if(a==='it-naam'){
    const t=S.indLijst[+el.dataset.i], oud=t.name, nieuw=indSchoon(el.value);
    if(!nieuw||nieuw===oud){el.value=oud;return}
    if(S.indLijst.some(x=>x!==t&&indEq(x.name,nieuw))){el.value=oud;toast(`Er is al een indicatie "${nieuw}"`);return}
    for(const x of [...S.clients,...S.schemas])if(indEq(x.indicatie,oud))x.indicatie=nieuw;
    if(indBeheer?.open?.[oud]){indBeheer.open[nieuw]=true;delete indBeheer.open[oud]}
    t.name=nieuw;el.value=nieuw;cliInd='';save();toast(`Hernoemd naar "${nieuw}"`); // niet opnieuw opbouwen, zodat een volgende klik niet verloren gaat
  }
  if(a==='is-naam'){
    const t=S.indLijst[+el.dataset.i], j=+el.dataset.j, oud=t.subs[j], nieuw=indSchoon(el.value);
    if(!nieuw||nieuw===oud){el.value=oud;return}
    if(t.subs.some((s,k)=>k!==j&&indEq(s,nieuw))){el.value=oud;toast(`${t.name} heeft al een subcategorie "${nieuw}"`);return}
    for(const x of [...S.clients,...S.schemas])if(indEq(x.indicatie,t.name)&&indEq(x.subcategorie,oud))x.subcategorie=nieuw;
    t.subs[j]=nieuw;el.value=nieuw;cliInd='';save();toast(`Hernoemd naar "${nieuw}"`);
  }
});
document.addEventListener('submit',ev=>{
  const f=ev.target;
  if(f.id==='it-new-form'){ev.preventDefault();const naam=indSchoon($('#it-new').value);if(!naam)return;
    if(indTop(naam)){toast(`Er is al een indicatie "${naam}"`);return}
    S.indLijst.push({name:naam,subs:[]});indBeheer.open[naam]=true;zoek.ind='';save();indOpnieuw(`.ind-new[data-i="${S.indLijst.length-1}"] input`);toast(`Indicatie "${naam}" toegevoegd`)}
  if(f.classList?.contains('ind-new')){ev.preventDefault();const t=S.indLijst[+f.dataset.i], naam=indSchoon(f.querySelector('input').value);if(!naam)return;
    if(t.subs.some(s=>indEq(s,naam))){toast(`${t.name} heeft al een subcategorie "${naam}"`);return}
    t.subs.push(naam);save();indOpnieuw(`.ind-new[data-i="${f.dataset.i}"] input`);toast(`Subcategorie "${naam}" toegevoegd aan ${t.name}`)}
});
document.addEventListener('keydown',ev=>{
  if(ev.key==='Enter'&&['it-naam','is-naam'].includes(ev.target.dataset?.act)){ev.preventDefault();ev.target.blur()}
  if(ev.key==='Escape'&&indBeheer){indBeheer=null;render()}
});
