/* SAM MATH: ساخت آزمون با هوش مصنوعی (سؤال و پاسخ‌نامه از سرور SAM AI). */
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
  const MIN_Q = 3, MAX_Q = 8;
  let questions = [];
  let busy = false;

  const faNum = n => String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

  function setStatus(text, bad = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('error', bad);
  }

  function buildPrompt(grade, count, topic) {
    return [
      `تو یک معلم ریاضی باتجربه‌ی ایرانی هستی. ${count} سؤال چهارگزینه‌ای ریاضی برای دانش‌آموز ${grade} بساز.`,
      topic ? `موضوع سؤال‌ها: ${topic}.` : 'سؤال‌ها را از مباحث رایج ریاضی این پایه انتخاب کن و تنوع رعایت کن.',
      'سؤال‌ها باید از نظر علمی درست، متناسب با سطح این پایه و دارای فقط یک پاسخ صحیح باشند.',
      'فقط یک شیء JSON معتبر برگردان؛ بدون هیچ متن، توضیح یا علامت اضافه، با این ساختار دقیق:',
      '{"questions":[{"question":"متن سؤال","options":["گزینهٔ ۱","گزینهٔ ۲","گزینهٔ ۳","گزینهٔ ۴"],"answer":0,"explanation":"توضیح کوتاه حل"}]}',
      'مقدار answer یک عدد صحیح بین ۰ تا ۳ و اندیس گزینهٔ درست است. عبارت‌های ریاضی را خوانا بنویس.'
    ].join('\n');
  }

  async function askModel(prompt) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
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
      if (error.name === 'AbortError') throw new Error('زمان ساختن آزمون تمام شد؛ دوباره تلاش کن.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // Accepts only well-formed questions; anything else is dropped.
  function parseQuestions(text, count) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('پاسخ مدل به‌صورت آزمون قابل خواندن نبود؛ دوباره بساز.');
    let data;
    try { data = JSON.parse(text.slice(start, end + 1)); }
    catch { throw new Error('ساختار آزمون معتبر نبود؛ دوباره بساز.'); }
    const list = Array.isArray(data.questions) ? data.questions : [];
    const valid = list
      .filter(q => q && typeof q.question === 'string' && q.question.trim()
        && Array.isArray(q.options) && q.options.length === 4
        && q.options.every(o => typeof o === 'string' && o.trim())
        && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3)
      .slice(0, count)
      .map(q => ({
        question: q.question.trim(),
        options: q.options.map(o => o.trim()),
        answer: q.answer,
        explanation: typeof q.explanation === 'string' ? q.explanation.trim() : ''
      }));
    if (!valid.length) throw new Error('هیچ سؤال معتبری از مدل دریافت نشد؛ دوباره بساز.');
    return valid;
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
    setStatus('در حال ساختن آزمون با هوش مصنوعی… ممکن است چند ثانیه طول بکشد.');
    try {
      const text = await askModel(buildPrompt(grade, count, topic));
      questions = parseQuestions(text, count);
      renderQuiz();
      submitButton.hidden = false;
      setStatus(questions.length < count
        ? `${faNum(questions.length)} سؤال ساخته شد (کمتر از تعداد خواسته‌شده).`
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
