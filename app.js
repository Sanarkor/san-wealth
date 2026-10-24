'use strict';
(function(){
const KEY='pfdash.v1'; // keep this prefix distinct from other pages on the same origin
const TOKEN_KEY='pfdash.ghtoken'; // GitHub token: localStorage only, never inside the data
const REPO='Sanarkor/san-wealth',REPO_NAME=REPO.split('/')[1],BRANCHES=['main','gh-pages'],DATA_PATH='data.json';
const DEF_SECTIONS=[
  {k:'pea',   name:'PEA',                 type:'sec', color:'#34d399'},
  {k:'cto',   name:'CTO',                 type:'sec', color:'#60a5fa'},
  {k:'savings',name:'Épargne',            type:'sav', color:'#fbbf24'},
  {k:'crypto',name:'Crypto',              type:'cry', color:'#f472b6'}
];
const PALETTE=['#34d399','#60a5fa','#a78bfa','#fbbf24','#22d3ee','#f472b6','#fb923c','#a3e635','#e879f9','#94a3b8'];
const RESERVED=new Set(['v','demo','settings','fx','cash','cryptoAt','stocksAt','updatedAt','cloudAt','app','sections','recurring','recHistory','exportedAt','savedAt']);
let SECTIONS=DEF_SECTIONS;
function cloneSecs(x){return x.map(s=>Object.assign({},s));}
function validSecs(x){if(!Array.isArray(x))return null;const out=[],seen=new Set();
  for(const s of x){if(!s||typeof s!=='object')continue;const k=String(s.k||'');if(!/^[a-z][a-z0-9_]{0,30}$/.test(k)||RESERVED.has(k)||seen.has(k))continue;
    const type=['sec','sav','cry'].includes(s.type)?s.type:'sec';seen.add(k);
    const grp=typeof s.group==='string'?s.group.trim().slice(0,60):'';
    const o={k,name:String(s.name||k).slice(0,60),type,color:/^#[0-9a-f]{3,8}$/i.test(s.color||'')?s.color:PALETTE[out.length%PALETTE.length]};if(grp)o.group=grp;out.push(o);}
  return out;}
function secsOf(d){return (d&&validSecs(d.sections))||DEF_SECTIONS;}
const CG_MAP={BTC:'bitcoin',ETH:'ethereum',DOGE:'dogecoin',SOL:'solana',HYPE:'hyperliquid',ATH:'aethir',TON:'the-open-network',DOGS:'dogs-2',
  XRP:'ripple',BNB:'binancecoin',ADA:'cardano',USDT:'tether',USDC:'usd-coin',DOT:'polkadot',AVAX:'avalanche-2',LINK:'chainlink',PEPE:'pepe',
  SHIB:'shiba-inu',NOT:'notcoin',SUI:'sui',TRX:'tron',LTC:'litecoin',POL:'polygon-ecosystem-token',MATIC:'polygon-ecosystem-token',
  ATOM:'cosmos',NEAR:'near',ARB:'arbitrum',OP:'optimism',APT:'aptos',XLM:'stellar',BCH:'bitcoin-cash',UNI:'uniswap',WIF:'dogwifcoin',BONK:'bonk',
  JUP:'jupiter-exchange-solana',TIA:'celestia',INJ:'injective-protocol',RENDER:'render-token',FET:'fetch-ai',KAS:'kaspa',ETC:'ethereum-classic'};
const CURS=['EUR','USD','GBP','CHF','CAD','JPY'];
const MAIN_CURS=['EUR','USD','GBP','CHF'];
function curOf(c){c=String(c||'EUR').toUpperCase();return MAIN_CURS.includes(c)?c:'EUR';}

/* ---------- state ---------- */
// legacy (v1) savings sections -> merged 'savings' (v2)
const LEGACY_SAV=[['savRev','',true],['savLbp','La Banque Postale',true],['spouse','Ma femme',false],['kids','Enfant',false]];
function blank(secs){secs=cloneSecs(secs||DEF_SECTIONS);const b={v:3,demo:false,sections:secs,cash:{},recurring:[],recHistory:[],
  settings:{provider:'none',apiKey:'',masked:false,collapsed:{},mainCur:'EUR'},fx:{rates:{EUR:1},at:0,src:''},cryptoAt:0,stocksAt:0};
  for(const s of secs){b[s.k]=[];if(s.type!=='sav')b.cash[s.k]={amount:0,cur:'EUR'};}return b;}
// ?vue = read-only view: data comes from the public data.json only, kept in memory, never written to localStorage
const VIEW=new URLSearchParams(location.search).has('vue');
let S=load();SECTIONS=S.sections;
function load(){
  if(VIEW)return blank();
  try{const raw=localStorage.getItem(KEY);if(!raw)return blank();return normalize(JSON.parse(raw));}catch(e){return blank();}
}
function normalize(d){
  if(!d||typeof d!=='object')return blank();
  const b=blank(secsOf(d));
  for(const s of b.sections){b[s.k]=Array.isArray(d[s.k])?d[s.k].filter(x=>x&&typeof x==='object').map(x=>Object.assign({id:uid()},x)):[];}
  for(const[k,inst,inTotal]of LEGACY_SAV){if(Array.isArray(d[k]))for(const x of d[k]){if(!x||typeof x!=='object')continue;
    if(b.savings)b.savings.push(Object.assign({id:uid(),inst,inTotal},x,{inTotal:x.inTotal===undefined?inTotal:!!x.inTotal,inst:x.inst||inst}));}}
  for(const s of b.sections)if(s.type==='sav')for(const x of b[s.k]){if(x.inTotal===undefined)x.inTotal=true;x.inTotal=!!x.inTotal;}
  if(d.cash&&typeof d.cash==='object')for(const k of b.sections.filter(s=>s.type!=='sav').map(s=>s.k)){const c=d.cash[k];if(c&&typeof c==='object'){const n=typeof c.amount==='number'?c.amount:parseFloat(String(c.amount??'').replace(/\s/g,'').replace(',','.'));
    b.cash[k]={amount:isFinite(n)?n:0,cur:(b.sections.find(s=>s.k===k).type==='sec'&&k!=='pea'&&String(c.cur).toUpperCase()==='USD')?'USD':'EUR'};}}
  if(Array.isArray(d.recurring))b.recurring=d.recurring.filter(r=>r&&typeof r==='object'&&r.id).map(r=>({id:String(r.id),sec:String(r.sec||''),lineId:String(r.lineId||''),
    amount:+r.amount||0,day:Math.min(31,Math.max(1,parseInt(r.day,10)||1)),active:r.active!==false,next:/^\d{4}-\d{2}-\d{2}$/.test(r.next||'')?r.next:'',createdAt:r.createdAt||''}));
  if(Array.isArray(d.recHistory))b.recHistory=d.recHistory.filter(h=>h&&typeof h==='object'&&h.id);
  b.demo=!!d.demo;
  if(d.settings&&typeof d.settings==='object')Object.assign(b.settings,d.settings);
  if(!b.settings.collapsed||typeof b.settings.collapsed!=='object')b.settings.collapsed={};
  b.settings.mainCur=curOf(b.settings.mainCur);
  if(d.fx&&d.fx.rates)b.fx=d.fx;
  b.cryptoAt=+d.cryptoAt||0;b.stocksAt=+d.stocksAt||0;
  b.updatedAt=+d.updatedAt||0;b.cloudAt=+d.cloudAt||0;
  return b;
}
function localTd(){try{const d=JSON.parse(localStorage.getItem(KEY)||'null');const st=d&&d.settings;return st&&st.provider==='twelvedata'&&String(st.apiKey||'').trim()?{provider:'twelvedata',apiKey:String(st.apiKey).trim()}:null;}catch(e){return null;}}
function touch(){S.updatedAt=Date.now();}
function save(){if(VIEW)return;try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){toast('Impossible d\'enregistrer (stockage plein ou bloqué)');}}
function uid(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);}

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const num=v=>{if(v===null||v===undefined||v==='')return NaN;const n=typeof v==='number'?v:parseFloat(String(v).replace(/\s/g,'').replace(',','.'));return isFinite(n)?n:NaN;};
const fEUR=new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'});
function baseCur(){return curOf(S&&S.settings&&S.settings.mainCur);}
function toBase(n){if(!isFinite(n))return NaN;const b=baseCur();if(b==='EUR')return n;const r=fx(b);return isFinite(r)&&r>0?n/r:NaN;}
function eur(n){if(!isFinite(n))return '—';const b=baseCur();if(b==='EUR')return fEUR.format(n);const v=toBase(n);return isFinite(v)?money(v,b):'—';}
function money(n,c){if(!isFinite(n))return '—';const a=Math.abs(n);const d=a===0?2:a<0.01?6:a<1?4:2;
  try{return new Intl.NumberFormat('fr-FR',{style:'currency',currency:c||'EUR',minimumFractionDigits:2,maximumFractionDigits:d}).format(n);}catch(e){return n.toFixed(d)+' '+c;}}
function qtyf(n){return isFinite(n)?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:8}).format(n):'—';}
function pct(n){return isFinite(n)?(n>=0?'+':'')+n.toFixed(2).replace('.',',')+' %':'';}
function signed(n){if(!isFinite(n))return '';const b=baseCur();const v=b==='EUR'?n:toBase(n);if(!isFinite(v))return '';const f=b==='EUR'?fEUR.format(Math.abs(v)):money(Math.abs(v),b);return (n>=0?'+':'−')+f;}
function cls(n){return !isFinite(n)||Math.abs(n)<0.005?'mut':n>0?'pos':'neg';}
function qtime(t){const d=new Date(t),n=new Date();const hm=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  return d.toDateString()===n.toDateString()?hm:d.toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'2-digit'})+' '+hm;}
const THEME_KEY='pfdash.theme'; // UI preference only, separate from the data key
function setTheme(t){const L=t==='light';document.documentElement.dataset.theme=L?'light':'dark';
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',L?'#f4f6fa':'#0b0f17');
  const b=document.getElementById('btnTheme');if(b){b.textContent=L?'☾':'☀';b.title=L?'Passer en mode sombre':'Passer en mode clair';b.setAttribute('aria-label',b.title);}}
function isToday(t){return !!t&&new Date(t).toDateString()===new Date().toDateString();}
function qlabel(t){const d=new Date(t);return isToday(t)?'cours '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'clôture '+d.toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'2-digit'});}
function ago(t){if(!t)return 'jamais';const s=(Date.now()-t)/1000;if(s<60)return 'à l\'instant';if(s<3600)return 'il y a '+Math.floor(s/60)+' min';if(s<86400)return 'il y a '+Math.floor(s/3600)+' h';
  return new Date(t).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'});}
function el(tag,attrs,...kids){const e=document.createElement(tag);if(attrs)for(const[k,v]of Object.entries(attrs)){
  if(v===undefined||v===null||v===false)continue;if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='text')e.textContent=v;else e.setAttribute(k,v===true?'':v);}
  for(const c of kids.flat()){if(c===null||c===undefined||c===false)continue;e.appendChild(typeof c==='string'?document.createTextNode(c):c);}return e;}
