/* SAM MATH 2026 upgrade pack */
(() => {
'use strict';
const $=id=>document.getElementById(id), fa=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[+d]);
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(_){return d}};
function init(){
  // First landing page and priority ordering
  const toolsNav=document.querySelector('[data-mode="tools"]');
  if(toolsNav){document.querySelectorAll('.nav-item[data-mode]').forEach(b=>b.classList.remove('active'));toolsNav.classList.add('active');}
  const info={tools:['ابزارهای ریاضی','مجموعه ابزارهای هوشمند محاسباتی'],calculator:['ماشین‌حساب پیشرفته','حالت استاندارد، علمی، برنامه‌نویس و تبدیل واحد']};
  if(window.samShowMode) window.samShowMode('tools');
  else {const t=$('toolsPanel'),c=$('calculatorPanel');if(t&&c){t.hidden=false;c.hidden=true;}}
  // Put sieve and its live table first; all other cards stay in original order.
  const grid=document.querySelector('#toolsPanel .tools-grid');
  if(grid){const sieve=grid.querySelector('#runSieve')?.closest('.tool-card');const viz=$('sieveVizCard');if(sieve)grid.prepend(sieve);if(viz)grid.insertBefore(viz,grid.children[1]||null);}
  // Profile name persists on this browser
  const progress=$('progressPanel');
  if(progress){
    const hero=progress.querySelector('.progress-hero');
    if(hero&&!$('progNameInput')){
      const edit=document.createElement('div');edit.className='profile-edit';
      edit.innerHTML='<label for="progNameInput">نام نمایشی تو</label><div class="profile-edit-row"><input id="progNameInput" maxlength="24" placeholder="نام دلخواهت را بنویس"><button id="progNameSave" type="button" class="primary-btn">ذخیره نام</button></div><p class="hint" id="progNameStatus">نام و پیشرفت روی همین مرورگر ذخیره می‌شود.</p>';
      hero.append(edit);const rank=document.createElement('p');rank.id='progTitle';rank.className='profile-title';rank.textContent='لقب: تازه‌وارد';hero.append(rank);
    }
    const profile=load('sam_profile_v1',{name:''});
    if(profile.name){$('progName').textContent=profile.name;$('progNameInput').value=profile.name;}else{$('progNameInput').value='';}
    $('progNameSave')?.addEventListener('click',()=>{const name=$('progNameInput').value.trim().slice(0,24);if(!name){$('progNameStatus').textContent='لطفاً یک نام وارد کن.';return;}save('sam_profile_v1',{name,joinedAt:load('sam_profile_v1',{joinedAt:Date.now()}).joinedAt||Date.now()});$('progName').textContent=name;$('progNameStatus').textContent='نامت ذخیره شد؛ دفعه بعد هم همین‌جا نمایش داده می‌شود.';});
    const avatar=progress.querySelector('.avatar-big');if(avatar)avatar.textContent='🏆';
  }
  // Calculator modes, history and programmer/unit/date helpers
  const calc=$('calculatorPanel');
  if(calc&&!$('calcMode')){
    const bar=document.createElement('div');bar.className='calc-modebar';
    bar.innerHTML='<label>حالت ماشین‌حساب <select id="calcMode"><option value="standard">استاندارد</option><option value="scientific">علمی</option><option value="programmer">برنامه‌نویس</option><option value="convert">تبدیل واحد</option><option value="date">محاسبه تاریخ</option></select></label><div id="calcModeExtra"></div>';
    calc.prepend(bar);
    const grid=$('calcKeys');const scientific=grid?Array.from(grid.querySelectorAll('[data-key]')):[];
    $('calcMode').addEventListener('change',()=>{
      const mode=$('calcMode').value;let extra=$('calcModeExtra');extra.replaceChildren();
      if(mode==='programmer'){extra.innerHTML='<div class="calc-extra-grid"><label>عدد ده‌دهی<input id="progDec" inputmode="numeric" placeholder="مثلاً 255"></label><label>مبنای خروجی<select id="progBase"><option value="2">دودویی</option><option value="8">هشت‌هشتی</option><option value="16" selected>شانزده‌شانزدهی</option></select></label><button id="progConvert" class="primary-btn">تبدیل</button><p id="progOut" class="result"></p></div>'; $('progConvert').onclick=()=>{let n=Number(String($('progDec').value).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));$('progOut').textContent=Number.isSafeInteger(n)?`BIN: ${n.toString(2)} | OCT: ${n.toString(8)} | HEX: ${n.toString(16).toUpperCase()}`:'عدد صحیح معتبر وارد کن.';};}
      if(mode==='convert'){extra.innerHTML='<div class="calc-extra-grid"><label>مقدار<input id="unitValue" value="1" inputmode="decimal"></label><label>تبدیل<select id="unitKind"><option value="km-mi">کیلومتر ← مایل</option><option value="mi-km">مایل ← کیلومتر</option><option value="cm-in">سانتی‌متر ← اینچ</option><option value="in-cm">اینچ ← سانتی‌متر</option><option value="kg-lb">کیلوگرم ← پوند</option><option value="lb-kg">پوند ← کیلوگرم</option><option value="c-f">سلسیوس ← فارنهایت</option><option value="f-c">فارنهایت ← سلسیوس</option><option value="l-ml">لیتر ← میلی‌لیتر</option></select></label><button id="unitConvert" class="primary-btn">تبدیل کن</button><p id="unitOut" class="result"></p></div>'; $('unitConvert').onclick=()=>{let x=Number($('unitValue').value.replace(',','.')),k=$('unitKind').value, f={'km-mi':x=>x*.621371,'mi-km':x=>x/ .621371,'cm-in':x=>x/2.54,'in-cm':x=>x*2.54,'kg-lb':x=>x*2.20462,'lb-kg':x=>x/2.20462,'c-f':x=>x*9/5+32,'f-c':x=>(x-32)*5/9,'l-ml':x=>x*1000};$('unitOut').textContent=Number.isFinite(x)?`نتیجه: ${fa(Number(f[k](x).toFixed(6)))}`:'مقدار معتبر وارد کن.';};}
      if(mode==='date'){extra.innerHTML='<div class="calc-extra-grid"><label>تاریخ اول<input id="dateA" type="date"></label><label>تاریخ دوم<input id="dateB" type="date"></label><button id="dateDiff" class="primary-btn">اختلاف روزها</button><p id="dateOut" class="result"></p></div>'; $('dateDiff').onclick=()=>{let a=new Date($('dateA').value),b=new Date($('dateB').value);$('dateOut').textContent=isNaN(+a)||isNaN(+b)?'هر دو تاریخ را انتخاب کن.':`اختلاف: ${fa(Math.round(Math.abs(b-a)/86400000))} روز`;};}
      if(grid){grid.classList.toggle('calc-standard-mode',mode==='standard');grid.querySelectorAll('.key-function').forEach(k=>{const key=k.dataset.key||'';k.hidden=mode==='programmer'||mode==='convert'||mode==='date'||(mode==='standard'&&/^(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|log|ln|fact|floor|ceil|round|exp|cbrt)/.test(key));});}
    });
    $('calcMode').value='standard';$('calcMode').dispatchEvent(new Event('change'));
  }
  // Google-Dino-inspired math runner and grade-scaled Sudoku
  const challenge=$('challengePanel');
  if(challenge&&!$('samArcade')&&!window.SAM_ARCADE_PRO){
    const section=document.createElement('section');section.id='samArcade';section.className='arcade-suite';
    section.innerHTML=`<h2>🎮 آرکید ریاضی SAM</h2><label class="arcade-grade">پایهٔ تحصیلی <select id="arcadeGrade"><option value="1">پایه 1</option><option value="2">پایه 2</option><option value="3">پایه 3</option><option value="4">پایه 4</option><option value="5">پایه 5</option><option value="6">پایه 6</option><option value="7">پایه 7</option><option value="8" selected>پایه 8</option><option value="9">پایه 9</option><option value="10">پایه 10</option><option value="11">پایه 11</option><option value="12">پایه 12</option></select></label>
      <div class="arcade-tabs"><button class="arcade-tab active" data-arcade="runner">🦖 دایناسور ریاضی</button><button class="arcade-tab" data-arcade="sudoku">🧩 سودوکوی هوشمند</button><button class="arcade-tab" data-arcade="quick">⚡ رعدوبرق محاسبات</button><button class="arcade-tab" data-arcade="memory">🧠 حافظه عددی</button><button class="arcade-tab" data-arcade="hunt">🎯 شکار جواب</button><button class="arcade-tab" data-arcade="order">🔢 پازل ترتیب</button></div>
      <div id="runnerGame" class="arcade-view"><p class="hint">مثل دایناسور معروف بدو، مانع‌ها را رد کن و با حل سؤال‌های متنوع راه را باز کن؛ هرچه جلوتر بروی سرعت بیشتر می‌شود!</p><div class="runner-scene"><div class="runner-sky">✦　✧　☁</div><div class="runner-ground"></div><div id="runnerDino" class="runner-dino">🦖</div><div id="runnerObstacle" class="runner-obstacle">√</div><div class="runner-hud"><span>امتیاز: <b id="runnerScore">۰</b></span><span>مرحله: <b id="runnerStage">۱</b></span></div></div><div class="runner-question" id="runnerQuestion">شروع را بزن!</div><div class="runner-controls"><button id="runnerStart" class="primary-btn">شروع بازی</button><input id="runnerAnswer" inputmode="numeric" placeholder="جواب"><button id="runnerSubmit" class="primary-btn">پرش!</button></div><p id="runnerFeedback" class="result"></p></div>
      <div id="sudokuGame" class="arcade-view" hidden><p class="hint">سطح جدول با پایه انتخابی تغییر می‌کند: پایه‌های ۱ تا ۳ جدول ۴×۴، پایه‌های ۴ تا ۶ جدول ۶×۶ و پایه‌های ۷ تا ۱۲ جدول ۹×۹ دارند.</p><div class="sudoku-controls"><label>پایه<select id="sudokuGrade">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i===7?'selected':''}>پایه ${fa(i+1)}</option>`).join('')}</select></label><button id="sudokuNew" class="primary-btn">جدول تازه</button><button id="sudokuCheck" class="ghost-btn">بررسی جواب</button></div><div id="sudokuBoard" class="sudoku-board"></div><p id="sudokuStatus" class="result"></p></div>
      <div id="quickGame" class="arcade-view" hidden><p class="hint">۳۰ ثانیه فرصت داری تا جای ممکن سؤال‌های تازه را درست جواب بدهی.</p><div class="mini-game-stat" id="quickTime">زمان: ۳۰</div><div class="mini-game-question" id="quickQuestion">برای شروع آماده‌ای؟</div><div class="mini-game-controls"><input id="quickAnswer" inputmode="numeric" placeholder="پاسخ"><button id="quickStart" class="primary-btn">شروع رعدوبرق</button><button id="quickSubmit" class="ghost-btn">ثبت جواب</button></div><p class="result" id="quickStatus"></p></div>
      <div id="memoryGame" class="arcade-view" hidden><p class="hint">دنباله اعداد را به خاطر بسپار و سپس همان ترتیب را وارد کن. هر مرحله سخت‌تر می‌شود.</p><div class="mini-game-question" id="memorySequence">برای نمایش دنباله شروع کن.</div><div class="mini-game-controls"><input id="memoryAnswer" inputmode="numeric" placeholder="اعداد را پشت سر هم بنویس"><button id="memoryStart" class="primary-btn">نمایش دنباله</button><button id="memoryCheck" class="ghost-btn">بررسی</button></div><p class="result" id="memoryStatus"></p></div>
      <div id="huntGame" class="arcade-view" hidden><p class="hint">جواب درست را از بین چهار گزینه شکار کن؛ سؤال‌ها با هر دور عوض می‌شوند.</p><div class="mini-game-question" id="huntQuestion">شروع بازی را بزن.</div><div class="hunt-options" id="huntOptions"></div><button id="huntStart" class="primary-btn">شروع شکار جواب</button><p class="result" id="huntStatus"></p></div>
      <div id="orderGame" class="arcade-view" hidden><p class="hint">عددهای به‌هم‌ریخته را به ترتیب صعودی مرتب کن و مرحله‌ها را پشت سر بگذار.</p><div class="mini-game-question" id="orderQuestion">عددها را مرتب کن.</div><div class="order-options" id="orderOptions"></div><div class="mini-game-controls"><input id="orderAnswer" inputmode="numeric" placeholder="مثلاً ۲،۴،۷،۹"><button id="orderNew" class="primary-btn">مرحله تازه</button><button id="orderCheck" class="ghost-btn">بررسی ترتیب</button></div><p class="result" id="orderStatus"></p></div>`;
    challenge.append(section);
    section.querySelectorAll('.arcade-tab').forEach(b=>b.onclick=()=>{section.querySelectorAll('.arcade-tab').forEach(x=>x.classList.toggle('active',x===b));['runner','sudoku','quick','memory','hunt','order'].forEach(k=>{const el=$(k+'Game');if(el)el.hidden=b.dataset.arcade!==k;});});
    const lockedGames={root:7,power:7,fraction:7,gcd:7,lcm:7,prime:6,sequence:6,reverse:8,estimate:5};
    function syncGameLocks(){const grade=Number($('arcadeGrade').value);const game=$('chGame');if(game){[...game.options].forEach(o=>{const min=lockedGames[o.value]||1;o.disabled=grade<min;if(o.disabled)o.textContent=o.textContent.replace(/ 🔒.*$/,'')+' 🔒 پایه '+min+' به بالا';else o.textContent=o.textContent.replace(/ 🔒.*$/,'');});if(game.selectedOptions[0]?.disabled)game.value='mixed';}}
    $('arcadeGrade').addEventListener('change',syncGameLocks);syncGameLocks();
    let score=0,stage=1,answer=0,run=false,lastQuestion='';
    function question(){
      const grade=Number($('arcadeGrade')?.value||8);
      let text='',a,b,kind;
      for(let attempt=0;attempt<20;attempt++){
        if(grade<=2){
          a=1+Math.floor(Math.random()*9);b=1+Math.floor(Math.random()*9);
          kind=Math.random()<.55?'+':'−';if(kind==='−'&&b>a)[a,b]=[b,a];
          answer=kind==='+'?a+b:a-b;text=`${fa(a)} ${kind} ${fa(b)} = ؟`;
        }else if(grade<=4){
          a=2+Math.floor(Math.random()*12);b=2+Math.floor(Math.random()*12);
          kind=['+','−','×'][Math.floor(Math.random()*3)];if(kind==='−'&&b>a)[a,b]=[b,a];
          answer=kind==='+'?a+b:kind==='−'?a-b:a*b;text=`${fa(a)} ${kind} ${fa(b)} = ؟`;
        }else if(grade<=6){
          a=3+Math.floor(Math.random()*18);b=2+Math.floor(Math.random()*12);
          kind=['×','−','+'][Math.floor(Math.random()*3)];if(kind==='−'&&b>a)[a,b]=[b,a];
          answer=kind==='×'?a*b:kind==='−'?a-b:a+b;text=`${fa(a)} ${kind} ${fa(b)} = ؟`;
        }else if(grade<=8){
          if(Math.random()<.5){a=2+Math.floor(Math.random()*14);answer=a*a;text=`${fa(a)}² = ؟`;}
          else{a=2+Math.floor(Math.random()*14);answer=a;text=`√${fa(a*a)} = ؟`;}
        }else if(grade<=10){
          a=2+Math.floor(Math.random()*18);b=a+2+Math.floor(Math.random()*20);answer=b-a;text=`اگر x + ${fa(a)} = ${fa(b)} باشد، x = ؟`;
        }else{
          a=2+Math.floor(Math.random()*15);b=2+Math.floor(Math.random()*15);
          if(Math.random()<.5){answer=a*b;text=`${fa(a)} × ${fa(b)} = ؟`;}
          else{const c=1+Math.floor(Math.random()*12);answer=a+b-c;text=`${fa(a)} + ${fa(b)} − ${fa(c)} = ؟`;}
        }
        if(text!==lastQuestion)break;
      }
      lastQuestion=text;$('runnerQuestion').textContent=text;
    }
    $('runnerStart').onclick=()=>{score=0;stage=1;run=true;lastQuestion='';$('runnerScene')?.classList.add('runner-running');$('runnerObstacle').style.setProperty('--runner-speed','2.3s');$('runnerScore').textContent='۰';$('runnerStage').textContent='۱';$('runnerFeedback').textContent='آماده‌ای؟ شروع شد!';const st=load('sam_stats_v1',{});st.games=(st.games||0)+1;save('sam_stats_v1',st);question();};
    $('runnerSubmit').onclick=()=>{if(!run){$('runnerFeedback').textContent='اول بازی را شروع کن.';return;}const v=Number(($('runnerAnswer').value||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));if(v===answer){score+=10;stage++;$('runnerScene')?.classList.add('runner-running');$('runnerObstacle').style.setProperty('--runner-speed',Math.max(.65,2.3-stage*.075)+'s');$('runnerDino').classList.remove('runner-jump');void $('runnerDino').offsetWidth;$('runnerDino').classList.add('runner-jump');$('runnerObstacle').textContent=['√','π','∑','△','∞'][stage%5];$('runnerScore').textContent=fa(score);$('runnerStage').textContent=fa(stage);$('runnerFeedback').textContent='عالی! مانع را رد کردی ⭐';question();$('runnerAnswer').value='';save('sam-math-arcade-best',Math.max(score,load('sam-math-arcade-best',0)));const st=load('sam_stats_v1',{});st.correct=(st.correct||0)+1;st.bestScore=Math.max(st.bestScore||0,score);st.totalGameScore=(st.totalGameScore||0)+score;save('sam_stats_v1',st);}else {$('runnerFeedback').textContent='این مانع رد نشد! جواب درست را پیدا کن و دوباره تلاش کن.';$('runnerDino').classList.add('runner-bump');setTimeout(()=>$('runnerDino')?.classList.remove('runner-bump'),260);}};
    $('runnerAnswer').addEventListener('keydown',e=>{if(e.key==='Enter')$('runnerSubmit').click();});
    // deterministic valid Latin-pattern Sudoku, randomized blanks; size scales by grade
    function makeSudoku(){const grade=+$('arcadeGrade').value,n=grade<=3?4:grade<=6?6:9,boxRows=n===4?2:n===6?2:3,boxCols=n/boxRows,symbols='123456789'.slice(0,n),board=Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>symbols[(r*boxCols+Math.floor(r/boxRows)+c)%n]));const puzzle=board.map(row=>row.slice());const blanks=grade<=3?Math.floor(n*n*.35):grade<=6?Math.floor(n*n*.48):Math.floor(n*n*.58);for(let k=0;k<blanks;k++){let r=Math.floor(Math.random()*n),c=Math.floor(Math.random()*n);puzzle[r][c]='';}const host=$('sudokuBoard');host.style.setProperty('--sudoku-n',n);host.innerHTML='';puzzle.forEach((row,r)=>row.forEach((v,c)=>{const inp=document.createElement('input');inp.inputMode='numeric';inp.maxLength=1;inp.value=v;inp.dataset.answer=board[r][c];inp.disabled=!!v;inp.setAttribute('aria-label',`ردیف ${r+1} ستون ${c+1}`);host.append(inp);}));host.dataset.size=n;$('sudokuStatus').textContent=`جدول ${fa(n)}×${fa(n)} آماده است. خانه‌های خالی را کامل کن.`;}
    $('sudokuNew').onclick=makeSudoku;$('arcadeGrade').onchange=()=>{$('sudokuGrade').value=$('arcadeGrade').value;makeSudoku();};$('sudokuGrade').onchange=()=>{$('arcadeGrade').value=$('sudokuGrade').value;makeSudoku();};$('sudokuCheck').onclick=()=>{const cells=[...$('sudokuBoard').querySelectorAll('input')];let ok=0;cells.forEach(x=>{x.classList.toggle('sudoku-correct',x.value.trim()===x.dataset.answer);x.classList.toggle('sudoku-wrong',x.value.trim()!==x.dataset.answer);if(x.value.trim()===x.dataset.answer)ok++;});$('sudokuStatus').textContent=ok===cells.length?'🏆 آفرین! جدول را کامل و درست حل کردی.':`${fa(ok)} از ${fa(cells.length)} خانه درست است؛ خانه‌های قرمز را اصلاح کن.`;if(ok===cells.length){save('sam-math-sudoku-wins',load('sam-math-sudoku-wins',0)+1);const st=load('sam_stats_v1',{});st.games=(st.games||0)+1;st.correct=(st.correct||0)+1;st.bestScore=Math.max(st.bestScore||0,100);st.totalGameScore=(st.totalGameScore||0)+100;save('sam_stats_v1',st);}};

    // Four additional playable mini-games.
    const norm = v => String(v||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const randomQuestion = () => {
      const g=Number($('arcadeGrade').value),a=1+Math.floor(Math.random()*(g<4?10:g<8?18:30)),b=1+Math.floor(Math.random()*(g<4?10:g<8?15:25));
      const ops=g<3?['+','−']:g<7?['+','−','×']:['+','−','×'];
      const op=ops[Math.floor(Math.random()*ops.length)];let x=a,y=b;if(op==='−'&&y>x)[x,y]=[y,x];
      return {text:`${fa(x)} ${op} ${fa(y)} = ؟`,answer:op==='+'?x+y:op==='−'?x-y:x*y};
    };
    let quickCurrent=null,quickScore=0,quickLeft=30,quickTimer=null;
    function nextQuick(){quickCurrent=randomQuestion();$('quickQuestion').textContent=quickCurrent.text;$('quickAnswer').value='';}
    $('quickStart').onclick=()=>{clearInterval(quickTimer);quickScore=0;quickLeft=30;$('quickStatus').textContent='بزن بریم!';$('quickTime').textContent='زمان: ۳۰';nextQuick();quickTimer=setInterval(()=>{quickLeft--;$('quickTime').textContent='زمان: '+fa(quickLeft);if(quickLeft<=0){clearInterval(quickTimer);$('quickStatus').textContent=`پایان! امتیاز تو: ${fa(quickScore)}`;save('sam_stats_v1',{...load('sam_stats_v1',{}),bestScore:Math.max(load('sam_stats_v1',{}).bestScore||0,quickScore)});}},1000);};
    $('quickSubmit').onclick=()=>{if(!quickCurrent||quickLeft<=0)return;if(Number(norm($('quickAnswer').value))===quickCurrent.answer){quickScore+=10;$('quickStatus').textContent='درست! امتیاز: '+fa(quickScore);nextQuick();}else $('quickStatus').textContent='نزدیک بود! دوباره امتحان کن.';};
    $('quickAnswer').addEventListener('keydown',e=>{if(e.key==='Enter')$('quickSubmit').click();});

    let memoryValues=[];
    $('memoryStart').onclick=()=>{const len=Math.min(3+Math.floor(stage/4),8);memoryValues=Array.from({length:len},()=>Math.floor(Math.random()*9)+1);$('memorySequence').textContent=memoryValues.map(fa).join('  ·  ');$('memoryStatus').textContent='خوب به خاطر بسپار؛ چند لحظه دیگر پنهان می‌شود.';$('memoryAnswer').value='';setTimeout(()=>{if($('memorySequence'))$('memorySequence').textContent='حالا دنباله را وارد کن!';},1800);};
    $('memoryCheck').onclick=()=>{const got=norm($('memoryAnswer').value).replace(/[,\s،-]/g,'');const expected=memoryValues.join('');$('memoryStatus').textContent=got===expected&&expected?'آفرین! حافظه‌ات عالیه 🏆':'این بار درست نشد؛ دوباره دنباله را ببین و تلاش کن.';if(got===expected&&expected){const st=load('sam_stats_v1',{});st.correct=(st.correct||0)+1;st.totalGameScore=(st.totalGameScore||0)+20;save('sam_stats_v1',st);}};

    let huntAnswer=null,huntPoints=0;
    function newHunt(){const q=randomQuestion();huntAnswer=q.answer;$('huntQuestion').textContent=q.text;const opts=new Set([huntAnswer]);while(opts.size<4){const delta=1+Math.floor(Math.random()*12);opts.add(Math.max(0,huntAnswer+(Math.random()<.5?-delta:delta)));}const arr=[...opts].sort(()=>Math.random()-.5);$('huntOptions').replaceChildren(...arr.map(v=>{const b=document.createElement('button');b.className='hunt-option';b.textContent=fa(v);b.onclick=()=>{if(v===huntAnswer){huntPoints+=10;$('huntStatus').textContent='شکار موفق! امتیاز: '+fa(huntPoints);newHunt();}else{$('huntStatus').textContent='این گزینه نبود؛ دوباره انتخاب کن.';b.disabled=true;}};return b;}));}
    $('huntStart').onclick=()=>{huntPoints=0;$('huntStatus').textContent='جواب درست را انتخاب کن!';newHunt();};

    let orderValues=[];
    function newOrder(){orderValues=Array.from({length:4},()=>Math.floor(Math.random()*40)+1);const shuffled=orderValues.slice().sort(()=>Math.random()-.5);$('orderQuestion').textContent='این عددها را از کوچک به بزرگ مرتب کن: '+shuffled.map(fa).join('  ·  ');$('orderAnswer').value='';}
    $('orderNew').onclick=newOrder;
    $('orderCheck').onclick=()=>{const got=norm($('orderAnswer').value).split(/[,\s،-]+/).filter(Boolean).map(Number);const expected=orderValues.slice().sort((a,b)=>a-b);$('orderStatus').textContent=got.length===4&&got.every((v,i)=>v===expected[i])?'درست مرتب کردی! مرحله بعدی آماده است ⭐':'ترتیب درست نیست؛ دوباره تلاش کن.';};
    newOrder();
    makeSudoku();
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
