'use strict';
(() => {
 const $=id=>document.getElementById(id); let expression='';
 const exprOut=$('calcExpression'), resultOut=$('calcResult');
 function gcd(a,b){a=Math.abs(Math.trunc(a));b=Math.abs(Math.trunc(b));while(b){[a,b]=[b,a%b]}return a||1}
 function fmt(n){if(!Number.isFinite(n))throw Error('این عبارت جواب معتبر ندارد.');if(Math.abs(n)<1e-12)n=0;return Number(n.toPrecision(12)).toString()}
 function calculate(raw){let s=raw.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/π/g,'pi').replace(/√\(/g,'sqrt(').replace(/\^/g,'**').replace(/%/g,'/100');
   if(!s.trim())throw Error('اول یک عبارت وارد کن.');
   if(!/^[0-9+\-*/().,\sA-Za-z_]*$/.test(s))throw Error('این علامت در ماشین‌حساب پشتیبانی نمی‌شود.');
   s=s.replace(/\bpi\b/gi,'Math.PI').replace(/\bsqrt\s*\(/gi,'Math.sqrt(').replace(/\bsin\s*\(/gi,'Math.sin(').replace(/\bcos\s*\(/gi,'Math.cos(').replace(/\btan\s*\(/gi,'Math.tan(').replace(/\blog\s*\(/gi,'Math.log10(').replace(/\bln\s*\(/gi,'Math.log(').replace(/\babs\s*\(/gi,'Math.abs(').replace(/\be\b/g,'Math.E');
   if(/[A-Za-z_]/.test(s.replace(/Math\.(PI|E|sqrt|sin|cos|tan|log10|log|abs)/g,'')))throw Error('تابع یا نماد ناشناخته است.');
   const val=Function('"use strict"; return ('+s+')')(); return fmt(val);
 }
 function update(){exprOut.textContent=expression||'0';try{resultOut.textContent=expression?calculate(expression):'نتیجه';resultOut.classList.remove('error')}catch(e){resultOut.textContent=expression?'…':'نتیجه';resultOut.classList.remove('error')}}
 function press(k){if(k==='AC'){expression='';update();return}if(k==='DEL'){expression=expression.slice(0,-1);update();return}if(k==='='){try{const v=calculate(expression);expression=v;exprOut.textContent=expression;resultOut.textContent='= '+v;resultOut.classList.remove('error')}catch(e){resultOut.textContent=e.message;resultOut.classList.add('error')}return}if(k==='square'){expression=expression?`(${expression})^2`:'';update();return}if(k==='pi')expression+='pi';else expression+=k;update()}
 $('calcKeys').addEventListener('click',e=>{const b=e.target.closest('button[data-key]');if(b)press(b.dataset.key)});
 document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(/^[0-9().+\-*/^]$/.test(e.key)){expression+=e.key;update()}else if(e.key==='Enter'){e.preventDefault();press('=')}else if(e.key==='Backspace'){press('DEL')}else if(e.key==='Escape'){press('AC')}});
 function val(id){return Number($(id).value)}function out(id,text,bad=false){$(id).textContent=text;$(id).classList.toggle('error',bad)}
 const faDigits=s=>String(s).replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

 /* ---------- ابزارها ---------- */
 $('solveLinear').onclick=()=>{let a=val('linearA'),b=val('linearB'),c=val('linearC');if(a===0){out('linearResult',b===c?'هر عددی می‌تواند جواب باشد.':'این معادله جواب ندارد.',b!==c);return}out('linearResult',`ax + b = c  ←  x = (c − b) ÷ a = (${c} − ${b}) ÷ ${a} = ${fmt((c-b)/a)}`)};
 $('solveFraction').onclick=()=>{let a=val('n1'),b=val('d1'),c=val('n2'),d=val('d2'),op=$('fracOp').value;if(![a,b,c,d].every(Number.isFinite)||b===0||d===0){out('fractionResult','صورت و مخرج را بررسی کن؛ مخرج صفر مجاز نیست.',true);return}let n,den;if(op==='+'){n=a*d+c*b;den=b*d}else if(op==='-'){n=a*d-c*b;den=b*d}else if(op==='*'){n=a*c;den=b*d}else{if(c===0){out('fractionResult','تقسیم بر کسر صفر ممکن نیست.',true);return}n=a*d;den=b*c}if(den<0){n=-n;den=-den}let g=gcd(n,den);out('fractionResult',`${a}/${b} ${op} ${c}/${d} = ${n}/${den} = ${n/g}/${den/g}`)};
 $('squareFraction').onclick=()=>{let n=val('sqN'),d=val('sqD');if(d===0){out('squareResult','مخرج نمی‌تواند صفر باشد.',true);return}let sn=n*n,sd=d*d,g=gcd(sn,sd);out('squareResult',`(${n}/${d})² = ${sn}/${sd} = ${sn/g}/${sd/g}`)};
 $('runSieve').onclick=()=>{let a=Math.floor(val('sieveFrom')),b=Math.floor(val('sieveTo'));if(!Number.isFinite(a)||!Number.isFinite(b)){out('sieveResult','هر دو مرز بازه را وارد کن.',true);return}if(a<1||b>5000){out('sieveResult','مرزها باید بین ۱ تا ۵۰۰۰ باشند.',true);return}if(a>b){out('sieveResult','عدد «از» باید کوچک‌تر یا برابر عدد «تا» باشد.',true);return}let p=Array(b+1).fill(true);p[0]=p[1]=false;for(let i=2;i*i<=b;i++)if(p[i])for(let j=i*i;j<=b;j+=i)p[j]=false;let primes=[];for(let i=a;i<=b;i++)if(p[i])primes.push(i);out('sieveResult',primes.length?`بازهٔ ${a} تا ${b}\nتعداد: ${primes.length}\n${primes.join('، ')}`:`در بازهٔ ${a} تا ${b} عدد اولی وجود ندارد.`)};
 $('solvePercent').onclick=()=>out('percentResult',`${val('percentValue')}٪ از ${val('percentBase')} = ${fmt(val('percentValue')*val('percentBase')/100)}`);
 $('solveGcd').onclick=()=>{let a=Math.trunc(val('gcdA')),b=Math.trunc(val('gcdB'));if(!Number.isFinite(a)||!Number.isFinite(b)){out('gcdResult','دو عدد صحیح وارد کن.',true);return}let g=gcd(a,b),l=(a===0||b===0)?0:Math.abs(a/g*b);out('gcdResult',`ب.م.م = ${g} ، ک.م.م = ${l}`)};
 $('solveRatio').onclick=()=>{let a=val('ratioA'),b=val('ratioB'),c=val('ratioC');if(b===0||a===0){out('ratioResult','a و b نباید صفر باشند.',true);return}out('ratioResult',`x = (b × c) ÷ a = ${fmt(b*c/a)}`)};
 $('solveEgyptian').onclick=()=>{let n=Math.trunc(val('egyN')),d=Math.trunc(val('egyD'));if(!Number.isFinite(n)||!Number.isFinite(d)||d<=0||n<=0||n>=d){out('egyResult','برای این ابزار، صورت و مخرج باید مثبت باشند و صورت از مخرج کوچک‌تر باشد.',true);return}let parts=[],steps=0;while(n!==0&&steps<30){let unit=Math.ceil(d/n);parts.push(`۱/${unit}`);n=n*unit-d;d=d*unit;let g=gcd(n,d);if(g){n/=g;d/=g}steps++}out('egyResult',parts.join(' + '))};
 $('runFibonacci').onclick=()=>{let n=Math.trunc(val('fibCount'));if(n<2||n>30){out('fibResult','تعداد باید بین ۲ تا ۳۰ باشد.',true);return}let a=1,b=1,arr=[a,b];for(let i=2;i<n;i++){let c=a+b;arr.push(c);a=b;b=c}out('fibResult',arr.join('، '))};
 $('factorNumber').onclick=()=>{let n=Math.trunc(val('factorN'));if(n<2||n>1000000){out('factorResult','عدد باید بین ۲ تا ۱٬۰۰۰٬۰۰۰ باشد.',true);return}let original=n,parts=[];for(let p=2;p*p<=n;p+=(p===2?1:2)){let count=0;while(n%p===0){n/=p;count++}if(count)parts.push(count>1?`${p}^${count}`:`${p}`)}if(n>1)parts.push(`${n}`);out('factorResult',`${original} = ${parts.join(' × ')}`)};
 $('runSequence').onclick=()=>{let a=val('seqFirst'),d=val('seqDiff'),n=Math.trunc(val('seqCount'));if(n<2||n>30){out('seqResult','تعداد باید بین ۲ تا ۳۰ باشد.',true);return}out('seqResult',Array.from({length:n},(_,i)=>a+i*d).join('، '))};
 $('solveQuad').onclick=()=>{let a=val('quadA'),b=val('quadB'),c=val('quadC');if(a===0){out('quadResult','ضریب a نباید صفر باشد.',true);return}let d=b*b-4*a*c;if(d<0){out('quadResult',`Δ = ${d}؛ جواب حقیقی ندارد.`);return}let x1=(-b+Math.sqrt(d))/(2*a),x2=(-b-Math.sqrt(d))/(2*a);out('quadResult',`Δ = ${d} ؛ x₁ = ${fmt(x1)} ، x₂ = ${fmt(x2)}`)};

 // شمارنده‌های یک عدد: همه‌ٔ مقسوم‌علیه‌های مثبت، تعداد، و زوج‌های ضربی
 $('runDivisors').onclick=()=>{
   const n=Math.trunc(val('divN'));
   if(!Number.isFinite(n)||n<1||n>1e12){out('divResult','عدد باید صحیح و بین ۱ تا ۱۰۱۲ باشد.',true);return}
   const small=[],big=[];
   for(let i=1;i*i<=n;i++){if(n%i===0){small.push(i);if(i*i!==n)big.push(n/i)}}
   const all=small.concat(big.reverse());
   const pairs=small.map((s,k)=>`${s}×${n/s}`).join('، ');
   let note;
   if(n===1)note='۱ فقط یک شمارنده دارد و عدد اول نیست.';
   else if(all.length===2)note='فقط دو شمارنده دارد؛ پس عدد اول است.';
   else note='بیش از دو شمارنده دارد؛ پس عدد اول نیست.';
   out('divResult',`${n} دارای ${all.length} شمارنده است:\n${all.join('، ')}\nزوج‌های ضربی: ${pairs}\n${note}`);
 };

 // نسبت طلایی: F(n) و نسبت دو جملهٔ متوالی فیبوناچی و فاصله‌اش از φ
 $('runPhi').onclick=()=>{
   const n=Math.trunc(val('phiN'));
   if(!Number.isFinite(n)||n<2||n>70){out('phiResult','n باید بین ۲ تا ۷۰ باشد.',true);return}
   let a=1,b=1;for(let i=3;i<=n;i++){[a,b]=[b,a+b]}
   // اکنون a = F(n-1) و b = F(n)
   const phi=(1+Math.sqrt(5))/2;
   const ratio=b/a;
   out('phiResult',`F(${n}) = ${b}\nF(${n})÷F(${n-1}) = ${b}÷${a} = ${ratio.toFixed(6)}\nφ ≈ ${phi.toFixed(6)}\nفاصله تا φ: ${Math.abs(ratio-phi).toExponential(3)}`);
 };

 // حساب پیمانه‌ای: (a + b) mod n روی ساعتی با n خانه
 $('runMod').onclick=()=>{
   const n=Math.trunc(val('modN')), a=Math.trunc(val('modA')), b=Math.trunc(val('modB'));
   if(![n,a,b].every(Number.isFinite)||n<2){out('modResult','پیمانه (n) باید عدد صحیح بزرگ‌تر یا برابر ۲ باشد.',true);return}
   const sum=a+b;
   const r=((sum%n)+n)%n;
   const q=Math.floor(sum/n);
   const shown=(r===0&&n===12)?12:r;
   out('modResult',`(${a} + ${b}) = ${sum}\n${sum} ÷ ${n} = ${q} با باقی‌مانده ${r}\n${sum} mod ${n} = ${r}`+(n===12?`\nروی ساعت ۱۲ تایی: ساعت ${shown}`:''));
 };

 /* ---------- دستیار ریاضی: موضوع‌ها ---------- */
 const TOOL_BUTTON={linear:'solveLinear',fraction:'solveFraction',square:'squareFraction',sieve:'runSieve',percent:'solvePercent',gcd:'solveGcd',ratio:'solveRatio',egy:'solveEgyptian',fib:'runFibonacci',factor:'factorNumber',seq:'runSequence',quad:'solveQuad',divisors:'runDivisors',phi:'runPhi',mod:'runMod'};
 const TOPICS=[
  {id:'fractions',cat:'عدد',title:'کسرها',text:'برای جمع و تفریق کسرها، مخرج مشترک بگیر؛ سپس صورت‌ها را جمع یا کم کن و در پایان با تقسیم صورت و مخرج بر ب.م.م ساده کن.',example:'۱/۲ + ۱/۳ = ۳/۶ + ۲/۶ = ۵/۶',tool:'fraction'},
  {id:'divisors',cat:'عدد',title:'شمارنده‌ها (مقسوم‌علیه‌ها)',text:'شمارنده‌های یک عدد، عددهایی هستند که آن عدد را بدون باقی‌مانده بر آن‌ها بخش‌پذیر است. برای پیدا کردن آن‌ها، از ۱ تا ریشهٔ عدد را امتحان کن و هر شمارندهٔ کوچک را همراه با «عدد ÷ آن» ثبت کن؛ هر جفت ضربی دو شمارندهٔ عدد است.',example:'۱۲ = ۱×۱۲ = ۲×۶ = ۳×۴ ⇒ شمارنده‌ها: ۱، ۲، ۳، ۴، ۶، ۱۲ (۶ تا)',tool:'divisors'},
  {id:'prime',cat:'عدد',title:'اعداد اول',text:'عدد اول دقیقاً دو شمارندهٔ مثبت دارد: ۱ و خودش. عدد ۱ اول نیست. در غربال اراتستن، مضرب‌های هر عدد اول را از فهرست حذف می‌کنیم؛ عددهای باقی‌مانده اول‌اند.',example:'۲، ۳، ۵، ۷، ۱۱ اول‌اند؛ ۹ اول نیست چون ۱، ۳، ۹ شمارنده دارد.',tool:'sieve'},
  {id:'factor',cat:'عدد',title:'تجزیه به عوامل اول',text:'هر عدد بزرگ‌تر از ۱ را می‌توان به حاصل‌ضرب عددهای اول نوشت. کافی است آن را بر کوچک‌ترین عدد اول بخش‌پذیر تقسیم کنی و ادامه بدهی.',example:'۳۶۰ = ۲³ × ۳² × ۵',tool:'factor'},
  {id:'gcd',cat:'عدد',title:'ب.م.م و ک.م.م',text:'ب.م.م بزرگ‌ترین عددی است که هر دو عدد بر آن بخش‌پذیرند. ک.م.م کوچک‌ترین مضرب مثبت مشترک آن‌هاست. برای هر دو عدد: ب.م.م × ک.م.م = حاصل‌ضرب خود آن دو عدد.',example:'ب.م.م(۱۸، ۲۴) = ۶ و ک.م.م = ۷۲',tool:'gcd'},
  {id:'egy',cat:'عدد',title:'کسرهای مصری',text:'هر کسر کوچک‌تر از ۱ را می‌توان به مجموع کسرهایی با صورت ۱ نوشت. روش حریصانه: مخرج ۱ بر کسر را گرد به بالا بگیر، آن را کم کن و تکرار کن.',example:'۳/۷ = ۱/۳ + ۱/۱۱ + ۱/۲۳۱',tool:'egy'},
  {id:'fib',cat:'الگو',title:'دنبالهٔ فیبوناچی',text:'در دنبالهٔ فیبوناچی هر جمله از جمع دو جملهٔ قبل به دست می‌آید. جملهٔ اول و دوم هر دو ۱ هستند.',example:'۱، ۱، ۲، ۳، ۵، ۸، ۱۳، ۲۱، ...',tool:'fib'},
  {id:'golden',cat:'الگو',title:'نسبت طلایی',text:'اگر هر جملهٔ فیبوناچی را بر جملهٔ قبلی‌اش تقسیم کنیم، نسبت‌ها کم‌کم به عدد ۱٫۶۱۸ نزدیک می‌شوند. این عدد را نسبت طلایی می‌نامند و با φ (فی) نشان می‌دهند: φ = (۱ + √۵) ÷ ۲. هرچه جمله‌ها بزرگ‌تر شوند، نزدیکی بیشتر می‌شود.',example:'۱۳÷۸ = ۱٫۶۲۵ ؛ ۲۱÷۱۳ ≈ ۱٫۶۱۵۴ — دومی به φ نزدیک‌تر است.',tool:'phi'},
  {id:'modular',cat:'عدد',title:'حساب پیمانه‌ای و ساعت',text:'در حساب پیمانه‌ای، پس از رسیدن به یک مقدار مشخص (پیمانه) دوباره از ابتدا می‌شماریم؛ درست مثل ساعت ۱۲ ساعته. باقی‌مانده تقسیم عدد بر پیمانه، همان جای ما روی ساعت است.',example:'روی ساعت ۱۲ تایی: ۸ + ۹ = ۱۷ ⇒ ۱۷ mod ۱۲ = ۵ ⇒ ساعت ۵',tool:'mod'},
  {id:'powers',cat:'عدد',title:'توان و جذر',text:'توان یعنی ضرب تکراری: ۳² = ۳×۳ = ۹. جذرِ یک عدد نامنفی، عددی است که مربعش آن عدد شود. ۲⁰ = ۱ و ۲⁻¹ = ۱/۲.',example:'√۴۹ = ۷ ؛ ۲⁵ = ۳۲',tool:'square'},
  {id:'order',cat:'عدد',title:'اولویت عملیات',text:'ترتیب انجام عملیات: اول پرانتز، بعد توان و جذر، سپس ضرب و تقسیم (از چپ به راست) و در آخر جمع و تفریق (از چپ به راست).',example:'۲ + ۳ × ۴² = ۲ + ۳ × ۱۶ = ۲ + ۴۸ = ۵۰',tool:null},
  {id:'linear',cat:'معادله',title:'معادلهٔ درجهٔ اول',text:'برای حل ax + b = c، ابتدا b را از دو طرف کم کن، سپس دو طرف را بر a تقسیم کن (به شرط a ≠ ۰).',example:'۲x + ۳ = ۱۱ ⇒ ۲x = ۸ ⇒ x = ۴',tool:'linear'},
  {id:'quadratic',cat:'معادله',title:'معادلهٔ درجهٔ دوم',text:'برای ax² + bx + c = 0 ابتدا Δ = b² − 4ac را حساب کن. اگر Δ ≥ ۰ باشد، جواب‌ها x = (−b ± √Δ) ÷ (2a) هستند. اگر Δ < ۰ باشد، جواب حقیقی ندارد.',example:'x² − ۵x + ۶ = ۰ ⇒ Δ = ۱ ⇒ x = ۲ یا x = ۳',tool:'quad'},
  {id:'sequence',cat:'الگو',title:'دنبالهٔ حسابی',text:'در دنبالهٔ حسابی، اختلاف هر دو جملهٔ متوالی ثابت است. جملهٔ n ام: aₙ = a₁ + (n − ۱)d.',example:'۴، ۷، ۱۰، ۱۳ ... با اختلاف ۳؛ جملهٔ دهم = ۴ + ۹×۳ = ۳۱',tool:'seq'},
  {id:'percent',cat:'نسبت',title:'درصد',text:'برای پیدا کردن p درصدِ یک عدد، عدد را در p ضرب و بر ۱۰۰ تقسیم کن.',example:'۱۵٪ از ۲۴۰ = ۲۴۰ × ۰٫۱۵ = ۳۶',tool:'percent'},
  {id:'ratio',cat:'نسبت',title:'تناسب',text:'اگر a/b = c/x باشد، با ضرب طرفین در حاصل‌ضرب مخرج‌ها به x می‌رسی: a·x = b·c ⇒ x = b·c ÷ a.',example:'۲/۵ = ۸/x ⇒ x = ۲۰',tool:'ratio'},
  {id:'pythagoras',cat:'هندسه',title:'قضیهٔ فیثاغورس',text:'در مثلث قائم‌الزاویه، مربع وتر برابر مجموع مربع‌های دو ضلع قائم است: a² + b² = c².',example:'ضلع‌های ۳ و ۴ ⇒ وتر = √(۹ + ۱۶) = ۵',tool:null}
 ];
 const topicList=$('topicList'), topicSearch=$('topicSearch'), topicAnswer=$('tutorAnswer');
 let activeTopic=null;

 function renderTopics(){
   const q=(topicSearch.value||'').trim().toLowerCase();
   const shown=TOPICS.filter(t=>!q||(t.title+' '+t.cat+' '+t.text).toLowerCase().includes(q));
   topicList.replaceChildren(...shown.map(t=>{
     const b=document.createElement('button');
     b.type='button';b.className='topic-chip'+(activeTopic===t.id?' active':'');
     b.dataset.topic=t.id;
     b.innerHTML='';
     const s=document.createElement('small');s.textContent=t.cat;
     b.append(t.title,s);
     b.addEventListener('click',()=>showTopic(t.id));
     return b;
   }));
   if(!shown.length){const p=document.createElement('p');p.className='hint';p.textContent='موضوعی با این عبارت پیدا نشد.';topicList.append(p)}
 }

 function showTopic(id){
   const t=TOPICS.find(x=>x.id===id);
   if(!t)return;
   activeTopic=id;
   topicAnswer.replaceChildren();
   topicAnswer.classList.remove('error');
   const h=document.createElement('h3');h.textContent=t.title;
   const p=document.createElement('p');p.textContent=t.text;
   const ex=document.createElement('p');ex.className='tutor-example';ex.textContent='نمونه: '+t.example;
   topicAnswer.append(h,p,ex);
   if(t.tool){
     const btn=document.createElement('button');
     btn.type='button';btn.className='primary-btn tutor-try';btn.textContent='امتحان کن در ابزارها ↗';
     btn.addEventListener('click',()=>openTool(t.tool));
     topicAnswer.append(btn);
   }
   renderTopics();
 }

 // از دستیار به ابزار مربوط می‌رود، کارت را باز و مشخص می‌کند
 function openTool(key){
   showMode('tools');
   const btn=$(TOOL_BUTTON[key]);
   if(!btn)return;
   const card=btn.closest('.tool-card');
   const details=card&&card.querySelector('details');
   if(details)details.open=true;
   card&&card.scrollIntoView({behavior:'smooth',block:'center'});
   if(card){card.classList.add('flash');setTimeout(()=>card.classList.remove('flash'),1600)}
   const input=card&&card.querySelector('input');
   if(input)input.focus({preventScroll:true});
 }

 topicSearch.addEventListener('input',renderTopics);
 $('randomTopic').addEventListener('click',()=>showTopic(TOPICS[Math.floor(Math.random()*TOPICS.length)].id));
 /* ---------- حالت‌ها (تب‌ها) ---------- */
 const modeInfo={calculator:['ماشین‌حساب علمی','با دکمه‌ها حساب کن؛ نیازی به تایپ با کیبورد نیست.'],tools:['ابزارهای ریاضی','ابزارهای کاربردی از کسرها تا شمارنده‌ها و نسبت طلایی.'],assistant:['دستیار ریاضی SAM','توضیح‌های آموزشی کوتاه با نمونه؛ هر موضوع را در ابزار هم امتحان کن.'],exam:['ساخت آزمون','آزمون چهارگزینه‌ای برای هر پایه بساز و پاسخ‌نامه را ببین.'],history:['تاریخچهٔ ریاضیات ایران','از خوارزمی و خیام تا میرزاخانی؛ دانشمندانی که ریاضی را پیش بردند.']};
 function showMode(mode){
   if(!modeInfo[mode])return;
   document.querySelectorAll('.nav-item[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
   Object.keys(modeInfo).forEach(m=>{const panel=$(m+'Panel');if(panel)panel.hidden=m!==mode});
   $('pageTitle').textContent=modeInfo[mode][0];
   $('pageDescription').textContent=modeInfo[mode][1];
 }
 document.querySelectorAll('.nav-item[data-mode]').forEach(btn=>btn.addEventListener('click',()=>showMode(btn.dataset.mode)));
 // پشتیبانی از آدرس‌هایی مثل index.html?mode=tools (دستیار صوتی و لینک‌ها از این استفاده می‌کنند)
 try{const m=new URLSearchParams(location.search).get('mode');if(m&&modeInfo[m])showMode(m)}catch(_){}

 $('themeBtn').onclick=()=>{document.body.classList.toggle('light');localStorage.setItem('sam-math-light',document.body.classList.contains('light')?'1':'0')};if(localStorage.getItem('sam-math-light')==='1')document.body.classList.add('light');
 renderTopics();
 showTopic('fractions');
})();
