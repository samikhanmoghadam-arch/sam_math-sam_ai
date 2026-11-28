(() => {
'use strict';
const $=id=>document.getElementById(id), API='https://sam-ai-backend.sami-math-lab.workers.dev';
let ggb=null;
function say(t){$('ggbAnswer').textContent=t;}
function initApplet(){
 if(!window.GGBApplet){$('ggb-element').innerHTML='<p class="ggb-loading">کتابخانهٔ GeoGebra بارگذاری نشد. اتصال اینترنت را بررسی کن.</p>';return;}
 const applet=new GGBApplet({appName:'classic',width:1200,height:760,scaleContainerClass:'ggb-classic-view',showToolBar:true,showAlgebraInput:true,showMenuBar:true,showResetIcon:true,enableRightClick:true,enableLabelDrags:true,enableShiftDragZoom:true,showZoomButtons:true,language:'fa',appletOnLoad:api=>{ggb=api;say('GeoGebra آماده است. دستور هندسی‌ات را بنویس تا اجرا کنم.');}},true);
 applet.inject('ggb-element');
}
function parseJson(s){const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<a)throw Error('پاسخ ساختاریافته دریافت نشد.');return JSON.parse(s.slice(a,b+1));}
async function ask(){
 const prompt=$('ggbPrompt').value.trim();if(!prompt)return;
 $('ggbAsk').disabled=true;say('SAM AI در حال بررسی درخواست و آماده‌سازی دستورهای هندسی است…');
 try{
  const system=`تو دستیار هندسه در GeoGebra Classic هستی. درخواست فارسی کاربر را بفهم. اگر درخواست ساخت/تغییر شکل است، دستورهای معتبر GeoGebra Classic را در آرایه commands بده؛ وگرنه commands خالی باشد و به فارسی پاسخ آموزشی بده. فقط JSON معتبر با ساختار {"reply":"پاسخ فارسی کوتاه","commands":["Circle((0,0),3)"]} برگردان. از دستورهای شناخته‌شده مانند Point, Segment, Line, Ray, Circle, Polygon, Midpoint, Intersect, PerpendicularLine, ParallelLine, Reflect, Rotate, Translate, Dilate, Angle, Distance و معادلات f(x)=... استفاده کن. نام اشیا را لاتین و یکتا بگذار. دستور غیرمرتبط نده.`;
  const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:system+'\n\nدرخواست کاربر: '+prompt}],web:false,site:''})});
  const data=await res.json();if(!res.ok)throw Error(data.error||'ارتباط با SAM AI برقرار نشد.');
  const obj=parseJson(data.answer||'');say(obj.reply||'انجام شد.');
  const allowed=/^(Point|Segment|Line|Ray|Circle|Polygon|Midpoint|Intersect|PerpendicularLine|ParallelLine|Reflect|Rotate|Translate|Dilate|Angle|Distance|Vector|Tangent|PerpendicularBisector|AngleBisector|Ellipse|Parabola)\s*\(/i;
  if(Array.isArray(obj.commands)&&obj.commands.length){
   if(!ggb)throw Error('محیط GeoGebra هنوز آماده نشده است.');
   let done=0;for(const command of obj.commands.slice(0,12)){if(typeof command!=='string'||command.length>220)continue;if(!allowed.test(command)&&! /^[A-Za-z][A-Za-z0-9_]*\s*\([^;]*\)\s*=\s*.+$/.test(command))continue;try{const ok=ggb.evalCommand(command);if(ok!==false)done++;}catch(_){}}
   say((obj.reply||'دستورها اجرا شدند.')+`\n\n${done} دستور هندسی به محیط ارسال شد.`);
  }
 }catch(e){say('مشکلی پیش آمد: '+e.message);}
 finally{$('ggbAsk').disabled=false;}
}
document.addEventListener('DOMContentLoaded',()=>{
 initApplet();
 document.querySelectorAll('.ggb-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.ggb-tab').forEach(x=>x.classList.toggle('active',x===b));const classic=b.dataset.view==='classic';$('ggbClassicView').hidden=!classic;$('ggbNativeView').hidden=classic;document.querySelector('main.workspace').hidden=classic;});
 $('ggbAsk').onclick=ask;$('ggbPrompt').addEventListener('keydown',e=>{if(e.key==='Enter')ask();});
 document.querySelectorAll('[data-ggb]').forEach(b=>b.onclick=()=>{if(!ggb){say('GeoGebra هنوز بارگذاری نشده است.');return;}ggb.evalCommand(b.dataset.ggb);say('دستور نمونه اجرا شد: '+b.textContent);});
});
})();