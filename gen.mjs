// 프로필 카드 SVG 생성기. 의존성 0, Node 18+. 디자인: Omagari DESIGN.md
// 실행: GH_USER=아이디 GITHUB_TOKEN=토큰 node gen.mjs   (토큰 없으면 데모 데이터)
// 출력: assets/<카드>-light.svg, assets/<카드>-dark.svg, README.md의 배너 칸
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { extname } from 'node:path'

// ── 여기만 고치면 됨 ─────────────────────────────────────────
const CONFIG = {
  tagline: 'Jobless, but AX-ing everything',
  // 이미지 자리: 한국 시각 오전(0~11시)엔 am, 오후엔 pm 그림. Actions가 0시·12시에 다시 그림
  // image: 레포 안 이미지 경로(png·jpg·gif·webp). 840×height 카드에 꽉 차게 가운데 기준으로 잘림
  // caption: 그림 아래 띠 왼쪽 문구, credit: 띠 오른쪽 출처 (README에서 그림을 누르면 출처로 이동)
  banner: {
    height: 360, caption: 'She is my wife.',
    am: { image: 'images/banner-am.jpg', credit: null },
    pm: { image: 'images/banner-pm.jpg', credit: { text: '@030_bv', url: 'https://x.com/030_bv/status/2095118743928291753' } },
  },
  // 프로젝트 카드 한 장에 한 줄씩, 이 순서대로
  // icon: 레포 안 이미지 경로(svg·png·jpg·webp). 비우면 이름 첫 글자를 넣음
  // status: 'active' | 'planned'. planned만 Planned 배지가 붙고 아이콘이 흐려짐
  projects: [
    { name: 'omagari', desc: 'AX for teams', lang: 'TypeScript', status: 'active', icon: 'icons/omagari.svg' },
    { name: 'kagami', desc: 'AX for focused work', lang: 'TypeScript', status: 'active', icon: 'icons/kagami.svg' },
    { name: 'konuri', desc: 'AX for …', status: 'planned', icon: 'icons/konuri.svg' },
    { name: 'otose', desc: 'AX for …', status: 'planned', icon: 'icons/otose.svg' },
    { name: 'akeboshi', desc: 'AX for …', status: 'planned', icon: 'icons/akeboshi.svg' },
  ],
}
// ─────────────────────────────────────────────────────────────

// 지금이 한국 시각 오전이면 am, 오후면 pm 그림. BANNER=am|pm 으로 강제할 수 있음(미리보기용)
const HALF = process.env.BANNER || (new Date(Date.now() + 9 * 3600e3).getUTCHours() < 12 ? 'am' : 'pm')
const BANNER = { ...CONFIG.banner, ...CONFIG.banner[HALF] }

