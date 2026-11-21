// SAM AI backend (Cloudflare Worker)
// - Ú¯ÙØªâ€ŒÙˆÚ¯Ùˆ: Workers AI Ø¨Ø§ Ù…Ø¯Ù„ Gemma (Ø§Ø² binding Ø¨Ø§ Ù†Ø§Ù… AIØ› Ù†ÛŒØ§Ø² Ø¨Ù‡ Ú©Ù„ÛŒØ¯ Ø¬Ø¯Ø§Ú¯Ø§Ù†Ù‡ Ù†Ø¯Ø§Ø±Ø¯)
// - Ø¬Ø³Øªâ€ŒÙˆØ¬ÙˆÛŒ ÙˆØ¨: LangSearchØ› Ú©Ù„ÛŒØ¯ Ø¯Ø± secret Ø¨Ø§ Ù†Ø§Ù… LANGSEARCH_API_KEY
// - Ø³Ø§Ø®Øª ØªØµÙˆÛŒØ±: Workers AI Ø¨Ø§ Ù…Ø¯Ù„ FLUX (Ù‡Ù…Ø§Ù† bindingØ› Ø¨Ø¯ÙˆÙ† Ú©Ù„ÛŒØ¯ Ø¬Ø¯Ø§Ú¯Ø§Ù†Ù‡)

const CHAT_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const IMAGE_EDIT_MODEL = "@cf/black-forest-labs/flux-1-kontext-dev";
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct"; // Ø¨Ø±Ø§ÛŒ Ø®ÙˆØ§Ù†Ø¯Ù† Ø¹Ú©Ø³ (Ù…Ø«Ù„Ø§Ù‹ Ø¯Ø³Øªâ€ŒÙ†ÙˆØ´ØªÙ‡)


