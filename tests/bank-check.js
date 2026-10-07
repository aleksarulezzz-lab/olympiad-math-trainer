/* Проверка банка задач без браузера.
   Запуск:  node tests/bank-check.js
   1) структура: уникальные id/формулировки, у каждой задачи есть навык, уровень, идея, шаг-подсказка, решение;
   2) 5 вариантов × 10 задач, по одной на каждый навык; 10 задач диагностики;
   3) независимый пересчёт ответов перебором для задач, где это возможно;
   4) подсказки и примеры уроков не выдают ответ задачи. */
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
const src=html.match(/<script id="v30-bank">([\s\S]*?)<\/script>/)[1];
const window={};new Function('window',src)(window);
const T=window.V30_TASKS,SK=window.V30_SKILLS,by=Object.fromEntries(T.map(t=>[t.id,t]));
let bad=0,good=0;const fail=m=>{bad++;console.log('  ✗',m)};const pass=()=>good++;

// 1. Структура
const ids=new Set(),texts=new Set();
for(const t of T){
  if(ids.has(t.id))fail('дубль id '+t.id);ids.add(t.id);
  const x=t.text.replace(/\s+/g,' ').trim();if(texts.has(x))fail('дубль формулировки '+t.id);texts.add(x);
  if(!SK.find(s=>s.id===t.skill))fail('неизвестный навык '+t.id);
  if(![1,2,3].includes(t.lvl))fail('уровень '+t.id);
  for(const k of ['title','text','answer','idea','step','solution'])if(!String(t[k]||'').trim())fail(`пусто: ${k} у ${t.id}`);
  if(!['train','variant','diag'].includes(t.pool))fail('пул '+t.id);
  // третья подсказка не должна содержать готовый ответ (для ответов длиннее 1 символа)
  if(String(t.answer).length>1&&/^\d+$/.test(t.answer)&&new RegExp('(^|\\D)'+t.answer+'(\\D|$)').test(t.step))fail('подсказка выдаёт ответ: '+t.id);
  pass();
}
for(let n=1;n<=5;n++){const v=T.filter(t=>t.pool==='variant'&&(t.id.startsWith('F29V'+n+'-')||t.id.startsWith('V30-V'+n+'-')));if(v.length!==10||new Set(v.map(t=>t.skill)).size!==10)fail('вариант '+n);else pass()}
if(T.filter(t=>t.pool==='diag').length!==10)fail('диагностика');
for(const s of SK){const n=T.filter(t=>t.pool==='train'&&t.skill===s.id).length;if(n<12)fail(`мало задач в навыке ${s.id}: ${n}`);
  if(!s.lesson||s.lesson.examples.length<2)fail('урок '+s.id);
  for(const e of s.lesson.examples)if(texts.has(e.text.replace(/\s+/g,' ').trim()))fail('пример урока совпадает с задачей банка: '+s.id)}

