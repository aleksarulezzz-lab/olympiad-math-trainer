/* Проверка банка задач без браузера.
   Запуск:  node tests/bank-check.js
   1) структура: уникальные id/формулировки, у каждой задачи есть навык, уровень, идея, шаг-подсказка, решение;
   2) 7 вариантов × 8 задач (не меньше 7 разных навыков); 10 задач диагностики;
      у задач вариантов есть обоснование (why), задачи с verify принимают свой эталон;
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
  const x=t.text.replace(/\s+/g,' ').trim()+(t.fig?JSON.stringify(t.fig):'');if(texts.has(x))fail('дубль формулировки '+t.id);texts.add(x);
  if(!SK.find(s=>s.id===t.skill))fail('неизвестный навык '+t.id);
  if(![1,2,3,4].includes(t.lvl))fail('уровень '+t.id);
  if(t.why&&(!Array.isArray(t.why)||t.why.length!==3||new Set(t.why).size!==3||t.why.some(x=>!String(x).trim())))fail('обоснование '+t.id);
  if(t.verify&&!t.verify(String(t.answer)))fail('verify не принимает эталон '+t.id);
  for(const k of ['title','text','answer','idea','step','solution'])if(!String(t[k]||'').trim())fail(`пусто: ${k} у ${t.id}`);
  if(!['train','variant','diag'].includes(t.pool))fail('пул '+t.id);
  // третья подсказка не должна содержать готовый ответ (для ответов длиннее 1 символа)
  if(String(t.answer).length>1&&/^\d+$/.test(t.answer)&&new RegExp('(^|\\D)'+t.answer+'(\\D|$)').test(t.step))fail('подсказка выдаёт ответ: '+t.id);
  pass();
}
for(let n=1;n<=7;n++){const v=T.filter(t=>t.pool==='variant'&&['V31-','V32-','V33-'].some(x=>t.id.startsWith(x+n+'-')));if(v.length!==8||new Set(v.map(t=>t.skill)).size<7)fail('вариант '+n);else pass()}
if(T.filter(t=>t.pool==='variant').length!==56)fail('в вариантах должно быть 56 задач');
for(const t of T.filter(t=>t.pool==='variant'))if(!t.why)fail('нет обоснования у задачи варианта '+t.id);
for(const t of T){if(t.type==='choice'&&!t.options.includes(t.answer))fail('choice '+t.id);if(t.type==='multi'&&!t.answer.split(';').every(a=>t.options.includes(a)))fail('multi '+t.id);if(t.type==='match'&&(t.answer.split('|').length!==t.rows.length||!t.answer.split('|').every(a=>t.options.includes(a))))fail('match '+t.id)}
if(T.filter(t=>t.pool==='diag').length!==10)fail('диагностика');
for(const s of SK){const n=T.filter(t=>t.pool==='train'&&t.skill===s.id).length;if(n<9)fail(`мало задач в навыке ${s.id}: ${n}`);
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
const lock=clues=>perms([0,1,2,3,4,5,6,7,8,9],3).filter(c=>clues.every(([g,n,pl])=>{const d=g.split('').map(Number);return d.filter(x=>c.includes(x)).length===n&&d.filter((x,i)=>c[i]===x).length===pl})).map(c=>c.join('')).join(',');
const skipDigit=(n,dig)=>{let c=0;for(let x=1;;x++){if(String(x).includes(dig))continue;if(++c===n)return x}};
const latin=(rows,cols,vals)=>{const ps=perms(range(1,vals),cols);const out=[];const rec=a=>{if(a.length===rows){out.push(a);return}for(const r of ps)if(a.every(b=>b.every((x,j)=>x!==r[j])))rec([...a,r])};rec([]);return out};
const gdef=(counts,d,m)=>{let best=0;const rec=(i,left,tot)=>{if(i===counts.length){best=Math.max(best,tot);return}for(let g=0;g<=Math.min(m-1,counts[i]);g++)for(let b=0;b<=Math.min(left,counts[i]-g);b++)rec(i+1,left-b,tot+g+b)};rec(0,d,0);return best+1};
const order=(names,cons,ask)=>{const r=perms(names,names.length).filter(p=>cons(x=>p.indexOf(x)));return [...new Set(r.map(ask))].join(',')};
const maxOf=(k,sumv)=>{const s=new Set();const rec=(st,left,kk,arr)=>{if(kk===0){if(left===0)s.add(arr[arr.length-1]);return}for(let x=st;x<=left;x++)rec(x+1,left-x,kk-1,[...arr,x])};rec(1,sumv,k,[]);return s};
// --- задачи с рисунками: ответ пересчитывается по самому рисунку ---
const cellsOf=map=>map.flatMap((row,r)=>[...row].map((ch,c)=>ch==='#'?[r,c]:null).filter(Boolean));
const figSet=map=>new Set(cellsOf(map).map(x=>x.join(',')));
const perimeter=map=>{const S=figSet(map);let e=0;for(const k of S){const [r,c]=k.split(',').map(Number);for(const [a,b] of [[r+1,c],[r-1,c],[r,c+1],[r,c-1]])if(!S.has(a+','+b))e++}return e};
const squaresIn=map=>{const S=figSet(map),R=map.length,C=Math.max(...map.map(x=>x.length));let n=0;for(let k=1;k<=Math.min(R,C);k++)for(let r=0;r+k<=R;r++)for(let c=0;c+k<=C;c++){let ok=true;for(let i=0;i<k;i++)for(let j=0;j<k;j++)if(!S.has((r+i)+','+(c+j)))ok=false;if(ok)n++}return n};
const dominoes=map=>{const S=figSet(map);let n=0;for(const k of S){const [r,c]=k.split(',').map(Number);if(S.has(r+','+(c+1)))n++;if(S.has((r+1)+','+c))n++}return n};
const orient=cells=>{const res=new Map();let cur=cells;for(let f=0;f<2;f++){for(let q=0;q<4;q++){const mr=Math.min(...cur.map(x=>x[0])),mc=Math.min(...cur.map(x=>x[1]));const nn=cur.map(([r,c])=>[r-mr,c-mc]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);res.set(JSON.stringify(nn),nn);cur=cur.map(([r,c])=>[c,-r])}cur=cur.map(([r,c])=>[r,-c])}return [...res.values()]};
const tiles=(map,piece)=>{const tgt=cellsOf(map),S=figSet(map),P=orient(cellsOf(piece));if(tgt.length%P[0].length)return false;const used=new Set();const rec=()=>{const f=tgt.find(x=>!used.has(x.join(',')));if(!f)return true;for(const v of P){const pl=v.map(([r,c])=>[r-v[0][0]+f[0],c-v[0][1]+f[1]].join(','));if(pl.every(k=>S.has(k)&&!used.has(k))){pl.forEach(k=>used.add(k));if(rec())return true;pl.forEach(k=>used.delete(k))}}return false};return rec()};
for(const t of T.filter(t=>t.fig)){
  const m=t.fig.map;let got;
  if(/периметр/i.test(t.text)){const side=+t.text.match(/стороной (\d+) см/)[1];got=String(perimeter(m)*side)}
  else if(/Сколько всего квадратов/.test(t.text))got=String(squaresIn(m));
  else if(/прямоугольник 1×2/.test(t.text))got=String(dominoes(m));
  else if(t.type==='multi'&&t.optFigs)got=t.optFigs.filter(o=>tiles(m,o.map)).map(o=>o.label).join(';');
  else if(/вырезали белую фигуру/.test(t.text)){const area=+t.text.match(/равна (\d+)/)[1],n=+t.text.match(/из (\d+) одинаковых/)[1];const big=cellsOf(m.map(r=>r.replace(/o/g,'#'))).length,small=m.join('').split('o').length-1;if(big!==4*n||small!==n)fail('рисунок не соответствует условию '+t.id);got=String(3*area)}
  else {fail('неизвестный тип рисунка '+t.id);continue}
  if(got!==t.answer)fail(`${t.id}: в банке «${t.answer}», по рисунку «${got}»`);else pass();
}
const check={
 'V31-1-1':()=>range(1,100).filter(n=>n%2===0&&n%5===0).length,
 'V31-1-2':()=>order(['Артём','Борис','Вера','Глеб','Дина'],i=>i('Вера')>i('Глеб')&&i('Борис')<i('Артём')&&i('Борис')<i('Дина')&&i('Борис')!==0,p=>p[0]),
 'V31-1-3':()=>gdef([6,5,4],2,2),
 'V31-1-4':()=>(48/8)**2,
 'V31-1-5':()=>24*5/3,
 'V31-1-6':()=>3*sum(range(1,6)),
 'V31-1-7':()=>range(1,10).find(t=>36*t===12*(t+2)),
 'V31-1-8':()=>{const s=new Set(latin(3,4,4).map(t=>t[0][0]+t[1][0]+t[2][0]));return ['5','6','7','8','9','10'].filter(x=>s.has(+x)).join(';')},
 'V31-2-1':()=>skipDigit(50,'5'),
 'V31-2-2':()=>order(['Коля','Лёша','Миша','Нина','Оля'],i=>i('Коля')<i('Лёша')&&i('Коля')>i('Миша')&&i('Нина')>i('Лёша')&&i('Оля')<i('Миша'),p=>p[2]),
 'V31-2-3':()=>gdef([7,5,4],3,3),
 'V31-2-4':()=>{for(let a=1;a<40;a++)for(let b=1;b<a;b++)if(2*a+4*b===38&&4*a+2*b===46)return a*b},
 'V31-2-5':()=>range(0,120).find(x=>120+x===4*(120-x)),
 'V31-2-6':()=>4*5+6*3,
 'V31-2-7':()=>Math.abs(180-90*3),
 'V31-2-8':()=>{const sp=['плавание','теннис','шахматы','футбол'];return perms(sp,4).filter(([a,b,v,g])=>a!=='плавание'&&a!=='шахматы'&&b!=='футбол'&&b!=='теннис'&&v==='теннис'&&g!=='плавание').map(x=>x.join('|')).join(',')},
 'V31-3-1':()=>range(1,100).filter(n=>n%4===0&&n%6===0).length,
 'V31-3-2':()=>{for(let a=1;a<30;a++)for(let b=a+1;b<30;b++)for(let c=b+1;c<30;c++)if(a*b*c===24&&(a+1)*(b+1)*(c+1)===60)return c},
 'V31-3-3':()=>lock([['340',1,1],['693',1,0],['167',2,0],['586',0,0]]),
 'V31-3-4':()=>28*3,
 'V31-3-5':()=>12*2/3,
 'V31-3-6':()=>range(1,30).find(k=>3*k*(k+1)/2===108),
 'V31-3-7':()=>{for(let d=1;d<1000;d++){/* car 40/интервал, truck 30/интервал, старт 30 */const k=30/(40-30);if(Number.isInteger(k))return 40*k}},
 'V31-3-8':()=>{const s=maxOf(5,20);return ['5','6','9','10','11'].filter(x=>s.has(+x)).join(';')},
 'V31-4-1':()=>range(1,75).filter(n=>n%3===0&&n%4===0).length,
 'V31-4-2':()=>order(['Аня','Вера','Галя','Даша'],i=>i('Аня')===0&&i('Даша')===1&&Math.abs(i('Галя')-i('Даша'))!==1,p=>p[2]),
 'V31-4-3':()=>gdef([5,5,5],4,2),
 'V31-4-4':()=>{const s=9,x=26/2-s;return 2*(s+(s-x))},
 'V31-4-5':()=>180*2/15/3,
 'V31-4-6':()=>range(1,40).find(n=>6*(n-1)+5*n===104),
 'V31-4-7':()=>range(1,5000).find(d=>d/60-d/80===5),
 'V31-4-8':()=>{const s=new Set(latin(3,3,3).map(t=>t[0][0]+t[1][1]+t[2][2]));return ['3','4','5','6','7','9'].filter(x=>s.has(+x)).join(';')},
 'V31-5-1':()=>skipDigit(60,'3'),
 'V31-5-2':()=>order(['Захар','Ира','Кира','Лёва','Миша','Нина'],i=>i('Ира')>i('Захар')&&i('Ира')<i('Кира')&&i('Лёва')>i('Кира')&&i('Миша')>i('Лёва')&&i('Нина')===5,p=>p[2]),
 'V31-5-3':()=>gdef([6,7,8],5,3),
 'V31-5-4':()=>{const c=[10+14-18,10+18-14,14+18-10].filter(x=>x>18);return c.join(',')},
 'V31-5-5':()=>range(0,60).find(x=>60+x===3*(60-x)),
 'V31-5-6':()=>range(100,999).filter(n=>sum(digits(n))===5).length,
 'V31-5-7':()=>6*2/4,
 'V31-5-8':()=>perms(['рисование','музыка','танцы'],3).filter(([l,m,n])=>l!=='танцы'&&m!=='рисование'&&m!=='танцы'&&n!=='рисование').map(x=>x.join('|')).join(','),
 'V31-MO08':()=>(600+300)/(300/15),'V31-MO09':()=>48*(36/(48-36)),'V31-MO10':()=>400/(5-3),'V31-MO11':()=>(12+4)*2/2,
 'V31-FG05':()=>(22+26)/6,'V31-FG08':()=>{for(let a=1;a<40;a++)for(let b=1;b<a;b++)if(a+2*b===20&&2*a+b===25)return a*b},'V31-FG09':()=>12+20-16,
 'V31-TW07':()=>range(2,30).find(n=>n*(n-1)/2===21),'V31-TW11':()=>range(0,28).find(g=>4*(28-g)===3*g),
 'V31-ES03':()=>{let best=99;const rec=(st,left,k,arr)=>{if(k===0){if(left===0)best=Math.min(best,arr[3]);return}for(let x=st;x<=left;x++)rec(x+1,left-x,k-1,[...arr,x])};rec(1,20,4,[]);return best},
 'V31-ES05':()=>{const s=maxOf(3,12);return ['4','5','6','7','9','10'].filter(x=>s.has(+x)).join(';')},
 'V31-ES06':()=>{let s=0,n=0;while(s+n+1<=50){n++;s+=n}return n},
 'V31-ES07':()=>{let b=0;for(let a=0;a<=25;a++)for(let c4=0;a+c4<=25;c4++){const c=25-a-c4;if(3*a+4*c4+5*c===104)b=Math.max(b,c)}return b},
 'V31-ES08':()=>{const s=new Set(latin(4,4,4).slice(0,200).map(t=>t.reduce((x,r)=>x+r[0]+r[1],0)));return [...s].join(';')},
 'V31-LG02':()=>lock([['540',1,1],['486',1,0],['280',2,0],['940',0,0]]),
 'V31-LG04':()=>range(1,9).filter(L=>range(1,10).filter(k=>L%k===0).length===10-L).map(L=>10-L).join(','),
 'V31-NU01':()=>skipDigit(100,'1'),
 'V31-NU03':()=>{for(let a=1;a<30;a++)for(let b=a+1;b<30;b++)for(let c=b+1;c<31;c++)if(a*b*c===30&&(a+1)*(b+1)*(c+1)===72)return c},
 'V31-RM01':()=>range(1,105).filter(n=>n%6===0).length,'V31-RM03':()=>range(1,100).filter(n=>n%2===0||n%3===0).length,'V31-RM04':()=>range(1,200).find(n=>n%6===0&&n%8===0&&n%12===0),
 'V31-WD01':()=>range(0,150).find(x=>150+x===5*(150-x)),
 'V31-GU01':()=>gdef([4,3,5],3,2),'V31-GU02':()=>gdef([5,3,4],3,3),
 'V31-SQ01':()=>range(1,30).find(k=>3*k*(k+1)/2===135),'V31-GR01':()=>range(1,40).find(n=>9*n+10*(n-1)===275),

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
// --- V33: независимый пересчёт новых задач ---
const rebus=expr=>{const letters=[...new Set(expr.replace(/[^А-ЯЁ]/g,''))],lead=new Set(expr.match(/[А-ЯЁ]+/g).filter(w=>w.length>1).map(w=>w[0])),sols=[],used=[],m={};
  const rec=k=>{if(k===letters.length){const e=expr.replace(/[А-ЯЁ]+/g,w=>String(+[...w].map(c=>m[c]).join(''))).replace(/=/g,'===').replace(/×/g,'*');if(Function('return '+e)())sols.push({...m});return}
    const L=letters[k];for(let d=0;d<10;d++){if(used[d]||(d===0&&lead.has(L)))continue;used[d]=1;m[L]=d;rec(k+1);used[d]=0}};rec(0);return sols};
