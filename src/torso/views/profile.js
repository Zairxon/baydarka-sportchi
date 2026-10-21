import { state, save, today, replaceState, resetAll, diffDays } from '../store.js'
import { targets, ACTIVITY, GOALS, LEVELS, bmi } from '../calc.js'
import { buildPlan } from '../data/plans.js'
import { ARTICLES, SOURCES } from '../data/knowledge.js'
import { acts, ins, ctx, esc, num, r1, fmtNum, toast, ask, dd, ddVal, openSheet, closeSheet } from '../ui.js'
import { SUPPS, EV, SUPP_SOURCES } from '../data/supplements.js'
import { LOGO_SVG } from '../logo.js'
import { LANGS, getLang, tt } from '../i18n/core.js'
import { syncReminders, testSound, canNotify } from '../notify.js'
import { timeSel } from './sleep.js'
import { VERSION, RELEASES_URL, checkUpdate as checkUpd, updateInfo, updateBanner } from '../update.js'
import { bodyWeight, goalInfo, goalDirection } from '../calc.js'

let draft = null

function startDraft() {
  const p = state.profile
  draft = p ? { ...p } : { sex: 'm', age: '', height: '', weight: '', activity: 1.55, goal: 'gain', targetMin: 80, targetMax: 85, targetPace: 0.5, level: 'beginner', days: 3 }
}

function seg(field, items) {
  return `<div class="seg ${field === 'goal' ? 'goal-options' : ''}">${items.map(([v, t]) => `<button type="button" class="${String(draft[field]) === String(v) ? 'on' : ''}" data-a="setF" data-f="${field}" data-v="${v}">${t}</button>`).join('')}</div>`
}

const langPicker = () => `<div class="seg langs">${LANGS.map(([k, n]) => `<button type="button" class="${getLang() === k ? 'on' : ''}" data-a="setLang" data-v="${k}">${n}</button>`).join('')}</div>`

acts.setLang = ({ v }) => {
  if (document.getElementById('pf-age')) readInputs()
  state.lang = v
  try { localStorage.setItem('uzi-lang', v) } catch { /* без хранилища */ }
  save()
  document.documentElement.lang = ({ ru: 'ru', uz: 'uz-Cyrl', uzl: 'uz-Latn', en: 'en' })[v] || 'ru'
  syncReminders()
  ctx.render()
}

export function profileForm(first) {
  if (!draft) startDraft()
  const d = draft
  return `
  ${langPicker()}
  ${first ? `<div class="hero"><div class="logo">${LOGO_SVG}</div><h1>Здоровье</h1><p>Питание, тренировки и прогресс — в одном приложении. Ответьте на несколько вопросов, и я рассчитаю вашу норму калорий, БЖУ и составлю план тренировок.</p></div>` : '<h2>Профиль</h2>'}
  <div class="card">
    <label>Пол</label>${seg('sex', [['m', 'Мужчина'], ['f', 'Женщина']])}
    <div class="grid3">
      <label>Возраст<input id="pf-age" type="text" inputmode="numeric" value="${d.age}" placeholder="лет"/></label>
      <label>Рост<input id="pf-h" type="text" inputmode="decimal" value="${d.height}" placeholder="см"/></label>
      <label>Вес<input id="pf-w" type="text" inputmode="decimal" value="${d.weight}" placeholder="кг"/></label>
    </div>
    <label>Активность вне зала</label>
    ${dd('pf-act', ACTIVITY.map(a => [a.v, a.t]), d.activity)}
    <label>Цель</label>${seg('goal', Object.entries(GOALS).map(([k, g]) => [k, g.t.split(' / ')[0]]))}
    <div class="sub">${GOALS[d.goal].d}</div>
    ${d.goal === 'target' ? `<div class="grid3 mt"><label>От, кг<input id="pf-target-min" type="text" inputmode="decimal" value="${d.targetMin ?? 80}"/></label><label>До, кг<input id="pf-target-max" type="text" inputmode="decimal" value="${d.targetMax ?? 85}"/></label><label>Темп, кг/нед.<input id="pf-target-pace" type="number" inputmode="decimal" min="0.1" max="2" step="0.1" value="${d.targetPace ?? 0.5}"/></label></div><div class="sub">Можно указать свой темп от 0,1 до 2 кг/нед. Для защиты от чрезмерного дефицита приложение ограничивает калории; фактический срок может быть дольше желаемого. CDC указывает постепенный темп около 0,45–0,9 кг/нед. как более устойчивый для многих людей.</div>${num(d.targetPace) > 0.9 ? `<div class="sub warn-line">Темп выше 0,9 кг/нед. может быть чрезмерным. Приложение не будет создавать для него неограниченный дефицит.</div>` : ''}` : ''}
    <button class="btn full mt" data-a="saveProfile">${first ? 'Рассчитать и начать' : 'Сохранить'}</button>
  </div>`
}