function toast(m,ms){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),ms||2600);}
function fx(cur){cur=(cur||'EUR').toUpperCase();if(cur==='EUR')return 1;const r=S.fx.rates[cur];return isFinite(r)&&r>0?r:NaN;} // EUR per 1 unit

/* ---------- valuation ---------- */
function lineVal(sec,l){
  if(sec.type==='sav'){const v=num(l.amount);return {value:isFinite(v)?v:0,cost:NaN,pnl:NaN};}
  const q=num(l.qty)||0;
  if(sec.type==='cry'){
    const p=num(l.price);const pru=num(l.pru);
    const value=isFinite(p)?q*p:(isFinite(pru)?q*pru:0);
    const cost=isFinite(pru)?q*pru:NaN;
    return {value,cost,pnl:isFinite(cost)&&isFinite(p)?value-cost:NaN,missing:!isFinite(p)};
  }
  const r=fx(l.cur);const p=num(l.price);const pru=num(l.pru);
  const cost=isFinite(pru)?q*pru*r:NaN;
  const value=isFinite(p)?q*p*r:(isFinite(cost)?cost:0);
  return {value,cost,pnl:isFinite(p)&&isFinite(cost)?value-cost:NaN,missing:!isFinite(p),fxMissing:!isFinite(r)};
}
function secVal(sec){let value=0,cost=0,pnl=0,hasPnl=false,off=0,offN=0;for(const l of S[sec.k]){const v=lineVal(sec,l);
  if(sec.type==='sav'&&l.inTotal===false){off+=v.value;offN++;continue;}value+=v.value;
  if(isFinite(v.pnl)){pnl+=v.pnl;cost+=v.cost;hasPnl=true;}}
  const cash=cashVal(sec.k);value+=cash; // cash: in totals, never in gain/loss
  return {value,cost,pnl:hasPnl?pnl:NaN,off,offN,cash};}
function cashVal(k){const c=S.cash&&S.cash[k];if(!c)return 0;const n=num(c.amount);if(!isFinite(n)||!n)return 0;const r=fx(c.cur);return isFinite(r)?n*r:0;}

/* ---------- render ---------- */
const editing={}; // sectionKey -> line id | 'new'
const DEF_NAME='Clebardo';
function dispName(){return String(S.settings.displayName||'').trim()||DEF_NAME;}
const BANK_RE=/banque|bank|revolut|boursorama|cr[ée]dit|caisse|lcl|bnp|soci[ée]t[ée]|postale|fortuneo|hello|n26|\bing\b|trade ?republic|bforbank|monabanq|axa|cic|hsbc|qonto|lydia|sumeria|livret|ldds|lep|pel|cel/i;
function guessHolder(l){ // only a suggestion for the form / title fallback
  const inst=String(l.inst||'').trim();if(inst&&!BANK_RE.test(inst))return inst;
  const lab=String(l.label||'').trim();const p=lab.split(/\s[–—-]\s/);if(p.length>1&&!BANK_RE.test(p[0]))return p[0].trim();
  return lab&&!BANK_RE.test(lab)?lab:'';}
function holderOf(l){return String(l.holder||'').trim()||guessHolder(l)||String(l.label||'').trim();}
function titleNames(){const out=[dispName()];const seen=new Set(out.map(x=>x.toLowerCase()));
  for(const l of SECTIONS.filter(s=>s.type==='sav').flatMap(s=>S[s.k])){if(!l.third||l.inTotal===false)continue;const h=holderOf(l);if(h&&!seen.has(h.toLowerCase())){seen.add(h.toLowerCase());out.push(h);}}
  return out;}
function renderTitle(){const n=$('#ptName');if(!n)return;n.textContent='';
  titleNames().forEach((x,i)=>{if(i)n.appendChild(document.createTextNode(' + '));n.appendChild(el('span',{class:'tn',text:x}));});}
function units(){const out=[],seen=new Map();
  for(const s of SECTIONS){if(!s.group){out.push({kind:'sec',sec:s});continue;}
    let u=seen.get(s.group);if(!u){u={kind:'grp',name:s.group,members:[],color:s.color};seen.set(s.group,u);out.push(u);}u.members.push(s);}
  return out;}
function grpVal(u){let value=0,cost=0,pnl=0,has=false,cash=0;for(const s of u.members){const v=secVal(s);value+=v.value;cash+=v.cash||0;if(isFinite(v.pnl)){pnl+=v.pnl;cost+=v.cost;has=true;}}
  return {value,cost,pnl:has?pnl:NaN,cash,off:0,offN:0};}
function render(){
  renderTitle();
  document.body.classList.toggle('masked',!!S.settings.masked);
  $('#demoBanner').classList.toggle('hidden',!S.demo);
  let total=0,tp=0,tc=0,hp=false;const parts=[];
  for(const u of units()){const v=u.kind==='grp'?grpVal(u):secVal(u.sec);total+=v.value;if(isFinite(v.pnl)){tp+=v.pnl;tc+=v.cost;hp=true;}
    parts.push({sec:u.kind==='grp'?{name:u.name,color:u.color,type:'grp'}:u.sec,v:v.value,pnl:v.pnl,cost:v.cost});}
  $('#total').textContent=eur(total);
  const tpEl=$('#totalPnl');tpEl.className='pnl amt '+(hp?cls(tp):'mut');
  tpEl.textContent='';if(hp)tpEl.append(el('span',{class:'pnl-lbl',text:'Plus/moins-value latente'}),el('span',{class:'pnl-val'},el('b',{text:signed(tp)}),tc>0?el('b',{class:'pnl-pc',text:'('+pct(tp/tc*100)+')'}):null));
  else tpEl.textContent='Plus/moins-value : renseigne PRU et cours';
  const st=[];st.push('Crypto : '+ago(S.cryptoAt));st.push('Change : '+(S.fx.at?ago(S.fx.at):'—'));
  st.push('Actions : '+(busy?'actualisation…'+(S.stocksAt?' (cache '+qtime(S.stocksAt)+')':''):(S.stocksAt?ago(S.stocksAt):'manuel')));
  if(S.cloudAt)st.push(S.updatedAt>S.cloudAt?'En ligne : modifs à sauvegarder':'En ligne : à jour');$('#status').textContent=st.join(' · ');
  drawDonut(parts,total);
  const any=SECTIONS.some(s=>S[s.k].length);$('#empty').classList.toggle('hidden',any);
  const root=$('#sections');root.textContent='';
  for(const u of units())root.appendChild(u.kind==='grp'?renderGroup(u):renderSection(u.sec));
  renderRecurring();
}
function gainPill(p){ // same figures as the envelope cards; nothing without PRU (savings, crypto without PRU)
  if(p.sec.type==='sav'||!isFinite(p.pnl)||!(p.cost>0))return el('span',{class:'lg-g none'});
  const r=p.pnl/p.cost*100;const c=cls(p.pnl);
  return el('span',{class:'lg-g pill amt '+c,title:'Plus/moins-value : '+signed(p.pnl)},(c==='pos'?'▲ +':c==='neg'?'▼ −':'')+Math.abs(r).toFixed(1).replace('.',',')+' %');
}
function drawDonut(parts,total){
  const svg=$('#donut');svg.textContent='';const NS='http://www.w3.org/2000/svg';const R=48,C=2*Math.PI*R;
  const mk=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e;};
  svg.appendChild(mk('circle',{cx:60,cy:60,r:R,fill:'none',stroke:'#1f2a3a',class:'trk','stroke-width':14}));
  let off=0;
  if(total>0)for(const p of parts){if(p.v<=0)continue;const len=p.v/total*C;
    svg.appendChild(mk('circle',{cx:60,cy:60,r:R,fill:'none',stroke:p.sec.color,'stroke-width':14,'stroke-dasharray':Math.max(len-1.2,0.01)+' '+(C-Math.max(len-1.2,0.01)),'stroke-dashoffset':-off,transform:'rotate(-90 60 60)'}));off+=len;}
  const t1=mk('text',{x:60,y:56,'text-anchor':'middle',class:'c-lbl'});t1.textContent='Enveloppes';svg.appendChild(t1);
  const t2=mk('text',{x:60,y:71,'text-anchor':'middle',class:'c-val'});t2.textContent=String(parts.filter(p=>p.v>0).length);svg.appendChild(t2);
  const lg=$('#legend');lg.textContent='';
  for(const p of parts){const li=el('li',null,el('span',{class:'dot'}),el('span',{class:'nm',text:p.sec.name}),el('span',{class:'pc',text:total>0?(p.v/total*100).toFixed(1).replace('.',',')+' %':'—'}),gainPill(p),el('span',{class:'vl amt',text:eur(p.v)}));
    li.style.setProperty('--c',p.sec.color);lg.appendChild(li);}
}
// dual EUR / USD display (CTO + Crypto only), using the app's live EUR/USD rate (frankfurter, cached in S.fx)
const DUAL=new Set(['cto','crypto']);
function isDual(sec){return !!sec&&DUAL.has(sec.k);}
function toUsd(e){const r=fx('USD');return isFinite(e)&&isFinite(r)&&r>0?e/r:NaN;}
function usdS(n){return isFinite(n)?money(n,'USD'):'—';}
function sUsd(n){return isFinite(n)?(n>=0?'+':'−')+money(Math.abs(n),'USD'):'';}
function lineUsd(sec,l,v){const c=(l.cur||'EUR').toUpperCase();const q=num(l.qty)||0,p=num(l.price),pru=num(l.pru);
  if(sec.type!=='cry'&&c==='USD'){const r=fx('USD'); // native USD line: exact $ figures, € alongside for price/PRU
    return {value:isFinite(p)?q*p:(isFinite(pru)?q*pru:0),pnl:isFinite(p)&&isFinite(pru)?q*(p-pru):NaN,cost:isFinite(pru)?q*pru:NaN,alt:[isFinite(p)&&isFinite(r)?'cours '+eur(p*r):null,isFinite(pru)&&isFinite(r)?'PRU '+eur(pru*r):null]};}
  const k=sec.type==='cry'?1:fx(c);
  return {value:toUsd(v.value),pnl:toUsd(v.pnl),cost:toUsd(v.cost),alt:[isFinite(p)?'cours '+usdS(toUsd(p*k)):null,sec.type!=='cry'&&isFinite(pru)?'PRU '+usdS(toUsd(pru*k)):null]};} // crypto: current price in $ only
