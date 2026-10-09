// Oefeningen importeren uit Excel (.xlsx, .xls, .ods of .csv).
// Eén rij per oefening. Kolomkoppen: Oefening, Categorie, Sets, Herhalingen, Vasthouden (s), Rust (s), Instructie, Schema.
// Alleen "Oefening" is verplicht. Met "Schema" komt de kaart meteen in dat schema; een onbekend schema wordt aangemaakt.
// Het Excel-programma (SheetJS, js/vendor) wordt pas geladen als het importvenster opengaat.

let imp=null; // {fase:'kies'|'laden'|'check', bestand, rijen, fout}

const IMP_KOLOMMEN={
  name:['oefening','naam','training','oefeningnaam','naamoefening'],
  cat:['categorie','soort','type'],
  sets:['sets','set'],
  reps:['herhalingen','herh','reps','herhaling'],
  hold:['vasthouden','vasthoudtijd','hold','vast'],
  rest:['rust','rusttijd','pauze'],
  note:['instructie','uitleg','opmerking','notitie','instructies'],
  schema:['schema','schemas','fase']
};
const IMP_MAX=500;

function laadXlsx(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  return laadXlsx.p||(laadXlsx.p=new Promise((ok,nee)=>{
    const s=document.createElement('script');s.src='js/vendor/xlsx.full.min.js';
    s.onload=()=>ok(window.XLSX);s.onerror=()=>{laadXlsx.p=null;nee(new Error('Excel-lezer kon niet laden'))};
    document.head.append(s);
  }));
}

const impNorm=v=>String(v??'').toLowerCase().replace(/\(.*?\)/g,'').replace(/[^a-zà-ÿ0-9]/g,'');
const impCat=v=>{const n=impNorm(v);if(!n)return null;return CATS.find(c=>impNorm(c)===n||impNorm(c).startsWith(n)&&n.length>=3)||false};
const impGetal=v=>{if(v===''||v==null)return null;const n=Math.round(+String(v).replace(',','.'));return Number.isFinite(n)&&n>=0?n:false};
const impKaart=naam=>S.cards.find(c=>impNorm(c.name)===impNorm(naam));
const impSchema=naam=>S.schemas.find(s=>impNorm(s.name)===impNorm(naam));

// Zet de rijen uit het werkblad om naar een lijst met status per rij
function impVerwerk(tabel){
  const kop=tabel.findIndex(r=>r.some(c=>IMP_KOLOMMEN.name.includes(impNorm(c))));
  if(kop<0)return {fout:'Geen kolom "Oefening" gevonden. Gebruik het voorbeeldbestand als begin.'};
  const kol={};tabel[kop].forEach((c,i)=>{const n=impNorm(c);for(const [k,namen] of Object.entries(IMP_KOLOMMEN))if(kol[k]==null&&namen.includes(n))kol[k]=i});
  const data=tabel.slice(kop+1).filter(r=>r.some(c=>String(c).trim()!==''));
  if(!data.length)return {fout:'Het bestand bevat geen oefeningen onder de kopregel.'};
  if(data.length>IMP_MAX)return {fout:`Het bestand heeft ${data.length} rijen; het maximum is ${IMP_MAX}.`};
  const gezien={};
  const rijen=data.map((r,i)=>{
    const cel=k=>kol[k]==null?'':String(r[kol[k]]??'').trim();
    const rij={nr:kop+i+2,name:cel('name'),let:[],schemas:cel('schema').split(';').map(s=>s.trim()).filter(Boolean)};
    if(!rij.name){rij.status='fout';rij.let.push('Naam ontbreekt');return rij}
    const cat=impCat(cel('cat'));
    rij.cat=cat||null;
    const VELD={sets:'Sets',reps:'Herhalingen',hold:'Vasthouden',rest:'Rust'};
    for(const f in VELD){const g=impGetal(cel(f));if(g===false)rij.let.push(`${VELD[f]} "${cel(f)}" is geen getal`);rij[f]=g===false?null:g}
    rij.note=cel('note')||null;
    const k=impNorm(rij.name);
    if(gezien[k]){rij.status='extra';rij.van=gezien[k];return rij}
    gezien[k]=rij;
    rij.bestaat=impKaart(rij.name);rij.status=rij.bestaat?'bijwerken':'nieuw';
    if(cat===false)rij.let.push(`Onbekende categorie "${cel('cat')}"${rij.bestaat?': blijft '+rij.bestaat.cat:': wordt Mobiliteit'}`);
    else if(!rij.bestaat&&!rij.cat)rij.let.push('Geen categorie: wordt Mobiliteit');
    return rij;
  });
  return {rijen};
}

