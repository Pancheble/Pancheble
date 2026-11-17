// 프로필 카드 SVG 생성기. 의존성 0, Node 18+.
// 실행: GH_USER=아이디 GITHUB_TOKEN=토큰 node gen.mjs   (토큰 없으면 데모 데이터)
// 출력: assets/<카드>-light.svg, assets/<카드>-dark.svg, README.md의 프로젝트·배너 칸
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { extname } from 'node:path'

// ── 여기만 고치면 됨 ─────────────────────────────────────────
const CONFIG = {
  tagline: 'Jobless, but AX-ing everything',
  group: { name: 'Veritas', motto: 'AX for everything' }, // 프로젝트 묶음 이름과 한 줄 설명
  // 이미지 자리: 한국 시각 오전(0~11시)엔 am, 오후엔 pm 그림. Actions가 0시·12시에 다시 그림
  // image: 레포 안 이미지 경로(png·jpg·gif·webp). 840×height에 꽉 차게 가운데 기준으로 잘림
  // caption: 왼쪽 아래 문구, credit: 오른쪽 아래 출처 (README에서 그림을 누르면 출처로 이동)
  banner: {
    height: 412, caption: 'She is my wife.',
    credit: { text: '@030_bv', url: 'https://x.com/030_bv/status/2095118743928291753' }, // 두 그림 모두 이 게시물
    am: { image: 'images/banner-am.jpg' },
    pm: { image: 'images/banner-pm.jpg' },
  },
  // 프로젝트 한 줄씩, 이 순서대로
  // icon: 레포 안 이미지 경로(svg·png·jpg·webp). 비우면 이름 첫 글자를 넣음
  // status: 'active' | 'planned' | 'archived'. planned는 빗금 줄 + 회색 점, archived는 노란 점
  // url: 있으면 화살표가 붙고, README에서 그 줄을 누르면 이동
  projects: [
    { name: 'omagari', desc: 'AX for teams', lang: 'TypeScript', status: 'active', icon: 'icons/omagari.svg', url: 'https://github.com/Pancheble/omagari' },
    { name: 'kagami', desc: 'AX for focused work', lang: 'TypeScript', status: 'archived', icon: 'icons/kagami.svg', url: 'https://github.com/Pancheble/kagami' },
    { name: 'konuri', desc: 'AX for …', status: 'planned', icon: 'icons/konuri.svg' },
    { name: 'otose', desc: 'AX for …', status: 'planned', icon: 'icons/otose.svg' },
    { name: 'akeboshi', desc: 'AX for …', status: 'planned', icon: 'icons/akeboshi.svg' },
  ],
}
// ─────────────────────────────────────────────────────────────

// 지금이 한국 시각 오전이면 am, 오후면 pm 그림. BANNER=am|pm 으로 강제할 수 있음(미리보기용)
const HALF = process.env.BANNER || (new Date(Date.now() + 9 * 3600e3).getUTCHours() < 12 ? 'am' : 'pm')
const BANNER = { ...CONFIG.banner, ...CONFIG.banner[HALF] }

// card = 페이지 바탕색(글자 뒤를 가리는 흰 칩에도 씀), on = 파란 바탕 위 글자색. 다크는 GitHub 다크 테마 색
const THEMES = {
  light: { card: '#ffffff', line: '#e0e0e0', chip: '#e8e8ed', ink: '#1d1d1f', sub: '#636366', link: '#0066cc', on: '#ffffff', zero: '#d2d2d7', attention: '#9a6700', dim: 0 },
  dark: { card: '#0d1117', line: '#3d444d', chip: '#262c36', ink: '#f0f6fc', sub: '#9198a1', link: '#4493f8', on: '#0d1117', zero: '#3d444d', attention: '#d29922', dim: 0.08 },
}
const OFF = '#8e8e93'
const SANS = "'Manrope','IBM Plex Sans KR',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif"
const KR = "'IBM Plex Sans KR','Manrope',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif"
const W = 840

const DEMO = {
  name: 'Your Name', login: 'yourname',
  stats: { Stars: 128, Commits: 1342, PRs: 87, Issues: 23, Repos: 34, Followers: 56 },
  hours: [2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 8, 5, 1, 1, 7, 6, 8, 15, 15, 12, 1],
}