function usdEl(n,signed,extra){const t=signed?sUsd(n):usdS(n);return t&&t!=='—'?el('div',{class:'usd amt'+(extra?' '+extra:''),text:t}):null;}
function totBlock(v){return el('div',{class:'sec-tot'},el('div',{class:'v amt',text:eur(v.value)}),
  isFinite(v.pnl)?el('div',{class:'pl'},v.cost>0?el('span',{class:'pill amt '+cls(v.pnl),text:pct(v.pnl/v.cost*100)}):null,el('span',{class:'pe amt '+cls(v.pnl),text:signed(v.pnl)})):null,
  v.offN?el('div',{class:'p mut amt',text:'+ '+eur(v.off)+' hors total'}):null);}
function renderGroup(u){
  const key='grp:'+u.name;const c=S.settings.collapsed[key];const collapsed=c===undefined?false:!!c;const v=grpVal(u);
  const gid='grp-'+u.members.map(s=>s.k).join('-');
  const card=el('section',{class:'card sec egrp'+(collapsed?' collapsed':''),id:gid});card.style.setProperty('--c',u.color);
  const toggle=()=>{S.settings.collapsed[key]=!collapsed;save();render();};
  const n=u.members.reduce((a,s)=>a+(S[s.k]||[]).length,0);
  card.appendChild(el('div',{class:'sec-head',role:'button',tabindex:'0','aria-expanded':String(!collapsed),'aria-controls':'body-'+gid,onclick:toggle,onkeydown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}}},
    el('div',{class:'sec-title'},el('span',{class:'bar'}),el('div',null,el('div',{text:u.name}),el('div',{class:'sec-sub',text:u.members.length+' compte(s) · '+n+' ligne(s)'+(v.cash?' · dont '+eur(v.cash)+' non investis':'')}))),
    el('div',{class:'sec-right'},totBlock(v),el('span',{class:'chev','aria-hidden':'true'}))));
  const body=el('div',{class:'sec-body grp-body',id:'body-'+gid});
  for(const s of u.members)body.appendChild(renderSection(s,true));
  card.appendChild(body);return card;
}
function renderSection(sec,isSub){
  const v=secVal(sec);const collapsed=isCollapsed(sec.k);
  const card=el('section',{class:(isSub?'sub-sec sec':'card sec')+(collapsed?' collapsed':''),id:'sec-'+sec.k});card.style.setProperty('--c',sec.color);
  const sub=S[sec.k].length+(sec.type==='sav'?' compte(s)':' ligne(s)');
  const toggle=()=>{S.settings.collapsed[sec.k]=!collapsed;save();render();};
  const head=el('div',{class:'sec-head',role:'button',tabindex:'0','aria-expanded':String(!collapsed),'aria-controls':'body-'+sec.k,onclick:toggle,onkeydown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}}},
    el('div',{class:'sec-title'},el('span',{class:'bar'}),el('div',null,el('div',{text:sec.name}),el('div',{class:'sec-sub',text:sub}))),
    el('div',{class:'sec-right'},
      el('div',{class:'sec-tot'},el('div',{class:'v amt',text:eur(v.value)}),isDual(sec)?usdEl(toUsd(v.value),false,'usd-tot'):null,
        isFinite(v.pnl)?el('div',{class:'pl'},v.cost>0?el('span',{class:'pill amt '+cls(v.pnl),text:pct(v.pnl/v.cost*100)}):null,el('span',{class:'pe amt '+cls(v.pnl),text:signed(v.pnl)})):null,
        v.offN?el('div',{class:'p mut amt',text:'+ '+eur(v.off)+' hors total'}):null),
      el('span',{class:'chev','aria-hidden':'true'})));
  card.appendChild(head);
  const body=el('div',{class:'sec-body',id:'body-'+sec.k});const list=el('div',{class:'lines'});
  let rows=S[sec.k];
  if(sec.type==='sav'){const on=rows.filter(l=>l.inTotal!==false),off=rows.filter(l=>l.inTotal===false);rows=on;
    for(const l of on)list.appendChild(editing[sec.k]===l.id?editForm(sec,l):lineRow(sec,l));
    if(off.length){list.appendChild(el('div',{class:'grp',text:'Hors total · '+eur(v.off)}));for(const l of off)list.appendChild(editing[sec.k]===l.id?editForm(sec,l):lineRow(sec,l));}
    rows=[];}
  for(const l of rows){list.appendChild(editing[sec.k]===l.id?editForm(sec,l):lineRow(sec,l));}
  if(editing[sec.k]==='new')list.appendChild(editForm(sec,null));
  if(sec.type!=='sav')list.appendChild(editing[sec.k]==='cash'?cashForm(sec):cashRow(sec));
  body.appendChild(list);
  if(!VIEW&&editing[sec.k]!=='new')body.appendChild(el('button',{class:'add',onclick:()=>{editing[sec.k]='new';render();focusFirst(sec.k);}},'+ Ajouter '+(sec.type==='sav'?'un compte':sec.type==='cry'?'une crypto':'une ligne')));
  card.appendChild(body);return card;
}
function cashRow(sec){
  const c=S.cash[sec.k]||(S.cash[sec.k]={amount:0,cur:'EUR'});const n=num(c.amount)||0;const v=cashVal(sec.k);const usd=c.cur==='USD';
  const open=()=>{if(VIEW)return;editing[sec.k]='cash';render();focusFirst(sec.k);};
  return el('div',{class:'ln cash',tabindex:VIEW?null:'0',role:VIEW?null:'button',title:VIEW?null:'Modifier les fonds disponibles',onclick:open,onkeydown:e=>{if(e.key==='Enter')open();}},
    el('div',{class:'a'},el('span',{class:'wal','aria-hidden':'true'},'👛'),el('span',{class:'ct'},'Fonds disponibles non investis')),
    el('div',{class:'r'},el('div',{class:'v amt',text:eur(v)}),isDual(sec)&&v?usdEl(usd?n:toUsd(v)):null),
    el('div',{class:'b amt',text:(usd&&!isDual(sec)?money(n,'USD')+' · ':'')+'Liquidités · hors plus/moins-value'}),
    el('div',{class:'r'}));
}
function cashForm(sec){
  const c=S.cash[sec.k]||(S.cash[sec.k]={amount:0,cur:'EUR'});
  const f=el('form',{class:'edit cash-edit',onsubmit:e=>{e.preventDefault();const fd=new FormData(f);const n=num((fd.get('amount')||'').toString().trim());
    S.cash[sec.k]={amount:isFinite(n)?n:0,cur:sec.type==='sec'&&fd.get('cur')==='USD'?'USD':'EUR'};delete editing[sec.k];touch();save();render();}});
  f.append(inp('amount','Fonds disponibles non investis'+(sec.type==='sec'&&sec.k!=='pea'?'':' (€)'),c.amount||'',{num:1,ph:'0'}));
  if(sec.type==='sec'&&sec.k!=='pea'){const s=el('select',{name:'cur'},...['EUR','USD'].map(x=>{const o=el('option',{value:x,text:x});if(c.cur===x)o.selected=true;return o;}));f.append(el('label',null,'Devise',s));}
  f.append(el('div',{class:'btns'},el('button',{type:'button',onclick:()=>{delete editing[sec.k];render();}},'Annuler'),el('button',{type:'submit',class:'primary'},'Enregistrer')));
  f.addEventListener('keydown',e=>{if(e.key==='Escape'){delete editing[sec.k];render();}});
  return f;
}
function isCollapsed(k){const c=S.settings.collapsed[k];return c===undefined?k==='savings':!!c;}
function focusFirst(k){setTimeout(()=>{const i=document.querySelector('#sec-'+k+' .edit input');if(i)i.focus();},30);}
function lineRow(sec,l){
  const v=lineVal(sec,l);let a,b,tags=[];
  if(sec.type==='sav'){
    a=l.label||'Compte';const bits=[];if(l.inst)bits.push(l.inst);if(isFinite(num(l.rate)))bits.push('Taux '+String(num(l.rate)).replace('.',',')+' %');if(l.note)bits.push(l.note);b=bits.join(' · ')||'Solde manuel';
    if(l.capped)tags.push(el('span',{class:'tag ok',text:'Plafond atteint'}));
    if(l.inTotal===false)tags.push(el('span',{class:'tag off',text:'hors total'}));
    if(l.third)tags.push(el('span',{class:'tag third',text:'tiers · '+holderOf(l)}));
  }else if(sec.type==='cry'){
    a=(l.sym||'?').toUpperCase();const bits=[qtyf(num(l.qty))+' '+(l.sym||'').toUpperCase()];
    if(isFinite(num(l.price)))bits.push(money(num(l.price),'EUR'));if(isFinite(num(l.pru)))bits.push('PRU '+money(num(l.pru),'EUR'));b=bits.join(' · ');
    if(v.missing)tags.push(el('span',{class:'tag',text:'cours ?'}));
    for(const r of S.recurring)if(r.lineId===l.id)tags.push(el('span',{class:'tag rec'+(r.active?'':' off'),text:'🔁 +'+eur(r.amount).replace(',00','')+'/mois'}));
  }else{
    a=(l.ticker||'?')+(l.name?' · '+l.name:'');const c=(l.cur||'EUR').toUpperCase();
    const bits=[qtyf(num(l.qty))+' × '+(isFinite(num(l.price))?money(num(l.price),c):'—'),'PRU '+money(num(l.pru),c)];
    if(isFinite(num(l.chg))&&l.priceSrc==='auto'&&!l.autoFail)bits.push('jour '+pct(num(l.chg)));
    let srcTxt='';if(l.priceAt)srcTxt=(l.autoFail?'dernier ':'')+(l.priceSrc==='auto'?(l.via||'auto')+' · '+(l.quoteAt?qlabel(l.quoteAt):ago(l.priceAt)):'saisi '+ago(l.priceAt));
    b=[bits.join(' · '),srcTxt];
    const wantsAuto=l.src!=='manuel'&&(l.isin||l.apiSym);
    for(const r of S.recurring)if(r.lineId===l.id)tags.push(el('span',{class:'tag rec'+(r.active?'':' off'),text:'🔁 +'+eur(r.amount).replace(',00','')+'/mois'+(r.active?'':' (pause)')}));
    if(v.missing)tags.push(el('span',{class:'tag',text:'cours manquant'}));
    else if(wantsAuto&&!l.autoFail&&l.priceSrc==='auto'&&isToday(l.quoteAt||l.priceAt))tags.push(el('span',{class:'tag ok',text:'live'}));
    else if(wantsAuto&&l.autoFail)tags.push(el('span',{class:'tag',text:'auto ✗ · cours manuel',title:'Source automatique indisponible : dernier cours connu / saisi utilisé'}));
    else tags.push(el('span',{class:'tag off',text:'manuel'}));
    if(v.fxMissing)tags.push(el('span',{class:'tag',text:'change ?'}));
  }
  const U=isDual(sec)?lineUsd(sec,l,v):null;
  return el('div',{class:'ln'+(sec.type==='sav'&&l.inTotal===false?' off':'')+(U?' dual':''),tabindex:VIEW?null:'0',role:VIEW?null:'button',onclick:VIEW?null:()=>{editing[sec.k]=l.id;render();focusFirst(sec.k);},onkeydown:VIEW?null:e=>{if(e.key==='Enter'){editing[sec.k]=l.id;render();focusFirst(sec.k);}}},
    el('div',{class:'a'},sec.type==='sav'?el('input',{type:'checkbox',class:'tot-cb',title:'Compte dans le total','aria-label':'Compte dans le total',checked:l.inTotal!==false,disabled:VIEW,
      onclick:e=>{e.stopPropagation();if(VIEW){e.preventDefault();return;}l.inTotal=e.target.checked;touch();save();render();},onkeydown:e=>e.stopPropagation()}):null,a,...tags),
    el('div',{class:'r'},el('div',{class:'v amt',text:eur(v.value)}),U?usdEl(U.value):null),
    Array.isArray(b)?el('div',{class:'b amt'},el('span',{class:'bm',text:b[0]}),b[1]?el('span',{class:'bs',text:b[1]}):null):el('div',{class:'b amt',text:b}),
    el('div',{class:'r'},isFinite(v.pnl)?el('div',{class:'p amt '+cls(v.pnl),text:signed(v.pnl)+(v.cost>0?' '+pct(v.pnl/v.cost*100):'')}):el('div',{class:'p',text:''})),
    U&&U.alt.some(Boolean)?el('div',{class:'b2 amt',text:'≈ '+U.alt.filter(Boolean).join(' · ')}):null);
}
function inp(name,label,val,opts={}){
  const i=el('input',{name,value:val===undefined||val===null?'':String(val),placeholder:opts.ph||'',inputmode:opts.num?'decimal':null,autocomplete:'off',spellcheck:'false',type:opts.type||'text'});
  if(opts.type==='checkbox'){i.checked=!!val;i.value='1';}
  return el('label',{class:opts.full?'full':null},label,i);
}
function editForm(sec,l){
  const isNew=!l;l=l||{};
  const f=el('form',{class:'edit',onsubmit:e=>{e.preventDefault();commit(sec,l.id,new FormData(f),f);}});
  if(sec.type==='sav'){
    f.append(inp('label','Libellé',l.label,{ph:'ex. Livret A'}),inp('inst','Établissement / titulaire',l.inst,{ph:'ex. banque, prénom'}),inp('amount','Solde (€)',l.amount,{num:1}),inp('rate','Taux % (facultatif)',l.rate,{num:1}));
    const cb=el('input',{type:'checkbox',name:'capped'});cb.checked=!!l.capped;f.append(el('label',{class:'chk'},el('span',null,cb,' Plafond atteint / intérêts compensés')));
    const ct=el('input',{type:'checkbox',name:'inTotal'});ct.checked=l.inTotal!==false;f.append(el('label',{class:'chk'},el('span',null,ct,' Compte dans le total')));
    const tp=el('input',{type:'checkbox',name:'third'});tp.checked=!!l.third;f.append(el('label',{class:'chk'},el('span',null,tp,' Compte tiers')));
    const hl=inp('holder','Titulaire',l.holder||guessHolder(l),{ph:'ex. prénom'});hl.classList.toggle('hidden',!tp.checked);f.append(hl);
    tp.addEventListener('change',()=>{hl.classList.toggle('hidden',!tp.checked);if(tp.checked)setTimeout(()=>hl.querySelector('input').focus(),0);});
    f.append(inp('note','Note (facultatif)',l.note,{full:1,ph:'ex. intérêts capitalisés au 31/12'}));
  }else if(sec.type==='cry'){
    f.append(inp('sym','Symbole',l.sym,{ph:'BTC'}),inp('qty','Quantité',l.qty,{num:1}),inp('pru','PRU € (facultatif)',l.pru,{num:1}),
      inp('cgId','ID CoinGecko (auto)',l.cgId,{ph:CG_MAP[(l.sym||'').toUpperCase()]||'auto'}),inp('price','Cours € (auto / manuel)',l.price,{num:1,full:1}));
  }else{
    const cur=el('select',{name:'cur'},...CURS.map(c=>{const o=el('option',{value:c,text:c});if((l.cur||(sec.k==='cto'?'USD':'EUR'))===c)o.selected=true;return o;}));
    const src=el('select',{name:'src'},...[['auto','Automatique'],['manuel','Manuel uniquement']].map(([v,t])=>{const o=el('option',{value:v,text:t});if((l.src||'auto')===v)o.selected=true;return o;}));
    f.append(inp('ticker','Ticker',l.ticker,{ph:'ex. CW8'}),inp('name','Nom (facultatif)',l.name),inp('qty','Quantité',l.qty,{num:1}),inp('pru','PRU',l.pru,{num:1}),
      el('label',null,'Devise',cur),inp('price','Dernier cours (secours)',l.price,{num:1}),el('label',null,'Cours',src),
      inp('isin','ISIN (cours auto sans clé)',l.isin,{ph:'ex. FR0011871110'}),inp('apiSym','Symbole Twelve Data / AV',l.apiSym,{ph:'ex. IONQ'}),
      inp('mkt','Place onvista (facultatif)',l.mkt,{ph:'_PAR, _NYS, _NAS…'}));
  }
  const btns=el('div',{class:'btns'});
  if(!isNew)btns.append(el('button',{type:'button',class:'danger',onclick:async()=>{if(await ask('Supprimer cette ligne ?',{ok:'Supprimer',danger:1})){S[sec.k]=S[sec.k].filter(x=>x.id!==l.id);delete editing[sec.k];touch();save();render();}}},'Supprimer'));
  btns.append(el('button',{type:'button',onclick:()=>{delete editing[sec.k];render();}},'Annuler'),el('button',{type:'submit',class:'primary'},'Enregistrer'));
  f.append(btns);
  f.addEventListener('keydown',e=>{if(e.key==='Escape'){delete editing[sec.k];render();}});
  return f;
}
function commit(sec,id,fd,form){
  const g=k=>(fd.get(k)||'').toString().trim();const n=k=>{const v=num(g(k));return isFinite(v)?v:null;};
  let o;
  if(sec.type==='sav'){if(!g('label')&&n('amount')===null){toast('Renseigne au moins un libellé ou un solde');return;}
    o={label:g('label')||'Compte',inst:g('inst'),amount:n('amount')??0,rate:n('rate'),note:g('note'),capped:!!form.querySelector('[name=capped]')?.checked,inTotal:!!form.querySelector('[name=inTotal]')?.checked,third:!!form.querySelector('[name=third]')?.checked,holder:g('holder')};}
  else if(sec.type==='cry'){if(!g('sym')){toast('Symbole requis');return;}o={sym:g('sym').toUpperCase(),qty:n('qty')??0,pru:n('pru'),cgId:g('cgId').toLowerCase()};
    const p=n('price');o.price=p;}
  else{if(!g('ticker')){toast('Ticker requis');return;}o={ticker:g('ticker').toUpperCase(),name:g('name'),qty:n('qty')??0,pru:n('pru'),cur:g('cur')||'EUR',apiSym:g('apiSym'),isin:g('isin').toUpperCase(),mkt:g('mkt'),src:g('src')||'auto'};o.price=n('price');
    const ex0=S[sec.k].find(x=>x.id===id);if(ex0&&(ex0.isin!==o.isin))o.ovType='';}
  const arr=S[sec.k];const ex=arr.find(x=>x.id===id);
  if(ex){
    if(sec.type!=='sav'&&o.price!==ex.price){o.priceAt=o.price===null?0:Date.now();o.priceSrc='manuel';o.chg=null;}
    if(sec.type==='cry'&&o.sym!==ex.sym&&!g('cgId'))o.cgId='';
    Object.assign(ex,o);
  }else{o.id=uid();if(sec.type!=='sav'&&o.price!==null){o.priceAt=Date.now();o.priceSrc='manuel';}arr.push(o);}
  delete editing[sec.k];touch();save();render();
  if(sec.type==='cry'&&(!ex||o.price===null||!o.cgId))refreshCrypto(true);
}

