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
// Bestaande categorie (ook bij een begin van de naam, minstens 3 tekens), anders een nieuwe met die naam
const impCat=v=>{const n=impNorm(v);if(!n)return null;
  const al=cats().find(c=>impNorm(c)===n)||cats().find(c=>n.length>=3&&impNorm(c).startsWith(n));
  if(al)return {name:al,nieuw:false};
  const t=String(v).trim().replace(/\s+/g,' ');return {name:t.charAt(0).toUpperCase()+t.slice(1),nieuw:true}};
const impCatBestaat=naam=>cats().find(c=>c.toLowerCase()===naam.toLowerCase());
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
    rij.cat=cat?.name||null;rij.nieuweCat=!!cat?.nieuw;
    const VELD={sets:'Sets',reps:'Herhalingen',hold:'Vasthouden',rest:'Rust'};
    for(const f in VELD){const g=impGetal(cel(f));if(g===false)rij.let.push(`${VELD[f]} "${cel(f)}" is geen getal`);rij[f]=g===false?null:g}
    rij.note=cel('note')||null;
    const k=impNorm(rij.name);
    if(gezien[k]){rij.status='extra';rij.van=gezien[k];return rij}
    gezien[k]=rij;
    rij.bestaat=impKaart(rij.name);rij.status=rij.bestaat?'bijwerken':'nieuw';
    if(!rij.bestaat&&!rij.cat)rij.let.push(`Geen categorie: wordt ${cats()[0]}`);
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
  const t={nieuw:0,bijwerken:0,fout:0,koppel:0,schemas:new Set(),cats:new Set()};
  rijen.forEach(r=>{if(r.status in t)t[r.status]++;
    if((r.status==='nieuw'||r.status==='bijwerken')&&r.nieuweCat)t.cats.add(r.cat.toLowerCase());
    if(r.status!=='fout')r.schemas.forEach(n=>{t.koppel++;if(!impSchema(n))t.schemas.add(n.toLowerCase())})});
  return t;
}

function impToepassen(){
  const undo=snapshot(), nieuw={}, t=impTelling(imp.rijen);
  let toegevoegd=0;
  // eerst de nieuwe categorieën aanmaken (één keer per naam, hoofdletters maken niet uit)
  for(const r of imp.rijen){
    if(r.status==='fout'||r.status==='extra'||!r.cat)continue;
    const al=impCatBestaat(r.cat);
    if(al)r.cat=al;else S.cats.push({name:r.cat,color:vrijeKleur()});
  }
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
        c={id:uid(),name:bron.name,cat:bron.cat||cats()[0],sets:bron.sets??3,reps:bron.reps??10,hold:bron.hold??0,rest:bron.rest??30,note:bron.note||''};
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
  const d=[t.nieuw&&`${t.nieuw} nieuw`,t.cats.size&&`${t.cats.size} nieuwe categorie${t.cats.size===1?'':'ën'}`,t.bijwerken&&`${t.bijwerken} bijgewerkt`,toegevoegd&&`${toegevoegd}× in schema`].filter(Boolean).join(', ');
  toast(`Geïmporteerd: ${d||'niets veranderd'}`,undo);
}

// Zet keuzelijsten (gegevensvalidatie) in een werkblad. SheetJS kan dat zelf niet schrijven, dus voegen we
// het stukje XML toe in het xlsx-bestand (een zip). Andere waarden blijven toegestaan (showErrorMessage=0).
function impKeuzelijsten(X,data,blad,lijsten){
  const zip=X.CFB.read(new Uint8Array(data),{type:'array'}), f=X.CFB.find(zip,`/xl/worksheets/sheet${blad}.xml`);
  const dv=lijsten.map(([bereik,bron])=>`<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="${bereik}"><formula1>${bron}</formula1></dataValidation>`).join('');
  f.content=new TextEncoder().encode(new TextDecoder().decode(f.content).replace('</sheetData>',`</sheetData><dataValidations count="${lijsten.length}">${dv}</dataValidations>`));
  f.size=f.content.length;
  return X.CFB.write(zip,{type:'array',fileType:'zip',compression:true});
}