acts.setF = ({ f, v }) => {
  readInputs()
  draft[f] = f === 'days' ? Number(v) : v
  ctx.render()
}

function readInputs() {
  const g = id => document.getElementById(id)
  if (!g('pf-age')) return
  draft.age = g('pf-age').value
  draft.height = g('pf-h').value
  draft.weight = g('pf-w').value
  draft.activity = Number(ddVal('pf-act'))
  draft.level = ddVal('pf-level')
  if (draft.goal === 'target') {
    draft.targetMin = g('pf-target-min')?.value ?? draft.targetMin ?? 80
    draft.targetMax = g('pf-target-max')?.value ?? draft.targetMax ?? 85
    draft.targetPace = num(g('pf-target-pace')?.value ?? draft.targetPace ?? 0.5)
  }
}

acts.saveProfile = async () => {
  readInputs()
  const age = num(draft.age), height = num(draft.height), weight = num(draft.weight)
  if (!(age >= 14 && age <= 90)) return toast('Возраст: от 14 до 90 лет')
  if (!(height >= 120 && height <= 230)) return toast('Рост в сантиметрах, например 178')
  if (!(weight >= 30 && weight <= 250)) return toast('Вес в килограммах, например 72,5')
  if (draft.goal === 'target') {
    const min = num(draft.targetMin), max = num(draft.targetMax)
    if (!(min >= 30 && max <= 250 && min < max)) return toast('Укажите диапазон: от 30 до 250 кг, нижняя граница меньше верхней')
    const pace = num(draft.targetPace)
    if (!(pace >= 0.1 && pace <= 2)) return toast('Темп должен быть от 0,1 до 2 кг в неделю')
    draft.targetMin = r1(min); draft.targetMax = r1(max); draft.targetPace = pace
  }
  const prev = state.profile
  state.profile = { ...draft, age, height, weight: r1(weight), kcalAdj: prev?.kcalAdj || 0 }
  if (!state.weights[today()] && (!prev || prev.weight !== r1(weight))) state.weights[today()] = r1(weight)
  if (!state.plan || !prev || prev.days !== draft.days || prev.level !== draft.level || prev.goal !== draft.goal || prev.targetMin !== draft.targetMin || prev.targetMax !== draft.targetMax) {
    if (!state.plan || !prev || true) {
      state.plan = buildPlan(state.profile.days, state.profile.level, targets(state.profile).goalDirection)
      state.planVer = 3
    }
  }
  if (!state.stepGoalCustom) state.stepGoal = goalInfo(state.profile.goal).steps
  draft = null
  save()
  toast('Готово')
  ctx.tab = prev ? 'profile' : 'today'
  ctx.render()
}

