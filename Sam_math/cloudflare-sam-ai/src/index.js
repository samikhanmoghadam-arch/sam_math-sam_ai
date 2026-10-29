// SAM AI backend (Cloudflare Worker)
// - گفت‌وگو: Workers AI با مدل Gemma (از binding با نام AI؛ نیاز به کلید جداگانه ندارد)
// - جست‌وجوی وب: LangSearch؛ کلید در secret با نام LANGSEARCH_API_KEY
// - ساخت تصویر: Workers AI با مدل FLUX (همان binding؛ بدون کلید جداگانه)

const CHAT_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct"; // برای خواندن عکس (مثلاً دست‌نوشته)

const VISION_PROMPT = "تو تصویر را بررسی می‌کنی و فقط یک شیء JSON معتبر برمی‌گردانی؛ هیچ متن اضافه‌ای ننویس. اگر کاربر ساختار JSON خواست، همان کلیدها را پر کن.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

const SYSTEM_PROMPT = `تو «SAM AI» هستی؛ یک دستیار هوشمند، دوستانه و دقیق برای کمک عمومی.
نام تو دقیقاً «SAM AI» است. اگر کسی اسمت را پرسید همین را بگو. خودت را با نام کاربر (مثلاً سامی) یکی نکن.

کارهایی که انجام می‌دهی: پاسخ به پرسش‌های عمومی، برنامه‌نویسی، علوم، نوشتن و ویرایش متن، ترجمه، ایده‌پردازی و یادگیری.
اگر کاربر درباره ریاضی یا درسش پرسید، مثل یک معلم صبور رفتار کن: اول بفهم چه می‌خواهد، سپس مرحله‌به‌مرحله و با دلیل توضیح بده، محاسبه را دوباره بررسی کن و اگر کاربر خواست، پیش از جواب نهایی راهنمایی کن.

قواعد:
- زبان پیش‌فرض فارسی روان و طبیعی است. اگر کاربر به زبان دیگری نوشت، به همان زبان پاسخ بده.
- اگر مطمئن نیستی، صادقانه بگو. هرگز منبع، عدد یا واقعیت ساختگی نساز.
- از تاریخچهٔ گفت‌وگو برای فهمیدن سؤال‌های پیگیری استفاده کن.
- اگر در پیام‌ها «نتایج جست‌وجوی زندهٔ وب» آمده، از همان‌ها استفاده کن و به منبع‌ها با شمارهٔ [1] و [2] ارجاع بده. اگر نتایج برای جواب کافی نبود، همین را صریح بگو.
- اطلاعات خصوصی یا رمز عبور کاربر را تشویق به ارسال نکن.

قالب پاسخ:
- فرمول‌ها را ساده بنویس، مثل 2x + 5 = 17؛ از علامت دلار یا LaTeX استفاده نکن.
- JSON خام یا کد تزئینی نفرست، مگر کاربر کد بخواهد.
- پاسخ را خوانا و نسبتاً کوتاه نگه دار، مگر کاربر توضیح کامل بخواهد.`;

// مدل Llama Vision قبل از اولین استفاده نیاز دارد که کلمهٔ agree به آن داده شود (تأیید لایسنس).
// اگر این خطا آمد، یک‌بار همان را انجام می‌دهیم و دوباره تلاش می‌کنیم.
async function runVision(env, payload) {
  try {
    return await env.AI.run(VISION_MODEL, payload);
  } catch (error) {
    const msg = String(error?.message || error);
    if (!/agree/i.test(msg)) throw error;
    await env.AI.run(VISION_MODEL, { prompt: "agree" });
    return await env.AI.run(VISION_MODEL, payload);
  }
}

function extractText(result) {
  const text = result?.response || result?.choices?.[0]?.message?.content || result?.output_text;
  return typeof text === "string" ? text.trim() : "";
}

function normalizeMessages(body) {
  const list = Array.isArray(body.messages)
    ? body.messages
    : [{ role: "user", content: String(body.question || "") }];
  return list
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, 6000) }))
    .filter(m => m.content)
    .slice(-20);
}

// فقط نام دامنه معتبر را قبول می‌کند (مثلاً example.com)
function cleanSite(value) {
  const s = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : "";
}

async function webSearch(env, query, site) {
  if (!env.LANGSEARCH_API_KEY) {
    return {
      error: "کلید جست‌وجوی وب روی Worker تنظیم نشده است. در ترمینال پوشهٔ cloudflare-sam-ai دستور npx wrangler secret put LANGSEARCH_API_KEY را اجرا کن.",
      status: 503
    };
  }
  // LangSearch از پارامتر site: در خود متن جست‌وجو پشتیبانی می‌کند
  const q = (site ? `site:${site} ` : "") + query.slice(0, 380);
  const res = await fetch("https://api.langsearch.com/v1/web-search", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.LANGSEARCH_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: q, count: 5 }),
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) {
    return { error: `جست‌وجوی وب ناموفق بود (HTTP ${res.status}). کلید LangSearch و اعتبار حساب را در سایت LangSearch بررسی کن.`, status: 502 };
  }
  const data = await res.json();
  const pages = Array.isArray(data?.data?.webPages?.value) ? data.data.webPages.value : [];
  const results = pages
    .slice(0, 5)
    .map(r => ({
      title: String(r.name || r.url || "منبع").slice(0, 200),
      url: String(r.url || ""),
      content: String(r.snippet || r.summary || r.text || "").slice(0, 700)
    }))
    .filter(r => /^https?:\/\//.test(r.url));
  return { results };
}