// ===== Ø³Ù‡Ù…ÛŒÙ‡Ù” Ø³Ø§Ø®Øª ØªØµÙˆÛŒØ± =====
// Ø¨Ø¯ÙˆÙ† Ø§ÛŒÙ…ÛŒÙ„: Û± ØªØµÙˆÛŒØ± Ø¯Ø± Ø±ÙˆØ² Ø¨Ø±Ø§ÛŒ Ù‡Ø± Ø¯Ø³ØªÚ¯Ø§Ù‡ (ÛŒØ§ IP Ø§Ú¯Ø± Ø´Ù†Ø§Ø³Ù‡ Ø¯Ø³ØªÚ¯Ø§Ù‡ Ù†Ø¨ÙˆØ¯)
// Ø¨Ø§ Ø§ÛŒÙ…ÛŒÙ„: Û±Û° ØªØµÙˆÛŒØ± Ø¯Ø± Ø±ÙˆØ² Ø¨Ø±Ø§ÛŒ Ù‡Ù…Ø§Ù† Ø§ÛŒÙ…ÛŒÙ„
// Ø´Ù…Ø§Ø±Ø´ ÙÙ‚Ø· ÙˆÙ‚ØªÛŒ ÙØ¹Ø§Ù„ Ø§Ø³Øª Ú©Ù‡ KV Ø¨Ø§ Ù†Ø§Ù… SAM_LIMITS Ø¨Ù‡ Worker ÙˆØµÙ„ Ø´Ø¯Ù‡ Ø¨Ø§Ø´Ø¯ (Ø±Ø§Ù‡Ù†Ù…Ø§: README-V2-FA.txt)
const IMAGE_LIMIT_DEVICE = 100000;
const IMAGE_LIMIT_EMAIL = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tehranDay() {
  return new Date(Date.now() + 3.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function hashText(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function quotaFor(env, request, body) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 80) : "";
  const device = typeof body.deviceId === "string" ? body.deviceId.trim().slice(0, 100) : "";
  const useEmail = EMAIL_PATTERN.test(email);
  const scope = useEmail ? "email" : "device";
  const limit = useEmail ? IMAGE_LIMIT_EMAIL : IMAGE_LIMIT_DEVICE;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const identity = useEmail ? email : (device.length >= 8 ? device : "ip:" + ip);
  if (!env.SAM_LIMITS) {
    return { scope, limit, used: 0, remaining: limit, enforced: false, key: null };
  }
  const key = `img:${tehranDay()}:${scope}:${await hashText(identity)}`;
  const used = Number(await env.SAM_LIMITS.get(key)) || 0;
  return { scope, limit, used, remaining: Math.max(0, limit - used), enforced: true, key };
}

function publicQuota(q) {
  return { scope: q.scope, limit: q.limit, used: q.used, remaining: q.remaining, enforced: q.enforced };
}

function quotaMessage(q) {
  const tail = q.scope === "device"
    ? "Ø¨Ø§ ÙˆØ±ÙˆØ¯ Ø¨Ø§ Ø§ÛŒÙ…ÛŒÙ„ Ù…ÛŒâ€ŒØªÙˆØ§Ù†ÛŒ Ø±ÙˆØ²ÛŒ Û±Û° ØªØµÙˆÛŒØ± Ø¨Ø³Ø§Ø²ÛŒ."
    : "ÙØ±Ø¯Ø§ Ø¯ÙˆØ¨Ø§Ø±Ù‡ Ø§Ù…ØªØ­Ø§Ù† Ú©Ù†.";
  return `Ø§Ù…Ø±ÙˆØ² Ø¨Ù‡ Ø³Ù‚Ù Ø³Ø§Ø®Øª ØªØµÙˆÛŒØ± Ø±Ø³ÛŒØ¯ÛŒ (${q.limit} ØªØµÙˆÛŒØ±). ${tail}`;
}

// Ù†Ø§Ù… Ú©Ø§Ø±Ø¨Ø± Ø§Ø² ØµÙØ­Ù‡Ù” ÙˆØ±ÙˆØ¯ Ù…ÛŒâ€ŒØ¢ÛŒØ¯Ø› Ú©ÙˆØªØ§Ù‡ Ùˆ Ø¨Ø¯ÙˆÙ† Ø®Ø· Ø¬Ø¯ÛŒØ¯ ØªØ§ Ø¯Ø± Ù¾Ø±Ø§Ù…Ù¾Øª Ø¯Ø³ØªÚ©Ø§Ø±ÛŒ Ù†Ø´ÙˆØ¯
function userLine(body) {
  const name = typeof body.user === "string" ? body.user.replace(/[\r\n]+/g, " ").trim().slice(0, 30) : "";
  return name ? `\n\nÙ†Ø§Ù… Ú©Ø§Ø±Ø¨Ø±: ${name}. Ú¯Ø§Ù‡ÛŒ Ø¨Ø§ Ù‡Ù…ÛŒÙ† Ù†Ø§Ù… ØµØ¯Ø§ÛŒØ´ Ú©Ù†ØŒ Ø§Ù…Ø§ Ø¯Ø± Ù‡Ø± Ù¾Ø§Ø³Ø® ØªÚ©Ø±Ø§Ø±Ø´ Ù†Ú©Ù†.` : "";
}

const VISION_PROMPT = "ØªÙˆ ØªØµÙˆÛŒØ± Ø±Ø§ Ø¨Ø±Ø±Ø³ÛŒ Ù…ÛŒâ€ŒÚ©Ù†ÛŒ Ùˆ ÙÙ‚Ø· ÛŒÚ© Ø´ÛŒØ¡ JSON Ù…Ø¹ØªØ¨Ø± Ø¨Ø±Ù…ÛŒâ€ŒÚ¯Ø±Ø¯Ø§Ù†ÛŒØ› Ù‡ÛŒÚ† Ù…ØªÙ† Ø§Ø¶Ø§ÙÙ‡â€ŒØ§ÛŒ Ù†Ù†ÙˆÛŒØ³. Ø§Ú¯Ø± Ú©Ø§Ø±Ø¨Ø± Ø³Ø§Ø®ØªØ§Ø± JSON Ø®ÙˆØ§Ø³ØªØŒ Ù‡Ù…Ø§Ù† Ú©Ù„ÛŒØ¯Ù‡Ø§ Ø±Ø§ Ù¾Ø± Ú©Ù†.";

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

const SYSTEM_PROMPT = `قانون هویت قطعی:
نام تو فقط SAM AI است.
تو دستیار هوشمند رسمی پروژه SAM MATH هستی.
اگر کاربر پرسید «تو کی هستی؟»، «اسمت چیه؟»، «چه هوش مصنوعی‌ای هستی؟» یا هر سؤال مشابهی پرسید، پاسخ بده:
«من SAM AI هستم؛ دستیار هوشمند پروژه SAM MATH.»

هرگز خودت را با نام ChatGPT، Gemini، Claude یا نام هوش مصنوعی دیگری معرفی نکن.
این قانون در تمام زبان‌ها، از جمله فارسی، انگلیسی و عربی، برقرار است.ØªÙˆ Â«SAM AIÂ» Ù‡Ø³ØªÛŒØ› ÛŒÚ© Ø¯Ø³ØªÛŒØ§Ø± Ù‡ÙˆØ´Ù…Ù†Ø¯ØŒ Ø¯ÙˆØ³ØªØ§Ù†Ù‡ Ùˆ Ø¯Ù‚ÛŒÙ‚ Ø¨Ø±Ø§ÛŒ Ú©Ù…Ú© Ø¹Ù…ÙˆÙ…ÛŒ.
Ù†Ø§Ù… ØªÙˆ Ø¯Ù‚ÛŒÙ‚Ø§Ù‹ Â«SAM AIÂ» Ø§Ø³Øª. Ø§Ú¯Ø± Ú©Ø³ÛŒ Ø§Ø³Ù…Øª Ø±Ø§ Ù¾Ø±Ø³ÛŒØ¯ Ù‡Ù…ÛŒÙ† Ø±Ø§ Ø¨Ú¯Ùˆ. Ø®ÙˆØ¯Øª Ø±Ø§ Ø¨Ø§ Ù†Ø§Ù… Ú©Ø§Ø±Ø¨Ø± (Ù…Ø«Ù„Ø§Ù‹ Ø³Ø§Ù…ÛŒ) ÛŒÚ©ÛŒ Ù†Ú©Ù†.

Ú©Ø§Ø±Ù‡Ø§ÛŒÛŒ Ú©Ù‡ Ø§Ù†Ø¬Ø§Ù… Ù…ÛŒâ€ŒØ¯Ù‡ÛŒ: Ù¾Ø§Ø³Ø® Ø¨Ù‡ Ù¾Ø±Ø³Ø´â€ŒÙ‡Ø§ÛŒ Ø¹Ù…ÙˆÙ…ÛŒØŒ Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ†ÙˆÛŒØ³ÛŒØŒ Ø¹Ù„ÙˆÙ…ØŒ Ù†ÙˆØ´ØªÙ† Ùˆ ÙˆÛŒØ±Ø§ÛŒØ´ Ù…ØªÙ†ØŒ ØªØ±Ø¬Ù…Ù‡ØŒ Ø§ÛŒØ¯Ù‡â€ŒÙ¾Ø±Ø¯Ø§Ø²ÛŒ Ùˆ ÛŒØ§Ø¯Ú¯ÛŒØ±ÛŒ.
Ø§Ú¯Ø± Ú©Ø§Ø±Ø¨Ø± Ø¯Ø±Ø¨Ø§Ø±Ù‡ Ø±ÛŒØ§Ø¶ÛŒ ÛŒØ§ Ø¯Ø±Ø³Ø´ Ù¾Ø±Ø³ÛŒØ¯ØŒ Ù…Ø«Ù„ ÛŒÚ© Ù…Ø¹Ù„Ù… ØµØ¨ÙˆØ± Ø±ÙØªØ§Ø± Ú©Ù†: Ø§ÙˆÙ„ Ø¨ÙÙ‡Ù… Ú†Ù‡ Ù…ÛŒâ€ŒØ®ÙˆØ§Ù‡Ø¯ØŒ Ø³Ù¾Ø³ Ù…Ø±Ø­Ù„Ù‡â€ŒØ¨Ù‡â€ŒÙ…Ø±Ø­Ù„Ù‡ Ùˆ Ø¨Ø§ Ø¯Ù„ÛŒÙ„ ØªÙˆØ¶ÛŒØ­ Ø¨Ø¯Ù‡ØŒ Ù…Ø­Ø§Ø³Ø¨Ù‡ Ø±Ø§ Ø¯ÙˆØ¨Ø§Ø±Ù‡ Ø¨Ø±Ø±Ø³ÛŒ Ú©Ù† Ùˆ Ø§Ú¯Ø± Ú©Ø§Ø±Ø¨Ø± Ø®ÙˆØ§Ø³ØªØŒ Ù¾ÛŒØ´ Ø§Ø² Ø¬ÙˆØ§Ø¨ Ù†Ù‡Ø§ÛŒÛŒ Ø±Ø§Ù‡Ù†Ù…Ø§ÛŒÛŒ Ú©Ù†.

Ù‚ÙˆØ§Ø¹Ø¯:
- Ø²Ø¨Ø§Ù† Ù¾ÛŒØ´â€ŒÙØ±Ø¶ ÙØ§Ø±Ø³ÛŒ Ø±ÙˆØ§Ù† Ùˆ Ø·Ø¨ÛŒØ¹ÛŒ Ø§Ø³Øª. Ø§Ú¯Ø± Ú©Ø§Ø±Ø¨Ø± Ø¨Ù‡ Ø²Ø¨Ø§Ù† Ø¯ÛŒÚ¯Ø±ÛŒ Ù†ÙˆØ´ØªØŒ Ø¨Ù‡ Ù‡Ù…Ø§Ù† Ø²Ø¨Ø§Ù† Ù¾Ø§Ø³Ø® Ø¨Ø¯Ù‡.
- Ø§Ú¯Ø± Ù…Ø·Ù…Ø¦Ù† Ù†ÛŒØ³ØªÛŒØŒ ØµØ§Ø¯Ù‚Ø§Ù†Ù‡ Ø¨Ú¯Ùˆ. Ù‡Ø±Ú¯Ø² Ù…Ù†Ø¨Ø¹ØŒ Ø¹Ø¯Ø¯ ÛŒØ§ ÙˆØ§Ù‚Ø¹ÛŒØª Ø³Ø§Ø®ØªÚ¯ÛŒ Ù†Ø³Ø§Ø². Ø³Ø¤Ø§Ù„ Ø±Ø§ Ø¯Ù‚ÛŒÙ‚ Ø¨Ø®ÙˆØ§Ù†ØŒ Ù…Ø­Ø¯ÙˆØ¯ÛŒØªâ€ŒÙ‡Ø§ÛŒ Ú©Ø§Ø±Ø¨Ø± Ø±Ø§ Ø±Ø¹Ø§ÛŒØª Ú©Ù†ØŒ Ø§Ú¯Ø± Ø¯Ø±Ø®ÙˆØ§Ø³Øª Ù…Ø¨Ù‡Ù… Ø§Ø³Øª ÛŒÚ© Ø³Ø¤Ø§Ù„ Ú©ÙˆØªØ§Ù‡ Ø¨Ù¾Ø±Ø³ØŒ Ùˆ Ø¯Ø± Ú©Ø¯Ù†ÙˆÛŒØ³ÛŒ Ø±Ø§Ù‡Ú©Ø§Ø± Ù‚Ø§Ø¨Ù„ Ø§Ø¬Ø±Ø§ Ø¨Ø§ Ø­ÙØ¸ Ú©Ø¯Ù‡Ø§ÛŒ Ù…ÙˆØ¬ÙˆØ¯ Ø§Ø±Ø§Ø¦Ù‡ Ø¨Ø¯Ù‡.
- Ø§Ø² ØªØ§Ø±ÛŒØ®Ú†Ù‡Ù” Ú¯ÙØªâ€ŒÙˆÚ¯Ùˆ Ø¨Ø±Ø§ÛŒ ÙÙ‡Ù…ÛŒØ¯Ù† Ø³Ø¤Ø§Ù„â€ŒÙ‡Ø§ÛŒ Ù¾ÛŒÚ¯ÛŒØ±ÛŒ Ø§Ø³ØªÙØ§Ø¯Ù‡ Ú©Ù†.
- Ø§Ú¯Ø± Ø¯Ø± Ù¾ÛŒØ§Ù…â€ŒÙ‡Ø§ Â«Ù†ØªØ§ÛŒØ¬ Ø¬Ø³Øªâ€ŒÙˆØ¬ÙˆÛŒ Ø²Ù†Ø¯Ù‡Ù” ÙˆØ¨Â» Ø¢Ù…Ø¯Ù‡ØŒ Ø§Ø² Ù‡Ù…Ø§Ù†â€ŒÙ‡Ø§ Ø§Ø³ØªÙØ§Ø¯Ù‡ Ú©Ù† Ùˆ Ø¨Ù‡ Ù…Ù†Ø¨Ø¹â€ŒÙ‡Ø§ Ø¨Ø§ Ø´Ù…Ø§Ø±Ù‡Ù” [1] Ùˆ [2] Ø§Ø±Ø¬Ø§Ø¹ Ø¨Ø¯Ù‡. Ø§Ú¯Ø± Ù†ØªØ§ÛŒØ¬ Ø¨Ø±Ø§ÛŒ Ø¬ÙˆØ§Ø¨ Ú©Ø§ÙÛŒ Ù†Ø¨ÙˆØ¯ØŒ Ù‡Ù…ÛŒÙ† Ø±Ø§ ØµØ±ÛŒØ­ Ø¨Ú¯Ùˆ.
- Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ø®ØµÙˆØµÛŒ ÛŒØ§ Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ú©Ø§Ø±Ø¨Ø± Ø±Ø§ ØªØ´ÙˆÛŒÙ‚ Ø¨Ù‡ Ø§Ø±Ø³Ø§Ù„ Ù†Ú©Ù†.

Ù‚Ø§Ù„Ø¨ Ù¾Ø§Ø³Ø®:
- ÙØ±Ù…ÙˆÙ„â€ŒÙ‡Ø§ Ø±Ø§ Ø³Ø§Ø¯Ù‡ Ø¨Ù†ÙˆÛŒØ³ØŒ Ù…Ø«Ù„ 2x + 5 = 17Ø› Ø§Ø² Ø¹Ù„Ø§Ù…Øª Ø¯Ù„Ø§Ø± ÛŒØ§ LaTeX Ø§Ø³ØªÙØ§Ø¯Ù‡ Ù†Ú©Ù†.
- JSON Ø®Ø§Ù… ÛŒØ§ Ú©Ø¯ ØªØ²Ø¦ÛŒÙ†ÛŒ Ù†ÙØ±Ø³ØªØŒ Ù…Ú¯Ø± Ú©Ø§Ø±Ø¨Ø± Ú©Ø¯ Ø¨Ø®ÙˆØ§Ù‡Ø¯.
- Ù¾Ø§Ø³Ø® Ø±Ø§ Ø®ÙˆØ§Ù†Ø§ Ùˆ Ù†Ø³Ø¨ØªØ§Ù‹ Ú©ÙˆØªØ§Ù‡ Ù†Ú¯Ù‡ Ø¯Ø§Ø±ØŒ Ù…Ú¯Ø± Ú©Ø§Ø±Ø¨Ø± ØªÙˆØ¶ÛŒØ­ Ú©Ø§Ù…Ù„ Ø¨Ø®ÙˆØ§Ù‡Ø¯.`;

// Ù…Ø¯Ù„ Llama Vision Ù‚Ø¨Ù„ Ø§Ø² Ø§ÙˆÙ„ÛŒÙ† Ø§Ø³ØªÙØ§Ø¯Ù‡ Ù†ÛŒØ§Ø² Ø¯Ø§Ø±Ø¯ Ú©Ù‡ Ú©Ù„Ù…Ù‡Ù” agree Ø¨Ù‡ Ø¢Ù† Ø¯Ø§Ø¯Ù‡ Ø´ÙˆØ¯ (ØªØ£ÛŒÛŒØ¯ Ù„Ø§ÛŒØ³Ù†Ø³).
// Ø§Ú¯Ø± Ø§ÛŒÙ† Ø®Ø·Ø§ Ø¢Ù…Ø¯ØŒ ÛŒÚ©â€ŒØ¨Ø§Ø± Ù‡Ù…Ø§Ù† Ø±Ø§ Ø§Ù†Ø¬Ø§Ù… Ù…ÛŒâ€ŒØ¯Ù‡ÛŒÙ… Ùˆ Ø¯ÙˆØ¨Ø§Ø±Ù‡ ØªÙ„Ø§Ø´ Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ….
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

// ÙÙ‚Ø· Ù†Ø§Ù… Ø¯Ø§Ù…Ù†Ù‡ Ù…Ø¹ØªØ¨Ø± Ø±Ø§ Ù‚Ø¨ÙˆÙ„ Ù…ÛŒâ€ŒÚ©Ù†Ø¯ (Ù…Ø«Ù„Ø§Ù‹ example.com)
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
      error: "Ú©Ù„ÛŒØ¯ Ø¬Ø³Øªâ€ŒÙˆØ¬ÙˆÛŒ ÙˆØ¨ Ø±ÙˆÛŒ Worker ØªÙ†Ø¸ÛŒÙ… Ù†Ø´Ø¯Ù‡ Ø§Ø³Øª. Ø¯Ø± ØªØ±Ù…ÛŒÙ†Ø§Ù„ Ù¾ÙˆØ´Ù‡Ù” cloudflare-sam-ai Ø¯Ø³ØªÙˆØ± npx wrangler secret put LANGSEARCH_API_KEY Ø±Ø§ Ø§Ø¬Ø±Ø§ Ú©Ù†.",
      status: 503
    };
  }
  // LangSearch Ø§Ø² Ù¾Ø§Ø±Ø§Ù…ØªØ± site: Ø¯Ø± Ø®ÙˆØ¯ Ù…ØªÙ† Ø¬Ø³Øªâ€ŒÙˆØ¬Ùˆ Ù¾Ø´ØªÛŒØ¨Ø§Ù†ÛŒ Ù…ÛŒâ€ŒÚ©Ù†Ø¯
  const q = (site ? `site:${site} ` : "") + query.slice(0, 380);
  const res = await fetch("https://api.langsearch.com/v1/web-search", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.LANGSEARCH_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: q, count: 5 }),
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) {
    return { error: `Ø¬Ø³Øªâ€ŒÙˆØ¬ÙˆÛŒ ÙˆØ¨ Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯ (HTTP ${res.status}). Ú©Ù„ÛŒØ¯ LangSearch Ùˆ Ø§Ø¹ØªØ¨Ø§Ø± Ø­Ø³Ø§Ø¨ Ø±Ø§ Ø¯Ø± Ø³Ø§ÛŒØª LangSearch Ø¨Ø±Ø±Ø³ÛŒ Ú©Ù†.`, status: 502 };
  }
  const data = await res.json();
  const pages = Array.isArray(data?.data?.webPages?.value) ? data.data.webPages.value : [];
  const results = pages
    .slice(0, 5)
    .map(r => ({
      title: String(r.name || r.url || "Ù…Ù†Ø¨Ø¹").slice(0, 200),
      url: String(r.url || ""),
      content: String(r.snippet || r.summary || r.text || "").slice(0, 700)
    }))
    .filter(r => /^https?:\/\//.test(r.url));
  return { results };
}

