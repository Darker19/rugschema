// Indicaties beheren, ingedeeld in subcategorieën die je zelf maakt (bijv. Rug, Knie, Enkel).
//   S.indGroepen  = ['Rug','Knie',...]                 volgorde = volgorde in lijsten
//   S.indicaties  = [{name:'Scoliose', groep:'Rug'}]   groep '' = zonder subcategorie
// Cliënten en schema's bewaren de indicatie als tekst (c.indicatie / s.indicatie); hernoemen past die overal aan.
// indBeheer: null (dicht) of {weg: index van de indicatie die verwijderd wordt}

let indBeheer=null;

// Indicaties die bij cliënten of schema's staan maar nog niet in de lijst, komen erbij (zonder subcategorie)
function registreerIndicaties(){
  if(!S.indGroepen)S.indGroepen=structuredClone(seed.indGroepen);
  if(!S.indicaties)S.indicaties=structuredClone(seed.indicaties);
  for(const x of [...S.clients,...S.schemas]){
    const n=(x.indicatie||'').trim();
    if(n&&!S.indicaties.some(i=>indNorm(i.name)===indNorm(n)))S.indicaties.push({name:n,groep:''});
  }
}
const indInfo=n=>S.indicaties?.find(i=>indNorm(i.name)===indNorm(n));
const groepVan=n=>indInfo(n)?.groep||'';
const indGebruik=n=>({clienten:S.clients.filter(c=>indNorm(c.indicatie)===indNorm(n)).length,schemas:S.schemas.filter(s=>indNorm(s.indicatie)===indNorm(n)).length});
// Indicaties per subcategorie, in volgorde; '' (zonder subcategorie) als laatste
function indPerGroep(){
  return [...S.indGroepen,''].map(g=>({groep:g,items:S.indicaties.map((i,n)=>({...i,n})).filter(i=>i.groep===g).sort((a,b)=>a.name.localeCompare(b.name,'nl'))}));
}
const indLabel=n=>{const g=groepVan(n);return g?`${g} · ${n}`:n};

