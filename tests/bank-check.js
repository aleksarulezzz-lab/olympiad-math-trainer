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
for(let n=1;n<=5;n++){const v=T.filter(t=>t.pool==='variant'&&t.id.startsWith('V31-'+n+'-'));if(v.length!==8||new Set(v.map(t=>t.skill)).size<7)fail('вариант '+n);else pass()}
if(T.filter(t=>t.pool==='variant').length!==40)fail('в вариантах должно быть 40 задач');
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
for(const [id,f] of Object.entries(check)){
  const t=by[id];if(!t){fail('нет задачи '+id);continue}
  const got=String(f());if(got!==String(t.answer))fail(`${id}: в банке «${t.answer}», перебор даёт «${got}»`);else pass();
}
console.log(`Итог: ${good} проверок пройдено, ${bad} ошибок; задач в банке: ${T.length}`);
process.exit(bad?1:0);
