// news-scrap.mjs — 네이버 뉴스 아침 스크랩 (푸드 · 경제 · 사회) → 아웃룩용 HTML
// 실행:  node news-scrap.mjs --once   (지금 한 번 생성 → out/news.json, out/latest.html)
//        node news-scrap.mjs          (매일 07:50 KST 생성 + http://localhost:3000 에서 최신본 리턴)
import * as cheerio from 'cheerio';
import cron from 'node-cron';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('out');
const PORT = Number(process.env.PORT || 3000);
const PER_SECTION = 8;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

// 푸드는 네이버에 단독 섹션이 없어서
// 생활/문화 > 음식/맛집(103/238) + 경제 > 생활경제(101/310) 중 음식 키워드 기사를 합칩니다.
const FOOD_WORDS = ['식품', '외식', '맛집', '음식', '카페', '커피', '디저트', '베이커리', '빵', '라면', '편의점',
  '프랜차이즈', '배달', '메뉴', '레스토랑', '먹거리', '농산물', '과일', '한우', '주류', '맥주', '와인', '팝업'];

const SECTIONS = [
  { key: 'food', label: '푸드', accent: '#B4532A', sources: [
    { url: 'https://news.naver.com/breakingnews/section/103/238' },
    { url: 'https://news.naver.com/breakingnews/section/101/310', filter: FOOD_WORDS },
  ] },
  { key: 'economy', label: '경제', accent: '#1F5F8B', sources: [{ url: 'https://news.naver.com/section/101' }] },
  { key: 'society', label: '사회', accent: '#3E6B48', sources: [{ url: 'https://news.naver.com/section/102' }] },
];

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// 네이버 뉴스 섹션/속보 목록 공통 마크업(.sa_item) 파싱
function parseList(html, filter) {
  const $ = cheerio.load(html);
  const items = [];
  $('.sa_item').each((_, el) => {
    const $el = $(el);
    const title = $el.find('.sa_text_strong').first().text().trim();
    const link = $el.find('a.sa_text_title').first().attr('href');
    if (!title || !link) return;
    if (filter && !filter.some((w) => title.includes(w))) return;
    items.push({
      title,
      link,
      press: $el.find('.sa_text_press').first().text().trim(),
      lede: $el.find('.sa_text_lede').first().text().trim().replace(/\s+/g, ' ').slice(0, 110),
    });
  });
  return items;
}

async function collect() {
  const result = [];
  for (const sec of SECTIONS) {
    const seen = new Set();
    const items = [];
    for (const src of sec.sources) {
      try {
        for (const it of parseList(await fetchHtml(src.url), src.filter)) {
          const id = it.link.split('?')[0];
          if (seen.has(id)) continue;
          seen.add(id);
          items.push(it);
        }
      } catch (e) {
        console.error(`[${sec.label}] 수집 실패:`, e.message);
      }
    }
    result.push({ ...sec, items: items.slice(0, PER_SECTION) });
  }
  return result;
}