function searchContext(results) {
  if (!results.length) {
    return "\n\nØ¬Ø³Øªâ€ŒÙˆØ¬ÙˆÛŒ ÙˆØ¨ Ø¨Ø±Ø§ÛŒ Ø§ÛŒÙ† Ù¾Ø±Ø³Ø´ Ù†ØªÛŒØ¬Ù‡â€ŒØ§ÛŒ Ù†Ø¯Ø§Ø´Øª. Ø§Ú¯Ø± Ø¨Ù‡ Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ø±ÙˆØ² Ù†ÛŒØ§Ø² Ø§Ø³ØªØŒ ØµØ§Ø¯Ù‚Ø§Ù†Ù‡ Ø¨Ú¯Ùˆ Ú©Ù‡ Ù†ØªÙˆØ§Ù†Ø³ØªÛŒ ØªØ£ÛŒÛŒØ¯ Ú©Ù†ÛŒ.";
  }
  const lines = results.map((r, i) => `[${i + 1}] ${r.title}\nØ¢Ø¯Ø±Ø³: ${r.url}\nØ®Ù„Ø§ØµÙ‡: ${r.content}`);
  return "\n\nÙ†ØªØ§ÛŒØ¬ Ø¬Ø³Øªâ€ŒÙˆØ¬ÙˆÛŒ Ø²Ù†Ø¯Ù‡Ù” ÙˆØ¨ (Ø¨Ø±Ø§ÛŒ Ù¾Ø§Ø³Ø® Ø§Ø² Ø§ÛŒÙ†â€ŒÙ‡Ø§ Ø§Ø³ØªÙØ§Ø¯Ù‡ Ú©Ù† Ùˆ Ù…Ù†Ø¨Ø¹â€ŒÙ‡Ø§ Ø±Ø§ Ø¨Ø§ Ø´Ù…Ø§Ø±Ù‡Ù” [1] Ùˆ [2] Ø§Ø±Ø¬Ø§Ø¹ Ø¨Ø¯Ù‡):\n\n" + lines.join("\n\n");
}

