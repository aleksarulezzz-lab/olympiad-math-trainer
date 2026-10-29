/* Сквозная браузерная проверка тренажёра (Playwright + Chromium).
   Запуск:  node tests/e2e.js
   Нужен пакет playwright (npm i -D playwright) или глобальная установка. */
const path=require('path');const fs=require('fs');
let chromium;
try{({chromium}=require('playwright'))}catch(e){({chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright'))}
const URL='file://'+path.resolve(__dirname,'..','index.html');
let failed=0,passed=0;
function ok(cond,msg){if(cond){passed++;console.log('  ✓',msg)}else{failed++;console.log('  ✗',msg)}}

(async()=>{
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1100,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const dialogs=[];let dialogAnswer=true;
  page.on('dialog',d=>{dialogs.push(d.message());dialogAnswer?d.accept():d.dismiss()});
  const visible=sel=>page.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.closest('.hidden')&&e.offsetParent!==null},sel);
  const ans=id=>page.evaluate(id=>V30.tasks.find(t=>t.id===id).answer,id);
  const ids=()=>page.evaluate(()=>{const a=window.getP().v30.active;return a?a.ids:[]});
  const wait=ms=>page.waitForTimeout(ms);
  // ответ в задаче любого формата: число/текст, «выбери вариант», «выбери все», «сопоставь»
  // две неверные попытки в задаче любого формата
  async function wrongTwice(i){
    const t=await page.evaluate(i=>{const id=window.getP().v30.active.ids[i];const t=V30.tasks.find(x=>x.id===id);return {type:t.type||'',answer:t.answer,options:t.options||[]}},i);
    if(t.type==='choice'||t.type==='multi'){
      const wrong=t.options.filter(o=>o!==t.answer).slice(0,2);
      await page.click(`[data-v30opt="${i}"][data-val="${wrong[0]}"]`);await page.click('#v30c'+i);
      if(t.type==='multi')await page.click(`[data-v30opt="${i}"][data-val="${wrong[0]}"]`);
      await page.click(`[data-v30opt="${i}"][data-val="${wrong[1]}"]`);await page.click('#v30c'+i);return;
    }
    await page.fill('#v30a'+i,'0x');await page.click('#v30c'+i);await page.fill('#v30a'+i,'0y');await page.click('#v30c'+i);
  }
  async function setAns(i,val){
    const t=await page.evaluate(i=>{const id=window.getP().v30.active.ids[i];const t=V30.tasks.find(x=>x.id===id);return {type:document.getElementById('v30a'+i).type==='hidden'?t.type||'':'',rows:(t.rows||[]).length}},i);
    if(t.type==='choice')return page.click(`[data-v30opt="${i}"][data-val="${val}"]`);
    if(t.type==='multi'){for(const v of String(val).split(';'))await page.click(`[data-v30opt="${i}"][data-val="${v}"]`);return}
    if(t.type==='match'){const parts=String(val).split('|');for(let k=0;k<parts.length;k++)await page.selectOption(`[data-v30match="${i}"][data-r="${k}"]`,parts[k]);return}
    return page.fill('#v30a'+i,String(val));
  }

  await page.goto(URL);await wait(700);
  console.log('1. Загрузка');
  ok(errors.length===0,'нет JS-ошибок при загрузке '+JSON.stringify(errors));
  const st=await page.evaluate(()=>V30.selfTest());
  ok(st.ok,'самопроверка банка: '+JSON.stringify(st.problems));
  ok(await visible('#v30Variants'),'стартовый экран — варианты');

  console.log('2. Мой тренер: разбор метода → похожие задачи');
  await page.click('#tabAdaptive');await wait(200);
  ok(await visible('#v30Trainer .v30focus'),'тренер предлагает следующий шаг');
  await page.click('#v30Trainer .v30focus [data-v30="trainer"]');await wait(200);
  ok(await visible('#v30Work .v30lesson'),'сначала открывается разбор метода');
  const hiddenSteps=await page.$$eval('#v30Work .v30exStep.hidden',x=>x.length);
  await page.click('[data-v30l="next"]');await wait(50);
  ok(await page.$$eval('#v30Work .v30exStep.hidden',x=>x.length)===hiddenSteps-1,'шаги примера открываются по одному');
  await page.click('[data-v30l="all"]');await wait(50);
  ok(await visible('.v30exAnswer'),'после всех шагов виден ответ примера');
  await page.click('#v30GoPractice');await wait(200);
  ok(await page.$$eval('#v30Tasks .task',x=>x.length)===5,'после разбора — 5 похожих задач');
  ok(await visible('.v30method'),'над задачами можно снова открыть метод');
  let route=await ids();
  const skill=await page.evaluate(id=>V30.tasks.find(t=>t.id===id).skill,route[0]);
  ok(await page.evaluate((r)=>r.every(id=>V30.tasks.find(t=>t.id===id).skill===window.getP().v30.active.skill),route),'все задачи маршрута — из одной темы');
  // задача 1: верно с первого раза
  await page.fill('#v30a0',await ans(route[0]));await page.click('#v30c0');await wait(50);
  ok((await page.textContent('#v30f0')).includes('самостоятельно'),'верный ответ засчитан как самостоятельный');
  // задача 2: две ошибки → разбор
  await page.fill('#v30a1','мимо');await page.click('#v30c1');await wait(30);
  ok((await page.textContent('#v30f1')).includes('Ответ не раскрываю'),'после первой ошибки ответ не раскрывается');
  ok(!(await visible('#v30s1')),'кнопка разбора скрыта после первой ошибки');
  await page.fill('#v30a1','снова мимо');await page.click('#v30c1');await wait(30);
  ok(await visible('#v30s1'),'после второй ошибки доступен разбор');
  await page.click('#v30s1');await wait(30);
  ok((await page.textContent('#v30f1')).includes('Разбор'),'разбор показан');
  // задача 3: подсказки по порядку, потом верно
  ok(await page.$eval('[data-v30hint="2"][data-n="2"]',b=>b.disabled),'подсказка 2 закрыта до подсказки 1');
  await page.click('[data-v30hint="2"][data-n="1"]');await wait(30);
  ok(!(await page.$eval('[data-v30hint="2"][data-n="2"]',b=>b.disabled)),'после подсказки 1 открылась подсказка 2');
  await page.fill('#v30a2',await ans(route[2]));await page.click('#v30c2');await wait(30);
  ok((await page.textContent('#v30f2')).includes('с подсказкой'),'решение после подсказки засчитано как «с подсказкой»');
  // выход и возврат посреди маршрута
  await page.click('#v30Back');await wait(200);
  ok(await visible('#v30Trainer .v30resume'),'после выхода есть карточка «Продолжить»');
  ok(await page.evaluate(()=>document.body.innerText.length>500),'после выхода страница не пустая');
  await page.click('#v30Trainer [data-v30="resume"]');await wait(200);
  ok((await page.textContent('#v30f0')).includes('Верно'),'после возврата состояние задач восстановлено');
  dialogAnswer=true;await page.click('#v30Finish');await wait(200);
  ok(await visible('#v30Result'),'маршрут завершается, показан итог');
  const sk=await page.evaluate(s=>window.getP().v30.skills[s],skill);
  ok(sk&&sk.ind===1&&sk.ast===1&&sk.wrong===1,'статистика навыка: 1 сам., 1 с подсказкой, 1 ошибка');
  const rev=await page.evaluate(()=>Object.values(window.getP().v30.res).filter(r=>r.o==='wrong').length);
  ok(rev===1,'задача с ошибкой попала в работу над ошибками');
  const unseenBack=await page.evaluate(r=>!window.getP().v30.seen[r[3]]&&!window.getP().v30.seen[r[4]],route);
  ok(unseenBack,'нерешённые задачи вернулись в пул (не считаются увиденными)');
  const today=await page.evaluate(()=>{const d=new Date(),k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');return window.getP().v30.days[k]});
  ok(today&&today.ind===1&&today.ast===1&&today.wrong===1&&today.sk[skill].join()==='1,1,1','дневник за сегодня: 1 сам., 1 с подсказкой, 1 ошибка — по навыку');
  await page.click('#v30Result [data-v30="go"][data-to="stats"]');await wait(150);
  const rep1=await page.textContent('#v30Today');
  ok(rep1.includes('2задачи решены верно')&&rep1.includes('Что подтянуть'),'«Мой прогресс»: за сегодня 2 верно, 1 неверно, есть «Что подтянуть»');
  ok(await visible('#v30Today [data-v30="trainer"]'),'у темы «подтянуть» есть кнопка тренировки');
  ok(await visible('#v30Totals table'),'есть итог за все дни с таблицей по дням');

  console.log('3. Тренер находит просадку и объясняет именно её');
  await page.evaluate(()=>{const p=window.getP();p.v30.skills={};p.v30.skills.guarantee={n:6,ind:1,ast:0,wrong:5,recent:[0,0,1,0,0,0],last:Date.now()};p.v30.skills.logic={n:6,ind:6,ast:0,wrong:0,recent:[1,1,1,1,1,1],last:Date.now()};window.setP(p)});
  await page.evaluate(()=>showHome('adaptive'));await wait(150);
  ok((await page.textContent('#v30Trainer .v30focus')).includes('Гарантия'),'зона роста — «Гарантия и худший случай»');
  await page.click('#v30Trainer .v30focus [data-v30="trainer"]');await wait(200);
  ok((await page.textContent('#v30Work .v30lesson')).includes('худший случай'),'разбор метода — по слабой теме');
  ok((await page.textContent('#v30Work .v30why')).includes('около 17%'),'объяснено, почему тренер выбрал тему');
  await page.click('#v30Back');await wait(100);
  await page.click('#v30Trainer [data-v30="discard"]');await wait(150);

  console.log('4. Тема никогда не «не запускается»: свежие задачи заканчиваются → повтор задач с ошибками');
  let starts=0,reviews=0;
  for(let k=0;k<10;k++){
    await page.evaluate(()=>showHome('topics'));await wait(80);
    await page.click('#v30Topics [data-v30="topic"][data-skill="grid"]');await wait(120);
    const r=await ids();if(r.length)starts++;
    reviews+=await page.$$eval('#v30Tasks .v30rev',x=>x.length);
    // отвечаем неверно и открываем разбор во всех задачах
    for(let i=0;i<r.length;i++){await wrongTwice(i);await page.click('#v30s'+i)}
    await page.click('#v30Finish');await wait(100);
  }
  ok(starts===10,'тема запустилась 10 раз подряд из 10');
  ok(reviews>0,'когда свежие задачи кончились, выданы задачи с ошибками (с пометкой «повтор»)');
  ok(dialogs.every(m=>!m.includes('мало')),'не было отказов «свежих задач мало»');

  console.log('5. Олимпиада: решение → выход → перезагрузка → продолжить → завершить → статистика → следующий вариант');
  await page.evaluate(()=>showHome('variants'));await wait(100);
  await page.click('#v30Variants [data-v30="variant"][data-n="3"][data-mode="olympiad"]');await wait(200);
  const v3=await ids();
  ok(v3.length===8,'Вариант 3: 8 задач, как на настоящей олимпиаде');
  ok(await page.evaluate(r=>JSON.stringify(r)===JSON.stringify(V30.variantTasks(3).map(t=>t.id)),v3),'открыт именно Вариант 3');
  ok(/^\d\d:\d\d$/.test(await page.textContent('#v30Timer')),'таймер идёт');
  for(let i=0;i<5;i++)await setAns(i,await ans(v3[i]));
  await page.fill('#v30a5','1000');await wait(400);
  await page.click('#v30Back');await wait(150);
  await page.reload();await wait(800);
  ok(await visible('#v30Variants .v30resume'),'после перезагрузки предлагается продолжить');
  await page.click('#v30Variants [data-v30="resume"]');await wait(200);
  ok(await page.inputValue('#v30a4')===String(await ans(v3[4])),'ответы сохранились после перезагрузки');
  ok(await page.evaluate(()=>!document.getElementById('v30a0').disabled),'ответы можно менять до завершения');
  dialogAnswer=true;await page.click('#v30Finish');await wait(250);
  ok(await page.$$eval('#v30Tasks .v30just',x=>x.length)===5,'после сдачи ответов — обоснования к 5 верным ответам');
  ok(await page.$$eval('#v30Work input.answer',x=>x.length)===0,'на шаге обоснований ответы уже не поменять');
  await page.click('#v30Finish');await wait(250);
  ok((await page.textContent('#v30Result .score')).trim()==='5 / 8','результат 5 / 8');
  const p1=await page.evaluate(()=>{const p=window.getP();return {ol:(p.olympiads||[]).length,best:p.v30.variants[3]&&p.v30.variants[3].best,active:p.v30.active}});
  ok(p1.ol===1&&p1.best===5&&!p1.active,'результат записан в историю, черновик удалён');
  await page.click('#v30Result [data-v30="nextVariant"]');await wait(200);
  const v4=await ids();
  ok(v4.length===8&&v4.every(id=>!v3.includes(id)),'«Вариант 4 →» даёт 8 других задач');
  await page.click('#v30Back');await wait(100);
  await page.click('#v30Variants [data-v30="discard"]');await wait(100);
  await page.click('#tabStats');await wait(200);
  ok(await visible('#v30Stats #v30Today')&&!(await visible('#homeStats')),'«Мой прогресс» открывается после олимпиады (новый экран)');
  ok((await page.textContent('#v30Totals')).includes('пробных олимпиад: 1'),'итог за все дни учитывает олимпиаду');

  console.log('6. Все 5 вариантов различны, банк без дублей');
  const allV=await page.evaluate(()=>[1,2,3,4,5].map(n=>V30.variantTasks(n).map(t=>t.id)));
  ok(new Set(allV.flat()).size===40,'40 разных задач в 5 вариантах');

  console.log('7. Новый вариант, разминка, диагностика, кабинет родителя');
  await page.evaluate(()=>showHome('variants'));await wait(80);
  await page.click('#v30Variants [data-v30="fresh"][data-mode="practice"]');await wait(150);
  const fr=await ids();
  ok(fr.length===8&&new Set(await page.evaluate(r=>r.map(id=>V30.tasks.find(t=>t.id===id).skill),fr)).size===8,'новый вариант: 8 задач по 8 разным навыкам');
  await page.click('#v30Back');await wait(80);await page.click('#v30Variants [data-v30="discard"]');await wait(80);
  await page.click('#tabWarm');await wait(80);await page.click('#v30Warm [data-v30="warm"]');await wait(150);
  ok((await ids()).length===5,'разминка: 5 задач');
  await page.click('#v30Back');await wait(80);await page.click('#v30Warm [data-v30="discard"]');await wait(80);
  await page.evaluate(()=>showHome('adaptive'));await wait(80);
  await page.evaluate(()=>startDiagnostic());await wait(150);
  const dg=await ids();for(let i=0;i<dg.length;i++)if(i<7)await page.fill('#v30a'+i,await ans(dg[i]));
  await page.click('#v30Finish');await wait(200);
  ok(await page.evaluate(()=>window.getP().diagnostic.level)===3,'диагностика 7/10 → ступень 3');
  await page.click('#tabParent').catch(()=>{});await page.evaluate(()=>showHome('parent'));await wait(100);
  ok((await page.textContent('#parentDash')).includes('Гарантия'),'кабинет родителя заполнен');

  console.log('7б. Новые форматы ответа: выбери вариант / выбери все / сопоставь');
  await page.evaluate(()=>showHome('variants'));await wait(80);
  await page.click('#v30Variants [data-v30="variant"][data-n="2"][data-mode="practice"]');await wait(150);
  let v2=await ids();
  await setAns(1,'Лёша');await page.click('#v30c1');await wait(30);
  ok((await page.textContent('#v30f1')).includes('Пока неверно'),'неверный выбор варианта не засчитан');
  ok(!(await page.$eval('[data-v30opt="1"]',b=>b.disabled)),'после ошибки можно выбрать другой вариант');
  await setAns(1,await ans(v2[1]));await page.click('#v30c1');await wait(30);
  ok((await page.textContent('#v30f1')).includes('Ответ верный'),'«выбери вариант»: верный ответ засчитан');
  ok(await visible('#v30w1'),'после верного ответа — шаг «выбери верное рассуждение»');
  const why=id=>page.evaluate(id=>V30.tasks.find(t=>t.id===id).why,id);
  await page.click(`[data-v30why="1"][data-val="${(await why(v2[1]))[0]}"]`);await wait(30);
  ok((await page.textContent('#v30f1')).includes('со второй попытки'),'верный выбор со второй попытки не считается самостоятельным');
  await setAns(7,await ans(v2[7]));await page.click('#v30c7');await wait(30);
  ok((await page.textContent('#v30f7')).includes('Ответ верный'),'«сопоставь»: верный ответ засчитан');
  await page.click(`[data-v30why="7"][data-val="${(await why(v2[7]))[0]}"]`);await wait(30);
  ok((await page.textContent('#v30f7')).includes('Решено самостоятельно')&&(await page.textContent('#v30f7')).includes('7 баллов'),'верное рассуждение с первой попытки — полное решение');
  await setAns(0,await ans(v2[0]));await page.click('#v30c0');await wait(30);
  await page.click(`[data-v30why="0"][data-val="${(await why(v2[0]))[1]}"]`);await wait(30);
  ok((await page.textContent('#v30f0')).includes('рассуждение выбрано неверно'),'неверное рассуждение: показано верное');
  const o7=await page.evaluate(id=>window.getP().v30.res[id].o,v2[0]);
  ok(o7==='ast','ответ без верного рассуждения не считается самостоятельным');
  await page.click('#v30Back');await wait(80);await page.click('#v30Variants [data-v30="discard"]');await wait(80);
  await page.click('#v30Variants [data-v30="variant"][data-n="1"][data-mode="olympiad"]');await wait(150);
  const v1=await ids();
  ok(await page.$$eval('#v30Tasks [data-v30opt]',x=>x.length)===0,'в олимпиаде нет вариантов ответа — только поля');
  ok(await page.$$eval('#v30Tasks .v30just',x=>x.length)===0,'пока ответы не сданы, рассуждения не показываются (они подсказали бы ответ)');
  await setAns(7,'6, 7');await wait(300);
  await page.click('#v30Back');await wait(100);await page.reload();await wait(700);
  await page.click('#v30Variants [data-v30="resume"]');await wait(200);
  ok(await page.inputValue('#v30a7')==='6, 7','«найдите все»: ответ сохранился после перезагрузки');
  await setAns(7,'6, 7, 8, 9');for(let i=0;i<7;i++)await setAns(i,await ans(v1[i]));
  await page.click('#v30Finish');await wait(200);
  const w1=await page.evaluate(r=>r.map(id=>V30.tasks.find(t=>t.id===id).why[0]),v1);
  ok(await page.$$eval('#v30Tasks .v30just',x=>x.length)===8,'шаг обоснований: все 8 верных ответов');
  await page.click(`[data-v30why="0"][data-val="${w1[0]}"]`);await wait(300);
  await page.click('#v30Back');await wait(100);await page.reload();await wait(700);
  await page.click('#v30Variants [data-v30="resume"]');await wait(200);
  ok(await page.$$eval('[data-v30why="0"].sel',x=>x.length)===1,'после перезагрузки открывается шаг обоснований с выбором');
  for(let i=1;i<6;i++)await page.click(`[data-v30why="${i}"][data-val="${w1[i]}"]`);
  await page.click('#v30Finish');await wait(200);
  ok((await page.textContent('#v30Result .score')).trim()==='8 / 8','олимпиада без вариантов ответа: 8 / 8');
  ok((await page.textContent('#v30Result')).includes('6, 7, 8, 9'),'ответ «найдите все» показан в разборе понятно');
  ok((await page.textContent('#v30Result .v30pts')).includes('46 из 56'),'баллы как на олимпиаде: 6 задач по 7 и 2 задачи без обоснования по 2');
  ok(await page.evaluate(()=>window.getP().olympiads[0].pts===46),'баллы записаны в историю');

  console.log('7в. Новые темы, уровень 4 и варианты повышенной сложности');
  const nv=await page.evaluate(()=>({sk:['spatial','construct','cutting','weigh','rebus','tournament'].every(s=>V30.skills.some(x=>x.id===s)),l4:V30.tasks.filter(t=>t.lvl===4).length,v6:V30.variantTasks(6).length,v7:V30.variantTasks(7).length}));
  ok(nv.sk,'6 новых тем в списке навыков');
  ok(nv.l4>=10,'есть задачи уровня 4: '+nv.l4);
  ok(nv.v6===8&&nv.v7===8,'варианты 6 и 7 — по 8 задач');
  await page.evaluate(()=>showHome('variants'));await wait(80);
  ok(await page.$$eval('#v30Variants [data-v30="variant"][data-mode="olympiad"]',x=>x.length)===7,'на экране 7 вариантов');
  await page.click('#v30Variants [data-v30="variant"][data-n="6"][data-mode="practice"]');await wait(150);
  ok((await ids()).every(id=>id.startsWith('V33-6-')),'открыт вариант 6');
  await page.click('#v30Back');await wait(80);await page.click('#v30Variants [data-v30="discard"]');await wait(80);
  await page.evaluate(()=>showHome('topics'));await wait(80);
  await page.click('#v30Topics [data-v30="topic"][data-skill="construct"]');await wait(150);
  ok((await ids()).length===5,'тема «Построй пример» запускается');
  await page.fill('#v30a0','123');await page.click('#v30Back');await wait(80);await page.click('#v30Topics [data-v30="discard"]');await wait(80);
  await page.click('#v30Topics [data-v30="topic"][data-skill="rebus"]');await wait(150);
  ok(await page.evaluate(()=>window.getP().v30.active.ans.every(x=>!x)),'новая сессия начинается с пустыми ответами (ответы прошлой не переносятся)');
  await page.click('#v30Back');await wait(80);await page.click('#v30Topics [data-v30="discard"]');await wait(80);
  const vr=await page.evaluate(()=>{const f=id=>V30.tasks.find(t=>t.id===id);return [V30.isCorrect(f('V33-CN02'),'1, 4, 2, 5, 3, 6'),!V30.isCorrect(f('V33-CN02'),'1, 2, 3, 4, 5, 6'),V30.isCorrect(f('V33-CN06'),'6 4 5 7 3 2'),V30.isCorrect(f('V33-CN05'),'48, 36, 24, 12'),!V30.isCorrect(f('V33-CN05'),'12, 24, 36'),V30.isCorrect(f('V33-7-5'),'4,5'),V30.isCorrect(f('V33-7-5'),'4.5'),V30.isCorrect(f('V33-CN10'),'Нет, нельзя')]});
  ok(vr.every(Boolean),'проверка расстановок принимает любой верный ответ: '+JSON.stringify(vr));

  console.log('8. Проверка ответов');
  const chk=await page.evaluate(()=>{const f=id=>V30.tasks.find(t=>t.id===id);return [
    V30.isCorrect(f('F29V1-09'),'3'),!V30.isCorrect(f('F29V1-09'),'4'),V30.isCorrect(f('QH4'),'320 ягод'),
    V30.isCorrect(f('V30-V5-04'),'за второй дверью'),V30.isCorrect(f('V31-1-8'),'9;8;7;6'),V30.isCorrect(f('V31-1-8'),'6, 7, 8, 9'),!V30.isCorrect(f('V31-1-8'),'6;7;8'),V30.isCorrect(f('V31-2-8'),'футбол|плавание|теннис|шахматы'),!V30.isCorrect(f('V31-2-8'),'плавание|футбол|теннис|шахматы'),V30.isCorrect(f('F29V1-08'),'Да, можно'),V30.isCorrect(f('F29V2-04'),'Математику'),
    V30.isCorrect(f('F29V4-10'),'нельзя'),!V30.isCorrect(f('F29V1-01'),'1207')]});
  ok(chk.every(Boolean),'нормализация ответов: '+JSON.stringify(chk));

  console.log('9. Телефон: без горизонтальной прокрутки');
  await page.setViewportSize({width:375,height:800});
  for(const t of ['variants','adaptive','topics']){await page.evaluate(x=>showHome(x),t);await wait(80);
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'нет горизонтальной прокрутки: '+t)}

  console.log('10. Миграция старого черновика и истории');
  const p2=await browser.newPage();const e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto(URL);await p2.waitForTimeout(400);
  await p2.evaluate(()=>{sessionStorage.clear();const p={v26:{seenIds:['F01','X19'],'v26.activeSession':{mode:'olympiad',title:'Старая олимпиада',taskIds:['F29V2-01','F29V2-02'],answers:[{answer:'4'},{answer:''}],started:Date.now(),deadline:Date.now()+600000}}};sessionStorage.setItem('ol5guestSessionProgressV27',JSON.stringify(p))});
  await p2.reload();await p2.waitForTimeout(700);
  const m=await p2.evaluate(()=>{const p=window.getP();return {seen:!!(p.v30.seen.F01&&p.v30.seen.X19),act:p.v30.active&&p.v30.active.title,old:!!p.v26['v26.activeSession']}});
  ok(m.seen,'задачи, увиденные в старой версии, не выдаются как новые');
  ok(m.act==='Старая олимпиада'&&!m.old,'незавершённая работа старой версии перенесена');
  ok(e2.length===0,'нет JS-ошибок в сценарии миграции');
  ok(await p2.evaluate(()=>!sessionStorage.getItem('ol5guestSessionProgressV27')&&!!localStorage.getItem('ol5guestSessionProgressV27')),'старый гостевой прогресс перенесён из вкладки в браузер');

  console.log('10a. Прогресс гостя не пропадает после закрытия вкладки');
  const ctx=await browser.newContext();const t1=await ctx.newPage();
  await t1.goto(URL);await t1.waitForTimeout(400);
  await t1.evaluate(()=>{const x=getP();x.xp=777;setP(x)});
  ok(await t1.evaluate(()=>!!localStorage.getItem('ol5guestSessionProgressV27')),'гостевой прогресс пишется в localStorage');
  await t1.close();const t2=await ctx.newPage();await t2.goto(URL);await t2.waitForTimeout(400);
  ok(await t2.evaluate(()=>getP().xp===777),'в новой вкладке прогресс гостя на месте');
  ok((await t2.textContent('.hero .privacyLine')).includes('Без регистрации'),'на главном экране есть строка о приватности');
  await ctx.close();

  console.log('10б. Установка на телефон и превью ссылки');
  await page.evaluate(()=>showHome('guide'));await wait(150);
  ok(await visible('#v30InstallCard'),'в «Как пользоваться» есть инструкция по установке');
  ok(await page.evaluate(()=>!!document.querySelector('link[rel=manifest]')&&!!document.querySelector('meta[property="og:image"]')),'есть манифест и картинка превью');
  const man=JSON.parse(fs.readFileSync(path.resolve(__dirname,'..','manifest.webmanifest'),'utf8'));
  ok(man.icons.every(i=>fs.existsSync(path.resolve(__dirname,'..',i.src)))&&fs.existsSync(path.resolve(__dirname,'..','og.png')),'иконки и картинка превью на месте');

  console.log('11. Остальные кнопки: мир, магазин, мастерская, приватность, админ');
  await page.setViewportSize({width:1100,height:900});
  await page.evaluate(()=>showHome('world'));await wait(150);
  await page.click('#homeWorld .recbtn');await wait(150);
  ok(await visible('#homeShopworld .worldShopCard'),'«Развивать мир» открывает магазин мира');
  await page.evaluate(()=>{const x=getP();x.xp=(x.xp||0)+500;setP(x)});await page.click('#tabShopWorld');await wait(100);
  await page.click('[data-v26-buy="flag"]');await wait(100);
  ok(await page.evaluate(()=>getP().v26.world.owned.includes('flag')),'покупка в магазине мира работает');
  await page.click('#tabWorkshop');await wait(150);await page.fill('#v27w0','Все случаи');await page.click('[data-v27-work="0"]');await wait(80);
  ok((await page.textContent('#v27wf0')).includes('Сохранено'),'мастерская сохраняет открытие');
  await page.click('.linkBtn27');await wait(80);
  ok(await page.evaluate(()=>!!document.getElementById('v27PrivacyPanel')),'панель приватности открывается');
  await page.evaluate(()=>showPrivacy27());
  await page.keyboard.press('Control+Shift+A');await wait(150);
  ok(await visible('#homeAdmin #adminEmail'),'Ctrl+Shift+A открывает служебный вход');
  await page.click('#tabVariants');await wait(100);
  ok(await visible('#v30Variants')&&!(await visible('#homeAdmin')),'из админки можно вернуться к вариантам');

  console.log('12. Время занятий: идёт только при активной работе');
  {
    const pg=await browser.newPage({viewport:{width:1100,height:900}});pg.on('pageerror',e=>errors.push(e.message));pg.on('dialog',d=>d.accept());
    await pg.clock.install();await pg.goto(URL);await pg.clock.runFor(1000);
    const sec=()=>pg.evaluate(()=>{const d=new Date(),k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');return Math.round(((window.getP().v30.days||{})[k]||{}).sec||0)});
    await pg.clock.runFor(120000);
    ok(await sec()===0,'на главном экране время не идёт');
    await pg.evaluate(()=>showHome('warm'));await pg.clock.runFor(200);await pg.click('#v30Warm [data-v30="warm"]');await pg.clock.runFor(200);
    for(let m=0;m<3;m++){await pg.mouse.click(5,5);await pg.clock.runFor(60000)}
    const s1=await sec();ok(s1>=170&&s1<=190,'3 минуты работы → ~3 мин в дневнике ('+s1+' сек)');
    await pg.clock.runFor(20*60000);
    const s2=await sec();ok(s2-s1<=5*60+10,'без действий засчитывается не больше 5 минут ('+(s2-s1)+' сек)');
    await pg.evaluate(()=>showHome('stats'));await pg.clock.runFor(300);
    ok((await pg.textContent('#v30Today')).includes('мин'),'время показано в отчёте за сегодня');
    ok(await pg.evaluate(()=>{const g=document.querySelector('#v30Hero #game');return !!g&&g.offsetParent!==null&&/XP/.test(g.textContent)}),'в «Моём прогрессе» виден герой и XP');
    await pg.evaluate(()=>{showHome('variants');showHome('stats')});await pg.clock.runFor(200);
    ok(await pg.evaluate(()=>!!document.querySelector('#v30Hero #game')&&document.querySelectorAll('#game').length===1),'герой не пропадает при повторном открытии вкладки');
    await pg.close();
  }

  console.log('13. Две ветки: олимпиада и «Школа на шаг вперёд»');
  {
    const pg=await browser.newPage({viewport:{width:1100,height:900}});pg.on('pageerror',e=>errors.push(e.message));pg.on('dialog',d=>d.accept());
    const vis=sel=>pg.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.closest('.hidden')&&e.offsetParent!==null},sel);
    const pids=()=>pg.evaluate(()=>{const a=window.getP().v30.active;return a?a.ids:[]});
    await pg.goto(URL);await pg.waitForTimeout(500);
    ok(await vis('#v30TrackPick'),'при первом входе предлагается выбрать ветку');
    ok((await pg.textContent('#tabVariants')).includes('Варианты'),'по умолчанию — олимпиадная ветка');
    await pg.click('#v30TrackPick [data-track="school"]');await pg.waitForTimeout(150);
    ok(await pg.evaluate(()=>V30.track())==='school'&&!(await vis('#v30TrackPick')),'выбрана школьная ветка, выбор больше не мешает');
    ok((await pg.textContent('#tabVariants')).includes('Контрольные'),'вкладка «Варианты» стала «Контрольные»');
    ok(await pg.$$eval('#v30Variants .v30skill',x=>x.length)===10,'в школьной ветке 10 тем (5 и 6 класс)');
    await pg.evaluate(()=>showHome('adaptive'));await pg.waitForTimeout(100);
    const sk=await pg.$$eval('#v30Trainer .v30skill [data-v30="trainer"]',x=>x.map(b=>b.dataset.skill));
    ok(sk.length===10&&sk.every(x=>x.startsWith('s_')),'тренер показывает только школьные темы');
    await pg.evaluate(()=>showHome('variants'));await pg.waitForTimeout(100);
    await pg.click('#v30Variants [data-v30="school"][data-mode="test"]');await pg.waitForTimeout(200);
    const tid=await pids();
    ok(tid.length===8&&tid.every(id=>id.startsWith('S34-')),'контрольная: 8 школьных задач');
    ok(await pg.evaluate(ids=>new Set(ids.map(id=>V30.tasks.find(t=>t.id===id).skill)).size===8,tid),'контрольная: 8 разных тем');
    ok((await pg.textContent('#v30Timer')).startsWith('40'),'на контрольную 40 минут');
    for(let i=0;i<8;i++)await pg.fill('#v30a'+i,i===7?'0':await pg.evaluate(id=>V30.tasks.find(t=>t.id===id).answer,tid[i]));
    await pg.click('#v30Finish');await pg.waitForTimeout(250);
    ok((await pg.textContent('#v30Grade')).trim()==='5','7 из 8 верно → пятёрка');
    const sp=await pg.evaluate(()=>({s:window.getP().v30.school,o:(window.getP().olympiads||[]).length}));
    ok(sp.s.length===1&&sp.s[0].grade===5&&sp.s[0].score===7&&sp.o===0,'оценка в истории контрольных, в олимпиады не попала');
    await pg.evaluate(()=>showHome('stats'));await pg.waitForTimeout(100);
    ok(await vis('#v30SchoolHist'),'«Мой прогресс» показывает оценки за контрольные');
    await pg.evaluate(()=>showHome('topics'));await pg.waitForTimeout(100);
    await pg.click('#v30Topics [data-v30="topic"][data-skill="s_pct"]');await pg.waitForTimeout(150);
    ok(await vis('#v30Work .badge.v30ahead'),'у задач 6 класса метка «🚀 6 класс»');
    const a0=await pg.evaluate(()=>{const id=window.getP().v30.active.ids[0];return V30.tasks.find(t=>t.id===id).answer});
    await pg.fill('#v30a0',a0);await pg.click('#v30c0');await pg.waitForTimeout(80);
    ok((await pg.textContent('#v30f0')).includes('6 класса'),'за задачу 6 класса — отдельная похвала');
    await pg.click('#v30Back');await pg.waitForTimeout(80);await pg.click('#v30Topics [data-v30="discard"]');await pg.waitForTimeout(80);
    await pg.click('#v30TrackBar [data-track="olymp"]');await pg.waitForTimeout(100);
    ok(await pg.$$eval('#v30Topics .v30skill [data-v30="topic"]',x=>x.every(b=>!b.dataset.skill.startsWith('s_'))&&x.length===20),'в олимпиадной ветке 20 олимпиадных тем');
    await pg.evaluate(()=>showHome('variants'));await pg.waitForTimeout(80);
    ok(await pg.$$eval('#v30Variants [data-v30="variant"][data-mode="olympiad"]',x=>x.length)===7,'после переключения снова 7 олимпиадных вариантов');
    await pg.setViewportSize({width:375,height:800});await pg.waitForTimeout(80);
    ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'переключатель веток на телефоне без горизонтальной прокрутки');
    await pg.close();
  }

  console.log('14. Будильник: час занятий, цель по задачам, итоги');
  {
    const pg=await browser.newPage({viewport:{width:375,height:800}});pg.on('pageerror',e=>errors.push(e.message));pg.on('dialog',d=>d.accept());
    const vis=sel=>pg.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.closest('[hidden]')&&!e.closest('.hidden')&&e.offsetParent!==null},sel);
    await pg.clock.install();await pg.goto(URL);await pg.clock.runFor(800);
    await pg.click('#v30TrackBar [data-v30="alarm"]');await pg.clock.runFor(100);
    ok(await vis('#v30Modal #v30AlStart'),'кнопка ⏰ открывает настройку будильника');
    ok(await pg.evaluate(()=>[+document.querySelector('#v30AlDur .on').dataset.val,+document.querySelector('#v30AlGoal .on').dataset.val].join())==='60,5','первый раз: 1 час и цель 5 задач');
    ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'окно будильника на телефоне без горизонтальной прокрутки');
    await pg.click('#v30AlStart');await pg.clock.runFor(1500);
    ok(!!(await pg.$('#v30AlarmPill'))&&(await pg.textContent('#v30AlarmPill')).includes('0 из 5'),'идёт отсчёт, видна цель «0 из 5»');
    ok(await vis('#v30Trainer'),'после старта открывается тренер');
    await pg.click('#v30Trainer .v30focus [data-v30="trainer"]');await pg.clock.runFor(200);await pg.click('#v30GoPractice');await pg.clock.runFor(200);
    for(const i of [0,1]){const a=await pg.evaluate(i=>{const id=window.getP().v30.active.ids[i];return V30.tasks.find(t=>t.id===id).answer},i);await pg.fill('#v30a'+i,a);await pg.click('#v30c'+i);await pg.clock.runFor(100);
      if(await pg.$('#v30w'+i+' .v30whyopt'))await pg.evaluate(i=>{const id=window.getP().v30.active.ids[i];const t=V30.tasks.find(x=>x.id===id);document.querySelector(`#v30w${i} [data-val="${CSS.escape(t.why[0])}"]`)?.click()},i)}
    await pg.fill('#v30a2','0x');await pg.click('#v30c2');await pg.clock.runFor(1200);
    ok((await pg.textContent('#v30AlarmPill')).includes('2 из 5'),'решённые задачи засчитываются в цель: 2 из 5');
    await pg.clock.runFor(60*60000);
    ok(await vis('#v30Modal .v30alarmsum')&&(await pg.textContent('#v30AlarmTitle')).includes('Время вышло'),'через час будильник звонит и показывает итоги');
    const sum=await pg.textContent('#v30Modal');
    ok(sum.includes('2 из 5')&&sum.includes('На следующий раз')&&sum.includes('Что подтянуть'),'итоги: решено/цель, что подтянуть, что взять на следующий раз');
    const rec=await pg.evaluate(()=>({...window.getP().v30.alarms[0],running:!!window.getP().v30.alarm}));
    ok(rec&&rec.ind+rec.ast===2&&rec.goal===5&&!rec.met&&rec.min===60&&!rec.running,'занятие записано: 60 мин, 2 из 5, цель не выполнена');
    ok(!(await pg.$('#v30AlarmPill')),'после звонка отсчёт убран');
    await pg.click('#v30Modal [data-close]');await pg.clock.runFor(100);
    await pg.evaluate(()=>showHome('adaptive'));await pg.clock.runFor(100);
    // цель выполнена → в следующий раз цель больше
    await pg.evaluate(()=>{const p=window.getP();p.v30.alarms.unshift({ts:Date.now(),dur:60,min:60,goal:5,ind:5,ast:1,wrong:0,sk:{},met:true,early:false});window.setP(p)});
    await pg.click('#v30TrackBar [data-v30="alarm"]');await pg.clock.runFor(100);
    ok(await pg.evaluate(()=>+document.querySelector('#v30AlGoal .on').dataset.val)===10,'цель выполнена → следующая цель 10 задач');
    await pg.click('#v30Modal [data-close]');await pg.clock.runFor(100);
    await pg.evaluate(()=>{const p=window.getP();p.v30.alarms=[60,60,60].map(()=>({ts:Date.now(),dur:60,min:60,goal:15,ind:16,ast:0,wrong:0,sk:{},met:true,early:false}));window.setP(p)});
    await pg.click('#v30TrackBar [data-v30="alarm"]');await pg.clock.runFor(100);
    ok(await pg.evaluate(()=>+document.querySelector('#v30AlDur .on').dataset.val)===90,'три часа подряд с целью → занятие 1,5 часа');
    await pg.click('#v30Modal [data-close]');await pg.clock.runFor(100);
    await pg.evaluate(()=>showHome('stats'));await pg.clock.runFor(100);
    ok(await vis('#v30Alarms')&&(await pg.textContent('#v30Alarms')).includes('Следующая цель'),'«Мой прогресс» показывает занятия по будильнику');
    // будильник «прозвенел», пока вкладка была закрыта
    await pg.evaluate(()=>{const p=window.getP();p.v30.alarm={start:Date.now()-2*3600000,dur:60,goal:5,c:{ind:1,ast:0,wrong:0},sk:{}};window.setP(p)});
    await pg.reload();await pg.clock.runFor(800);
    ok((await pg.textContent('#v30AlarmTitle')).includes('пока тренажёр был закрыт'),'после перезагрузки показаны итоги прошедшего занятия');
    await pg.click('#v30Modal [data-close]');await pg.clock.runFor(100);
    // досрочное завершение
    await pg.click('#v30TrackBar [data-v30="alarm"]');await pg.clock.runFor(100);await pg.click('#v30AlStart');await pg.clock.runFor(1200);
    await pg.click('#v30AlarmPill');await pg.clock.runFor(100);await pg.click('#v30AlStop');await pg.clock.runFor(100);
    ok((await pg.textContent('#v30AlarmTitle')).includes('Занятие закончено')&&(await pg.evaluate(()=>window.getP().v30.alarms[0].early)),'занятие можно закончить досрочно');
    await pg.close();
  }

  ok(errors.length===0,'за весь прогон нет JS-ошибок '+JSON.stringify(errors));
  console.log(`\nИтог: ${passed} пройдено, ${failed} не пройдено`);
  await browser.close();process.exit(failed?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