const word=(sols,w)=>[...new Set(sols.map(s=>[...w].map(c=>s[c]).join('')))].join(',');
const pour2=(A,B,goal)=>{const seen=new Map([['0,0',0]]);let q=[[0,0]];while(q.length){const nq=[];for(const [a,b] of q){const d=seen.get(a+','+b);if(a===goal||b===goal)return d;const t=Math.min(a,B-b),u=Math.min(b,A-a);for(const s of [[A,b],[a,B],[0,b],[a,0],[a-t,b+t],[a+u,b-u]]){const k=s.join(',');if(!seen.has(k)){seen.set(k,d+1);nq.push(s)}}}q=nq}return 'нет'};
const pour3=(caps,start,goal)=>{const seen=new Set([start.join()]);let q=[start],d=0;while(q.length){for(const s of q)if(goal(s))return d;const nq=[];for(const s of q)for(let i=0;i<3;i++)for(let j=0;j<3;j++){if(i===j)continue;const t=Math.min(s[i],caps[j]-s[j]);if(!t)continue;const n=s.slice();n[i]-=t;n[j]+=t;if(!seen.has(n.join())){seen.add(n.join());nq.push(n)}}q=nq;d++}};
const minWeigh=n=>{let k=0,c=1;while(c<n){c*=3;k++}return k};
const cube=(a,b,c,faces)=>{let n=0;for(let x=0;x<a;x++)for(let y=0;y<b;y++)for(let z=0;z<c;z++){const f=(x===0)+(x===a-1)+(y===0)+(y===b-1)+(z===0)+(z===c-1);if(f===faces)n++}return n};
const circle=(names,cons)=>perms(names.slice(1),names.length-1).map(p=>[names[0],...p]).filter(p=>cons(x=>p.indexOf(x),p));
const after=(p,x)=>p[(p.indexOf(x)+1)%p.length];
const cubeOpp=(views,a)=>{const adj=new Set(views.filter(v=>v.includes(a)).flat());adj.delete(a);const left=range(1,6).filter(x=>x!==a&&!adj.has(x));if(left.length===1)return left[0];
  // остальное: противоположная пара, найденная для другой грани
  const opp={};for(let f=1;f<=6;f++){const ad=new Set(views.filter(v=>v.includes(f)).flat());ad.delete(f);const l=range(1,6).filter(x=>x!==f&&!ad.has(x));if(l.length===1){opp[f]=l[0];opp[l[0]]=f}}return left.filter(x=>!opp[x]||opp[x]===a).join(',')};
