const SITE_ORIGINS = new Set([
  "https://olivercraftboycompany-design.github.io",
  "http://localhost:8788",
  "http://127.0.0.1:8788",
]);
const BOOKS = new Map([
  ["genesis",1],["exodus",2],["leviticus",3],["numbers",4],["deuteronomy",5],
  ["joshua",6],["judges",7],["ruth",8],["1 samuel",9],["2 samuel",10],
  ["1 kings",11],["2 kings",12],["1 chronicles",13],["2 chronicles",14],["ezra",15],
  ["nehemiah",16],["esther",17],["job",18],["psalms",19],["proverbs",20],
  ["ecclesiastes",21],["song of solomon",22],["isaiah",23],["jeremiah",24],
  ["lamentations",25],["ezekiel",26],["daniel",27],["hosea",28],["joel",29],
  ["amos",30],["obadiah",31],["jonah",32],["micah",33],["nahum",34],
  ["habakkuk",35],["zephaniah",36],["haggai",37],["zechariah",38],["malachi",39],
  ["matthew",40],["mark",41],["luke",42],["john",43],["acts",44],["romans",45],
  ["1 corinthians",46],["2 corinthians",47],["galatians",48],["ephesians",49],
  ["philippians",50],["colossians",51],["1 thessalonians",52],["2 thessalonians",53],
  ["1 timothy",54],["2 timothy",55],["titus",56],["philemon",57],["hebrews",58],
  ["james",59],["1 peter",60],["2 peter",61],["1 john",62],["2 john",63],
  ["3 john",64],["jude",65],["revelation",66],
]);
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
});
function corsHeaders(origin) {
  return origin && SITE_ORIGINS.has(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Scripture-Desk", "Vary": "Origin" }
    : {};
}
function parseReference(value) {
  if (typeof value !== "string" || value.length > 80) return null;
  const match = value.trim().match(/^(.+?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/);
  if (!match) return null;
  const book = match[1].toLowerCase().replace(/\s+/g, " ");
  const id = BOOKS.get(book), chapter = Number(match[2]), first = Number(match[3]);
  const last = match[4] ? Number(match[4]) : first;
  if (!id || chapter < 1 || chapter > 150 || first < 1 || last < first || last - first > 11) return null;
  return { book, id, chapter, first, last, label: `${match[1]} ${chapter}:${first}${last > first ? `-${last}` : ""}` };
}
async function getVerses(ref) {
  const url = `https://bolls.life/get-text/KJV/${ref.id}/${ref.chapter}/`;
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("scripture_source");
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("scripture_source");
  const cleanText = value => String(value || "")
    .replace(/<S>[^<]*<\/S>/gi, "") // Bolls wraps Strong's numbers in <S> tags; remove the contents too.
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-f]+|[0-9]+);/gi, entity => {
      const named = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&apos;": "'", "&nbsp;": " " };
      if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
      const code = entity[2].toLowerCase() === "#" && entity[3].toLowerCase() === "x"
        ? Number.parseInt(entity.slice(4, -1), 16) : Number.parseInt(entity.slice(2, -1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/\s+/g, " ").trim();
  return rows.filter(v => Number(v.verse) >= ref.first && Number(v.verse) <= ref.last)
    .map(v => ({ number: Number(v.verse), text: cleanText(v.text) }))
    .filter(v => v.text && v.text.length < 1000);
}
function promptFor(mode, question, reference, verses) {
  const passage = verses.map(v => `${reference.split(" ").slice(0,-1).join(" ")} ${reference.split(" ").at(-1).split(":")[0]}:${v.number}: ${v.text}`).join("\n");
  const purpose = mode === "reflect"
    ? "Offer exactly two gentle, open-ended reflection questions tied to the passage. Do not present them as Scripture."
    : "Explain the passage in context in plain, gentle language. Distinguish what the text says from interpretation, and do not condemn the reader.";
  return [
    "You are Bibley, a warm and careful Bible study helper.",
    "Use only the supplied King James Version text for quotations. Do not invent, alter, or misattribute Bible quotations or references. If the question is not answered by this passage, say so.",
    "If you quote Scripture, copy the exact words and include its exact verse reference. Keep the response concise.",
    purpose,
    `Passage (${reference}, KJV):\n${passage}`,
    question ? `Question: ${question}` : "Question: Explain the main point of this passage.",
  ].join("\n\n");
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);
    if (origin && !SITE_ORIGINS.has(origin)) return json({ error: "origin_not_allowed" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/api/bibley/status" && request.method === "GET") {
      const ready = typeof env.GROQ_API_KEY === "string" && !!env.GROQ_API_KEY;
      return json({ ready, status: ready ? "ready" : "error" }, ready ? 200 : 503, cors);
    }
    if (url.pathname !== "/api/bibley/study" || request.method !== "POST") return json({ error: "not_found" }, 404, cors);
    if (!env.GROQ_API_KEY) return json({ error: "unavailable" }, 503, cors);
    if (env.AI_RATE_LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const { success } = await env.AI_RATE_LIMITER.limit({ key: ip });
      if (!success) return json({ error: "busy" }, 429, cors);
    }
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 5000) return json({ error: "request_too_large" }, 413, cors);
      body = JSON.parse(raw);
    } catch { return json({ error: "invalid_json" }, 400, cors); }
    const ref = parseReference(body.reference);
    const mode = body.mode === "reflect" ? "reflect" : body.mode === "explain" ? "explain" : null;
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
    if (!ref || !mode) return json({ error: "invalid_request" }, 400, cors);
    try {
      const verses = await getVerses(ref);
      if (!verses.length) return json({ error: "passage_unavailable" }, 404, cors);
      const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [{ role: "user", content: promptFor(mode, question, ref.label, verses) }],
          max_completion_tokens: 700,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (upstream.status === 429) return json({ error: "busy" }, 429, cors);
      if (!upstream.ok) return json({ error: "upstream_unavailable" }, 502, cors);
      const result = await upstream.json();
      const answer = result?.choices?.[0]?.message?.content;
      if (typeof answer !== "string" || !answer.trim()) return json({ error: "empty_answer" }, 502, cors);
      return json({ answer: answer.trim().slice(0, 12000) }, 200, cors);
    } catch {
      return json({ error: "upstream_unavailable" }, 502, cors);
    }
  },
};