async function fetchData(login, token) {
  const query = `query($login:String!){user(login:$login){
    name login followers{totalCount}
    contributionsCollection{totalCommitContributions totalPullRequestContributions totalIssueContributions restrictedContributionsCount}
    repositories(first:100,ownerAffiliations:OWNER,isFork:false){totalCount nodes{stargazerCount}}}}`
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login } }),
  })
  const json = await res.json()
  const u = json.data?.user
  if (!u) throw new Error(JSON.stringify(json))
  // 최근 커밋 100개의 시각. 날짜 문자열의 '시'(커밋한 사람의 현지 시각)를 그대로 셈
  const sr = await fetch(`https://api.github.com/search/commits?per_page=100&sort=author-date&order=desc&q=${encodeURIComponent(`author:${login}`)}`,
    { headers: { Authorization: `bearer ${token}`, Accept: 'application/vnd.github+json' } })
  const hours = Array(24).fill(0)
  for (const it of (await sr.json()).items ?? []) hours[+it.commit.author.date.slice(11, 13)]++
  const c = u.contributionsCollection
  return {
    name: u.name || u.login, login: u.login,
    stats: {
      // ponytail: 별은 레포 100개까지만 합침, 넘으면 페이지네이션 추가
      Stars: u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0),
      Commits: c.totalCommitContributions + c.restrictedContributionsCount, // 최근 1년
      PRs: c.totalPullRequestContributions,
      Issues: c.totalIssueContributions,
      Repos: u.repositories.totalCount,
      Followers: u.followers.totalCount,
    },
    hours,
  }
}

// ── 글자 폭: Manrope 700의 글자별 폭(1/1000 em)을 재 둔 표. 굵기별 보정값은 WF. 한글은 IBM Plex Sans KR 700 기준 ──
const CH = String.fromCharCode(...Array.from({ length: 95 }, (_, i) => i + 32)) + '·–…“”'
const TBL = [200, 360, 467, 931, 628, 900, 668, 260, 453, 453, 465, 572, 303, 420, 303, 433, 658, 438, 595, 581, 609, 586, 622, 533, 612, 622, 342, 343, 637, 750, 637, 553, 914, 671, 631, 738, 700, 585, 523, 732, 722, 280, 501, 647, 533, 855, 718, 749, 638, 749, 660, 657, 607, 720, 641, 976, 655, 611, 663, 423, 433, 423, 680, 660, 539, 576, 616, 576, 617, 602, 378, 616, 625, 280, 288, 538, 280, 899, 625, 618, 616, 617, 399, 541, 433, 625, 553, 802, 554, 559, 534, 449, 300, 449, 716, 267, 540, 710, 451, 451]
const WID = Object.fromEntries([...CH].map((ch, i) => [ch, TBL[i]]))
const WF = { 400: 0.95, 500: 0.967, 600: 0.983, 700: 1, 800: 1.017 }
// ls: 글자 사이 간격(em)
const textW = (s, size, w = 700, ls = 0) => [...String(s)].reduce((sum, ch) =>
  sum + (ch.charCodeAt(0) > 0x2e80 ? 892 : (WID[ch] ?? 600) * WF[w]) / 1000 + ls, 0) * size
const clip = (s, maxW, size, w) => { // 폭을 넘으면 …로 자름
  if (textW(s, size, w) <= maxW) return s
  while (s && textW(s + '…', size, w) > maxW) s = s.slice(0, -1)
  return s.trimEnd() + '…'
}