async function impBestand(file){
  imp={fase:'laden',bestand:file.name};render();
  try{
    const X=await laadXlsx();
    const wb=X.read(await file.arrayBuffer(),{type:'array'});
    const blad=wb.Sheets[wb.SheetNames.find(n=>impNorm(n)==='oefeningen')||wb.SheetNames[0]];
    const res=impVerwerk(X.utils.sheet_to_json(blad,{header:1,defval:'',raw:true}));
    imp={fase:res.fout?'kies':'check',bestand:file.name,...res};
  }catch(e){imp={fase:'kies',bestand:file.name,fout:'Dit bestand kan niet gelezen worden. Kies een Excel-bestand (.xlsx) of een CSV-bestand.'}}
  render();$('#overlay .sheet')?.focus();
}

function impTelling(rijen){
  const t={nieuw:0,bijwerken:0,fout:0,koppel:0,schemas:new Set()};
  rijen.forEach(r=>{if(r.status in t)t[r.status]++;
    if(r.status!=='fout')r.schemas.forEach(n=>{t.koppel++;if(!impSchema(n))t.schemas.add(n.toLowerCase())})});
  return t;
}

function impToepassen(){
  const undo=snapshot(), nieuw={}, t=impTelling(imp.rijen);
  let toegevoegd=0;
  for(const r of imp.rijen){
    if(r.status==='fout')continue;
    const bron=r.status==='extra'?r.van:r;
    let c=bron.kaart;
    if(!c){
      c=bron.bestaat;
      if(c){ // alleen ingevulde velden overschrijven
        if(bron.cat)c.cat=bron.cat;
        for(const f of ['sets','reps','hold','rest'])if(bron[f]!=null)c[f]=bron[f];
        if(bron.note)c.note=bron.note;
      }else{
        c={id:uid(),name:bron.name,cat:bron.cat||'Mobiliteit',sets:bron.sets??3,reps:bron.reps??10,hold:bron.hold??0,rest:bron.rest??30,note:bron.note||''};
        S.cards.push(c);
      }
      bron.kaart=c;
    }
    for(const n of r.schemas){
      let s=impSchema(n)||nieuw[impNorm(n)];
      if(!s){s={id:uid(),name:n,maxFlex:30,days:3,weeks:4,items:[]};S.schemas.push(s);nieuw[impNorm(n)]=s}
      if(!s.items.some(i=>i.card===c.id)){s.items.push({card:c.id,sets:c.sets,reps:c.reps,hold:c.hold,rest:c.rest});toegevoegd++}
    }
  }
  imp.rijen.forEach(r=>delete r.kaart);
  imp=null;save();render();
  const d=[t.nieuw&&`${t.nieuw} nieuw`,t.bijwerken&&`${t.bijwerken} bijgewerkt`,toegevoegd&&`${toegevoegd}× in schema`].filter(Boolean).join(', ');
  toast(`Geïmporteerd: ${d||'niets veranderd'}`,undo);
}