/* ---------- prices ---------- */
async function getJSON(url){const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),12000);
  try{const r=await fetch(url,{signal:ctl.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(t);}}
async function refreshFx(){
  const need=new Set(['USD']);if(baseCur()!=='EUR')need.add(baseCur());for(const l of stockLines())if(l.cur&&l.cur!=='EUR')need.add(l.cur.toUpperCase());for(const k in S.cash){const c=S.cash[k];if(c&&c.cur&&c.cur!=='EUR')need.add(c.cur);}
  try{const d=await getJSON('https://api.frankfurter.dev/v1/latest?base=EUR&symbols='+[...need].join(','));
    const rates={EUR:1};for(const[c,r]of Object.entries(d.rates||{}))if(r>0)rates[c]=1/r;S.fx={rates,at:Date.now(),src:'frankfurter ('+d.date+')'};return true;}
  catch(e){try{const d=await getJSON('https://open.er-api.com/v6/latest/EUR');const rates={EUR:1};for(const c of need)if(d.rates&&d.rates[c]>0)rates[c]=1/d.rates[c];
    S.fx={rates,at:Date.now(),src:'open.er-api'};return true;}catch(e2){return false;}}
}
async function resolveCg(sym){
  if(CG_MAP[sym])return CG_MAP[sym];
  try{const d=await getJSON('https://api.coingecko.com/api/v3/search?query='+encodeURIComponent(sym));
    const c=(d.coins||[]).filter(x=>(x.symbol||'').toUpperCase()===sym).sort((a,b)=>(a.market_cap_rank||1e9)-(b.market_cap_rank||1e9))[0];return c?c.id:'';}catch(e){return '';}
}
async function refreshCrypto(quiet){
  if(!S.crypto.length)return true;
  for(const l of S.crypto){if(!l.cgId){const id=await resolveCg((l.sym||'').toUpperCase());if(id)l.cgId=id;}}
  const ids=[...new Set(S.crypto.map(l=>l.cgId).filter(Boolean))];if(!ids.length)return false;
  try{const d=await getJSON('https://api.coingecko.com/api/v3/simple/price?vs_currencies=eur&ids='+ids.map(encodeURIComponent).join(','));
    const now=Date.now();for(const l of S.crypto){const p=d[l.cgId]&&d[l.cgId].eur;if(isFinite(p)){l.price=p;l.priceAt=now;l.priceSrc='auto';}}
    S.cryptoAt=now;save();if(quiet)render();return true;}
  catch(e){if(!quiet)toast('CoinGecko indisponible (limite de requêtes ?)');return false;}
}
function stockLines(){return SECTIONS.filter(s=>s.type==='sec').flatMap(s=>S[s.k]||[]);}
function today(){return new Date().toISOString().slice(0,10);}
function tdBudget(n){const u=S.settings.tdUse||{};if(u.d!==today()){u.d=today();u.n=0;}
  if(u.n+n>700)return false;u.n+=n;S.settings.tdUse=u;return true;}
const TD_CALLS='pfdash.tdcalls',TD_GAP=31e3,TD_PER_MIN=2,TD_EVERY=4.5*60e3;
function tdGuard(){ // shared by every open tab through localStorage
  const now=Date.now();let c=[];try{c=JSON.parse(localStorage.getItem(TD_CALLS)||'[]').filter(t=>now-t<60e3);}catch(e){c=[];}
  if(c.length>=TD_PER_MIN||(c.length&&now-Math.max(...c)<TD_GAP))return false;
  c.push(now);try{localStorage.setItem(TD_CALLS,JSON.stringify(c));}catch(e){}return true;
}
function tdDue(lines,manual){const at=S.settings.tdSymAt||{};const now=Date.now();
  return [...new Set(lines.filter(l=>l.apiSym).map(l=>l.apiSym.trim()))].filter(s=>manual||now-(at[s]||0)>TD_EVERY).sort((x,y)=>(at[x]||0)-(at[y]||0));}
async function tdOne(sym,lines,key,now){
  if(!tdGuard()||!tdBudget(1))return null;
  S.settings.tdSymAt=Object.assign({},S.settings.tdSymAt,{[sym]:now});
  try{const r=await getJSON('https://api.twelvedata.com/quote?apikey='+encodeURIComponent(key)+'&symbol='+encodeURIComponent(sym));
    const p=r&&!r.code&&num(r.close);if(!isFinite(p))return [];const out=[];
    for(const l of lines)if(l.apiSym&&l.apiSym.trim()===sym){l.price=p;l.chg=isFinite(num(r.percent_change))?num(r.percent_change):null;l.priceAt=now;l.quoteAt=(+r.last_quote_at||+r.timestamp||0)*1000;l.priceSrc='auto';l.via='Twelve Data';l.autoFail=false;out.push(l);}
    return out;}catch(e){return [];}
}
let tdTimer=null;
function tdSchedule(){if(tdTimer)return;tdTimer=setTimeout(async()=>{tdTimer=null;
  const key=(S.settings.apiKey||'').trim();if(S.settings.provider!=='twelvedata'||!key)return;
  const lines=stockLines().filter(l=>l.src!=='manuel'&&l.apiSym);const syms=tdDue(lines,false);if(!syms.length)return;
  const r=await tdOne(syms[0],lines,key,Date.now());if(r&&r.length){S.stocksAt=Date.now();save();render();}
  if(syms.length>1||!r)tdSchedule();},TD_GAP+500);}
const OV_CACHE='pfdash.ovcache',OV='https://api.onvista.de/api/v1/instruments/';
function ovCache(){try{return JSON.parse(localStorage.getItem(OV_CACHE)||'{}')||{};}catch(e){return {};}}
function ovKey(l){return [l.isin,(l.cur||'EUR').toUpperCase(),l.mkt||''].join('|');}
function ovStore(k,v){const c=ovCache();if(v)c[k]=v;else delete c[k];try{localStorage.setItem(OV_CACHE,JSON.stringify(c));}catch(e){}}
function ovOut(q,name){const t=Date.parse(q.datetimeLast||'');return {price:num(q.last),chg:num(q.performancePct),quoteAt:isFinite(t)?t:0,via:'onvista '+(name||(q.market&&q.market.name)||'')};}
async function onvista(l){
  const k=ovKey(l);const c=ovCache()[k];
  if(c&&c.id&&c.not){ // fast path: ~1 KB quote of the cached notation, no ISIN lookup
    try{const q=await getJSON(OV+c.t+'/'+encodeURIComponent(c.id)+'/quote?idNotation='+encodeURIComponent(c.not));
      if(q&&isFinite(num(q.last))&&(!q.isoCurrency||q.isoCurrency===(l.cur||'EUR').toUpperCase())){l.ovType=c.t;return ovOut(q,c.name);}}catch(e){}
    ovStore(k,null); // stale -> resolve again below
  }
  const types=l.ovType?[l.ovType]:['FUND','STOCK','DERIVATIVE']; // DERIVATIVE: ETC (e.g. physical gold)
  let d=null;
  for(const t of types){try{d=await getJSON(OV+t+'/ISIN:'+encodeURIComponent(l.isin)+'/snapshot');l.ovType=t;break;}catch(e){d=null;}}
  if(!d&&l.ovType){for(const t of ['FUND','STOCK','DERIVATIVE'].filter(x=>x!==l.ovType)){try{d=await getJSON(OV+t+'/ISIN:'+encodeURIComponent(l.isin)+'/snapshot');l.ovType=t;break;}catch(e){d=null;}}}
  if(!d)return null;
  const list=(d.quoteList&&d.quoteList.list)||[];const cur=(l.cur||'EUR').toUpperCase();
  const pref=[l.mkt,'_PAR','_NMS','_NAS','_NYS','_GER','_AMS','_BRU','_MIL'].filter(Boolean);
  let q=null;for(const m of pref){q=list.find(x=>x.market&&x.market.codeMarket===m&&x.isoCurrency===cur);if(q)break;}
  if(!q)q=list.find(x=>x.isoCurrency===cur);
  if(!q||!isFinite(num(q.last)))return null;
  const id=q.entityValue||q.idInstrument||(d.instrument&&d.instrument.entityValue);
  if(id&&q.market&&q.market.idNotation)ovStore(k,{t:l.ovType,id:String(id),not:String(q.market.idNotation),name:q.market.name||'',at:Date.now()});
  return ovOut(q);
}
async function pool(items,n,fn){let i=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const it=items[i++];try{await fn(it);}catch(e){}}}));}
let rTimer=null;function softRender(){if(rTimer)return;rTimer=setTimeout(()=>{rTimer=null;render();},120);}
async function refreshStocks(manual){
  const lines=stockLines().filter(l=>l.src!=='manuel'&&(l.apiSym||l.isin));if(!lines.length)return null;
  const prov=S.settings.provider,key=(S.settings.apiKey||'').trim();const now=Date.now();const done=new Set();
  const setP=(l,r)=>{l.price=r.price;l.chg=isFinite(r.chg)?r.chg:null;l.priceAt=Date.now();l.quoteAt=r.quoteAt||0;l.priceSrc='auto';l.via=r.via;l.autoFail=false;done.add(l);softRender();};
  const ovRun=ls=>pool(ls.filter(l=>!done.has(l)&&l.isin),6,async l=>{const r=await onvista(l);if(r)setP(l,r);});
  const useTd=prov==='twelvedata'&&key;
  // onvista (keyless, CORS) by ISIN for every line Twelve Data does not handle — 6 requests in parallel, started right away
  const ovFirst=ovRun(lines.filter(l=>!((useTd||prov==='alphavantage'&&key)&&l.apiSym)));
  // 1) Twelve Data first for lines with a symbol (free plan: US stocks such as COP): ONE symbol per call, >=31 s apart,
  //    max 2 calls/min across all tabs, each symbol <= every 4.5 min, <=700/day; runs in parallel with onvista
  const tdPart=(async()=>{if(!useTd)return;
    const syms=tdDue(lines,manual);
    if(syms.length){const r=await tdOne(syms[0],lines,key,now);if(r)for(const l of r){done.add(l);softRender();}if(syms.length>1)tdSchedule();}
    for(const l of lines)if(l.apiSym&&l.via==='Twelve Data'&&!l.autoFail&&!done.has(l)&&now-(l.priceAt||0)<15*60e3)done.add(l); // keep a recent TD quote until its turn
    await ovRun(lines.filter(l=>l.apiSym)); // onvista fallback for symbols TD could not price
  })();
  // 2) Alpha Vantage (optional)
  const avPart=(async()=>{if(!(prov==='alphavantage'&&key))return;for(const l of lines){if(!l.apiSym||done.has(l))continue;
    try{const d=await getJSON('https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol='+encodeURIComponent(l.apiSym)+'&apikey='+encodeURIComponent(key));
      const g=d['Global Quote'];const p=g&&num(g['05. price']);if(isFinite(p))setP(l,{price:p,chg:num(String(g['10. change percent']||'').replace('%','')),via:'Alpha Vantage'});}catch(e){}}
    await ovRun(lines.filter(l=>l.apiSym));})();
  await Promise.all([ovFirst,tdPart,avPart]);
  let ok=0,fail=0;for(const l of lines){if(done.has(l))ok++;else{l.autoFail=true;fail++;}}
  if(ok)S.stocksAt=now;return {ok,fail};
}
let busy=false;
async function refreshAll(manual){
  if(busy)return;busy=true;$('#btnRefresh').classList.add('spin');
  const msgs=[];
  render();
  const [fxOk,cOk,st]=await Promise.all([refreshFx().then(r=>{softRender();return r;}),refreshCrypto(false).then(r=>{softRender();return r;}),refreshStocks(manual)]);
  if(!fxOk)msgs.push('change indisponible');if(!cOk)msgs.push('crypto indisponible');
  if(st&&st.fail)msgs.push(st.fail+' cours action en manuel');
  save();render();busy=false;$('#btnRefresh').classList.remove('spin');
  if(manual)toast(msgs.length?'Actualisé — '+msgs.join(', '):'Cours actualisés');
}