function searchContext(results) {
  if (!results.length) {
    return "\n\nجست‌وجوی وب برای این پرسش نتیجه‌ای نداشت. اگر به اطلاعات روز نیاز است، صادقانه بگو که نتوانستی تأیید کنی.";
  }
  const lines = results.map((r, i) => `[${i + 1}] ${r.title}\nآدرس: ${r.url}\nخلاصه: ${r.content}`);
  return "\n\nنتایج جست‌وجوی زندهٔ وب (برای پاسخ از این‌ها استفاده کن و منبع‌ها را با شمارهٔ [1] و [2] ارجاع بده):\n\n" + lines.join("\n\n");
}

async function makeImage(env, request) {
  // پرامپت کاربر (فارسی) را به یک پرامپت انگلیسی کوتاه تبدیل می‌کنیم؛ مدل‌های تصویر با انگلیسی بهترند
  let prompt = request;
  try {
    const translated = await env.AI.run(CHAT_MODEL, {
      messages: [
        { role: "system", content: "The user wants an image. Turn their request into one concise, vivid English prompt for an image generator. Reply with the prompt only, without quotes or explanation." },
        { role: "user", content: request }
      ],
      max_tokens: 150,
      temperature: 0.5,
      chat_template_kwargs: { enable_thinking: false }
    });
    const text = extractText(translated);
    if (text) prompt = text;
  } catch (error) {
    console.warn("Image prompt translation failed; using the original text.", String(error?.message || error).slice(0, 200));
  }

  const out = await env.AI.run(IMAGE_MODEL, { prompt: prompt.slice(0, 2000), steps: 4 });
  if (!out || typeof out.image !== "string" || !out.image) {
    return reply({ error: "ساخت تصویر ناموفق بود. دوباره تلاش کن یا توضیح را کوتاه‌تر بنویس." }, 502);
  }
  return reply({
    answer: `تصویر ساخته شد. پرامپت استفاده‌شده: ${prompt}`,
    image: `data:image/jpeg;base64,${out.image}`
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return reply({ error: "برای پرسش از SAM AI باید درخواست POST ارسال شود." }, 405);
    if (!env || !env.AI || typeof env.AI.run !== "function") {
      return reply({ error: "اتصال Workers AI روی این Worker تنظیم نشده است. در wrangler.jsonc بخش ai با binding به نام AI را بررسی کن." }, 503);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return reply({ error: "درخواست JSON معتبر نیست." }, 400);
    }

    try {
      const messages = normalizeMessages(body);
      if (!messages.length || messages[messages.length - 1].role !== "user") {
        return reply({ error: "پیام کاربر دریافت نشد؛ دوباره تلاش کن." }, 400);
      }
      const question = messages[messages.length - 1].content;

      if (body.image === true) return await makeImage(env, question);

      // اگر عکسی پیوست شده، با مدل بینایی بررسی می‌شود (گفت‌وگوی متنی عادی فقط متن می‌بیند)
      const att = body.attachment;
      if (att && typeof att.data === "string" && att.data.startsWith("data:image/") && att.data.length < 7_000_000) {
        const vision = await runVision(env, {
          messages: [{ role: "system", content: VISION_PROMPT }, ...messages],
          image: att.data,
          max_tokens: 900,
          temperature: 0.2
        });
        // مدل بینایی گاهی JSON را از پیش‌پارس‌شده در response برمی‌گرداند؛ آن را به متن تبدیل می‌کنیم
        const visionAnswer = (vision && typeof vision.response === "object" && vision.response !== null)
          ? JSON.stringify(vision.response)
          : extractText(vision);
        if (!visionAnswer) {
          // برای عیب‌یابی: شکل خام پاسخ مدل (بدون محتوای عکس)
          const shape = JSON.stringify(vision ?? null).slice(0, 300);
          console.error("Vision model returned empty text:", shape);
          return reply({ error: "مدل بینایی پاسخی برنگرداند. دوباره تلاش کن. (جزئیات: " + shape + ")" }, 502);
        }
        return reply({ answer: visionAnswer, sources: [] });
      }

      let extra = "";
      let sources = [];
      if (body.web === true) {
        const found = await webSearch(env, question, cleanSite(body.site));
        if (found.error) return reply({ error: found.error }, found.status);
        extra = searchContext(found.results);
        sources = found.results.map(({ title, url }) => ({ title, url }));
      }

      const result = await env.AI.run(CHAT_MODEL, {
        messages: [{ role: "system", content: SYSTEM_PROMPT + extra }, ...messages],
        max_tokens: 1200,
        temperature: 0.4,
        chat_template_kwargs: { enable_thinking: false }
      });

      const answer = extractText(result);
      if (!answer) {
        console.error("SAM AI returned an empty or unrecognized response shape");
        return reply({ error: "مدل پاسخ متنی برنگرداند. گزارش Worker و سهمیهٔ Workers AI را در داشبورد Cloudflare بررسی کن." }, 502);
      }
      return reply({ answer, sources });
    } catch (error) {
      const detail = String(error?.message || error || "Unknown error").slice(0, 300);
      console.error("SAM AI request failed:", detail);
      return reply({ error: `درخواست مدل ناموفق بود: ${detail}` }, 500);
    }
  }
};