function impVoorbeeld(){
  laadXlsx().then(X=>{
    const rijen=[['Oefening','Categorie','Sets','Herhalingen','Vasthouden (s)','Rust (s)','Instructie','Schema'],
      ['Bekkenkantelen in rugligging','Mobiliteit',3,10,5,30,'Rustig ademen, onderrug zacht tegen de mat.','Fase 1 · Ontlasten'],
      ['Bird-dog','Stabiliteit',3,8,8,45,'Bekken stil houden, niet doorzakken.','Fase 2 · Opbouw stabiliteit'],
      ['Glute bridge','Kracht',3,12,3,45,'Billen aanspannen bovenin.','Fase 2 · Opbouw stabiliteit; Fase 3 · Belasten'],
      ['Wandelen','Conditie',1,1,0,0,'15 minuten in eigen tempo.','']];
    const uitleg=[['Kolom','Uitleg'],['Oefening','Verplicht. Bestaat de oefening al (zelfde naam), dan wordt de kaart bijgewerkt.'],
      ['Categorie',`Een van: ${CATS.join(', ')}. Leeg bij een nieuwe kaart = Mobiliteit.`],
      ['Sets, Herhalingen','Hele getallen. Leeg bij een nieuwe kaart = 3 sets, 10 herhalingen.'],
      ['Vasthouden (s), Rust (s)','Seconden. Leeg bij een nieuwe kaart = 0 en 30.'],['Instructie','Tekst die het kind ziet.'],
      ['Schema','Optioneel. Naam van het schema waar de kaart in komt. Meerdere schema\'s scheiden met ;. Een onbekend schema wordt aangemaakt.']];
    const wb=X.utils.book_new(), b1=X.utils.aoa_to_sheet(rijen), b2=X.utils.aoa_to_sheet(uitleg);
    b1['!cols']=[{wch:30},{wch:13},{wch:6},{wch:12},{wch:15},{wch:9},{wch:45},{wch:44}];b2['!cols']=[{wch:24},{wch:100}];
    X.utils.book_append_sheet(wb,b1,'Oefeningen');X.utils.book_append_sheet(wb,b2,'Uitleg');
    X.writeFile(wb,'RugSchema-oefeningen-voorbeeld.xlsx');
  }).catch(()=>toast('Voorbeeldbestand kon niet worden gemaakt'));
}

