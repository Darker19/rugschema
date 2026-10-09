// Alle opslag van de app zit in dit ene bestand. De rest van de app gebruikt alleen deze functies:
//   start()            -> {modus, gebruiker, gegevens, afgevinkt, melding}
//                         modus 'server' (ingelogd), 'login' (inloggen nodig) of 'demo' (geen server: alleen deze browser)
//   login(email, ww)   -> {ok, fout}            uitloggen()
//   laad()             -> {gegevens, afgevinkt} (na inloggen)
//   bewaarGegevens(S), bewaarAfgevinkt(d)       opslaan (op de server met een korte vertraging, zodat snelle wijzigingen samen gaan)
//   opStatus(fn)       fn('bezig'|'opgeslagen'|'fout'|'conflict'|'uitgelogd')
// Server: de PHP-API in api/ (Hostnet). Wil je later naar bijvoorbeeld Supabase, dan vervang je alleen dit bestand.
const Opslag=(()=>{
  const KEY='rugschema4', FOLD='rugschema-folded2', API='api/';
  const lees=k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}};
  const schrijf=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  let modus='demo', versie=0, statusFn=()=>{}, timer=null, bezig=false, opnieuw=false, wachtend=false;
  let laatste={gegevens:null,afgevinkt:{}};

  async function api(actie,data){
    const r=await fetch(API+'?a='+actie,data===undefined?{credentials:'same-origin'}:{
      method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-RugSchema':'1'},body:JSON.stringify(data)});
    let json=null;
    if((r.headers.get('content-type')||'').includes('application/json'))json=await r.json().catch(()=>null);
    if(!json)throw new Error('geen-api');
    return {status:r.status,...json};
  }

  async function laad(){
    const r=await api('gegevens');
    if(r.status===401){modus='login';return null}
    versie=r.versie;laatste={gegevens:r.gegevens,afgevinkt:r.afgevinkt||{}};
    return {gegevens:r.gegevens,afgevinkt:r.afgevinkt||{}};
  }

  async function verstuur(){
    if(bezig){opnieuw=true;return}
    bezig=true;opnieuw=false;wachtend=false;statusFn('bezig');
    try{
      const r=await api('bewaar',{gegevens:laatste.gegevens,afgevinkt:laatste.afgevinkt,versie});
      if(r.status===200){versie=r.versie;statusFn('opgeslagen')}
      else if(r.status===409){wachtend=false;statusFn('conflict')}
      else if(r.status===401){modus='login';statusFn('uitgelogd')}
      else{wachtend=true;statusFn('fout')}
    }catch(e){wachtend=true;statusFn('fout')}
    bezig=false;
    if(wachtend&&!opnieuw&&modus==='server'){clearTimeout(timer);timer=setTimeout(verstuur,10000)} // zelf opnieuw proberen
    if(opnieuw&&modus==='server')verstuur();
  }
  function plan(){if(modus!=='server')return;wachtend=true;clearTimeout(timer);timer=setTimeout(verstuur,700)}
  // niet weggaan terwijl er nog iets opgeslagen moet worden
  addEventListener('beforeunload',e=>{if(modus==='server'&&(wachtend||bezig)){e.preventDefault();e.returnValue=''}});

  return {
    get modus(){return modus},
    async start(){
      try{
        const s=await api('sessie');
        if(s.status===503)return {modus:'demo',...demoGegevens(),melding:s.fout==='niet-ingesteld'?'De server is nog niet ingesteld.':'De database is niet bereikbaar.'};
        if(!s.ingelogd){modus='login';return {modus}}
        modus='server';const g=await laad();
        return g?{modus,gebruiker:{naam:s.naam,email:s.email},...g}:{modus:'login'};
      }catch(e){return {modus:'demo',...demoGegevens()}} // geen server (GitHub Pages-preview of lokaal): alleen deze browser
    },
    async login(email,wachtwoord){
      try{
        const r=await api('login',{email,wachtwoord});
        if(r.status===200){modus='server';return {ok:true,gebruiker:{naam:r.naam,email:r.email}}}
        return {ok:false,fout:r.fout};
      }catch(e){return {ok:false,fout:'geen-verbinding'}}
    },
    async uitloggen(){try{await api('uitloggen',{})}catch(e){} modus='login';versie=0},
    laad,
    opStatus:fn=>{statusFn=fn},
    laadGegevens:()=>{const s=lees(KEY);return s&&s.cards?s:null},
    bewaarGegevens:s=>{if(modus==='server'){laatste.gegevens=s;plan()}else schrijf(KEY,s)},
    laadAfgevinkt:()=>lees(KEY+'-done')||{},
    bewaarAfgevinkt:d=>{if(modus==='server'){laatste.afgevinkt=d;plan()}else schrijf(KEY+'-done',d)},
    laadIngeklapt:()=>lees(FOLD),
    bewaarIngeklapt:f=>schrijf(FOLD,f),
    wisAlles:()=>{try{[KEY,KEY+'-done'].forEach(k=>localStorage.removeItem(k))}catch(e){}}
  };
  function demoGegevens(){modus='demo';return {gegevens:lees(KEY),afgevinkt:lees(KEY+'-done')||{}}}
})();