/* ---------- demo / io ---------- */
function demo(){
  const d=blank();d.demo=true;d.settings=Object.assign({},S.settings);d.fx=S.fx;
  d.pea=[{id:uid(),ticker:'DEMO-MONDE',name:'Démo ETF Monde',qty:10,pru:100,cur:'EUR',price:112.5,priceAt:Date.now(),priceSrc:'manuel'},
         {id:uid(),ticker:'DEMO-EUR',name:'Démo Action Europe',qty:25,pru:40,cur:'EUR',price:36.2,priceAt:Date.now(),priceSrc:'manuel'}];
  d.cto=[{id:uid(),ticker:'DEMO-US',name:'Démo Tech US',qty:5,pru:150,cur:'USD',price:171,priceAt:Date.now(),priceSrc:'manuel'}];
  d.savings=[{id:uid(),label:'Démo Coffre',inst:'Banque Démo A',amount:1500,rate:2.5,note:'',inTotal:true},
    {id:uid(),label:'Démo Livret',inst:'Banque Démo B',amount:5000,rate:1.5,capped:false,note:'',inTotal:true},
    {id:uid(),label:'Démo Livret plafonné',inst:'Banque Démo B',amount:10000,rate:1.5,capped:true,note:'Démo',inTotal:true},
    {id:uid(),label:'Démo LEP conjoint',inst:'Alex',amount:3000,rate:3.5,note:'',inTotal:true,third:true,holder:'Alex'},
    {id:uid(),label:'Démo Livret enfant',inst:'Enfant A',amount:800,note:'',inTotal:false,third:true,holder:'Enfant A'}];
  d.cash={pea:{amount:150,cur:'EUR'},cto:{amount:200,cur:'USD'},crypto:{amount:50,cur:'EUR'}};
  d.crypto=[{id:uid(),sym:'BTC',qty:0.01,pru:50000,cgId:'bitcoin'},{id:uid(),sym:'ETH',qty:0.2,pru:2000,cgId:'ethereum'}];
  return d;
}
function exportJSON(){
  const out=JSON.parse(JSON.stringify(S));out.exportedAt=new Date().toISOString();out.app='pf-dash';
  const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});const a=el('a',{href:URL.createObjectURL(blob),download:'portefeuille-'+new Date().toISOString().slice(0,10)+'.json'});
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);toast('Export téléchargé');
}
function isData(d){return d&&typeof d==='object'&&(Array.isArray(d.sections)||secsOf(d).some(s=>Array.isArray(d[s.k]))||LEGACY_SAV.some(x=>Array.isArray(d[x[0]])));}
function applyImport(d){const keepKey=S.settings.apiKey,keepCol=S.settings.collapsed,keepMask=S.settings.masked;S=normalize(d);SECTIONS=S.sections;S.settings.collapsed=keepCol;S.settings.masked=keepMask;if(!S.settings.apiKey&&keepKey)S.settings.apiKey=keepKey;S.cloudAt=0;touch();save();render();refreshAll(false);}
/* in-page modal (window.confirm can be blocked in webviews) */
function ask(msg,opts={}){return new Promise(res=>{
  const prev=document.querySelector('.modal-bg');if(prev)prev.remove();
  const done=v=>{bg.remove();document.removeEventListener('keydown',kd);res(v);};
  const kd=e=>{if(e.key==='Escape')done(false);};
  const ok=el('button',{type:'button',class:opts.danger?'b danger':'b primary',onclick:()=>done(true)},opts.ok||'OK');
  const bg=el('div',{class:'modal-bg',role:'dialog','aria-modal':'true'},el('div',{class:'modal'},
    el('div',{class:'modal-msg',text:msg}),opts.sub?el('div',{class:'hint',text:opts.sub}):null,
    el('div',{class:'row-btns end'},el('button',{type:'button',class:'b',onclick:()=>done(false)},opts.cancel||'Annuler'),ok)));
  document.body.appendChild(bg);document.addEventListener('keydown',kd);setTimeout(()=>ok.focus(),30);
});}
async function decodePayload(str){
  str=String(str||'').trim();const i=str.indexOf('#import=');if(i>=0)str=str.slice(i+8);else if(str.startsWith('import='))str=str.slice(7);
  if(str.startsWith('{'))return JSON.parse(str);
  let b64=decodeURIComponent(str).replace(/\s/g,'').replace(/-/g,'+').replace(/_/g,'/');while(b64.length%4)b64+='=';
  const bin=atob(b64);const bytes=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)bytes[k]=bin.charCodeAt(k);
  if(bytes[0]===0x7b||bytes[0]===0xef)return JSON.parse(new TextDecoder().decode(bytes));
  if(typeof DecompressionStream==='undefined')throw new Error('nocompress');
  const fmt=(bytes[0]&0x0f)===8&&((bytes[0]<<8)|bytes[1])%31===0?'deflate':'deflate-raw';
  const st=new Blob([bytes]).stream().pipeThrough(new DecompressionStream(fmt));return JSON.parse(await new Response(st).text());
}
let importing=false;
async function importFromText(txt,fromHash){
  if(importing)return;importing=true;
  try{
    let d;try{d=await decodePayload(txt);}catch(e){toast(e.message==='nocompress'?'Navigateur trop ancien pour ce lien compressé : utilise le lien non compressé':'Lien d\'import invalide');return;}
    if(!isData(d)){toast('Données d\'import invalides');return;}
    const has=SECTIONS.some(s=>S[s.k].length);
    const n=secsOf(d).reduce((a,s)=>a+(Array.isArray(d[s.k])?d[s.k].length:0),0);
    if(!await ask('Importer ces données ?',{ok:'Importer',sub:n+' ligne(s) au total.'+(has?' Les données actuelles de ce navigateur seront remplacées.':'')})){toast('Import annulé');return;}
    applyImport(d);toast('Import réussi');
  }finally{importing=false;}
}
function hashImport(){
  const h=location.hash||'';if(h.indexOf('#import=')!==0)return;
  const payload=h;
  try{history.replaceState(null,'',location.pathname+location.search);}catch(e){try{location.hash='';}catch(_){}}
  importFromText(payload,true);
}
function importJSON(file){
  const r=new FileReader();r.onload=async()=>{let d;try{d=JSON.parse(r.result);if(!isData(d))throw 0;}catch(e){toast('Fichier invalide');return;}
    if(!await ask('Remplacer les données actuelles par celles du fichier ?',{ok:'Importer'}))return;
    applyImport(d);toast('Import réussi');};r.readAsText(file);
}