export function renderProfile() {
  const t = targets()
  const p = state.profile
  const w = state.weights[today()] || Object.values(state.weights).slice(-1)[0] || p.weight
  const summary = `<div class="card">
    <div class="row-h"><b>Ваши нормы</b><span class="sub">пересчитываются по текущему весу</span></div>
    <div class="stats3"><div><b>${t.kcal}</b><span>ккал</span></div><div><b>${t.protein}</b><span>белок, г</span></div><div><b>${t.fat} / ${t.carbs}</b><span>жиры / углев., г</span></div></div>
    <div class="srow"><span>Базовый обмен (BMR)</span><b>${t.bmr} ккал</b></div>
    <div class="srow"><span>Суточный расход (TDEE)</span><b>${t.tdee} ккал</b></div>
    <div class="srow"><span>Вода (всего, с едой)</span><b>≈ ${fmtNum(t.water / 1000)} л</b></div>
    <div class="srow"><span>ИМТ</span><b>${fmtNum(bmi(w, p.height))}</b></div>
    ${p.goal === 'target' ? `<div class="srow"><span>Целевой диапазон</span><b>${p.targetMin ?? 80}–${p.targetMax ?? 85} кг</b></div><div class="sub">${targets().goalDirection === 'cut' ? 'Снижение калорий рассчитано с умеренным дефицитом.' : targets().goalDirection === 'gain' ? 'Для достижения диапазона калорийность рассчитана с небольшим профицитом.' : 'Текущий вес находится в диапазоне; калорийность поддерживает его.'}</div>` : ''}
    ${p.kcalAdj ? `<div class="srow"><span>Ваша поправка калорий</span><span><b>${p.kcalAdj > 0 ? '+' : ''}${p.kcalAdj}</b> <button class="link" data-a="resetAdj">сбросить</button></span></div>` : ''}
  </div>`
  return summary + profileForm(false) + `
  <div class="card"><div class="row-h"><b>Звук напоминаний и виджет</b></div>
    <button class="chk ${state.voiceCfg.on ? 'on' : ''}" data-a="vcTog" data-k="on"><i>${state.voiceCfg.on ? '✓' : ''}</i>Мелодичный звук у напоминаний</button>
    <button class="chk ${state.voiceCfg.meals ? 'on' : ''}" data-a="vcTog" data-k="meals"><i>${state.voiceCfg.meals ? '✓' : ''}</i>Спрашивать, что ели на завтрак, обед и ужин</button>
    <label>Время завтрака</label>${timeSel('vc-b', state.voiceCfg.breakfast || '08:30')}
    <label>Время обеда</label>${timeSel('vc-l', state.voiceCfg.lunch)}
    <label>Время ужина</label>${timeSel('vc-d', state.voiceCfg.dinner)}
    <button class="btn ghost full" data-a="vcTest">🔔 Проверить звук</button>
    <div class="sub mt">Вода, сон, завтрак, обед, ужин и конец отдыха между подходами приходят уведомлением с мягким звуком-колокольчиком. Звук можно сменить в настройках телефона (Приложения → Torso → Уведомления). Виджеты воды и сна: долгое нажатие на главный экран → Виджеты → Torso.</div>
  </div>
  <div class="card"><div class="row-h"><b>Версия приложения</b><span class="sub" id="ver">${VERSION}</span></div>
    <div class="sub mb" id="verMsg">${updateInfo() ? `Доступна новая версия ${updateInfo().version}.` : 'Нажмите, чтобы узнать, вышла ли новая версия.'}</div>${updateBanner()}
    <button class="btn ghost full" data-a="checkUpdate">🔄 Проверить обновление</button>
    <a class="btn ghost full" href="${RELEASES_URL}" target="_blank" rel="noopener">⬇️ Страница загрузки</a>
  </div>
  <div class="card"><b>Данные</b>
    <div class="sub mb">Всё хранится только на этом телефоне. Сделайте копию, если меняете телефон. ${backupLine()}</div>
    <div class="row2"><button class="btn ghost" data-a="exportData">Скопировать копию</button><button class="btn ghost" data-a="importData">Восстановить</button></div>
    <button class="btn danger full" data-a="wipe">Удалить все данные</button>
  </div>
  <p class="sub center">Torso — справочное приложение, не медицинская рекомендация. При заболеваниях проконсультируйтесь с врачом.</p>`
}

acts.resetAdj = () => { state.profile.kcalAdj = 0; save(); ctx.render() }


// Когда делали копию — раз в неделю напоминаем (см. notify.js)
const backupLine = () => {
  const d = state.lastBackup
  if (!d) return 'Копию вы ещё не делали.'
  const n = diffDays(today(), d)
  return n <= 0 ? 'Последняя копия: сегодня.' : `Последняя копия: ${n} дн. назад.`
}

acts.checkUpdate = async () => {
  const msg = document.getElementById('verMsg')
  const set = s => { if (msg) msg.textContent = tt(s) }
  set('Проверяю…')
  const r = await checkUpd(true)
  if (r === 'new') return ctx.render()
  set(r === 'same' ? 'У вас последняя версия.' : 'Не удалось проверить: нет интернета.')
}

acts.exportData = async () => {
  const { ai, ...rest } = state // ключ ИИ в копию не попадает
  state.lastBackup = today()
  save()
  syncReminders()
  const text = JSON.stringify({ ...rest })
  try {
    await navigator.clipboard.writeText(text)
    toast('Копия в буфере обмена — вставьте её в заметки')
  } catch {
    openSheet(`<div class="sh-h"><b>Копия данных</b><button class="icon" data-a="closeSheet">✕</button></div><div class="sub">Выделите и скопируйте текст целиком.</div><textarea id="exp" readonly>${esc(text)}</textarea>`)
  }
}

acts.importData = () => {
  openSheet(`<div class="sh-h"><b>Восстановить данные</b><button class="icon" data-a="closeSheet">✕</button></div>
    <div class="sub">Вставьте ранее скопированный текст. Текущие данные будут заменены.</div>
    <textarea id="imp" placeholder="Вставьте сюда"></textarea>
    <button class="btn full" data-a="doImport">Восстановить</button>`)
}
acts.doImport = () => {
  try {
    const s = JSON.parse(document.getElementById('imp').value)
    if (!s || typeof s !== 'object' || !('weights' in s)) throw new Error('bad')
    s.ai = state.ai
    replaceState(s)
    closeSheet()
    toast('Данные восстановлены')
    ctx.render()
  } catch { toast('Не удалось прочитать данные') }
}