// 2. Независимый пересчёт ответов
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const digits=n=>String(n).split('').map(Number);
const distinct=n=>new Set(String(n)).size===String(n).length;
const sum=a=>a.reduce((x,y)=>x+y,0);
const perms=(arr,k)=>k===0?[[]]:arr.flatMap((x,i)=>perms(arr.filter((_,j)=>j!==i),k-1).map(p=>[x,...p]));
const C2=n=>n*(n-1)/2;
const nim=(n,maxTake)=>n%(maxTake+1); // сколько взять, чтобы оставить кратное (maxTake+1)
const check={
 'V30-V1-01':()=>range(1000,9999).find(n=>distinct(n)&&sum(digits(n))===10),
 'F29V1-02':()=>{let a=[3,6,10,15,21];while(a.length<7)a.push(a.at(-1)+(a.at(-1)-a.at(-2))+1);return a[6]},
 'F29V1-06':()=>perms([0,1,2,3,4,5],3).filter(p=>p[0]!==0&&p[2]%2===1).length,
 'F29V1-09':()=>2026%7,
 'F29V2-01':()=>range(10,99).filter(n=>{const[a,b]=digits(n);return a<b&&a+b===9}).length,
 'F29V2-02':()=>{let a=[2],d=[2,3];for(let i=0;a.length<8;i++)a.push(a.at(-1)+d[i%2]);return a[7]},
 'F29V2-07':()=>C2(4)*C2(5),
 'F29V2-09':()=>range(51,100).find(n=>n%6===5),
 'V30-V3-01':()=>range(100,999).filter(n=>distinct(n)&&digits(n).reduce((x,y)=>x*y,1)===24).pop(),
 'F29V3-06':()=>{const c=(r,u)=>r===0||u===0?1:c(r-1,u)+c(r,u-1);return c(3,2)},
 'F29V4-01':()=>range(10,99).filter(n=>{const[a,b]=digits(n);return a<b&&a+b===12}).length,
 'F29V4-07':()=>sum(range(1,4).map(k=>(5-k)**2)),
 'F29V5-01':()=>perms([1,2,3,4,5],3).filter(p=>p[0]<p[1]).length,
 'F29V5-06':()=>perms([1,2,3,4,5],3).filter(p=>p[0]%2===0).length,
 'F29V5-09':()=>range(1,200).filter(n=>n%6===5).map(n=>n%3).every(r=>r===2)?2:-1,
 'V30-D08':()=>range(10,99).filter(n=>n%5===0&&sum(digits(n))===9).length,
 'V30-D04':()=>range(10,99).find(n=>sum(digits(n))===12),
 'V30-N06':()=>range(100,999).find(n=>distinct(n)&&sum(digits(n))===14),
 'QDG1':()=>range(100,999).find(n=>distinct(n)&&sum(digits(n))===14&&n%10===5),
 'D18-02':()=>range(100,999).find(n=>n%9===0&&distinct(n)&&String(n).includes('0')),
 'V30-N10':()=>range(100,999).filter(n=>distinct(n)&&sum(digits(n))===10).pop(),
 'D18-01':()=>range(10,99).find(n=>{const[a,b]=digits(n);return n-(b*10+a)===27&&a+b===9}),
 'D18-03':()=>range(100,999).find(n=>distinct(n)&&sum(digits(n))===12&&n%5===0),
 'D18-04':()=>range(100,999).find(n=>{const[a,b,c]=digits(n);return a===b+1&&c===b+2&&a+b+c===15}),
 'QRB3':()=>range(0,9).find(b=>(300+10*b+6)+(600+10*b+3)===929),
 'V30-N15':()=>range(10,99).find(n=>{const[a,b]=digits(n);return a+b===11&&(b*10+a)-n===27}),
 'V30-N16':()=>sum(range(1,100).map(n=>String(n).length)),
 'V30-S11':()=>{let a=[1];for(let i=1;a.length<10;i++)a.push(a.at(-1)+i);return a[9]},
 'V30-S12':()=>sum(range(0,49).map(i=>i%3+1)),
 'V30-S14':()=>{let a=[1,1];while(a.length<20)a.push(a.at(-1)+a.at(-2));return a.filter(x=>x%2===0).length},
 'QH4':()=>range(1,2000).find(x=>x/2/2===80),
 'V30-R06':()=>range(-100,100).find(x=>x+7-12+4===15),
 'V30-R08':()=>range(0,100).find(x=>((x+1)*2+1)*2===58),
 'V30-R10':()=>range(1,300).find(x=>x%3===0&&(x-x/3)/2===12),
 'V30-R11':()=>range(1,300).find(x=>{const a=x/2;return Number.isInteger(a)&&a-(a/2+2)===6}),
 'V30-R12':()=>range(1,300).find(x=>{const a=x-(x/2+1);return Number.isInteger(x/2)&&a-(a/2+1)===3}),
 'V30-R13':()=>{for(let a=0;a<=48;a++)for(let b=0;a+b<=48;b++){let x=[a,b,48-a-b];x=[x[0]-x[1],2*x[1],x[2]];x=[x[0],x[1]-x[2],2*x[2]];x=[2*x[0],x[1],x[2]-x[0]];if(x.every(v=>v===16))return a}},
 'V30-L14':()=>['Андрей','Борис','Виктор'].filter(c=>[c==='Борис',c==='Виктор',c!=='Виктор'].filter(Boolean).length===2).join(),
 'V30-L12':()=>range(1,5).filter(k=>{const knightTrue=(k-1)===1,liarSees=k,liarFalse=liarSees!==1;return knightTrue&&(k===5||liarFalse)}).join(),
 'V30-G12':()=>{let best=0;for(let m=0;m<1024;m++){const xs=range(1,10).filter(x=>m>>(x-1)&1);if(!xs.some(a=>xs.includes(11-a)&&a!==11-a))best=Math.max(best,xs.length)}return best+1},
 'V30-C12':()=>range(100,999).filter(n=>digits(n).every(d=>d%2)).length,
 'V30-C13':()=>{let c=0;for(let f=0;f<=1;f++)for(let t=0;t<=3;t++)for(let o=0;o<=7;o++)if(5*f+2*t+o===7)c++;return c},
 'D10':()=>perms(['A','B','C','D'],4).filter(p=>p.indexOf('A')<p.indexOf('B')).length,
 'V30-C15':()=>{let c=0;for(let a=0;a<16;a++)for(let b=a+1;b<16;b++)if(a%4!==b%4&&(a>>2)!==(b>>2))c++;return c},
 'V30-GR10':()=>(5-2+1)**2,
 'QSQ1':()=>sum(range(1,3).map(k=>(4-k)**2)),
 'QGR2':()=>C2(5)*C2(6),
 'V30-GR14':()=>{let best=0;for(let m=0;m<(1<<15);m++){let ok=true;for(let i=0;i<15&&ok;i++)if(m>>i&1){const r=Math.floor(i/5),c=i%5;if(c<4&&(m>>(i+1)&1))ok=false;if(r<2&&(m>>(i+5)&1))ok=false}if(ok)best=Math.max(best,m.toString(2).split('1').length-1)}return best},
 'D18-37':()=>nim(10,2),'D18-40':()=>nim(8,2),'V30-I13':()=>nim(22,3),'F29V2-08':()=>nim(11,2),'F29V4-08':()=>nim(14,2),
 'V30-I14':()=>sum(range(1,7)),
 'V30-M05':()=>['среда','четверг','пятница','суббота','воскресенье','понедельник','вторник'][100%7],
 'V30-M07':()=>1000%9,'V30-M11':()=>sum(range(1,20))%5,'V30-M14':()=>(5+4)%7,
 'V30-M12':()=>range(2,100).find(n=>n%2===1&&n%3===1&&n%4===1),
 'V30-M10':()=>(1*3*5*7*9*11*13)%10,
 'QA1':()=>range(1,7).find(a=>a*(15-a)===36),
 'V30-W14':()=>range(0,30).find(y=>33+y===3*(7+y)),
 'V30-W15':()=>{const g=(28-4)/2;return g*(g+4)},
 'V30-W10':()=>range(0,48).find(k=>k-6===48-k+6),
 'F29V2-10':()=>range(1,30).find(s=>(s+3)+(s+4+3)===24),
};
for(const [id,f] of Object.entries(check)){
  const t=by[id];if(!t){fail('нет задачи '+id);continue}
  const got=String(f());if(got!==String(t.answer))fail(`${id}: в банке «${t.answer}», перебор даёт «${got}»`);else pass();
}
console.log(`Итог: ${good} проверок пройдено, ${bad} ошибок; задач в банке: ${T.length}`);
process.exit(bad?1:0);
