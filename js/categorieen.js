// Categorieën beheren: toevoegen, hernoemen, kleur kiezen, volgorde wijzigen en verwijderen.
// Kaarten verwijzen naar een categorie via de naam (card.cat), dus hernoemen past ook de kaarten aan.
// catBeheer: null (dicht) of {kleur: naam waarvan de kleurkeuze open staat, weg: naam die verwijderd wordt}

function catBeheerHtml(){
  const st=catBeheer, telling=n=>S.cards.filter(c=>c.cat===n).length;
  return `<div class="scrim" data-act="cat-close"><div class="sheet" role="dialog" aria-label="Categorieën beheren" tabindex="-1">
    <div><div class="label">Kaartenbak</div><h2>Categorieën</h2>
      <p class="lede" style="font-size:.92rem">De volgorde hier is ook de volgorde in de kaartenbak en in de schema's. Klik op een naam om hem te wijzigen.</p></div>
    <ul class="cat-list">${S.cats.map((c,i)=>{const n=telling(c.name);return `<li class="cat-row" style="--cat:${c.color}">
      <div class="cat-main">
        <button type="button" class="cat-swatch" data-act="cat-kleuren" data-i="${i}" aria-label="Kleur van ${esc(c.name)} kiezen" aria-expanded="${st.kleur===i}"></button>
        <input class="cat-name" value="${esc(c.name)}" data-act="cat-naam" data-i="${i}" maxlength="30" aria-label="Naam categorie">
        <span class="cat-count num">${n} kaart${n===1?'':'en'}</span>
        <span class="cat-btns">
          <button type="button" class="icon-btn" data-act="cat-op" data-i="${i}" ${i===0?'disabled':''} aria-label="${esc(c.name)} omhoog" title="Omhoog">↑</button>
          <button type="button" class="icon-btn" data-act="cat-neer" data-i="${i}" ${i===S.cats.length-1?'disabled':''} aria-label="${esc(c.name)} omlaag" title="Omlaag">↓</button>
          <button type="button" class="icon-btn" data-act="cat-weg" data-i="${i}" ${S.cats.length<2?'disabled':''} aria-label="${esc(c.name)} verwijderen" title="Verwijderen">🗑</button></span>
      </div>
      ${st.kleur===i?`<div class="cat-palet" role="group" aria-label="Kleur kiezen">${CAT_KLEUREN.map(k=>`<button type="button" data-act="cat-kleur" data-i="${i}" data-k="${k}" style="--k:${k}" aria-pressed="${k===c.color}" aria-label="Kleur ${k}"></button>`).join('')}</div>`:''}
      ${st.weg===i?`<div class="cat-weg">
        <span>${n} kaart${n===1?'':'en'} verplaatsen naar</span>
        <select id="cat-naar">${S.cats.filter((_,j)=>j!==i).map(x=>`<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('')}</select>
        <button type="button" class="btn danger small" data-act="cat-weg-ok" data-i="${i}">Verwijderen</button>
        <button type="button" class="btn ghost small" data-act="cat-weg-nee">Annuleren</button></div>`:''}
    </li>`}).join('')}</ul>
    <form class="cat-new" id="cat-new-form"><input id="cat-new" maxlength="30" placeholder="Nieuwe categorie, bijv. Ademhaling" aria-label="Naam nieuwe categorie">
      <button class="btn">+ Toevoegen</button></form>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" style="flex:0 0 auto" data-act="cat-close">Klaar</button></div>
  </div></div>`;
}

const catNaamVrij=(naam,behalve)=>!S.cats.some((c,i)=>i!==behalve&&c.name.toLowerCase()===naam.toLowerCase());
function catOpnieuw(focus){render();if(focus)$(focus)?.focus()}

document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-act]');if(!b)return;const a=b.dataset.act, i=+b.dataset.i;
  if(a==='cat-open'){catBeheer={};render();$('#overlay .sheet')?.focus()}
  if(a==='cat-close'){if(b.classList.contains('scrim')&&ev.target!==b)return;catBeheer=null;render()}
  if(a==='cat-kleuren'){catBeheer.kleur=catBeheer.kleur===i?null:i;catBeheer.weg=null;catOpnieuw(`[data-act="cat-kleur"][data-i="${i}"][aria-pressed="true"]`)}
  if(a==='cat-kleur'){S.cats[i].color=b.dataset.k;catBeheer.kleur=null;save();catOpnieuw(`[data-act="cat-kleuren"][data-i="${i}"]`)}
  if(a==='cat-op'||a==='cat-neer'){const j=a==='cat-op'?i-1:i+1;if(j<0||j>=S.cats.length)return;
    [S.cats[i],S.cats[j]]=[S.cats[j],S.cats[i]];catBeheer.kleur=catBeheer.weg=null;save();catOpnieuw(`[data-act="${a}"][data-i="${j}"]`)}
  if(a==='cat-weg'){const naam=S.cats[i].name;
    if(S.cards.some(c=>c.cat===naam)){catBeheer.weg=i;catBeheer.kleur=null;catOpnieuw('#cat-naar');return}
    const undo=snapshot();S.cats.splice(i,1);if(catFilter===naam)catFilter='Alle';catBeheer.weg=null;save();render();toast(`Categorie "${naam}" verwijderd`,undo)}
  if(a==='cat-weg-ok'){const naam=S.cats[i].name, naar=$('#cat-naar').value, undo=snapshot();
    S.cards.forEach(c=>{if(c.cat===naam)c.cat=naar});S.cats.splice(i,1);if(catFilter===naam)catFilter='Alle';
    catBeheer.weg=null;save();render();toast(`"${naam}" verwijderd, kaarten staan nu bij ${naar}`,undo)}
  if(a==='cat-weg-nee'){catBeheer.weg=null;render()}
});
// hernoemen: opslaan bij verlaten van het veld of Enter
document.addEventListener('change',ev=>{
  const el=ev.target;if(el.dataset?.act!=='cat-naam')return;
  const i=+el.dataset.i, oud=S.cats[i].name, nieuw=el.value.trim().replace(/\s+/g,' ');
  if(!nieuw||nieuw===oud){el.value=oud;return}
  if(!catNaamVrij(nieuw,i)){el.value=oud;toast(`Er is al een categorie "${nieuw}"`);return}
  S.cats[i].name=nieuw;S.cards.forEach(c=>{if(c.cat===oud)c.cat=nieuw});if(catFilter===oud)catFilter=nieuw;
  // niet opnieuw opbouwen: dan gaat een klik op een andere knop (die de wijziging opslaat) verloren; sluiten bouwt alles opnieuw op
  el.value=nieuw;save();toast(`Hernoemd naar "${nieuw}"`);
});
document.addEventListener('submit',ev=>{
  if(ev.target.id!=='cat-new-form')return;ev.preventDefault();
  const naam=$('#cat-new').value.trim().replace(/\s+/g,' ');if(!naam)return;
  if(!catNaamVrij(naam)){toast(`Er is al een categorie "${naam}"`);return}
  S.cats.push({name:naam,color:vrijeKleur()});save();catOpnieuw('#cat-new');toast(`Categorie "${naam}" toegevoegd`);
});
document.addEventListener('keydown',ev=>{
  if(ev.key==='Enter'&&ev.target.dataset?.act==='cat-naam'){ev.preventDefault();ev.target.blur()}
  if(ev.key==='Escape'&&catBeheer){catBeheer=null;render()}
});