acts.wipe = async () => {
  if (!(await ask('Удалить все данные: профиль, питание, тренировки, вес? Это нельзя отменить.', 'Удалить всё', true))) return
  resetAll()
  draft = null
  ctx.tab = 'today'
  ctx.render()
}

export const resetDraft = () => { draft = null }

export function renderKnowledge() {
  // Добавки спортсменам-подросткам не предлагаем: только статьи.
  const tabs = ''
  return `<h2>Знания</h2>${tabs}
  <p class="sub mb">Коротко и по науке: что и почему работает.</p>
  ${goalCard()}
  ${ARTICLES.map(a => `<details class="card art"><summary>${esc(a.t)}</summary><div class="art-b">${a.b}</div></details>`).join('')}
  <details class="card art"><summary>Источники</summary><div class="art-b"><ul>${SOURCES.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div></details>`
}

function goalCard() {
  const g = goalInfo(state.profile.goal)
  return `<div class="card verdict ok"><div class="v-t">🎯 Ваша цель: ${esc(g.title)}</div><ul class="tips">${g.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="srow"><span>Цель по шагам</span><b>${(state.stepGoal || g.steps).toLocaleString('ru-RU')} в день</b></div></div>`
}

acts.ksub = ({ v }) => { ctx.ksub = v; ctx.render(); window.scrollTo(0, 0) }

function renderSupps() {
  const goal = goalDirection(state.profile)
  const w = bodyWeight()
  const goalName = { gain: 'набора мышц', cut: 'похудения', maintain: 'удержания веса' }[goal]
  const rel = s => s.goals.includes(goal) || (goal === 'maintain' && s.goals.includes('gain'))
  const order = [...SUPPS].sort((a, b) => (Number(rel(b)) - Number(rel(a))) || (a.ev < b.ev ? -1 : a.ev > b.ev ? 1 : 0))
  const card = s => {
    const on = state.supp.on.includes(s.id)
    const [evt, evc] = EV[s.ev]
    return `<div class="card supp">
      <div class="row-h"><b>${esc(s.n)}</b><span class="ev ${evc}">${evt}</span></div>
      ${rel(s) && s.ev !== 'C' ? `<div class="tag good">Подходит для вашей цели</div>` : ''}
      <p>${esc(s.what)}</p>
      ${s.dose !== '—' ? `<div class="srow"><span>Доза</span><span class="r">${esc(s.doseW ? s.doseW(w) : s.dose)}</span></div>` : ''}
      <p class="sub">${esc(s.note)}</p>
      <p class="sub">Источник: ${esc(s.src)}</p>
      ${s.ev !== 'C' ? `<button class="btn ${on ? '' : 'ghost'} full" data-a="toggleSupp" data-id="${s.id}">${on ? '✓ Принимаю (отмечать на главном экране)' : 'Принимаю'}</button>` : ''}
    </div>`
  }
  return `<div class="card verdict info"><div class="v-t">⚠️ Прежде чем покупать</div>
    <p>Добавки не заменяют еду, сон и тренировки. Для вашей цели (${goalName}) сначала проверьте калории, белок и сон. Покупайте продукты с независимой проверкой состава (знаки Informed Sport или NSF Certified for Sport), при болезнях, приёме лекарств, беременности и до 18 лет — только после врача.</p></div>
    ${order.map(card).join('')}
    <details class="card art"><summary>Источники</summary><div class="art-b"><ul>${SUPP_SOURCES.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div></details>`
}

acts.toggleSupp = ({ id }) => {
  const on = state.supp.on
  state.supp.on = on.includes(id) ? on.filter(x => x !== id) : [...on, id]
  save()
  ctx.render()
}

const saveVoice = () => { save(); syncReminders() }
acts.vcTog = ({ k }, el) => {
  state.voiceCfg[k] = !state.voiceCfg[k]
  el.classList.toggle('on', state.voiceCfg[k])
  el.querySelector('i').textContent = state.voiceCfg[k] ? '✓' : ''
  saveVoice()
}
const vcTime = key => ({ target }) => {
  const id = { breakfast: 'vc-b', lunch: 'vc-l', dinner: 'vc-d' }[key]
  const h = document.getElementById(id + '-h')?.dataset.value
  const m = document.getElementById(id + '-m')?.dataset.value
  if (h != null && m != null) { state.voiceCfg[key] = h + ':' + m; saveVoice() }
  void target
}
ins['vc-b-h'] = ins['vc-b-m'] = vcTime('breakfast')
ins['vc-l-h'] = ins['vc-l-m'] = vcTime('lunch')
ins['vc-d-h'] = ins['vc-d-m'] = vcTime('dinner')
acts.vcTest = async () => {
  if (!canNotify()) return toast('Звук работает в приложении на телефоне')
  toast((await testSound()) ? 'Звук придёт через пару секунд' : 'Не удалось проверить звук')
}
