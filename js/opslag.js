// Alle opslag van de app zit in dit ene bestand.
// Nu: localStorage in de browser. Later vervang je alleen dit bestand door een koppeling met de echte database.
const Opslag=(()=>{
  const KEY='rugschema4', FOLD='rugschema-folded2';
  const lees=k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}};
  const schrijf=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  return {
    laadGegevens:()=>{const s=lees(KEY);return s&&s.cards?s:null},
    bewaarGegevens:s=>schrijf(KEY,s),
    laadAfgevinkt:()=>lees(KEY+'-done')||{},
    bewaarAfgevinkt:d=>schrijf(KEY+'-done',d),
    laadIngeklapt:()=>lees(FOLD),
    bewaarIngeklapt:f=>schrijf(FOLD,f),
    wisAlles:()=>{try{[KEY,KEY+'-done'].forEach(k=>localStorage.removeItem(k))}catch(e){}}
  };
})();