const THEMES = {
  light: { card: '#ffffff', line: '#e0e0e0', divider: 'rgba(0,0,0,0.08)', dash: '#c7c7cc', chip: '#e8e8ed', ink: '#1d1d1f', sub: '#636366', link: '#0066cc', zero: '#d2d2d7', bar: '#d2d2d7', dim: 0 },
  // 다크는 GitHub 다크 테마 색에 맞춤: 카드 = 페이지 배경(#0d1117) + 테두리만 (라이트와 같은 방식)
  dark: { card: '#0d1117', line: '#3d444d', divider: '#262c36', dash: '#3d444d', chip: '#262c36', ink: '#f0f6fc', sub: '#9198a1', link: '#4493f8', zero: '#3d444d', bar: '#3d444d', dim: 0.08 },
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

// 이미지 자리. 그림 아래에 카드 색 띠(문구·출처)를 붙여 라이트·다크 모두 다른 카드와 맞춤
const banner = (d, t) => {
  const { image, height: IH = 360, caption, credit } = BANNER
  const H = IH + (caption || credit ? 52 : 0)
  return [H, `${card(0, 0, W, H, t)}<clipPath id="bn"><rect width="${W}" height="${H}" rx="18"/></clipPath>
<g clip-path="url(#bn)"><image href="${dataUri(image)}" width="${W}" height="${IH}" preserveAspectRatio="xMidYMid slice"/>${t.dim ? `<rect width="${W}" height="${IH}" fill="#000" opacity="${t.dim}"/>` : ''}</g>
${H > IH ? `<line x1="0" y1="${IH + 0.5}" x2="${W}" y2="${IH + 0.5}" stroke="${t.line}"/>` : ''}${caption ? txt(24, IH + 31, caption, 15, t.ink, ' font-weight="600"') : ''}${credit ? txt(W - 24, IH + 30, `Illustration · ${credit.text}`, 12, t.sub, ' text-anchor="end"') : ''}
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="18" fill="none" stroke="${t.line}"/>`]
}

// 프로젝트 카드 한 장. 줄 사이 구분선은 아이콘 오른쪽부터
const projects = (d, t) => {
  const H = 48 + CONFIG.projects.length * 72 + 8
  return [H, `${card(0, 0, W, H, t)}${title(24, 36, 'Projects - Veritas', t)}${txt(W - 24, 36, 'AX for everything', 12, t.sub, ' text-anchor="end"')}\n` + CONFIG.projects.map((p, i) => {
    const top = 48 + i * 72, cy = top + 36, iy = top + 16, planned = p.status === 'planned'
    const bw = planned ? Math.round(textW('Planned', 12) + 28) : 0, bx = W - 24 - bw // 배지는 예정에만
    const lx = p.lang ? (bw ? bx - 12 : bx) - textW(p.lang, 12) : bx // 언어 글자 시작점
    const icon = p.icon
      ? `<g opacity="${planned ? 0.6 : 1}"><clipPath id="ic${i}"><rect x="24" y="${iy}" width="40" height="40" rx="11"/></clipPath><image href="${dataUri(p.icon)}" x="24" y="${iy}" width="40" height="40" preserveAspectRatio="xMidYMid slice" clip-path="url(#ic${i})"/><rect x="24.5" y="${iy + 0.5}" width="39" height="39" rx="11" fill="none" stroke="${t.line}"/></g>`
      : planned
        ? `<rect x="24.5" y="${iy + 0.5}" width="39" height="39" rx="11" fill="none" stroke="${t.dash}" stroke-dasharray="4 3"/>`
        : `<rect x="24" y="${iy}" width="40" height="40" rx="11" fill="${t.chip}"/>${txt(44, iy + 26, [...p.name][0].toUpperCase(), 17, t.ink, ' font-weight="600" text-anchor="middle"')}`
    const desc = wrap(p.desc ?? '', lx - (p.lang ? 14 : 0) - 16 - 80, 13, 1)[0] ?? ''
    const badge = planned
      ? `<rect x="${bx + 0.5}" y="${cy - 9.5}" width="${bw - 1}" height="19" rx="9.5" fill="none" stroke="${t.line}"/><circle cx="${bx + 11}" cy="${cy}" r="2.25" fill="none" stroke="${OFFLINE}" stroke-width="1.5"/>${txt(bx + 20, cy + 4, 'Planned', 12, t.sub)}`
      : ''
    const lang = p.lang
      ? `<circle cx="${lx - 10}" cy="${cy}" r="4" fill="${d.langs.find(l => l.name === p.lang)?.color ?? t.sub}"/>${txt(lx, cy + 4, p.lang, 12, t.sub)}`
      : ''
    return `${i ? `<line x1="80" y1="${top + 0.5}" x2="${W - 24}" y2="${top + 0.5}" stroke="${t.divider}"/>` : ''}${icon}
${txt(80, top + 31, p.name, 15, t.ink, ' font-weight="600"')}${txt(80, top + 51, desc, 13, t.sub)}
${lang}${badge}`
  }).join('\n')]
}

const picture = (name, alt) => `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/${name}-dark.svg">
  <img src="assets/${name}-light.svg" width="100%" alt="${esc(alt)}">
</picture>`

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
const cards = { header, stats, hours, projects, ...(BANNER.image && { banner }) }
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
writeFileSync('README.md', readme)
console.log(`${GITHUB_TOKEN ? `rendered for ${GH_USER}` : 'no GITHUB_TOKEN → demo data'} → ${out.length} files, fonts ${fonts ? 'embedded' : 'system'}`)