/* ---------- online copy (data.json in the repo) ---------- */
function cleanForCloud(){ // never publish the API key, the GitHub token or local UI state
  const o=JSON.parse(JSON.stringify(S));
  o.settings={provider:o.settings.provider||'none',displayName:String(o.settings.displayName||'').trim()};
  delete o.cloudAt;o.app='pf-dash';o.demo=false;return o;
}
function applyRemote(d){ // keep this browser's settings (API key, provider, masked, collapsed)
  const st=S.settings;S=normalize(d);SECTIONS=S.sections;
  if(st.provider&&st.provider!=='none'||st.apiKey)S.settings=st;
  else S.settings=Object.assign({},S.settings,{apiKey:'',collapsed:st.collapsed||{},masked:!!st.masked});
  delete S.settings.token;
  S.settings.displayName=(d.settings&&typeof d.settings.displayName==='string')?d.settings.displayName:(st.displayName||'');
  S.updatedAt=+d.updatedAt||0;S.cloudAt=S.updatedAt;save();render();refreshAll(false);
}
async function fetchRemote(fresh){
  if(fresh){ // GitHub API: freshest copy (no CDN cache)
    try{const r=await fetch('https://api.github.com/repos/'+REPO+'/contents/'+DATA_PATH+'?ref=gh-pages&t='+Date.now(),
      {cache:'no-store',credentials:'omit',headers:{Accept:'application/vnd.github.raw+json'}});
      if(r.ok){const d=await r.json();if(isData(d))return d;}}catch(e){}
  }
  try{const r=await fetch(DATA_PATH+'?t='+Date.now(),{cache:'no-store',credentials:'omit'});if(!r.ok)return null;const d=await r.json();return isData(d)?d:null;}
  catch(e){return null;}
}
async function syncFromRemote(){
  if(location.hash.indexOf('#import=')===0)return;
  const d=await fetchRemote(false);if(!d)return;
  const ru=+d.updatedAt||0;const has=SECTIONS.some(s=>S[s.k].length);
  if(!has||S.demo){applyRemote(d);toast('Données en ligne chargées');return;}
  if(ru<=(S.updatedAt||0))return;
  if(S.updatedAt&&S.cloudAt&&S.updatedAt<=S.cloudAt){applyRemote(d);toast('Sauvegarde en ligne plus récente chargée');return;}
  if(await ask('Une sauvegarde en ligne plus récente existe. La charger ?',{ok:'Charger',
    sub:'Sauvegarde en ligne du '+new Date(ru).toLocaleString('fr-FR')+'. Les données de ce navigateur seront remplacées (Annuler pour les garder, puis « Sauvegarder en ligne »).'})){applyRemote(d);toast('Sauvegarde en ligne chargée');}
}
function b64utf8(s){const by=new TextEncoder().encode(s);let bin='';for(let i=0;i<by.length;i+=0x8000)bin+=String.fromCharCode.apply(null,by.subarray(i,i+0x8000));return btoa(bin);}
async function ghErr(r,branch,step){let m='';try{m=(await r.json()).message||'';}catch(e){}
  const s=r.status;let hint='';
  if(s===401)hint='Jeton invalide ou expiré';
  else if(s===403)hint='Jeton sans droit d\'écriture : mets Contents sur Read and write pour '+REPO_NAME;
  else if(s===404)hint='Dépôt introuvable pour ce jeton : sélectionne '+REPO_NAME+' dans le jeton';
  else if(s===409||s===422)hint='Conflit de version, réessaie';
  const e=new Error((hint?hint+' — ':'')+branch+' ('+step+') : HTTP '+s+(m?' « '+m+' »':''));e.status=s;return e;}
