/* SAM MATH: Persian/Arabic digit input support */
(() => {
  'use strict';
  const map = {'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
               '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
               '٫':'.','٬':'','،':'.','−':'-'};
  const normalize = value => String(value ?? '').replace(/[۰-۹٠-٩٫٬،−]/g, ch => map[ch] ?? ch);
  document.addEventListener('input', event => {
    const el = event.target;
    if (!el || !('value' in el) || !/^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
    if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file' || el.type === 'password') return;
    const old = el.value, next = normalize(old);
    if (old !== next) {
      const start = el.selectionStart, end = el.selectionEnd;
      el.value = next;
      try { if (start !== null && end !== null) el.setSelectionRange(start, end); } catch (_) {}
    }
  }, true);
  window.SAMNormalizeDigits = normalize;
})();