const esc = s => String(s).replace(/[&<>"]/g, ch => `&#${ch.charCodeAt(0)};`)
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif' }
const dataUri = p => `data:${MIME[extname(p).toLowerCase()] ?? 'image/png'};base64,${readFileSync(p).toString('base64')}`
const n = v => +(+v).toFixed(2)

const svg = (h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">
<style>__FONTS__text{font-family:${SANS}}.kr{font-family:${KR}}</style>
${body}
</svg>`
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra}/>`
// 글자. textLength로 잰 폭에 맞춰 두어서, 글꼴을 못 불러와도 칩 밖으로 넘치지 않음
const T = (x, y, s, size, fill, { w = 700, ls = 0, a, cls } = {}) =>
  `<text x="${n(x)}" y="${n(y)}" font-size="${size}" font-weight="${w}" fill="${fill}"${a ? ` text-anchor="${a}"` : ''}${cls ? ` class="${cls}"` : ''} textLength="${n(textW(s, size, w, ls))}">${esc(s)}</text>`
// 빗금 무늬(오른쪽 위로 올라가는 선). lw = 선 굵기, pitch = 선 간격
const hatch = (id, color, lw, pitch) => `<pattern id="${id}" width="${pitch}" height="${pitch}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${lw}" height="${pitch}" fill="${color}"/></pattern>`
// [ 이름 ] 꼴. [svg, 끝나는 x]를 돌려줌
const bracket = (name, t, { size = 13, y = 14.5, by = y, gap = 6, w = 800, ls = 0.06, cls } = {}) => {
  const lw = textW('[', size, 400), nw = textW(name, size, w, ls)
  return [T(0, by, '[', size, OFF, { w: 400 }) + T(lw + gap, y, name, size, t.ink, { w, ls, cls }) + T(lw + gap + nw + gap, by, ']', size, OFF, { w: 400 }),
    lw + gap + nw + gap + textW(']', size, 400)]
}
const micro = (x, lines, t) => lines.map((s, i) => T(x, 8 + i * 10, s.toUpperCase(), 8, t.sub, { ls: 0.1 })).join('')
// 구역 제목 줄(높이 20): [ 이름 ] + 작은 두 줄 글씨. plus = 사이에 네모 십자 아이콘
const label = (name, lines, t, plus) => {
  const [b, x] = bracket(name, t)
  return b + (plus ? `<path d="M${n(x + 10.5)} 5.5h9v9h-9zM${n(x + 15)} 7.5v5M${n(x + 12.5)} 10h5" fill="none" stroke="${OFF}"/>` : '') + micro(x + (plus ? 30 : 10), lines, t)
}
const dots = t => [0, 5, 10, 15, 20, 25].map(dx => rect(W - 28 + dx, 6, 3, 3, t.zero) + rect(W - 28 + dx, 11, 3, 3, t.zero)).join('')
const tri = (x, y, w, h, t, a = 72) => rect(x, y, a, h, t.link) + rect(x + a, y, a, h, t.ink) + rect(x + a * 2, y, w - a * 2, h, t.line) // 파랑·검정·회색 띠

// ── 카드 (각각 [높이, 본문]을 돌려줌) ──
// 헤더: 아이디를 빗금 글자로 크게 깔고(배경), 그 위에 이름·칩·한 줄 소개
const header = (d, t) => {
  const ghost = d.login.toUpperCase(), gs = Math.min(190, 838 / textW(ghost, 1, 800, -0.02)), base = 86.6 + 0.735 * gs / 2
  const [name] = bracket(d.name, t, { size: 46, y: 91.5, by: 93.5, gap: 16, w: 700, ls: 0, cls: 'kr' })
  let x = 0, chips = ''
  for (const [k, v] of [['GITHUB', '@' + d.login], ['PROJECT', CONFIG.group.name]]) {
    const kw = textW(k, 10, 700, 0.06), vw = textW(v, 12)
    chips += rect(x, 130, 11 + kw + 10, 24, t.card) + rect(x, 139.5, 5, 5, t.link) + T(x + 11, 145.5, k, 10, t.sub, { ls: 0.06 })
    x += 11 + kw + 10
    chips += rect(x, 130, vw + 24, 24, t.chip) + T(x + 12, 146.2, v, 12, t.ink)
    x += vw + 24 + 12
  }
  return [190, `<defs>${hatch('gh', t.zero, 1.5, 5)}</defs>
<text x="0" y="${n(base)}" font-size="${n(gs)}" font-weight="800" fill="url(#gh)" textLength="838">${esc(ghost)}</text>
${label('PROFILE', ['Redrawn by GitHub Actions', '00:00 · 12:00 KST'], t, true)}
${name}
${tri(0, 116, 420, 2, t)}
${chips}
${T(0, 184, `“${CONFIG.tagline}”`, 15, t.ink, { w: 600 })}
${rect(540, 157.5, 48, 4, t.zero)}<path d="M596 156h8l-4 7z" fill="${t.link}"/>${rect(612, 159, 124, 1, t.zero)}${rect(744, 157.5, 96, 4, t.zero)}`]
}

// 통계: 여섯 칸, 여섯 자리로 맞추고 앞에 채운 0은 연하게
const STATS = [['Commits', 'COMMITS · 1Y'], ['Stars', 'STARS'], ['PRs', 'PRS'], ['Issues', 'ISSUES'], ['Repos', 'REPOS'], ['Followers', 'FOLLOWERS']]
const stats = (d, t) => {
  const cw = (W - 16 * (STATS.length - 1)) / STATS.length
  return [112, label('STATS', ['Public activity', 'GitHub API'], t) + dots(t) + STATS.map(([k, name], i) => {
    const x = i * (cw + 16), num = String(d.stats[k]), pad = '0'.repeat(Math.max(0, 6 - num.length))
    const pw = textW(pad, 28, 800, -0.01)
    return `${rect(x, 32, cw, 2, i ? t.line : t.link)}${rect(x, 48.5, 5, 5, i ? t.zero : t.link)}${T(x + 11, 54.5, name, 10, t.sub, { ls: 0.06 })}
${pad ? T(x, 90, pad, 28, t.zero, { w: 800, ls: -0.01 }) : ''}${T(x + pw, 90, num, 28, t.ink, { w: 800, ls: -0.01 })}`
  }).join('\n')]
}

// 커밋하는 시간: 시간 눈금 줄 + 막대. 가장 많이 몰린 3시간을 파랗게
const h12 = h => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
const hours = (d, t) => {
  const c = d.hours, max = Math.max(1, ...c), sum3 = i => c[i] + c[(i + 1) % 24] + c[(i + 2) % 24]
  let peak = 0
  for (let i = 1; i < 24; i++) if (sum3(i) > sum3(peak)) peak = i
  const end = (peak + 3) % 24
  const range = end > peak && (peak < 12) === (end < 12) ? `${peak % 12 || 12}–${h12(end)}` : `${h12(peak)}–${h12(end)}`
  const bw = (W - 23 * 6) / 24, rx = W - textW(range, 12, 800), px = rx - 8 - textW('PEAK', 10, 700, 0.06)
  const cols = c.map((v, i) => {
    const x = i * (bw + 6), hot = (i - peak + 24) % 24 < 3, h = Math.max(2, Math.round((v / max) * 104)), hh = String(i).padStart(2, '0')
    return `${hot ? rect(x, 50, bw, 2, t.link) + T(x + bw / 2, 45, hh, 10, t.link, { w: 800, a: 'middle' }) : rect(x, 32, bw, 20, t.chip) + T(x + bw / 2, 45.5, hh, 10, t.sub, { a: 'middle' })}${rect(x, 56, bw, 104, 'url(#tk)')}${rect(x, 160 - h, bw, h, hot ? t.link : t.ink)}`
  }).join('\n')
  return [160, `<defs>${hatch('tk', t.line, 1, 6)}</defs>
${label('WHEN I COMMIT', ['Local time', `Last ${c.reduce((s, v) => s + v, 0)} commits`], t)}
${rect(px - 13, 7.5, 5, 5, t.link)}${T(px, 13.5, 'PEAK', 10, t.sub, { ls: 0.06 })}${T(rx, 14.2, range, 12, t.ink, { w: 800 })}
${cols}`]
}

// 프로젝트는 README에서 줄마다 다른 링크를 걸 수 있게 '제목 조각 + 줄 조각'으로 잘라 그림.
// 조각끼리 빈틈없이 이어 붙고, 줄 사이 4px 틈은 각 줄 조각의 위쪽에 들어 있음
const TONE = { active: t => t.link, archived: t => t.attention, planned: () => OFF }
const projectsHead = (d, t) => {
  const ps = CONFIG.projects, count = `${ps.filter(p => p.url).length} / ${ps.length} PUBLIC`, cw = textW(count, 10, 700, 0.06)
  const sx = W - cw - 10 - (ps.length * 32 - 4)
  return [32, label('PROJECTS', [CONFIG.group.name, CONFIG.group.motto], t)
    + ps.map((p, i) => rect(sx + i * 32, 8.5, 28, 3, p.status === 'planned' ? t.zero : TONE[p.status](t))).join('')
    + T(W - cw, 13.5, count, 10, t.sub, { ls: 0.06 })]
}
const BADGES = { planned: 'Planned', archived: 'Archived' }
const projectRow = (p, i) => (d, t) => {
  const top = i ? 4 : 0, h = 60 + top, cy = top + 30, planned = p.status === 'planned', tone = TONE[p.status](t), badge = BADGES[p.status]
  let x = W - 12, right = ''
  if (p.url) {
    x -= 28
    right += `${rect(x, cy - 14, 28, 28, t.link)}<path d="M${x + 9} ${cy}h10M${x + 15} ${cy - 4}l4 4-4 4" fill="none" stroke="${t.on}" stroke-width="1.6"/>`
    x -= 8
  }
  if (badge) {
    const bw = textW(badge, 11) + 32
    x -= bw
    right += rect(x, cy - 12, bw, 24, t.card) + rect(x + 10, cy - 3, 6, 6, tone) + T(x + 22, cy + 4, badge, 11, planned ? t.sub : t.ink)
    x -= 8
  }
  if (p.lang) {
    const lw = textW(p.lang, 11) + 20
    x -= lw
    right += rect(x, cy - 12, lw, 24, t.card) + T(x + 10, cy + 4, p.lang, 11, t.ink)
  }
  const icon = p.icon
    ? `<image href="${dataUri(p.icon)}" x="60" y="${cy - 18}" width="36" height="36" preserveAspectRatio="xMidYMid slice"${planned ? ' opacity="0.6"' : ''}/>`
    : rect(60, cy - 18, 36, 36, t.card) + T(78, cy + 6, [...p.name][0].toUpperCase(), 17, planned ? t.sub : t.ink, { w: 800, a: 'middle' })
  return [h, `${planned ? `<defs>${hatch('pl', t.line, 1, 6)}</defs>` : ''}${rect(0, top, W, 60, planned ? 'url(#pl)' : t.chip)}
${rect(12, cy - 12, 36, 24, planned ? t.chip : t.card)}${rect(12, cy - 12, 3, 24, tone)}${T(31.5, cy + 4.3, String(i + 1).padStart(2, '0'), 12, planned ? t.sub : t.ink, { w: 800, a: 'middle' })}
${icon}
${T(112, cy + 7, p.name, 20, planned ? t.sub : t.ink, { w: 800, ls: -0.01 })}${T(288, cy + 4.5, clip(p.desc ?? '', x - 16 - 288, 13, 500), 13, t.sub, { w: 500 })}
${right}`]
}

// 이미지 자리. 그림 위에 칩 세 개(오전/오후, 문구, 출처), 아래에 3색 띠
const banner = (d, t) => {
  const { image, height: H = 412, caption, credit } = BANNER, half = HALF.toUpperCase(), note = 'Switches at 00:00 · 12:00 KST'
  const hw = textW(half, 11, 800), nw = textW(note, 11)
  let chips = rect(16, 16, hw + nw + 30, 24, t.card) + T(26, 32, half, 11, t.link, { w: 800 }) + T(36 + hw, 32, note, 11, t.ink)
  if (caption) {
    const cw = textW(caption, 16, 800)
    chips += rect(16, H - 52, 4, 36, t.link) + rect(20, H - 52, cw + 26, 36, t.card) + T(32, H - 28.4, caption, 16, t.ink, { w: 800 })
  }
  if (credit) {
    const iw = textW('Illustration', 11), vw = textW(credit.text, 11), x = W - 16 - (iw + vw + 30)
    chips += rect(x, H - 40, iw + vw + 30, 24, t.card) + T(x + 10, H - 24, 'Illustration', 11, t.sub) + T(x + 20 + iw, H - 24, credit.text, 11, t.ink)
  }
  return [H + 3, `<image href="${dataUri(image)}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>${t.dim ? rect(0, 0, W, H, '#000', ` opacity="${t.dim}"`) : ''}
${chips}
${tri(0, H, W, 3, t, 120)}`]
}

// tight: 한 줄로 붙여 쓰고 align="top"을 줘서 그림 아래 글자 줄 틈이 안 생기게(조각 이어 붙이기용)
const picture = (name, alt, tight) => tight
  ? `<picture><source media="(prefers-color-scheme: dark)" srcset="assets/${name}-dark.svg"><img src="assets/${name}-light.svg" width="100%" align="top" alt="${esc(alt)}"></picture>`
  : `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/${name}-dark.svg">
  <img src="assets/${name}-light.svg" width="100%" alt="${esc(alt)}">
</picture>`
const projectsBlock = () => `<p>${picture('projects-0', `Projects - ${CONFIG.group.name}`, true)}${CONFIG.projects.map((p, i) => {
  const pic = picture(`projects-${i + 1}`, p.name, true)
  return p.url ? `<a href="${esc(p.url)}">${pic}</a>` : pic
}).join('')}</p>`

// GitHub README의 <img> SVG는 외부 글꼴을 못 불러옴 → 쓰인 글자만 잘라 base64로 박음
async function fontCss(chars) {
  try {
    // 브라우저처럼 요청해야 작은 woff2(가변 글꼴 한 벌)를 줌
    const res = await fetch(`https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&family=IBM+Plex+Sans+KR:wght@700&text=${encodeURIComponent(chars)}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } })
    if (!res.ok) throw new Error(`fonts.googleapis.com ${res.status}`)
    let css = await res.text()
    for (const src of new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]))) {
      const buf = Buffer.from(await (await fetch(src)).arrayBuffer())
      css = css.replaceAll(src, `data:application/octet-stream;base64,${buf.toString('base64')}`)
    }
    return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
  } catch (e) {
    console.warn(`글꼴을 못 박음, 시스템 글꼴로 대체: ${e.message}`)
    return ''
  }
}

const { GH_USER, GITHUB_TOKEN } = process.env
const d = GITHUB_TOKEN ? await fetchData(GH_USER, GITHUB_TOKEN) : DEMO
const cards = {
  header, stats, hours, 'projects-0': projectsHead,
  ...Object.fromEntries(CONFIG.projects.map((p, i) => [`projects-${i + 1}`, projectRow(p, i)])),
  ...(BANNER.image && { banner }),
}
const out = []
for (const [name, render] of Object.entries(cards))
  for (const [mode, t] of Object.entries(THEMES)) {
    const [h, body] = render(d, t)
    out.push([`assets/${name}-${mode}.svg`, svg(h, body)])
  }
const chars = [...new Set(out.map(([, s]) => s.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c))).join('').replace(/\s/g, ''))].join('') + ' '
const fonts = await fontCss(chars)
rmSync('assets', { recursive: true, force: true }) // 지운 프로젝트의 옛 이미지가 남지 않게
mkdirSync('assets')
for (const [file, s] of out) writeFileSync(file, s.replace('__FONTS__', s.includes('<text') ? fonts : ''))
// README의 <!-- 이름 --> … <!-- /이름 --> 사이를 다시 씀
const setBlock = (md, name, html) => {
  if (!md.includes(`<!-- /${name} -->`)) throw new Error(`README.md에 <!-- ${name} --> … <!-- /${name} --> 표시가 없음`)
  return md.replace(new RegExp(`<!-- ${name} -->[\\s\\S]*<!-- /${name} -->`), `<!-- ${name} -->\n${html}\n<!-- /${name} -->`)
}
let readme = readFileSync('README.md', 'utf8')
const { image, caption, credit } = BANNER, pic = picture('banner', caption || '배너 이미지')
readme = setBlock(readme, 'banner', !image ? '' : `<p>\n${credit ? `<a href="${esc(credit.url)}">\n${pic}\n</a>` : pic}\n</p>`)
readme = setBlock(readme, 'projects', projectsBlock())
writeFileSync('README.md', readme)
console.log(`${GITHUB_TOKEN ? `rendered for ${GH_USER}` : 'no GITHUB_TOKEN → demo data'} → ${out.length} files, fonts ${fonts ? 'embedded' : 'system'}`)