async function ghPut(branch,content,token,msg,retry){
  const url='https://api.github.com/repos/'+REPO+'/contents/'+DATA_PATH;
  const h={Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};
  let sha;const g=await fetch(url+'?ref='+encodeURIComponent(branch)+'&t='+Date.now(),{headers:h,cache:'no-store',credentials:'omit'});
  if(g.ok)sha=(await g.json()).sha;else if(g.status!==404)throw await ghErr(g,branch,'lecture'); // 404 = first write: no sha
  const body={message:msg,content,branch};if(sha)body.sha=sha;
  const p=await fetch(url,{method:'PUT',headers:Object.assign({'Content-Type':'application/json'},h),body:JSON.stringify(body),credentials:'omit'});
  if(p.ok)return;
  if((p.status===409||p.status===422)&&!retry)return ghPut(branch,content,token,msg,true); // stale sha: re-read once
  throw await ghErr(p,branch,'écriture');
}
let cloudBusy=false;
async function saveOnline(){
  const token=(localStorage.getItem(TOKEN_KEY)||'').trim();
  if(!token){toast('Colle d\'abord ton jeton GitHub dans ⚙ Réglages');return;}
  if(S.demo){toast('Impossible : ce sont les données de démo');return;}
  if(cloudBusy)return;
  if(!await ask('Publier tes données en ligne ?',{ok:'☁️ Sauvegarder',sub:'Le fichier data.json du dépôt (public) sera remplacé par les données de ce navigateur. La clé API et le jeton ne sont jamais envoyés.'}))return;
  cloudBusy=true;toast('Sauvegarde en ligne…');
  try{
    const now=Date.now();const o=cleanForCloud();o.updatedAt=now;o.savedAt=new Date(now).toISOString();
    const content=b64utf8(JSON.stringify(o,null,1));
    for(const br of BRANCHES)await ghPut(br,content,token,'Sauvegarde des données ('+new Date(now).toLocaleString('fr-FR')+')');
    S.updatedAt=now;S.cloudAt=now;save();render();toast('☁️ Sauvegardé en ligne (visible partout d\'ici 1 à 2 min)');
  }catch(e){toast('Échec de la sauvegarde : '+e.message,9000);}
  finally{cloudBusy=false;}
}
async function loadOnline(){
  const d=await fetchRemote(true);if(!d){toast('Aucune sauvegarde en ligne trouvée');return;}
  const n=secsOf(d).reduce((a,s)=>a+(Array.isArray(d[s.k])?d[s.k].length:0),0);
  if(!await ask('Charger la sauvegarde en ligne ?',{ok:'Charger',sub:n+' ligne(s), sauvegarde du '+(d.updatedAt?new Date(+d.updatedAt).toLocaleString('fr-FR'):'?')+'. Les données de ce navigateur seront remplacées.'}))return;
  applyRemote(d);toast('Sauvegarde en ligne chargée');
}