async function makeImage(env, request) {
  // Ù¾Ø±Ø§Ù…Ù¾Øª Ú©Ø§Ø±Ø¨Ø± (ÙØ§Ø±Ø³ÛŒ) Ø±Ø§ Ø¨Ù‡ ÛŒÚ© Ù¾Ø±Ø§Ù…Ù¾Øª Ø§Ù†Ú¯Ù„ÛŒØ³ÛŒ Ú©ÙˆØªØ§Ù‡ ØªØ¨Ø¯ÛŒÙ„ Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ…Ø› Ù…Ø¯Ù„â€ŒÙ‡Ø§ÛŒ ØªØµÙˆÛŒØ± Ø¨Ø§ Ø§Ù†Ú¯Ù„ÛŒØ³ÛŒ Ø¨Ù‡ØªØ±Ù†Ø¯
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
    return reply({ error: "Ø³Ø§Ø®Øª ØªØµÙˆÛŒØ± Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯. Ø¯ÙˆØ¨Ø§Ø±Ù‡ ØªÙ„Ø§Ø´ Ú©Ù† ÛŒØ§ ØªÙˆØ¶ÛŒØ­ Ø±Ø§ Ú©ÙˆØªØ§Ù‡â€ŒØªØ± Ø¨Ù†ÙˆÛŒØ³." }, 502);
  }
  return reply({
    answer: `ØªØµÙˆÛŒØ± Ø³Ø§Ø®ØªÙ‡ Ø´Ø¯. Ù¾Ø±Ø§Ù…Ù¾Øª Ø§Ø³ØªÙØ§Ø¯Ù‡â€ŒØ´Ø¯Ù‡: ${prompt}`,
    image: `data:image/jpeg;base64,${out.image}`
  });
}


