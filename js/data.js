// Voorbeelddata: verzonnen oefeningen, schema's, cliënten en beoordelingen.
// Pas hier de testdata aan. Echte cliëntgegevens horen hier nooit in.
const seed={
  // categorieën in deze volgorde; kleur moet goed leesbaar zijn op wit
  cats:[
    {name:'Mobiliteit',color:'#2f6fb0'},{name:'Kracht',color:'#b4552a'},
    {name:'Stabiliteit',color:'#1a7f7a'},{name:'Conditie',color:'#7a4bb0'}
  ],
  cards:[
    {id:'e1',name:'Bekkenkantelen in rugligging',cat:'Mobiliteit',sets:3,reps:10,hold:5,rest:30,note:'Rustig ademen, onderrug zacht tegen de mat.'},
    {id:'e2',name:'Cat-camel (kleine uitslag)',cat:'Mobiliteit',sets:2,reps:8,hold:0,rest:30,note:'Alleen in pijnvrij bereik bewegen.'},
    {id:'e3',name:'Wandelen',cat:'Conditie',sets:1,reps:1,hold:0,rest:0,note:'15 minuten in eigen tempo.'},
    {id:'e4',name:'Bird-dog',cat:'Stabiliteit',sets:3,reps:8,hold:8,rest:45,note:'Bekken stil houden, niet doorzakken.'},
    {id:'e5',name:'Dead bug',cat:'Stabiliteit',sets:3,reps:10,hold:0,rest:45,note:'Onderrug blijft op de grond.'},
    {id:'e6',name:'Glute bridge',cat:'Kracht',sets:3,reps:12,hold:3,rest:45,note:'Billen aanspannen bovenin.'},
    {id:'e7',name:'McGill curl-up',cat:'Stabiliteit',sets:3,reps:6,hold:10,rest:30,note:'Eén knie gebogen, handen onder de onderrug.'},
    {id:'e8',name:'Hip hinge met stok',cat:'Kracht',sets:3,reps:10,hold:0,rest:60,note:'Stok raakt achterhoofd, rug en stuit.'},
    {id:'e9',name:'Zijwaartse plank',cat:'Stabiliteit',sets:3,reps:2,hold:20,rest:45,note:'Per kant.'},
    {id:'e10',name:'Goblet squat',cat:'Kracht',sets:3,reps:10,hold:0,rest:60,note:'Start met een lichte kettlebell.'},
    {id:'e11',name:'Clamshell',cat:'Kracht',sets:3,reps:12,hold:0,rest:30,note:'Voeten tegen elkaar, bovenste knie open.'},
    {id:'e12',name:'Fietsen op hometrainer',cat:'Conditie',sets:1,reps:1,hold:0,rest:0,note:'10 minuten, rechtop zitten.'},
    {id:'e13',name:'Balans op één been',cat:'Stabiliteit',sets:3,reps:2,hold:30,rest:20,note:'Per been. Ogen open, daarna dicht.'}
  ],
  schemas:[
    {id:'s1',name:'Fase 1 · Ontlasten',maxFlex:20,days:5,weeks:2,items:['e1','e2','e3']},
    {id:'s2',name:'Fase 2 · Opbouw stabiliteit',maxFlex:45,days:4,weeks:4,items:['e4','e5','e6','e7']},
    {id:'s3',name:'Fase 3 · Belasten',maxFlex:90,days:3,weeks:6,items:['e8','e9','e10']}
  ],
  clients:[
    {id:'c1',name:'Sanne de Vries',age:14,indicatie:'Scoliose',schema:'s2',custom:{maxFlex:40,removed:['e7'],extra:[{card:'e11',sets:2,reps:10,hold:0,rest:30}],tweak:{e4:{hold:5},e5:{reps:6}}}},
    {id:'c2',name:'Mehmet Yilmaz',age:11,indicatie:'Ziekte van Scheuermann',schema:'s1'},
    {id:'c3',name:'Joost Bakker',age:16,indicatie:'Lage rugpijn',schema:'s3'},
    {id:'c4',name:'Lotte Jansen',age:9,indicatie:'Scoliose',schema:''}
  ],
  ratings:[]
};
// schema-items krijgen standaard de dosering van de kaart
seed.schemas.forEach(s=>s.items=s.items.map(id=>{const c=seed.cards.find(x=>x.id===id);return {card:id,sets:c.sets,reps:c.reps,hold:c.hold,rest:c.rest}}));
// voorbeeld: persoonlijk schema voor Sanne, afgeleid van Fase 2
seed.clients.forEach(c=>{if(!c.custom)return;const b=seed.schemas.find(s=>s.id===c.schema),x=c.custom;
  c.custom={id:'p-'+c.id,client:c.id,base:b.id,name:b.name,maxFlex:x.maxFlex,days:b.days,weeks:b.weeks,
    items:[...b.items.filter(i=>!x.removed.includes(i.card)).map(i=>({...i,...(x.tweak[i.card]||{})})),...x.extra]}});
(()=>{const day=n=>new Date(Date.now()-n*864e5).toISOString().slice(0,10);
  const r=(c,e,d,hard,fun)=>seed.ratings.push({c,e,d:day(d),hard,fun});
  r('c1','e4',1,2,4);r('c1','e5',1,4,2);r('c1','e6',1,2,5);r('c1','e7',1,5,1);
  r('c1','e4',3,2,5);r('c1','e5',3,4,2);r('c1','e7',3,4,2);r('c1','e6',3,1,4);
  r('c2','e1',1,1,3);r('c2','e2',1,2,4);r('c2','e3',1,1,5);r('c2','e1',2,2,3);
  r('c3','e8',1,3,3);r('c3','e9',1,4,4);r('c3','e10',1,3,5);})();