function indBeheerHtml(){
  const st=indBeheer, opties=g=>`<option value="" ${!g?'selected':''}>Zonder subcategorie</option>${S.indGroepen.map(x=>`<option value="${esc(x)}" ${x===g?'selected':''}>${esc(x)}</option>`).join('')}`;
  const blok=({groep,items},gi)=>`<section class="ind-groep">
    ${groep?`<div class="ind-kop">
        <input class="ind-groepnaam" value="${esc(groep)}" data-act="ig-naam" data-i="${gi}" maxlength="40" aria-label="Naam subcategorie">
        <span class="cat-count">${items.length} indicatie${items.length===1?'':'s'}</span>
        <span class="cat-btns">
          <button type="button" class="icon-btn" data-act="ig-op" data-i="${gi}" ${gi===0?'disabled':''} aria-label="${esc(groep)} omhoog" title="Omhoog">↑</button>
          <button type="button" class="icon-btn" data-act="ig-neer" data-i="${gi}" ${gi===S.indGroepen.length-1?'disabled':''} aria-label="${esc(groep)} omlaag" title="Omlaag">↓</button>
          <button type="button" class="icon-btn" data-act="ig-weg" data-i="${gi}" aria-label="Subcategorie ${esc(groep)} verwijderen" title="Subcategorie verwijderen">🗑</button></span></div>`
      :`<div class="ind-kop"><b class="ind-los">Zonder subcategorie</b></div>`}
    <ul class="ind-lijst">${items.map(i=>{const u=indGebruik(i.name);return `<li>
      <div class="ind-rij">
        <input value="${esc(i.name)}" data-act="ind-naam" data-n="${i.n}" maxlength="60" aria-label="Naam indicatie">
        <select data-act="ind-groep" data-n="${i.n}" aria-label="Subcategorie van ${esc(i.name)}">${opties(i.groep)}</select>
        <span class="cat-count" title="Cliënten en schema's met deze indicatie">${u.clienten} cl.${u.schemas?` · ${u.schemas} sch.`:''}</span>
        <button type="button" class="icon-btn" data-act="ind-weg" data-n="${i.n}" aria-label="${esc(i.name)} verwijderen" title="Verwijderen">🗑</button></div>
      ${st.weg===i.n?`<div class="cat-weg"><span>"${esc(i.name)}" wordt ook weggehaald bij ${u.clienten} cliënt${u.clienten===1?'':'en'}${u.schemas?` en ${u.schemas} schema`:''}. Automatisch gekoppelde cliënten worden ontkoppeld.</span>
        <button type="button" class="btn danger small" data-act="ind-weg-ok" data-n="${i.n}">Verwijderen</button><button type="button" class="btn ghost small" data-act="ind-weg-nee">Annuleren</button></div>`:''}
    </li>`}).join('')||(groep?'<li class="empty" style="padding:2px 0">Nog geen indicaties.</li>':'')}</ul>
    <form class="ind-new" data-groep="${esc(groep)}"><input maxlength="60" placeholder="Indicatie toevoegen${groep?` aan ${esc(groep)}`:''}" aria-label="Nieuwe indicatie${groep?` in ${esc(groep)}`:''}"><button class="btn ghost small">+ Toevoegen</button></form>
  </section>`;
  return `<div class="scrim" data-act="ind-close"><div class="sheet wide" role="dialog" aria-label="Indicaties beheren" tabindex="-1">
    <div><div class="label">Cliënten</div><h2>Indicaties</h2>
      <p class="lede" style="font-size:.92rem">Deel indicaties in onder subcategorieën die je zelf maakt, zoals Rug, Knie of Enkel. Een nieuwe naam passen we ook aan bij cliënten en schema's.</p></div>
    ${indPerGroep().map((b,i)=>blok(b,i)).join('')}
    <form class="cat-new" id="ig-new-form"><input id="ig-new" maxlength="40" placeholder="Nieuwe subcategorie, bijv. Knie" aria-label="Naam nieuwe subcategorie"><button class="btn">+ Subcategorie</button></form>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" style="flex:0 0 auto" data-act="ind-close">Klaar</button></div>
  </div></div>`;
}

const indSchoon=v=>String(v||'').trim().replace(/\s+/g,' ');
function indOpnieuw(focus){render();if(focus)$(focus)?.focus()}

