/* SAM MATH: ساخت آزمون با هوش مصنوعی (سؤال و پاسخ‌نامه از سرور SAM AI).
   برای سرعت و کامل بودن، سؤال‌ها در بخش‌های کوچک و هم‌زمان ساخته می‌شوند؛
   اگر بخشی کم یا خراب باشد، فقط همان تعداد دوباره ساخته می‌شود تا آزمون کامل شود. */
'use strict';
(() => {
  const SAM_AI_URL = "https://sam-ai-backend.sami-math-lab.workers.dev";
  const $ = id => document.getElementById(id);
  const gradeSelect = $('examGrade');
  const countInput = $('examCount');
  const topicInput = $('examTopic');
  const createButton = $('examCreate');
  const statusEl = $('examStatus');
  const quizEl = $('examQuiz');
  const submitButton = $('examSubmit');
  const scoreEl = $('examScore');
  const resetButton = $('examReset');
  const LETTERS = ['الف', 'ب', 'ج', 'د'];
  const LETTER_INDEX = { 'الف': 0, 'ب': 1, 'ج': 2, 'د': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
  const MIN_Q = 3, MAX_Q = 8;
  const PER_REQUEST = 2;      // سؤال در هر درخواست: کوتاه‌تر، سریع‌تر و کم‌خطاتر
  const MAX_ROUNDS = 3;       // دور تکمیل برای جبران سؤال‌های نامعتبر
  const REQUEST_TIMEOUT = 60000;
  // هر بخش یک زاویهٔ متفاوت می‌گیرد تا سؤال‌های هم‌زمان تکراری نشوند
  const HINTS = [
    'محاسبهٔ عددی ساده', 'مسئلهٔ کلامی و کاربردی', 'عبارت یا معادلهٔ جبری',
    'هندسه و اندازه‌گیری', 'کسر، نسبت یا درصد', 'الگو و استدلال',
    'توان، جذر و عددهای بزرگ', 'مفهوم و تعریف'
  ];
  let questions = [];
  let busy = false;

  const toLatin = s => String(s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const faNum = n => String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

  function setStatus(text, bad = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('error', bad);
  }

  function buildPrompt(grade, count, size, topic, hint, avoid) {
    return [
      `تو یک معلم ریاضی باتجربه‌ی ایرانی هستی. ${size} سؤال چهارگزینه‌ای ریاضی برای دانش‌آموز پایهٔ ${grade} بساز.`,
      topic ? `موضوع سؤال‌ها: ${topic}. هر سؤال زاویه یا نوع متفاوتی از این موضوع داشته باشد.` : `نوع سؤال‌ها: ${hint}.`,
      `این ${size} سؤال بخشی از یک آزمون ${count} سؤالی‌اند؛ پس با بقیهٔ آزمون تکراری نباشند.`,
      avoid.length ? `این سؤال‌ها قبلاً ساخته شده‌اند و نباید تکرار شوند: ${avoid.map(q => '«' + q.slice(0, 90) + '»').join('، ')}.` : '',
      'سؤال‌ها باید از نظر علمی درست، متناسب با سطح این پایه و دارای فقط یک پاسخ صحیح باشند.',
      `فقط یک شیء JSON معتبر برگردان؛ بدون هیچ متن، توضیح یا علامت اضافه، با دقیقاً ${size} سؤال و این ساختار:`,
      '{"questions":[{"question":"متن سؤال","options":["گزینهٔ ۱","گزینهٔ ۲","گزینهٔ ۳","گزینهٔ ۴"],"answer":0,"explanation":"توضیح کوتاه حل"}]}',
      'مقدار answer یک عدد صحیح بین ۰ تا ۳ و اندیس گزینهٔ درست است. عبارت‌های ریاضی را خوانا بنویس.'
    ].filter(Boolean).join('\n');
  }

  async function askModel(prompt) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(SAM_AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], attachment: null, web: false, site: '' }),
        signal: controller.signal
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error(`پاسخ سرور قابل خواندن نیست (HTTP ${response.status}).`); }
      if (!response.ok) throw new Error(data.error || `خطای سرور (HTTP ${response.status})`);
      if (typeof data.answer !== 'string' || !data.answer.trim()) {
        throw new Error(data.error || 'پاسخ خالی از مدل دریافت شد.');
      }
      return data.answer;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('زمان ساختن این بخش از آزمون تمام شد.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function normAnswer(value) {
    if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 3 ? value : -1;
    if (typeof value === 'string') {
      const s = toLatin(value).trim().toLowerCase();
      if (/^[0-3]$/.test(s)) return Number(s);
      if (s in LETTER_INDEX) return LETTER_INDEX[s];
    }
    return -1;
  }

  // فقط سؤال‌های کامل و درست نگه داشته می‌شوند؛ بقیه کنار گذاشته می‌شود.
  function parseQuestions(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return [];
    let data;
    try { data = JSON.parse(text.slice(start, end + 1)); }
    catch { return []; }
    const list = Array.isArray(data.questions) ? data.questions : [];
    return list.map(q => {
      if (!q || typeof q.question !== 'string' || !q.question.trim()) return null;
      if (!Array.isArray(q.options) || q.options.length !== 4) return null;
      const options = q.options.map(o => (typeof o === 'string' || typeof o === 'number') ? String(o).trim() : '');
      if (options.some(o => !o)) return null;
      const answer = normAnswer(q.answer);
      if (answer < 0) return null;
      return {
        question: q.question.trim(),
        options,
        answer,
        explanation: typeof q.explanation === 'string' ? q.explanation.trim() : ''
      };
    }).filter(Boolean);
  }

  // یک بخش کوچک می‌سازد؛ اگر خراب باشد یک‌بار دیگر امتحان می‌کند.
  async function fetchBatch(grade, count, size, topic, hint, avoid) {
    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await askModel(buildPrompt(grade, count, size, topic, hint, avoid));
        const items = parseQuestions(text);
        if (items.length) return { items: items.slice(0, size), error: '' };
        lastError = 'پاسخ مدل به‌صورت آزمون قابل خواندن نبود.';
      } catch (error) {
        lastError = error.message;
      }
    }
    return { items: [], error: lastError };
  }

  async function buildExam(grade, count, topic) {
    let pool = [];
    let lastError = '';
    for (let round = 0; round < MAX_ROUNDS && pool.length < count; round++) {
      const missing = count - pool.length;
      const sizes = [];
      for (let left = missing; left > 0; left -= PER_REQUEST) sizes.push(Math.min(PER_REQUEST, left));
      setStatus(round === 0
        ? `در حال ساختن ${faNum(count)} سؤال در ${faNum(sizes.length)} بخش همزمان با هوش مصنوعی… چند ثانیه صبر کن.`
        : `${faNum(pool.length)} سؤال آماده شد؛ ${faNum(missing)} سؤال دیگر در حال ساخته شدن است…`);
      const avoid = pool.map(q => q.question);
      const results = await Promise.all(sizes.map((size, i) =>
        fetchBatch(grade, count, size, topic, HINTS[(pool.length + i) % HINTS.length], avoid)));
      results.forEach(r => {
        if (r.items.length) pool.push(...r.items);
        else if (r.error) lastError = r.error;
      });
    }
    pool = pool.slice(0, count);
    if (!pool.length) throw new Error(lastError || 'هیچ سؤال معتبری از مدل دریافت نشد؛ دوباره بساز.');
    return pool;
  }

  function renderQuiz() {
    quizEl.replaceChildren();
    questions.forEach((q, i) => {
      const card = document.createElement('article');
      card.className = 'tool-card exam-q';
      const title = document.createElement('h3');
      title.textContent = `سؤال ${faNum(i + 1)}`;
      const text = document.createElement('p');
      text.className = 'exam-text';
      text.textContent = q.question;
      const list = document.createElement('div');
      list.className = 'exam-options';
      q.options.forEach((option, j) => {
        const label = document.createElement('label');
        label.className = 'exam-option';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `examQ${i}`;
        radio.value = String(j);
        const span = document.createElement('span');
        span.textContent = `${LETTERS[j]}) ${option}`;
        label.append(radio, span);
        list.appendChild(label);
      });
      const feedback = document.createElement('p');
      feedback.className = 'exam-feedback';
      feedback.hidden = true;
      card.append(title, text, list, feedback);
      quizEl.appendChild(card);
    });
  }

  function submitQuiz() {
    let score = 0;
    questions.forEach((q, i) => {
      const card = quizEl.children[i];
      const chosen = card.querySelector(`input[name="examQ${i}"]:checked`);
      const picked = chosen ? Number(chosen.value) : -1;
      const correct = picked === q.answer;
      if (correct) score++;
      const options = card.querySelectorAll('.exam-option');
      options[q.answer].classList.add('correct-opt');
      if (picked >= 0 && !correct) options[picked].classList.add('wrong-opt');
      card.querySelectorAll('input').forEach(input => { input.disabled = true; });
      const feedback = card.querySelector('.exam-feedback');
      const verdict = picked < 0 ? 'بی‌پاسخ ماند.' : correct ? 'درست ✔' : 'نادرست ✘';
      let text = `${verdict} پاسخ درست: ${LETTERS[q.answer]}) ${q.options[q.answer]}`;
      if (q.explanation) text += `\nتوضیح: ${q.explanation}`;
      feedback.textContent = text;
      feedback.className = `exam-feedback ${picked < 0 ? 'skip' : correct ? 'good' : 'bad'}`;
      feedback.hidden = false;
    });
    scoreEl.textContent = `نمرهٔ تو: ${faNum(score)} از ${faNum(questions.length)}`;
    scoreEl.hidden = false;
    submitButton.hidden = true;
    setStatus('آزمون تمام شد؛ پاسخ‌نامه و توضیح هر سؤال زیر هر سؤال آمده است.');
  }

  function resetExam() {
    questions = [];
    quizEl.replaceChildren();
    scoreEl.hidden = true;
    submitButton.hidden = true;
    setStatus('یک پایه و تعداد سؤال انتخاب کن و آزمون بساز.');
  }

  createButton.addEventListener('click', async () => {
    if (busy) return;
    const count = Math.min(MAX_Q, Math.max(MIN_Q, Math.trunc(Number(countInput.value)) || 8));
    countInput.value = count;
    const grade = gradeSelect.value;
    const topic = topicInput.value.trim().slice(0, 80);
    busy = true;
    createButton.disabled = true;
    submitButton.hidden = true;
    scoreEl.hidden = true;
    quizEl.replaceChildren();
    questions = [];
    try {
      questions = await buildExam(grade, count, topic);
      renderQuiz();
      submitButton.hidden = false;
      setStatus(questions.length < count
        ? `${faNum(questions.length)} سؤال ساخته شد (کمتر از تعداد خواسته‌شده). دوباره بساز تا کامل شود.`
        : `آزمون ${faNum(questions.length)} سؤالی برای پایهٔ ${grade} آماده است.`);
    } catch (error) {
      setStatus(error.message || 'ساخت آزمون ناموفق بود.', true);
    } finally {
      busy = false;
      createButton.disabled = false;
    }
  });

  submitButton.addEventListener('click', () => { if (questions.length) submitQuiz(); });
  resetButton.addEventListener('click', () => { if (!busy) resetExam(); });
  resetExam();
})();
