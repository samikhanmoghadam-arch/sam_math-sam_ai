/* SAM MATH · تبدیل خروجی مدل به متن ساده: حذف $ و LaTeX و تبدیل نمادهای رایج به کاراکتر فارسی/ریاضی */
'use strict';
(() => {
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺', 'n': 'ⁿ' };
  const SYM = [
    [/\\times/g, '×'], [/\\cdot/g, '·'], [/\\div/g, '÷'], [/\\pm/g, '±'], [/\\mp/g, '∓'],
    [/\\le(q)?/g, '≤'], [/\\ge(q)?/g, '≥'], [/\\neq?/g, '≠'], [/\\approx/g, '≈'],
    [/\\pi/g, 'π'], [/\\infty/g, '∞'], [/\\theta/g, 'θ'], [/\\alpha/g, 'α'], [/\\beta/g, 'β'], [/\\Delta/g, 'Δ'],
    [/\\left|\\right/g, ''], [/\\left|\\right/g, ''], [/\\,|\;|\\!/g, ' '], [/\\text\{([^}]*)\}/g, '$1'], [/\\mathrm\{([^}]*)\}/g, '$1']
  ];
  function samPlain(input) {
    if (input === null || input === undefined) return '';
    let s = String(input);
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, '$1').replace(/\\\[([\s\S]+?)\\\]/g, '$1').replace(/\\\(([\s\S]+?)\\\)/g, '$1');
    s = s.replace(/\$([^$\n]+?)\$/g, '$1');
    for (let i = 0; i < 3; i++) s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
    for (let i = 0; i < 3; i++) s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
    s = s.replace(/\\sqrt/g, '√');
    s = s.replace(/\^\{([^{}]*)\}/g, (_, p) => p.split('').map(c => SUP[c] || c).join(''));
    s = s.replace(/\^(-?\d)/g, (_, p) => p.split('').map(c => SUP[c] || c).join(''));
    s = s.replace(/_\{([^{}]*)\}/g, '$1').replace(/_(\d)/g, '$1');
    for (const [re, rep] of SYM) s = s.replace(re, rep);
    s = s.replace(/[{}]/g, '').replace(/\\/g, '');
    return s;
  }
  window.samPlain = samPlain;
})();