const knightsTable=(n,says)=>{const res=new Set();for(let m=0;m<(1<<n);m++){const K=i=>(m>>(((i%n)+n)%n))&1;let ok=true;for(let i=0;i<n;i++)if(!!K(i)!==says(K,i)){ok=false;break}if(ok)res.add([...Array(n)].reduce((a,_,i)=>a+K(i),0))}return [...res]};
const maxRects=n=>{let k=0;while((k+1)*(k+2)/2<=n*n)k++;return k}; // оценка; пример в решении
Object.assign(check,{
 'V33-SP01':()=>7-2,'V33-SP02':()=>cube(2,2,2,3),'V33-SP03':()=>cube(3,3,3,0),'V33-SP04':()=>cube(4,4,4,1),
 'V33-SP05':()=>circle(['вишня','звезда','орех','сердце','банан','мишка'],(i,p)=>after(p,'вишня')==='звезда'&&after(p,'звезда')==='орех'&&after(p,'орех')==='сердце'&&after(p,'сердце')==='банан'&&after(p,'банан')==='мишка').map(p=>after(p,'мишка')).join(','),
 'V33-SP06':()=>[...new Set(circle(['гриб','ёлка','бабочка','жук','домик','цветок'],(i,p)=>after(p,'гриб')==='домик'&&Math.abs(i('жук')-i('гриб'))===3&&(after(p,'ёлка')==='бабочка'||after(p,'бабочка')==='ёлка')).map(p=>after(p,'домик')))].join(','),
 'V33-SP07':()=>cubeOpp([[1,2,3],[1,2,4],[1,3,5]],1),'V33-SP08':()=>cubeOpp([[6,4,2],[6,4,1],[6,2,3]],4),
 'V33-SP09':()=>cube(3,4,5,0),'V33-SP10':()=>{for(let n=3;n<20;n++)if(cube(n,n,n,1)===96)return n**3},
 'V33-CN05':()=>range(10,99).filter(x=>x===4*sum(digits(x))).join(', '),
 'V33-CN03':()=>{const s=new Set();for(const p of perms(range(1,6),6)){const [a,b,c,x,y,z]=p;if(a+x+b===12&&b+y+c===12&&c+z+a===12)s.add([a,b,c].sort().join(', '))}return [...s].join('|')},
 'V33-CN08':()=>range(0,10).filter(L=>range(1,10).filter(k=>L>=k).length===10-L).map(L=>10-L).join(','),
 'V33-CN10':()=>{for(const c of perms(range(1,20),5))if(sum(c)===20&&c.reduce((a,b)=>a*b,1)%25===0)return 'да';return 'нет'},
 'V33-CT04':()=>1+range(1,4).reduce((a,k)=>a+k,0),'V33-CT05':()=>4*9,
 'V33-CT09':()=>maxRects(3),'V33-6-8':()=>maxRects(4),
 'V33-WG01':()=>minWeigh(3),'V33-WG02':()=>minWeigh(27),'V33-WG03':()=>minWeigh(10),'V33-WG04':()=>minWeigh(100),'V33-7-4':()=>minWeigh(8),
 'V33-WG06':()=>pour2(9,4,6),'V33-WG07':()=>pour2(5,7,6),'V33-WG08':()=>pour2(6,9,4),
 'V33-6-4':()=>pour3([8,5,3],[8,0,0],s=>s[0]===4&&s[1]===4),
 'V33-RB01':()=>word(rebus('Б+Б+Б=АБ'),'АБ'),'V33-RB02':()=>word(rebus('А+АА+ААА=492'),'А'),
 'V33-RB03':()=>word(rebus('АБ+БА=121').filter(s=>s['А']-s['Б']===5),'АБ'),'V33-RB04':()=>word(rebus('СОК+СОК=ВОДА'),'В'),
 'V33-RB05':()=>word(rebus('КИС+КСИ=ИСК'),'ИСК'),'V33-RB06':()=>word(rebus('УДАР+УДАР=ДРАКА'),'ДРАКА'),
 'V33-RB07':()=>word(rebus('ОДИН+ОДИН=МНОГО'),'МНОГО'),'V33-RB08':()=>word(rebus('ТОРГ×Г=ГРОТ'),'ТОРГ'),
 'V33-RB09':()=>word(rebus('АБВГ×4=ГВБА'),'АБВГ'),'V33-RB10':()=>word(rebus('КТО×КТО=МЫШКА'),'КТО'),
 'V33-6-6':()=>word(rebus('ВАГОН+ВАГОН=СОСТАВ'),'СОСТАВ'),'V33-7-7':()=>rebus('ТИК+ТИК=ТАК').length?'да':'нет',
 'V33-TR01':()=>C2(7),'V33-TR03':()=>range(2,30).find(n=>C2(n)===45),'V33-TR04':()=>C2(6),'V33-TR05':()=>C2(4)*3-17,
 'V33-TR07':()=>C2(8)*2/8,'V33-TR08':()=>4*2+(C2(6)-4)*3,'V33-TR10':()=>2*C2(6),
 'V33-TR09':()=>range(1,40).filter(n=>{const tot=C2(n+2)-8;return tot>0&&(2*tot)%n===0&&tot/n<=n+1}).join(', '),
 'V33-L4-01':()=>Math.min(...knightsTable(10,(K,i)=>!K(i-1)&&!K(i+1))),'V33-6-7':()=>knightsTable(12,(K,i)=>!K(i+1)).join(','),
 'V33-L4-02':()=>{for(let x=1;;x++){const d=digits(x);if(new Set(d).size===d.length&&sum(d)===40)return x}},
 'V33-L4-03':()=>sum(range(1,10))%2?'нет':'да','V33-7-8':()=>sum(range(1,20))-19,
 'V33-6-3':()=>{const s=new Set();for(const [d,b,a,v,k] of perms(range(2,6),5))if(Math.abs(d-b)===3*Math.abs(a-b)&&Math.abs(b-1)===Math.abs(b-v))s.add(d);return [...s].join(',')},
 'V33-6-2':()=>{const p=['гриб','домик','цветок','жук','солнце','яблоко','ёлка','бабочка'];return p[4]},
 'V33-7-1':()=>range(1,800).find(g=>{const a=(800-5*g)/3;return Number.isInteger(a)&&3*g+5*a===640}),
 'V33-7-2':()=>{for(let n=3;n<20;n++)if(cube(n,n,n,2)===60)return cube(n,n,n,0)},
 'V33-7-3':()=>range(100,999).filter(x=>x===12*sum(digits(x))).join(', '),
 'V33-6-1':()=>range(1,300).find(x=>x%6===0&&x-x/3+x/6===50)
});
for(const [id,f] of Object.entries(check)){
  const t=by[id];if(!t){fail('нет задачи '+id);continue}
  const got=String(f());if(got!==String(t.answer))fail(`${id}: в банке «${t.answer}», перебор даёт «${got}»`);else pass();
}
console.log(`Итог: ${good} проверок пройдено, ${bad} ошибок; задач в банке: ${T.length}`);
process.exit(bad?1:0);