async function editImage(env, request, imageData) {
  const prefix = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;
  if (!prefix.test(imageData)) {
    return reply({ error: "ÙØ±Ù…Øª Ø¹Ú©Ø³ Ø¨Ø±Ø§ÛŒ ÙˆÛŒØ±Ø§ÛŒØ´ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³ØªØ› Ù„Ø·ÙØ§Ù‹ JPGØŒ PNG ÛŒØ§ WEBP Ø¨ÙØ±Ø³Øª." }, 400);
  }
  const base64 = imageData.replace(prefix, "");
  // Kontext Ù…Ø¯Ù„ ÙˆÛŒØ±Ø§ÛŒØ´ ØªØµÙˆÛŒØ± Ø§Ø³ØªØ› Ø¹Ú©Ø³ Ø§ØµÙ„ÛŒ Ø¨Ù‡â€ŒØ¹Ù†ÙˆØ§Ù† ÙˆØ±ÙˆØ¯ÛŒ Ø¨Ù‡ Ù…Ø¯Ù„ Ø¯Ø§Ø¯Ù‡ Ù…ÛŒâ€ŒØ´ÙˆØ¯.
  try {
    const out = await env.AI.run(IMAGE_EDIT_MODEL, {
      prompt: String(request || "Improve the image while preserving the original subject and composition.").slice(0, 1800),
      image: base64,
      steps: 20
    });
    const result = typeof out?.image === "string" ? out.image
      : (typeof out?.output === "string" ? out.output : "");
    if (!result) throw new Error("Ù…Ø¯Ù„ ÙˆÛŒØ±Ø§ÛŒØ´ ØªØµÙˆÛŒØ± Ø®Ø±ÙˆØ¬ÛŒ ØªØµÙˆÛŒØ±ÛŒ Ø¨Ø±Ù†Ú¯Ø±Ø¯Ø§Ù†Ø¯.");
    return reply({
      answer: "ÙˆÛŒØ±Ø§ÛŒØ´ ØªØµÙˆÛŒØ± Ø§Ù†Ø¬Ø§Ù… Ø´Ø¯. Ø§Ú¯Ø± Ù†ØªÛŒØ¬Ù‡ Ø¯Ù‚ÛŒÙ‚Ø§Ù‹ Ù…Ø·Ø§Ø¨Ù‚ Ø®ÙˆØ§Ø³ØªÙ‡â€ŒØ§Øª Ù†ÛŒØ³ØªØŒ ØªØºÛŒÛŒØ±Ø§Øª Ø±Ø§ ÙˆØ§Ø¶Ø­â€ŒØªØ± Ø¨Ù†ÙˆÛŒØ³.",
      image: `data:image/png;base64,${result}`
    });
  } catch (error) {
    const detail = String(error?.message || error).slice(0, 220);
    console.error("Image editing failed:", detail);
    return reply({
      error: "ÙˆÛŒØ±Ø§ÛŒØ´ Ù…Ø³ØªÙ‚ÛŒÙ… ØªØµÙˆÛŒØ± Ø¯Ø± Ø­Ø§Ù„ Ø­Ø§Ø¶Ø± Ø±ÙˆÛŒ Ø§ÛŒÙ† Worker Ø¯Ø± Ø¯Ø³ØªØ±Ø³ Ù†ÛŒØ³Øª ÛŒØ§ Ù…Ø¯Ù„ ÙˆÛŒØ±Ø§ÛŒØ´ Ø®Ø·Ø§ Ø¯Ø§Ø¯. Ù…Ø¯Ù„ FLUX Kontext Ø¨Ø§ÛŒØ¯ Ø¯Ø± Ø­Ø³Ø§Ø¨ Workers AI Ù‚Ø§Ø¨Ù„ Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø¨Ø§Ø´Ø¯. Ø¬Ø²Ø¦ÛŒØ§Øª: " + detail
    }, 502);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return reply({ error: "Ø¨Ø±Ø§ÛŒ Ù¾Ø±Ø³Ø´ Ø§Ø² SAM AI Ø¨Ø§ÛŒØ¯ Ø¯Ø±Ø®ÙˆØ§Ø³Øª POST Ø§Ø±Ø³Ø§Ù„ Ø´ÙˆØ¯." }, 405);
    if (!env || !env.AI || typeof env.AI.run !== "function") {
      return reply({ error: "Ø§ØªØµØ§Ù„ Workers AI Ø±ÙˆÛŒ Ø§ÛŒÙ† Worker ØªÙ†Ø¸ÛŒÙ… Ù†Ø´Ø¯Ù‡ Ø§Ø³Øª. Ø¯Ø± wrangler.jsonc Ø¨Ø®Ø´ ai Ø¨Ø§ binding Ø¨Ù‡ Ù†Ø§Ù… AI Ø±Ø§ Ø¨Ø±Ø±Ø³ÛŒ Ú©Ù†." }, 503);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return reply({ error: "Ø¯Ø±Ø®ÙˆØ§Ø³Øª JSON Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª." }, 400);
    }

    try {
      if (body && body.action === "quota") {
        const quota = await quotaFor(env, request, body);
        return reply(publicQuota(quota));
      }
      const messages = normalizeMessages(body);
      if (!messages.length || messages[messages.length - 1].role !== "user") {
        return reply({ error: "Ù¾ÛŒØ§Ù… Ú©Ø§Ø±Ø¨Ø± Ø¯Ø±ÛŒØ§ÙØª Ù†Ø´Ø¯Ø› Ø¯ÙˆØ¨Ø§Ø±Ù‡ ØªÙ„Ø§Ø´ Ú©Ù†." }, 400);
      }
      const question = messages[messages.length - 1].content;

      if (body.image === true) {
        const quota = await quotaFor(env, request, body);
        if (quota.enforced && quota.used >= quota.limit) {
          return reply({ error: quotaMessage(quota), quota: publicQuota(quota) }, 429);
        }
        const imageAttachment = body.attachment;
        const made = (imageAttachment && typeof imageAttachment.data === "string" &&
            imageAttachment.data.startsWith("data:image/") && imageAttachment.data.length < 7_000_000)
          ? await editImage(env, question, imageAttachment.data)
          : await makeImage(env, question);
        if (made.status === 200 && quota.enforced && quota.key) {
          await env.SAM_LIMITS.put(quota.key, String(quota.used + 1), { expirationTtl: 60 * 60 * 48 });
        }
        return made;
      }

      // Ø§Ú¯Ø± Ø¹Ú©Ø³ÛŒ Ù¾ÛŒÙˆØ³Øª Ø´Ø¯Ù‡ØŒ Ø¨Ø§ Ù…Ø¯Ù„ Ø¨ÛŒÙ†Ø§ÛŒÛŒ Ø¨Ø±Ø±Ø³ÛŒ Ù…ÛŒâ€ŒØ´ÙˆØ¯ (Ú¯ÙØªâ€ŒÙˆÚ¯ÙˆÛŒ Ù…ØªÙ†ÛŒ Ø¹Ø§Ø¯ÛŒ ÙÙ‚Ø· Ù…ØªÙ† Ù…ÛŒâ€ŒØ¨ÛŒÙ†Ø¯)
      const att = body.attachment;
      if (att && typeof att.data === "string" && att.data.startsWith("data:image/") && att.data.length < 7_000_000) {
        const vision = await runVision(env, {
          messages: [{ role: "system", content: VISION_PROMPT }, ...messages],
          image: att.data,
          max_tokens: 900,
          temperature: 0.2
        });
        // Ù…Ø¯Ù„ Ø¨ÛŒÙ†Ø§ÛŒÛŒ Ú¯Ø§Ù‡ÛŒ JSON Ø±Ø§ Ø§Ø² Ù¾ÛŒØ´â€ŒÙ¾Ø§Ø±Ø³â€ŒØ´Ø¯Ù‡ Ø¯Ø± response Ø¨Ø±Ù…ÛŒâ€ŒÚ¯Ø±Ø¯Ø§Ù†Ø¯Ø› Ø¢Ù† Ø±Ø§ Ø¨Ù‡ Ù…ØªÙ† ØªØ¨Ø¯ÛŒÙ„ Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ…
        const visionAnswer = (vision && typeof vision.response === "object" && vision.response !== null)
          ? JSON.stringify(vision.response)
          : extractText(vision);
        if (!visionAnswer) {
          // Ø¨Ø±Ø§ÛŒ Ø¹ÛŒØ¨â€ŒÛŒØ§Ø¨ÛŒ: Ø´Ú©Ù„ Ø®Ø§Ù… Ù¾Ø§Ø³Ø® Ù…Ø¯Ù„ (Ø¨Ø¯ÙˆÙ† Ù…Ø­ØªÙˆØ§ÛŒ Ø¹Ú©Ø³)
          const shape = JSON.stringify(vision ?? null).slice(0, 300);
          console.error("Vision model returned empty text:", shape);
          return reply({ error: "Ù…Ø¯Ù„ Ø¨ÛŒÙ†Ø§ÛŒÛŒ Ù¾Ø§Ø³Ø®ÛŒ Ø¨Ø±Ù†Ú¯Ø±Ø¯Ø§Ù†Ø¯. Ø¯ÙˆØ¨Ø§Ø±Ù‡ ØªÙ„Ø§Ø´ Ú©Ù†. (Ø¬Ø²Ø¦ÛŒØ§Øª: " + shape + ")" }, 502);
        }
        return reply({ answer: visionAnswer, sources: [] });
      }

      let extra = "";
      let sources = [];
      if (body.web === true) {
        const found = await webSearch(env, question, "");
        if (found.error) return reply({ error: found.error }, found.status);
        extra = searchContext(found.results);
        sources = found.results.map(({ title, url }) => ({ title, url }));
      }

      const result = await env.AI.run(CHAT_MODEL, {
        messages: [{ role: "system", content: SYSTEM_PROMPT + userLine(body) + extra }, ...messages],
        max_tokens: 1200,
        temperature: 0.4,
        chat_template_kwargs: { enable_thinking: false }
      });

      const answer = extractText(result);
      if (!answer) {
        console.error("SAM AI returned an empty or unrecognized response shape");
        return reply({ error: "Ù…Ø¯Ù„ Ù¾Ø§Ø³Ø® Ù…ØªÙ†ÛŒ Ø¨Ø±Ù†Ú¯Ø±Ø¯Ø§Ù†Ø¯. Ú¯Ø²Ø§Ø±Ø´ Worker Ùˆ Ø³Ù‡Ù…ÛŒÙ‡Ù” Workers AI Ø±Ø§ Ø¯Ø± Ø¯Ø§Ø´Ø¨ÙˆØ±Ø¯ Cloudflare Ø¨Ø±Ø±Ø³ÛŒ Ú©Ù†." }, 502);
      }
      return reply({ answer, sources });
    } catch (error) {
      const detail = String(error?.message || error || "Unknown error").slice(0, 300);
      console.error("SAM AI request failed:", detail);
      return reply({ error: `Ø¯Ø±Ø®ÙˆØ§Ø³Øª Ù…Ø¯Ù„ Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯: ${detail}` }, 500);
    }
  }
};