function importHtml(){
  const kop=`<div><div class="label">Importeren uit Excel</div><h2>Oefeningen importeren</h2></div>`;
  if(imp.fase==='laden')return `<div class="scrim"><div class="sheet" role="dialog" aria-label="Oefeningen importeren" tabindex="-1">${kop}<p class="empty">${esc(imp.bestand)} wordt gelezen…</p></div></div>`;
  if(imp.fase==='kies')return `<div class="scrim" data-act="imp-close"><div class="sheet" role="dialog" aria-label="Oefeningen importeren" tabindex="-1">${kop}
    <p class="lede" style="font-size:.92rem;margin:0">Eén rij per oefening, met de kolommen <b>Oefening</b>, Categorie, Sets, Herhalingen, Vasthouden (s), Rust (s), Instructie en Schema. Alleen Oefening is verplicht. Je ziet eerst wat er verandert voordat er iets wordt opgeslagen.</p>
    <label class="imp-drop"><input type="file" id="imp-file" accept=".xlsx,.xls,.ods,.csv"><span class="imp-drop-icon" aria-hidden="true">⇪</span><b>Kies een Excel-bestand</b><span>of sleep het hierheen</span></label>
    ${imp.fout?`<p class="imp-fout" role="alert">${imp.bestand?`<b>${esc(imp.bestand)}:</b> `:''}${esc(imp.fout)}</p>`:''}
    <div class="row" style="justify-content:space-between;align-items:center"><button type="button" class="btn ghost small" style="flex:0 0 auto" data-act="imp-voorbeeld">⤓ Voorbeeldbestand downloaden</button>
      <button type="button" class="btn ghost" style="flex:0 0 auto" data-act="imp-close">Annuleren</button></div></div></div>`;
  const t=impTelling(imp.rijen), ok=t.nieuw+t.bijwerken+imp.rijen.filter(r=>r.status==='extra').length;
  const LABEL={nieuw:'Nieuw',bijwerken:'Bijwerken',extra:'Extra schema',fout:'Overgeslagen'};
  return `<div class="scrim" data-act="imp-close"><div class="sheet wide" role="dialog" aria-label="Import controleren" tabindex="-1">${kop}
    <p class="lede" style="font-size:.92rem;margin:0">${esc(imp.bestand)} · ${imp.rijen.length} rij${imp.rijen.length===1?'':'en'}. Controleer en klik op Importeren.</p>
    <div class="chips">${t.nieuw?`<span class="chip">${t.nieuw} nieuwe kaart${t.nieuw===1?'':'en'}</span>`:''}${t.bijwerken?`<span class="chip">${t.bijwerken} bijwerken</span>`:''}
      ${t.koppel?`<span class="chip">${t.koppel}× in schema</span>`:''}${t.schemas.size?`<span class="chip">${t.schemas.size} nieuw schema</span>`:''}${t.fout?`<span class="chip warn">${t.fout} overgeslagen</span>`:''}</div>
    <div class="imp-tabel"><table><thead><tr><th>Rij</th><th>Oefening</th><th>Categorie</th><th>Dosering</th><th>Schema</th><th>Status</th></tr></thead><tbody>
    ${imp.rijen.map(r=>{const b=r.status==='extra'?r.van:r, c=b.bestaat, cat=b.cat||c?.cat||'Mobiliteit';
      const v=f=>b[f]??c?.[f]??{sets:3,reps:10,hold:0,rest:30}[f];
      return `<tr class="st-${r.status}"><td class="num">${r.nr}</td><td>${esc(r.name)||'<i>leeg</i>'}</td>
        <td>${r.status==='fout'?'':`<span class="cat" style="--cat:var(--c-${CATKEY[cat]})">${cat}</span>`}</td>
        <td class="num">${r.status==='fout'?'':`${v('sets')}×${v('reps')}${v('hold')?` · ${v('hold')}s`:''}${v('rest')?` · rust ${v('rest')}s`:''}`}</td>
        <td>${r.schemas.map(n=>`${esc(n)}${impSchema(n)?'':' <span class="badge">nieuw</span>'}`).join('<br>')}</td>
        <td><span class="imp-st">${LABEL[r.status]}</span>${r.let.length?`<small>${r.let.map(esc).join('<br>')}</small>`:''}</td></tr>`}).join('')}
    </tbody></table></div>
    ${t.bijwerken?`<p class="demo" style="margin:0">Bij bestaande kaarten worden alleen de ingevulde velden overschreven. De dosering in schema's waar de kaart al in staat, blijft hetzelfde.</p>`:''}
    <div class="row" style="justify-content:space-between;align-items:center">
      <button type="button" class="btn ghost small" style="flex:0 0 auto" data-act="imp-opnieuw">Ander bestand</button>
      <span style="flex:0 0 auto;display:flex;gap:8px"><button type="button" class="btn ghost" data-act="imp-close">Annuleren</button>
      <button type="button" class="btn" data-act="imp-go" ${ok?'':'disabled'}>Importeren</button></span></div></div></div>`;
}

document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
  if(a==='imp-open'){imp={fase:'kies'};render();$('#overlay .sheet')?.focus()}
  if(a==='imp-close'){if(b.classList.contains('scrim')&&ev.target!==b)return;if(imp?.fase==='laden')return;imp=null;render()}
  if(a==='imp-opnieuw'){imp={fase:'kies'};render()}
  if(a==='imp-voorbeeld')impVoorbeeld();
  if(a==='imp-go'&&imp?.rijen)impToepassen();
});
document.addEventListener('change',ev=>{if(ev.target.id==='imp-file'&&ev.target.files[0])impBestand(ev.target.files[0])});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&imp&&imp.fase!=='laden'){imp=null;render()}});
document.addEventListener('dragover',ev=>{const z=ev.target.closest?.('.imp-drop');if(z)z.classList.add('over')});
document.addEventListener('dragleave',ev=>{ev.target.closest?.('.imp-drop')?.classList.remove('over')});