function impVoorbeeld(){
  laadXlsx().then(X=>{
    const ct=cats(), cat=(naam,i)=>impCatBestaat(naam)||ct.find(c=>impNorm(c).startsWith(impNorm(naam)))||ct[i%ct.length];
    const rijen=[['Oefening','Categorie','Sets','Herhalingen','Vasthouden (s)','Rust (s)','Instructie','Schema'],
      ['Bekkenkantelen in rugligging',cat('Mobiliteit',0),3,10,5,30,'Rustig ademen, onderrug zacht tegen de mat.',S.schemas[0]?.name||''],
      ['Bird-dog',cat('Stabiliteit',1),3,8,8,45,'Bekken stil houden, niet doorzakken.',S.schemas[1]?.name||''],
      ['Glute bridge',cat('Kracht',2),3,12,3,45,'Billen aanspannen bovenin.',S.schemas.slice(1,3).map(x=>x.name).join('; ')],
      ['Wandelen',cat('Conditie',3),1,1,0,0,'15 minuten in eigen tempo.','']];
    const uitleg=[['Kolom','Uitleg'],['Oefening','Verplicht. Bestaat de oefening al (zelfde naam), dan wordt de kaart bijgewerkt.'],
      ['Categorie',`Kies uit de lijst (${ct.join(', ')}) of typ een nieuwe naam: die categorie wordt dan aangemaakt. Leeg bij een nieuwe kaart = ${ct[0]}.`],
      ['Sets, Herhalingen','Hele getallen. Leeg bij een nieuwe kaart = 3 sets, 10 herhalingen.'],
      ['Vasthouden (s), Rust (s)','Seconden. Leeg bij een nieuwe kaart = 0 en 30.'],['Instructie','Tekst die het kind ziet.'],
      ['Schema','Optioneel: mag leeg blijven. Kies uit de lijst of typ een nieuwe naam: dat schema wordt dan aangemaakt. Meerdere schema\'s scheiden met ;.']];
    const n=Math.max(ct.length,S.schemas.length);
    const lijst=[['Categorieën','Schema\'s'],...Array.from({length:n},(_,i)=>[ct[i]??'',S.schemas[i]?.name??''])];
    const wb=X.utils.book_new(), b1=X.utils.aoa_to_sheet(rijen), b2=X.utils.aoa_to_sheet(uitleg), b3=X.utils.aoa_to_sheet(lijst);
    b1['!cols']=[{wch:30},{wch:16},{wch:6},{wch:12},{wch:15},{wch:9},{wch:45},{wch:44}];b2['!cols']=[{wch:24},{wch:110}];b3['!cols']=[{wch:24},{wch:40}];
    X.utils.book_append_sheet(wb,b1,'Oefeningen');X.utils.book_append_sheet(wb,b2,'Uitleg');X.utils.book_append_sheet(wb,b3,'Lijsten');
    let data=X.write(wb,{type:'array',bookType:'xlsx'});
    try{data=impKeuzelijsten(X,data,1,[[`B2:B${IMP_MAX+1}`,`Lijsten!$A$2:$A$${ct.length+1}`],...(S.schemas.length?[[`H2:H${IMP_MAX+1}`,`Lijsten!$B$2:$B$${S.schemas.length+1}`]]:[])])}
    catch(e){/* zonder keuzelijsten is het bestand nog steeds bruikbaar */}
    const url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const a=Object.assign(document.createElement('a'),{href:url,download:'RugSchema-oefeningen-voorbeeld.xlsx'});
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
      ${t.koppel?`<span class="chip">${t.koppel}× in schema</span>`:''}${t.schemas.size?`<span class="chip">${t.schemas.size} nieuw schema</span>`:''}${t.cats.size?`<span class="chip">${t.cats.size} nieuwe categorie${t.cats.size===1?'':'ën'}</span>`:''}${t.fout?`<span class="chip warn">${t.fout} overgeslagen</span>`:''}</div>
    <div class="imp-tabel"><table><thead><tr><th>Rij</th><th>Oefening</th><th>Categorie</th><th>Dosering</th><th>Schema</th><th>Status</th></tr></thead><tbody>
    ${imp.rijen.map(r=>{const b=r.status==='extra'?r.van:r, c=b.bestaat, cat=b.cat||c?.cat||cats()[0];
      const v=f=>b[f]??c?.[f]??{sets:3,reps:10,hold:0,rest:30}[f];
      return `<tr class="st-${r.status}"><td class="num">${r.nr}</td><td>${esc(r.name)||'<i>leeg</i>'}</td>
        <td>${r.status==='fout'?'':`<span class="cat" style="--cat:${b.nieuweCat&&!impCatBestaat(cat)?'var(--muted)':catColor(impCatBestaat(cat)||cat)}">${esc(cat)}</span>${b.nieuweCat&&!impCatBestaat(cat)?' <span class="badge">nieuw</span>':''}`}</td>
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