const esc = (s = '') => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// 아웃룩(Word 렌더러) 대응: table 레이아웃, 인라인 스타일, 고정 폭 640
export function renderEmail(sections, date = new Date()) {
  const ymd = date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const font = "'Malgun Gothic','맑은 고딕',Apple SD Gothic Neo,sans-serif";
  const total = sections.reduce((n, s) => n + s.items.length, 0);

  const blocks = sections.map((s) => {
    const rows = s.items.length
      ? s.items.map((it, i) => `
        <tr><td style="padding:12px 0;border-top:${i ? '1px solid #E6E2DA' : '0'};font-family:${font};">
          <a href="${esc(it.link)}" style="color:#1B1B1B;text-decoration:none;font-size:15px;line-height:22px;font-weight:bold;">${esc(it.title)}</a>
          ${it.lede ? `<div style="color:#5B5750;font-size:13px;line-height:20px;padding-top:4px;">${esc(it.lede)}</div>` : ''}
          <div style="color:#8C877E;font-size:12px;line-height:18px;padding-top:4px;">${esc(it.press)}</div>
        </td></tr>`).join('')
      : `<tr><td style="padding:12px 0;font-family:${font};font-size:13px;color:#8C877E;">수집된 기사가 없습니다.</td></tr>`;
    return `
    <tr><td style="padding:28px 32px 8px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="font-family:${font};font-size:13px;font-weight:bold;color:${s.accent};letter-spacing:1px;border-bottom:2px solid ${s.accent};padding-bottom:8px;">
          ${esc(s.label)} <span style="color:#8C877E;font-weight:normal;">${s.items.length}건</span>
        </td></tr>
        ${rows}
      </table>
    </td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ko" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>아침 뉴스 스크랩 ${esc(ymd)}</title>
<!--[if mso]><style>table,td,div,a{font-family:'Malgun Gothic',sans-serif !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#F3F0EA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F3F0EA"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width:640px;max-width:640px;">
    <tr><td style="padding:28px 32px 20px 32px;background:#1E2A2F;font-family:${font};">
      <div style="color:#A9B8BC;font-size:12px;letter-spacing:2px;">MORNING BRIEF · 07:50 KST</div>
      <div style="color:#FFFFFF;font-size:22px;line-height:30px;font-weight:bold;padding-top:6px;">${esc(ymd)} 아침 뉴스</div>
      <div style="color:#A9B8BC;font-size:13px;padding-top:4px;">푸드 · 경제 · 사회 ${total}건 · 출처 네이버 뉴스</div>
    </td></tr>
    ${blocks}
    <tr><td style="padding:24px 32px 28px 32px;font-family:${font};font-size:11px;line-height:17px;color:#8C877E;">
      제목을 누르면 네이버 뉴스 원문으로 이동합니다. 기사 저작권은 각 언론사에 있습니다.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

async function run() {
  const now = new Date();
  const sections = await collect();
  const html = renderEmail(sections, now);
  const ymd = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD
  await fs.mkdir(OUT_DIR, { recursive: true });
  // 아티팩트 뷰어에 끌어다 놓을 파일
  const json = JSON.stringify({ generatedAt: now.toISOString(), sections: sections.map(({ sources, ...s }) => s) }, null, 2);
  await fs.writeFile(path.join(OUT_DIR, `news-${ymd}.json`), json);
  await fs.writeFile(path.join(OUT_DIR, 'news.json'), json);
  await fs.writeFile(path.join(OUT_DIR, `news-${ymd}.html`), html);
  await fs.writeFile(path.join(OUT_DIR, 'latest.html'), html);
  await fs.writeFile(path.join(OUT_DIR, 'index.html'), html); // GitHub Pages 첫 화면
  console.log(`[${now.toISOString()}] out/news-${ymd}.html 생성`);
  if (process.env.SMTP_HOST) await sendMail(html, ymd);
  return html;
}

// 선택: SMTP 환경변수가 있으면 아웃룩으로 바로 발송
async function sendMail(html, ymd) {
  const { default: nodemailer } = await import('nodemailer');
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,                 // 예: smtp.office365.com
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await t.sendMail({ from: process.env.SMTP_USER, to: process.env.MAIL_TO, subject: `[아침 뉴스] ${ymd} 푸드·경제·사회`, html });
  console.log(`메일 발송 → ${process.env.MAIL_TO}`);
}

if (process.argv.includes('--once')) {
  await run();
} else {
  cron.schedule('50 7 * * *', () => run().catch(console.error), { timezone: 'Asia/Seoul' });
  http.createServer(async (req, res) => {
    try {
      const html = req.url.startsWith('/refresh') ? await run()
        : await fs.readFile(path.join(OUT_DIR, 'latest.html'), 'utf8').catch(() => run());
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('생성 실패: ' + e.message);
    }
  }).listen(PORT, () => console.log(`매일 07:50 KST 스케줄 등록 · http://localhost:${PORT}`));
}