/* ---------- custom envelopes ---------- */
function renderEnvList(){const box=$('#envList');if(!box)return;box.textContent='';
  const dl=el('datalist',{id:'grpList'},...[...new Set(['Investissement / Bourse',...SECTIONS.map(s=>s.group).filter(Boolean)])].map(g=>el('option',{value:g})));box.appendChild(dl);
  const TYPES={sec:'Titres / fonds',sav:'Épargne',cry:'Crypto'};
  SECTIONS.forEach((s,i)=>{
    const name=el('input',{type:'text',value:s.name,maxlength:'60','aria-label':'Nom de l\'enveloppe',onchange:e=>{const v=e.target.value.trim();if(!v){e.target.value=s.name;return;}s.name=v;touch();save();render();}});
    const up=el('button',{type:'button',class:'mini',title:'Monter','aria-label':'Monter',disabled:i===0,onclick:()=>{SECTIONS.splice(i-1,0,SECTIONS.splice(i,1)[0]);touch();save();render();renderEnvList();}},'↑');
    const down=el('button',{type:'button',class:'mini',title:'Descendre','aria-label':'Descendre',disabled:i===SECTIONS.length-1,onclick:()=>{SECTIONS.splice(i+1,0,SECTIONS.splice(i,1)[0]);touch();save();render();renderEnvList();}},'↓');
    const del=el('button',{type:'button',class:'mini danger',title:'Supprimer l\'enveloppe',onclick:async()=>{const n=(S[s.k]||[]).length;closeDlg();
      if(!await ask('Supprimer l\'enveloppe « '+s.name+' » ?',{ok:'Supprimer',danger:1,sub:n?n+' ligne(s) seront supprimées.':'Elle est vide.'}))return;
      SECTIONS.splice(SECTIONS.indexOf(s),1);delete S[s.k];delete S.cash[s.k];S.recurring=S.recurring.filter(r=>r.sec!==s.k);touch();save();render();renderEnvList();}},'✕');
    const grp=el('input',{type:'text',value:s.group||'',maxlength:'60',list:'grpList',placeholder:'Groupe (facultatif)','aria-label':'Groupe',class:'env-grp',
      onchange:e=>{const g=e.target.value.trim();if(g)s.group=g.slice(0,60);else delete s.group;touch();save();render();renderEnvList();}});
    const col=el('input',{type:'color',class:'env-color',value:hex6(s.color),'aria-label':'Couleur',
      oninput:e=>{s.color=e.target.value;e.target.parentNode.style.background=e.target.value;render();},
      onchange:e=>{s.color=e.target.value;e.target.parentNode.style.background=e.target.value;touch();save();render();}});
    const sw=el('label',{class:'env-swatch',title:'Choisir la couleur'},col);sw.style.background=hex6(s.color);
    box.appendChild(el('div',{class:'env-row'},sw,name,el('span',{class:'env-type',text:TYPES[s.type]}),el('span',{class:'env-mv'},up,down),del,grp));});
}
function hex6(c){c=String(c||'').trim();if(/^#[0-9a-fA-F]{6}$/.test(c))return c.toLowerCase();if(/^#[0-9a-fA-F]{3}$/.test(c))return '#'+[...c.slice(1)].map(x=>x+x).join('').toLowerCase();return '#94a3b8';}
function addEnv(){const n=$('#envNewName').value.trim();const t=$('#envNewType').value;if(!n){toast('Donne un nom à l\'enveloppe');return;}
  let k;do{k='env_'+Math.random().toString(36).slice(2,8);}while(S[k]||RESERVED.has(k));
  const used=new Set(SECTIONS.map(s=>s.color));const color=PALETTE.find(c=>!used.has(c))||PALETTE[SECTIONS.length%PALETTE.length];
  SECTIONS.push({k,name:n.slice(0,60),type:['sec','sav','cry'].includes(t)?t:'sec',color});S[k]=[];if(t!=='sav')S.cash[k]={amount:0,cur:'EUR'};
  S.settings.collapsed[k]=false;$('#envNewName').value='';touch();save();render();renderEnvList();toast('Enveloppe ajoutée');}

/* ---------- recurring automatic deposits ---------- */
const REC_START='2026-10-18'; // first occurrence = next due date strictly after this day (no backfill)
function ymdLocal(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function dim(y,m){return new Date(y,m,0).getDate();} // m: 1..12
function occ(y,m,day){while(m>12){m-=12;y++;}return y+'-'+String(m).padStart(2,'0')+'-'+String(Math.min(day,dim(y,m))).padStart(2,'0');}
function nextOcc(from,day){const[y,m]=from.split('-').map(Number);const c=occ(y,m,day);return c>from?c:occ(y,m+1,day);}
function frDate(s){if(!s)return '—';const[y,m,d]=s.split('-');return d+'/'+m+'/'+y;}
function recLines(){const out=[];for(const s of SECTIONS){if(s.type==='sav')continue;for(const l of S[s.k]||[])out.push({sec:s,l});}return out;}
function findLine(r){const s=SECTIONS.find(x=>x.k===r.sec);let l=s&&(S[s.k]||[]).find(x=>x.id===r.lineId);
  if(!l){for(const x of recLines())if(x.l.id===r.lineId)return x;return null;}return {sec:s,l};}
function lineLabel(x){if(!x)return '(ligne supprimée)';const l=x.l;return x.sec.name+' · '+(x.sec.type==='cry'?(l.sym||'?').toUpperCase():(l.name||l.ticker||'?'));}
function lastRecDate(r){let d='';for(const h of S.recHistory)if(h.ruleId===r.id&&!h.undone&&h.date>d)d=h.date;return d;}
function freshNext(r){ // next date strictly after today (and not in a month already served)
  const t=ymdLocal();const last=lastRecDate(r);let n=nextOcc(t>REC_START?t:REC_START,r.day);
  if(last&&n.slice(0,7)===last.slice(0,7))n=nextOcc(n,r.day);if(last&&n<=last)n=nextOcc(last,r.day);return n;}
function round(x,d){const p=10**d;return Math.round(x*p)/p;}
function applyOne(r,date){
  const x=findLine(r);if(!x)return 'noline';const l=x.l;
  let price=num(l.price);if(!(price>0))price=num(l.pru);if(!(price>0))return 'noprice';
  const rate=x.sec.type==='cry'?1:fx(l.cur);if(!(rate>0))return 'nofx';
  const amt=+r.amount;if(!(amt>0))return 'noamount';
  const q=num(l.qty)||0,pru=num(l.pru);
  const units=round(amt/(price*rate),6);if(!(units>0))return 'nounits';
  const nq=round(q+units,6);const npru=isFinite(pru)&&q>0?round((q*pru+units*price)/nq,6):round(price,6);
  S.recHistory.push({id:uid(),ruleId:r.id,date,at:Date.now(),amount:amt,units,price,cur:x.sec.type==='cry'?'EUR':(l.cur||'EUR'),rate,sec:x.sec.k,lineId:l.id,prevQty:q,prevPru:isFinite(pru)?pru:null,newQty:nq,newPru:npru});
  l.qty=nq;l.pru=npru;return 'ok';
}
function applyRecurring(){
  const t=ymdLocal();let n=0,sum=0;const why=new Set();
  for(const r of S.recurring){if(!r.active)continue;if(!r.next)r.next=freshNext(r);let guard=0;
    while(r.next<=t&&guard++<240){const res=applyOne(r,r.next);if(res!=='ok'){why.add(res);break;}n++;sum+=+r.amount;r.next=nextOcc(r.next,r.day);}}
  if(n){touch();save();render();toast('🔁 '+n+' versement(s) automatique(s) appliqué(s) ('+eur(sum)+'). Pense à « Sauvegarder en ligne ».',7000);}
  else if(why.has('noprice'))toast('Versement automatique en attente : cours indisponible',4000);
  return n;
}
function undoLast(r){
  const hs=S.recHistory.filter(h=>h.ruleId===r.id&&!h.undone);if(!hs.length)return false;
  const h=hs.reduce((a,b)=>(b.date>a.date||(b.date===a.date&&b.at>a.at))?b:a);
  const x=findLine({sec:h.sec,lineId:h.lineId});
  if(x){const l=x.l;const q=num(l.qty)||0,pru=num(l.pru);
    if(Math.abs(q-h.newQty)<1e-9&&isFinite(pru)&&Math.abs(pru-h.newPru)<1e-9){l.qty=h.prevQty;l.pru=h.prevPru;}
    else{const nq=round(q-h.units,6);if(nq<=1e-9){l.qty=h.prevQty;l.pru=h.prevPru;}
      else{l.qty=nq;if(isFinite(pru))l.pru=round((q*pru-h.units*h.price)/nq,6);}}}
  h.undone=true;h.undoneAt=Date.now();touch();save();render();return true;
}
const recEdit={id:null};
function recForm(r){
  const isNew=!r;r=r||{amount:150,day:1};
  const opts=recLines();
  let defId=r.lineId;if(!defId){const sw=opts.find(x=>x.l.isin==='FR0010429068')||opts.find(x=>/swiss/i.test(x.sec.name))||opts[0];defId=sw&&sw.l.id;}
  const sel=el('select',{name:'target'},...opts.map(x=>{const o=el('option',{value:x.sec.k+'|'+x.l.id,text:lineLabel(x)});if(x.l.id===defId)o.selected=true;return o;}));
  const f=el('form',{class:'edit rec-edit',onsubmit:e=>{e.preventDefault();const fd=new FormData(f);
    const amt=num((fd.get('amount')||'').toString());const day=parseInt(fd.get('day'),10);const tg=String(fd.get('target')||'').split('|');
    if(!(amt>0)){toast('Montant invalide');return;}if(!(day>=1&&day<=31)){toast('Jour entre 1 et 31');return;}if(!tg[1]){toast('Choisis une ligne cible');return;}
    if(isNew){const nr={id:uid(),sec:tg[0],lineId:tg[1],amount:amt,day,active:true,createdAt:ymdLocal()};nr.next=freshNext(nr);S.recurring.push(nr);}
    else{const dayCh=r.day!==day;Object.assign(r,{sec:tg[0],lineId:tg[1],amount:amt,day});if(dayCh)r.next=freshNext(r);}
    recEdit.id=null;touch();save();render();}});
  f.append(inp('amount','Montant (€)',r.amount,{num:1}),inp('day','Jour du mois',r.day,{num:1,ph:'1'}),el('label',{class:'full'},'Ligne cible',sel));
  if(!opts.length)f.append(el('p',{class:'hint full',text:'Ajoute d\'abord une ligne (titre ou crypto) à une enveloppe.'}));
  f.append(el('div',{class:'btns'},el('button',{type:'button',onclick:()=>{recEdit.id=null;render();}},'Annuler'),el('button',{type:'submit',class:'primary'},isNew?'Créer':'Enregistrer')));
  return f;
}
function renderRecurring(){
  const box=$('#recBody');if(!box)return;box.textContent='';
  if(VIEW){const c=$('#recCard');if(c)c.classList.toggle('hidden',!S.recurring.length);}
  for(const r of S.recurring){
    if(recEdit.id===r.id){box.appendChild(recForm(r));continue;}
    const x=findLine(r);const hs=S.recHistory.filter(h=>h.ruleId===r.id).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:b.at-a.at);
    const live=hs.filter(h=>!h.undone);
    const head=el('div',{class:'rec-top'},
      el('div',{class:'rec-main'},el('div',{class:'rec-amt amt',text:'+'+eur(r.amount)+' / mois'}),el('div',{class:'rec-sub',text:'le '+r.day+' · '+lineLabel(x)})),
      el('span',{class:'tag '+(r.active?'ok':'off'),text:r.active?'actif':'en pause'}));
    const nxt=el('div',{class:'rec-next',text:r.active?('Prochain versement : '+frDate(r.next||freshNext(r))):'Versements suspendus'});
    const btns=el('div',{class:'rec-btns'},
      el('button',{type:'button',class:'b',onclick:()=>{recEdit.id=r.id;render();}},'Modifier'),
      el('button',{type:'button',class:'b',onclick:()=>{r.active=!r.active;if(r.active)r.next=freshNext(r);touch();save();render();toast(r.active?'Versement repris (prochain : '+frDate(r.next)+')':'Versement mis en pause');}},r.active?'⏸ Pause':'▶ Reprendre'),
      live.length?el('button',{type:'button',class:'b',onclick:async()=>{const h=live[0];if(!await ask('Annuler le dernier versement ?',{ok:'Annuler le versement',sub:frDate(h.date)+' : '+eur(h.amount)+' → '+qtyf(h.units)+' part(s). Il ne sera pas réappliqué.'}))return;undoLast(r);toast('Dernier versement annulé');}},'↶ Annuler le dernier'):null,
      el('button',{type:'button',class:'b danger',onclick:async()=>{if(!await ask('Supprimer ce versement programmé ?',{ok:'Supprimer',danger:1,sub:'Les parts déjà achetées restent en place.'}))return;S.recurring=S.recurring.filter(z=>z!==r);touch();save();render();}},'Supprimer'));
    const hist=el('details',{class:'rec-hist'},el('summary',null,'Historique ('+live.length+')'),
      hs.length?el('ul',null,...hs.slice(0,24).map(h=>el('li',{class:h.undone?'undone':''},el('span',{text:frDate(h.date)}),el('span',{class:'amt',text:eur(h.amount)}),
        el('span',{class:'amt',text:qtyf(h.units)+' × '+money(h.price,h.cur)}),h.undone?el('span',{class:'tag off',text:'annulé'}):null))):el('p',{class:'hint',text:'Aucun versement appliqué pour l\'instant.'}));
    box.appendChild(el('div',{class:'rec-item'+(r.active?'':' paused')},head,nxt,VIEW?null:btns,hist));
  }
  if(VIEW)return;
  if(recEdit.id==='new')box.appendChild(recForm(null));
  else box.appendChild(el('button',{class:'add',onclick:()=>{recEdit.id='new';render();}},'+ Ajouter un versement programmé'));
}

/* ---------- wire ---------- */
$('#btnRefresh').onclick=()=>refreshAll(true);
$('#btnTheme').onclick=()=>{const t=document.documentElement.dataset.theme==='light'?'dark':'light';setTheme(t);try{localStorage.setItem(THEME_KEY,t);}catch(e){}};
$('#btnMask').onclick=()=>{S.settings.masked=!S.settings.masked;save();render();};
const dlg=$('#dlgSettings');
function closeDlg(){if(!dlg.open)return;if(dlg.close)dlg.close();else{dlg.removeAttribute('open');dlg.dispatchEvent(new Event('close'));}}
$('#btnSettings').onclick=()=>{renderEnvList();$('#setProvider').value=S.settings.provider||'none';$('#setKey').value=S.settings.apiKey||'';$('#setToken').value=localStorage.getItem(TOKEN_KEY)||'';$('#setName').value=S.settings.displayName||'';markMainCur();if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');};
$('#btnPaste').onclick=()=>{const t=$('#pasteImport').value;if(!t.trim()){toast('Colle d\'abord le lien ou le JSON');return;}$('#pasteImport').value='';closeDlg();importFromText(t,false);};
$('#btnCloseDlg').onclick=e=>{e.preventDefault();closeDlg();};
{const x=$('#btnCloseTop');if(x)x.onclick=e=>{e.preventDefault();closeDlg();};}
{const sj=$('#btnSaveJson');if(sj)sj.onclick=()=>saveOnline();}
function markMainCur(){const c=baseCur();document.querySelectorAll('#mainCurPick .cur-opt').forEach(b=>b.classList.toggle('on',b.dataset.cur===c));}
document.querySelectorAll('#mainCurPick .cur-opt').forEach(b=>b.addEventListener('click',async()=>{
  const c=curOf(b.dataset.cur);if(S.settings.mainCur===c)return;
  S.settings.mainCur=c;markMainCur();touch();save();render();
  if(c!=='EUR'&&!isFinite(fx(c))){if(await refreshFx()){save();render();}}}));
dlg.addEventListener('close',()=>{const tk=$('#setToken').value.trim();try{if(tk)localStorage.setItem(TOKEN_KEY,tk);else localStorage.removeItem(TOKEN_KEY);}catch(e){}
  const nm=$('#setName').value.trim().slice(0,40);if(nm!==(S.settings.displayName||'')){S.settings.displayName=nm;touch();}
  const p=$('#setProvider').value,k=$('#setKey').value.trim();const ch=p!==S.settings.provider||k!==S.settings.apiKey;
  S.settings.provider=p;S.settings.apiKey=k;save();render();if(ch&&p!=='none'&&k)refreshAll(true);});
$('#btnExport').onclick=exportJSON;
$('#btnEnvAdd').onclick=addEnv;
$('#btnCloudSave').onclick=()=>{$('#setToken').value&&localStorage.setItem(TOKEN_KEY,$('#setToken').value.trim());closeDlg();saveOnline();};
$('#btnCloudLoad').onclick=()=>{closeDlg();loadOnline();};
$('#btnImport').onclick=()=>$('#fileImport').click();
$('#fileImport').onchange=e=>{const f=e.target.files[0];if(f)importJSON(f);e.target.value='';closeDlg();};
const loadDemo=async()=>{const has=SECTIONS.some(s=>S[s.k].length)&&!S.demo;if(dlg.open)closeDlg();if(has&&!await ask('Remplacer tes données par la démo ?',{ok:'Charger la démo',sub:'Pense à exporter avant.'}))return;S=demo();SECTIONS=S.sections;save();render();refreshAll(false);};
$('#btnDemo').onclick=loadDemo;$('#btnDemo2').onclick=loadDemo;
$('#btnReset').onclick=async()=>{closeDlg();if(!await ask('Effacer toutes les données de ce navigateur ?',{ok:'Tout effacer',danger:1}))return;const st=S.settings;S=blank();SECTIONS=S.sections;S.settings.provider=st.provider;S.settings.apiKey=st.apiKey;save();render();toast('Données effacées');};
$('#btnClearDemo').onclick=()=>{const st=S.settings;S=blank();SECTIONS=S.sections;S.settings.provider=st.provider;S.settings.apiKey=st.apiKey;save();render();};
setTheme(document.documentElement.dataset.theme==='light'?'light':'dark');
if(VIEW){document.body.classList.add('view');const rb=$('#roBadge');if(rb)rb.hidden=false;
  for(const id of ['btnSettings','btnSaveJson','btnDemo','btnDemo2','btnClearDemo','btnReset','btnCloudSave','btnCloudLoad','btnImport','btnExport','btnPaste','btnEnvAdd']){const b=document.getElementById(id);if(b){b.onclick=null;b.disabled=true;}}
  render();
  fetchRemote(false).then(d=>{if(!d){toast('Données en ligne indisponibles',5000);return;}
    S=normalize(d);SECTIONS=S.sections;S.settings.collapsed={};S.settings.masked=false;
    const td=localTd();if(td)Object.assign(S.settings,td);else{S.settings.provider='none';S.settings.apiKey='';}
    S.cloudAt=S.updatedAt;render();refreshAll(false);});
  setInterval(()=>{if(!document.hidden)refreshAll(false);},5*60e3);
}else{
render();hashImport();syncFromRemote().finally(async()=>{await refreshAll(false);applyRecurring();});
window.addEventListener('hashchange',hashImport);
window.addEventListener('pageshow',hashImport);
window.addEventListener('focus',hashImport);
setInterval(()=>{if(!document.hidden){refreshAll(false).then(applyRecurring);}},5*60e3);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-S.cryptoAt>5*60e3)refreshAll(false);});
})();
