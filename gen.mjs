// 프로필 카드 SVG 생성기. 의존성 0, Node 18+. 디자인: Omagari DESIGN.md
// 실행: GH_USER=아이디 GITHUB_TOKEN=토큰 node gen.mjs   (토큰 없으면 데모 데이터)
// 출력: assets/<카드>-light.svg, assets/<카드>-dark.svg, README.md의 배너 칸
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { extname } from 'node:path'
import { deflateSync } from 'node:zlib'

// ── 여기만 고치면 됨 ─────────────────────────────────────────
const CONFIG = {
  tagline: 'Jobless, but AX-ing everything',
  // 이미지 자리: 한국 시각 오전(0~11시)엔 am, 오후엔 pm 그림. Actions가 0시·12시에 다시 그림
  // image: 레포 안 이미지 경로(png·jpg·gif·webp). 840×height 카드에 꽉 차게 가운데 기준으로 잘림
  // caption: 아래 유리 패널 왼쪽 문구, credit: 패널 오른쪽 출처 (README에서 그림을 누르면 출처로 이동)
  banner: {
    height: 412, caption: 'She is my wife.',
    glass: 'liquid', // 아래 알약 패널 재질: 'frost'(서리 유리, 뒤가 흐림) | 'liquid'(리퀴드 글래스, 투명 + 가장자리 굴절)
    dispersion: 0.15, // liquid일 때 색수차 세기. 0 = 없음, 0.15 = 은은하게, 0.4 = 눈에 띄게
    credit: { text: '@030_bv', url: 'https://x.com/030_bv/status/2095118743928291753' }, // 두 그림 모두 이 게시물
    am: { image: 'images/banner-am.jpg' },
    pm: { image: 'images/banner-pm.jpg' },
  },
  // 프로젝트 카드 한 장에 한 줄씩, 이 순서대로
  // icon: 레포 안 이미지 경로(svg·png·jpg·webp). 비우면 이름 첫 글자를 넣음
  // status: 'active' | 'planned' | 'archived'. planned(회색 점)·archived(노란 점)는 배지가 붙고, planned는 아이콘이 흐려짐
  // url: 있으면 README에서 그 줄을 누르면 이동
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
const BANNER = { ...CONFIG.banner, ...CONFIG.banner[HALF], ...(process.env.GLASS && { glass: process.env.GLASS }),
  ...(process.env.DISPERSION && { dispersion: +process.env.DISPERSION }) }

const THEMES = {
  light: { card: '#ffffff', line: '#e0e0e0', divider: 'rgba(0,0,0,0.08)', dash: '#c7c7cc', chip: '#e8e8ed', ink: '#1d1d1f', sub: '#636366', link: '#0066cc', zero: '#d2d2d7', bar: '#d2d2d7', dim: 0,
    glassTop: 'rgba(255,255,255,0.5)', glassBot: 'rgba(255,255,255,0.22)', rim: 'rgba(255,255,255,0.65)', shine: 'rgba(255,255,255,0.9)', gsub: 'rgba(29,29,31,0.72)', liquid: 'rgba(255,255,255,0.3)', attention: '#9a6700' },
  // 다크는 GitHub 다크 테마 색에 맞춤: 카드 = 페이지 배경(#0d1117) + 테두리만 (라이트와 같은 방식)
  dark: { card: '#0d1117', line: '#3d444d', divider: '#262c36', dash: '#3d444d', chip: '#262c36', ink: '#f0f6fc', sub: '#9198a1', link: '#4493f8', zero: '#3d444d', bar: '#3d444d', dim: 0.08,
    glassTop: 'rgba(40,46,56,0.55)', glassBot: 'rgba(13,17,23,0.4)', rim: 'rgba(255,255,255,0.18)', shine: 'rgba(255,255,255,0.25)', gsub: 'rgba(240,246,252,0.72)', liquid: 'rgba(13,17,23,0.36)', attention: '#d29922' },
}
const OFFLINE = '#8e8e93'
const SANS = "'IBM Plex Sans KR',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif"
const MONO = "'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace"
const W = 840

const DEMO = {
  name: 'Your Name', login: 'yourname',
  stats: { Stars: 128, Commits: 1342, PRs: 87, Issues: 23, Repos: 34, Followers: 56 },
  langs: [['TypeScript', '#3178c6', 48], ['Python', '#3572A5', 22], ['Go', '#00ADD8', 12],
    ['Rust', '#dea584', 8], ['Shell', '#89e051', 6], ['CSS', '#663399', 4]]
    .map(([name, color, size]) => ({ name, color, size })),
  hours: [2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 8, 5, 1, 1, 7, 6, 8, 15, 15, 12, 1],
}

async function fetchData(login, token) {
  // ponytail: 레포 100개까지만 집계, 넘으면 페이지네이션 추가
  const query = `query($login:String!){user(login:$login){
    name login followers{totalCount}
    contributionsCollection{totalCommitContributions totalPullRequestContributions totalIssueContributions restrictedContributionsCount}
    repositories(first:100,ownerAffiliations:OWNER,isFork:false){totalCount nodes{stargazerCount
      languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}}}}}`
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
  const c = u.contributionsCollection, repos = u.repositories.nodes, langs = {}
  for (const r of repos)
    for (const { size, node } of r.languages.edges)
      (langs[node.name] ??= { name: node.name, color: node.color ?? OFFLINE, size: 0 }).size += size
  return {
    name: u.name || u.login, login: u.login,
    stats: {
      Stars: repos.reduce((s, r) => s + r.stargazerCount, 0),
      Commits: c.totalCommitContributions + c.restrictedContributionsCount, // 최근 1년
      PRs: c.totalPullRequestContributions,
      Issues: c.totalIssueContributions,
      Repos: u.repositories.totalCount,
      Followers: u.followers.totalCount,
    },
    langs: Object.values(langs).sort((a, b) => b.size - a.size),
    hours,
  }
}

// ── 글자 폭 추정 (IBM Plex Sans 기준 대략치) ──
const textW = (s, size) => [...s].reduce((w, ch) => w + size * (
  ch.charCodeAt(0) > 0x2e80 ? 0.9 : /[A-Z0-9@#%&]/.test(ch) ? 0.64 : /[ijlrtf.,:;'|!() ]/.test(ch) ? 0.3 : 0.54), 0)
const wrap = (s, maxW, size, maxLines) => {
  const lines = []
  for (const word of s.split(' ')) {
    const last = lines.at(-1)
    if (last !== undefined && textW(`${last} ${word}`, size) <= maxW) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  if (lines.length > maxLines) {
    let l = lines[maxLines - 1]
    while (l && textW(l + '…', size) > maxW) l = l.slice(0, -1)
    lines.length = maxLines
    lines[maxLines - 1] = l.trimEnd() + '…'
  }
  return lines
}

const esc = s => String(s).replace(/[&<>"]/g, ch => `&#${ch.charCodeAt(0)};`)
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif' }
const dataUri = p => `data:${MIME[extname(p).toLowerCase()] ?? 'image/png'};base64,${readFileSync(p).toString('base64')}`

const svg = (h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">
<style>__FONTS__text{font-family:${SANS}}.mono{font-family:${MONO}}.num{font-variant-numeric:tabular-nums}</style>
${body}
</svg>`
const card = (x, y, w, h, t, dashed) => `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="18" fill="${t.card}" stroke="${dashed ? t.dash : t.line}"${dashed ? ' stroke-dasharray="4 3"' : ''}/>`
const txt = (x, y, s, size, fill, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}"${extra}>${esc(s)}</text>`
const title = (x, y, s, t) => txt(x, y, s, 12, t.sub, ' font-weight="600"')

// ── 카드 (각각 [높이, 본문]을 돌려줌) ──
const header = (d, t) => [132, `${card(0, 0, W, 132, t)}
${txt(32, 62, d.name, 34, t.ink, ' font-weight="600"')}
${txt(32, 92, CONFIG.tagline, 15, t.sub)}
${txt(W - 32, 54, '@' + d.login, 13, t.link, ' class="mono" text-anchor="end"')}`]

// 가로 통계: 제목 없이 여섯 칸, 여섯 자리로 맞추고 앞에 채운 0은 연하게
const STATS = [['Commits', 'Commits (1y)'], ['Stars', 'Stars'], ['PRs', 'PRs'], ['Issues', 'Issues'], ['Repos', 'Repos'], ['Followers', 'Followers']]
const stats = (d, t) => {
  const cw = (W - 48 + 32) / STATS.length // 칸마다 좌우 16px 안쪽 여백까지 같은 폭
  return [102, card(0, 0, W, 102, t) + STATS.map(([k, name], i) => {
    const x = 8 + i * cw, n = String(d.stats[k]), pad = '0'.repeat(Math.max(0, 6 - n.length))
    return `${i ? `<line x1="${x}" y1="25" x2="${x}" y2="77" stroke="${t.divider}"/>` : ''}<text x="${x + 16}" y="51" font-size="28" font-weight="600" class="num" fill="${t.ink}"><tspan fill="${t.zero}">${pad}</tspan>${n}</text>${txt(x + 16, 72, name, 13, t.sub)}`
  }).join('\n')]
}

// 커밋하는 시간: 최근 커밋의 시간대 막대. 가장 많이 몰린 3시간을 진하게
const h12 = h => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
const hours = (d, t) => {
  const c = d.hours, max = Math.max(1, ...c), sum3 = i => c[i] + c[(i + 1) % 24] + c[(i + 2) % 24]
  let peak = 0
  for (let i = 1; i < 24; i++) if (sum3(i) > sum3(peak)) peak = i
  const end = (peak + 3) % 24
  const range = end > peak && (peak < 12) === (end < 12) ? `${peak % 12 || 12}–${h12(end)}` : `${h12(peak)}–${h12(end)}`
  const bw = (W - 48 - 23 * 8) / 24, note = `local time · last ${c.reduce((s, v) => s + v, 0)} commits`
  const bars = c.map((v, i) => {
    const h = Math.max(2, Math.round((v / max) * 80)), x = 24 + i * (bw + 8)
    return `<rect x="${x}" y="${136 - h}" width="${bw}" height="${h}" rx="${Math.min(5, h / 2)}" fill="${(i - peak + 24) % 24 < 3 ? t.ink : t.bar}"/>${i % 6 ? '' : txt(x, 155, String(i).padStart(2, '0'), 11, t.sub, ' class="num"')}`
  }).join('')
  return [184, `${card(0, 0, W, 184, t)}${title(24, 36, 'When I commit', t)}
${txt(W - 24, 36, note, 13, t.sub, ' text-anchor="end"')}${txt(W - 24 - textW(note, 13) - 8, 36, `Mostly ${range}`, 13, t.ink, ' font-weight="600" text-anchor="end"')}
${bars}`]
}

// ── 리퀴드 글래스 굴절 지도 (의존성 없이 PNG를 직접 만듦) ──
const crc32 = buf => {
  let c = ~0
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)) }
  return ~c >>> 0
}
const pngChunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]), len = Buffer.alloc(4), crc = Buffer.alloc(4)
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const png = (w, h, pixel) => { // pixel(x, y) → [r, g, b]
  const row = w * 3 + 1, raw = Buffer.alloc(row * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(pixel(x, y), y * row + 1 + x * 3)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2 // 8비트 RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))])
}
// 알약(w×h, 끝이 반원) 안의 점마다 "어디서 가져와 그릴지"를 R(가로)·G(세로)에 담음. 128 = 그대로.
// 가장자리에서 edge px 안쪽까지는 안쪽 방향으로 최대 shift px 당겨 와서 렌즈처럼 휘어 보이게 함
const LENS_SCALE = 32
const lensMap = (w, h, edge, shift) => {
  const r = h / 2, k = 2 // 2배 해상도로 만들어 부드럽게
  const buf = png(w * k, h * k, (X, Y) => {
    const x = (X + 0.5) / k, y = (Y + 0.5) / k
    const vx = x - Math.min(Math.max(x, r), w - r), vy = y - r, len = Math.hypot(vx, vy)
    const t = Math.max(0, 1 - Math.max(0, r - len) / edge), s = t * t * shift
    const dx = len ? (-vx / len) * s : 0, dy = len ? (-vy / len) * s : 0
    const ch = v => Math.max(0, Math.min(255, Math.round(255 * (0.5 + v / LENS_SCALE))))
    return [ch(dx), ch(dy), 128]
  })
  return `data:image/png;base64,${buf.toString('base64')}`
}

// 이미지 자리. 그림이 카드를 꽉 채우고, 아래에 알약 모양 유리 패널(문구·출처)을 띄움.
// SVG는 뒤를 흐리는 기능이 없어서, 패널 자리에 같은 그림을 한 번 더 깔고 필터로 유리처럼 만듦
const banner = (d, t) => {
  const { image, height: H = 412, caption, credit, glass, dispersion: k = 0 } = BANNER, liquid = glass === 'liquid'
  const ph = 40, r = ph / 2, px = 16, py = H - px - ph, pw = W - px * 2
  const pane = `x="${px}" y="${py}" width="${pw}" height="${ph}" rx="${r}"`
  // 서리 유리: 크게 흐림(사본을 키워 가장자리 흐림이 비지 않게).
  // 리퀴드: 거의 투명 + 진짜 굴절(feDisplacementMap). 필터 범위를 알약과 똑같이 두고 지도를 그 범위에
  // 꽉 채워서(feImage에 x/y를 안 줌) 브라우저마다 지도 위치가 어긋나지 않게 함
  const zoom = (s, cx = W / 2, cy = H / 2) => `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`
  // 색수차: 빨강은 (1+k)배, 파랑은 (1-k)배 더 휘게 따로 굴절시킨 뒤 색 채널끼리 합침. 가운데는 안 휘니 가장자리에만 색이 갈라짐
  const bend = (s, out) => `<feDisplacementMap in="SourceGraphic" in2="map" scale="${(LENS_SCALE * s).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="${out}"/>`
  const KEEP = ['1 0 0 0 0  0 0 0 0 0  0 0 0 0 0', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0'] // 빨강만·초록만·파랑만
  const only = (from, i, out) => `<feColorMatrix in="${from}" values="${KEEP[i]}  0 0 0 1 0" result="${out}"/>`
  const refract = k
    ? `${bend(1 + k, 'dr')}${bend(1, 'dg')}${bend(1 - k, 'db')}
${only('dr', 0, 'r')}${only('dg', 1, 'g')}${only('db', 2, 'b')}
<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>`
    : bend(1, 'bent')
  const filter = liquid
    ? `<filter id="glass" filterUnits="userSpaceOnUse" x="${px}" y="${py}" width="${pw}" height="${ph}" color-interpolation-filters="sRGB">
<feImage href="${lensMap(pw, ph, 16, 14)}" preserveAspectRatio="none" result="map"/>
${refract}
<feGaussianBlur stdDeviation="0.5"/><feColorMatrix type="saturate" values="1.35"/></filter>`
    : `<filter id="glass"><feGaussianBlur stdDeviation="12"/><feColorMatrix type="saturate" values="1.8"/></filter>`
  const copy = liquid ? '<use href="#art" filter="url(#glass)"/>' : `<use href="#art" filter="url(#glass)" transform="${zoom(1.08)}"/>`
  // 리퀴드는 가장자리를 따라 빛이 도는 테두리(왼쪽 위·오른쪽 아래가 밝음), 서리는 위쪽 반사선 한 줄
  const rim = liquid
    ? `<linearGradient id="rim" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.15"/><stop offset="0.65" stop-color="#fff" stop-opacity="0.1"/><stop offset="1" stop-color="#fff" stop-opacity="0.7"/></linearGradient>`
    : ''
  const tint = liquid ? t.liquid : 'url(#tint)'
  return [H, `${card(0, 0, W, H, t)}<defs>
<image id="art" href="${dataUri(image)}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
<clipPath id="bn"><rect width="${W}" height="${H}" rx="18"/></clipPath>
<clipPath id="pane"><rect ${pane}/></clipPath>
${filter}
<filter id="soft" x="-10%" y="-80%" width="120%" height="260%"><feGaussianBlur stdDeviation="8"/></filter>
<linearGradient id="tint" x2="0" y2="1"><stop offset="0" stop-color="${t.glassTop}"/><stop offset="1" stop-color="${t.glassBot}"/></linearGradient>${rim}
</defs>
<g clip-path="url(#bn)"><use href="#art"/>${t.dim ? `<rect width="${W}" height="${H}" fill="#000" opacity="${t.dim}"/>` : ''}
<rect x="${px}" y="${py + 6}" width="${pw}" height="${ph}" rx="${r}" fill="#000" opacity="${liquid ? 0.12 : 0.16}" filter="url(#soft)"/>
<g clip-path="url(#pane)">${copy}</g></g>
<rect x="${px + 0.5}" y="${py + 0.5}" width="${pw - 1}" height="${ph - 1}" rx="${r - 0.5}" fill="${tint}" stroke="${liquid ? 'url(#rim)' : t.rim}"${liquid ? ' stroke-width="1.2"' : ''}/>
${liquid ? '' : `<line x1="${px + r}" y1="${py + 1.5}" x2="${W - px - r}" y2="${py + 1.5}" stroke="${t.shine}"/>`}
${caption ? txt(px + 22, py + 25, caption, 15, t.ink, ' font-weight="600"') : ''}${credit ? txt(W - px - 22, py + 24, `Illustration · ${credit.text}`, 12, t.gsub, ' text-anchor="end"') : ''}
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="18" fill="none" stroke="${t.line}"/>`]
}

// 프로젝트 카드는 README에서 줄마다 다른 링크를 걸 수 있게 '제목 조각 + 줄 조각'으로 잘라 그림.
// 조각끼리 빈틈없이 이어 붙으면 카드 한 장처럼 보임. edge: 'top'은 위 모서리만, 'bottom'은 아래 모서리만 둥글게
const R = 18
const slice = (h, t, edge) => {
  const o = 0.5, r = R - o
  const fill = edge === 'top' ? `M0 ${h}V${R}A${R} ${R} 0 0 1 ${R} 0H${W - R}A${R} ${R} 0 0 1 ${W} ${R}V${h}Z`
    : edge === 'bottom' ? `M0 0V${h - R}A${R} ${R} 0 0 0 ${R} ${h}H${W - R}A${R} ${R} 0 0 0 ${W} ${h - R}V0Z`
      : `M0 0H${W}V${h}H0Z`
  const line = edge === 'top' ? `M${o} ${h}V${R}A${r} ${r} 0 0 1 ${R} ${o}H${W - R}A${r} ${r} 0 0 1 ${W - o} ${R}V${h}`
    : edge === 'bottom' ? `M${o} 0V${h - R}A${r} ${r} 0 0 0 ${R} ${h - o}H${W - R}A${r} ${r} 0 0 0 ${W - o} ${h - R}V0`
      : `M${o} 0V${h}M${W - o} 0V${h}`
  return `<path d="${fill}" fill="${t.card}"/><path d="${line}" fill="none" stroke="${t.line}"/>`
}
const projectsHead = (d, t) => [48, `${slice(48, t, 'top')}${title(24, 36, 'Projects - Veritas', t)}${txt(W - 24, 36, 'AX for everything', 12, t.sub, ' text-anchor="end"')}`]

// 줄 하나. 구분선은 아이콘 오른쪽부터. 배지: planned는 회색 빈 점, archived는 노란 빈 점
const BADGES = { planned: ['Planned', () => OFFLINE], archived: ['Archived', t => t.attention] }
const projectRow = (p, i, last) => (d, t) => {
  const h = last ? 80 : 72, cy = 36, iy = 16, planned = p.status === 'planned', badgeOf = BADGES[p.status]
  const bw = badgeOf ? Math.round(textW(badgeOf[0], 12) + 28) : 0, bx = W - 24 - bw
  const lx = p.lang ? (bw ? bx - 12 : bx) - textW(p.lang, 12) : bx // 언어 글자 시작점
  const icon = p.icon
    ? `<g opacity="${planned ? 0.6 : 1}"><clipPath id="ic"><rect x="24" y="${iy}" width="40" height="40" rx="11"/></clipPath><image href="${dataUri(p.icon)}" x="24" y="${iy}" width="40" height="40" preserveAspectRatio="xMidYMid slice" clip-path="url(#ic)"/><rect x="24.5" y="${iy + 0.5}" width="39" height="39" rx="11" fill="none" stroke="${t.line}"/></g>`
    : planned
      ? `<rect x="24.5" y="${iy + 0.5}" width="39" height="39" rx="11" fill="none" stroke="${t.dash}" stroke-dasharray="4 3"/>`
      : `<rect x="24" y="${iy}" width="40" height="40" rx="11" fill="${t.chip}"/>${txt(44, iy + 26, [...p.name][0].toUpperCase(), 17, t.ink, ' font-weight="600" text-anchor="middle"')}`
  const desc = wrap(p.desc ?? '', lx - (p.lang ? 14 : 0) - 16 - 80, 13, 1)[0] ?? ''
  const badge = badgeOf
    ? `<rect x="${bx + 0.5}" y="${cy - 9.5}" width="${bw - 1}" height="19" rx="9.5" fill="none" stroke="${t.line}"/><circle cx="${bx + 11}" cy="${cy}" r="2.25" fill="none" stroke="${badgeOf[1](t)}" stroke-width="1.5"/>${txt(bx + 20, cy + 4, badgeOf[0], 12, t.sub)}`
    : ''
  const lang = p.lang
    ? `<circle cx="${lx - 10}" cy="${cy}" r="4" fill="${d.langs.find(l => l.name === p.lang)?.color ?? t.sub}"/>${txt(lx, cy + 4, p.lang, 12, t.sub)}`
    : ''
  return [h, `${slice(h, t, last ? 'bottom' : 'mid')}${i ? `<line x1="80" y1="0.5" x2="${W - 24}" y2="0.5" stroke="${t.divider}"/>` : ''}${icon}
${txt(80, 31, p.name, 15, t.ink, ' font-weight="600"')}${txt(80, 51, desc, 13, t.sub)}
${lang}${badge}`]
}

// tight: 한 줄로 붙여 쓰고 align="top"을 줘서 그림 아래 글자 줄 틈이 안 생기게(조각 이어 붙이기용)
const picture = (name, alt, tight) => tight
  ? `<picture><source media="(prefers-color-scheme: dark)" srcset="assets/${name}-dark.svg"><img src="assets/${name}-light.svg" width="100%" align="top" alt="${esc(alt)}"></picture>`
  : `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/${name}-dark.svg">
  <img src="assets/${name}-light.svg" width="100%" alt="${esc(alt)}">
</picture>`
const projectsBlock = () => `<p>${picture('projects-0', 'Projects - Veritas', true)}${CONFIG.projects.map((p, i) => {
  const pic = picture(`projects-${i + 1}`, p.name, true)
  return p.url ? `<a href="${esc(p.url)}">${pic}</a>` : pic
}).join('')}</p>`

// GitHub README의 <img> SVG는 외부 글꼴을 못 불러옴 → 쓰인 글자만 잘라 base64로 박음
async function fontCss(chars) {
  try {
    const res = await fetch(`https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=IBM+Plex+Sans+KR:wght@400;600&text=${encodeURIComponent(chars)}`)
    if (!res.ok) throw new Error(`fonts.googleapis.com ${res.status}`)
    let css = await res.text()
    for (const [, src] of css.matchAll(/url\((https:[^)]+)\)/g)) {
      const buf = Buffer.from(await (await fetch(src)).arrayBuffer())
      css = css.replace(src, `data:application/octet-stream;base64,${buf.toString('base64')}`)
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
  ...Object.fromEntries(CONFIG.projects.map((p, i, all) => [`projects-${i + 1}`, projectRow(p, i, i === all.length - 1)])),
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