document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-act]');if(!b)return;const a=b.dataset.act, i=+b.dataset.i, n=+b.dataset.n;
  if(a==='ind-open'){registreerIndicaties();indBeheer={};render();$('#overlay .sheet')?.focus()}
  if(a==='ind-close'){if(b.classList.contains('scrim')&&ev.target!==b)return;indBeheer=null;render()}
  if(a==='ig-op'||a==='ig-neer'){const j=a==='ig-op'?i-1:i+1;if(j<0||j>=S.indGroepen.length)return;
    [S.indGroepen[i],S.indGroepen[j]]=[S.indGroepen[j],S.indGroepen[i]];save();indOpnieuw(`[data-act="${a}"][data-i="${j}"]`)}
  if(a==='ig-weg'){const g=S.indGroepen[i], undo=snapshot();S.indGroepen.splice(i,1);S.indicaties.forEach(x=>{if(x.groep===g)x.groep=''});
    if(cliInd==='g:'+g)cliInd='';save();render();toast(`Subcategorie "${g}" verwijderd; de indicaties staan nu zonder subcategorie`,undo)}
  if(a==='ind-weg'){const x=S.indicaties[n], u=indGebruik(x.name);
    if(u.clienten||u.schemas){indBeheer.weg=n;render();return}
    const undo=snapshot();S.indicaties.splice(n,1);indBeheer.weg=null;save();render();toast(`Indicatie "${x.name}" verwijderd`,undo)}
  if(a==='ind-weg-ok'){const x=S.indicaties[n], undo=snapshot();
    S.clients.forEach(c=>{if(indNorm(c.indicatie)===indNorm(x.name))c.indicatie=''});
    S.schemas.forEach(s=>{if(indNorm(s.indicatie)===indNorm(x.name))s.indicatie=''});
    S.indicaties.splice(n,1);if(indNorm(cliInd)===indNorm(x.name))cliInd='';
    const k=koppelIndicaties();indBeheer.weg=null;save();render();toast([`Indicatie "${x.name}" verwijderd`,koppelTekst(k)].filter(Boolean).join(' · '),undo)}
  if(a==='ind-weg-nee'){indBeheer.weg=null;render()}
});
document.addEventListener('change',ev=>{
  const el=ev.target, a=el.dataset?.act;
  if(a==='ind-groep'){S.indicaties[+el.dataset.n].groep=el.value;save();render();toast(el.value?`Verplaatst naar ${el.value}`:'Verplaatst naar zonder subcategorie')}
  if(a==='ind-naam'){
    const x=S.indicaties[+el.dataset.n], oud=x.name, nieuw=indSchoon(el.value);
    if(!nieuw||nieuw===oud){el.value=oud;return}
    if(S.indicaties.some(i=>i!==x&&indNorm(i.name)===indNorm(nieuw))){el.value=oud;toast(`Er is al een indicatie "${nieuw}"`);return}
    S.clients.forEach(c=>{if(indNorm(c.indicatie)===indNorm(oud))c.indicatie=nieuw});
    S.schemas.forEach(s=>{if(indNorm(s.indicatie)===indNorm(oud))s.indicatie=nieuw});
    if(indNorm(cliInd)===indNorm(oud))cliInd=nieuw;
    x.name=nieuw;el.value=nieuw;save();toast(`Hernoemd naar "${nieuw}"`); // niet opnieuw opbouwen, zodat een volgende klik niet verloren gaat
  }
  if(a==='ig-naam'){
    const i=+el.dataset.i, oud=S.indGroepen[i], nieuw=indSchoon(el.value);
    if(!nieuw||nieuw===oud){el.value=oud;return}
    if(S.indGroepen.some((g,j)=>j!==i&&indNorm(g)===indNorm(nieuw))){el.value=oud;toast(`Er is al een subcategorie "${nieuw}"`);return}
    S.indGroepen[i]=nieuw;S.indicaties.forEach(x=>{if(x.groep===oud)x.groep=nieuw});if(cliInd==='g:'+oud)cliInd='g:'+nieuw;
    el.value=nieuw;save();toast(`Hernoemd naar "${nieuw}"`);
  }
});
document.addEventListener('submit',ev=>{
  const f=ev.target;
  if(f.id==='ig-new-form'){ev.preventDefault();const naam=indSchoon($('#ig-new').value);if(!naam)return;
    if(S.indGroepen.some(g=>indNorm(g)===indNorm(naam))){toast(`Er is al een subcategorie "${naam}"`);return}
    S.indGroepen.push(naam);save();indOpnieuw('#ig-new');toast(`Subcategorie "${naam}" toegevoegd`)}
  if(f.classList?.contains('ind-new')){ev.preventDefault();const groep=f.dataset.groep, naam=indSchoon(f.querySelector('input').value);if(!naam)return;
    const al=indInfo(naam);
    if(al){if(al.groep===groep){toast(`"${al.name}" staat al hier`);return}al.groep=groep;toast(`"${al.name}" verplaatst naar ${groep||'zonder subcategorie'}`)}
    else{S.indicaties.push({name:naam,groep});toast(`Indicatie "${naam}" toegevoegd`)}
    save();indOpnieuw(`.ind-new[data-groep="${CSS.escape(groep)}"] input`)}
});
document.addEventListener('keydown',ev=>{
  if(ev.key==='Enter'&&['ind-naam','ig-naam'].includes(ev.target.dataset?.act)){ev.preventDefault();ev.target.blur()}
  if(ev.key==='Escape'&&indBeheer){indBeheer=null;render()}
});
