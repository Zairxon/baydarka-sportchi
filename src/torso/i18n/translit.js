// Узбекская кириллица → латиница (официальный алфавит 1995/2021)
const MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: 'ʼ', ь: '', ы: 'i', э: 'e', ю: 'yu', я: 'ya',
  ў: 'oʻ', қ: 'q', ғ: 'gʻ', ҳ: 'h',
}
const VOWELS = 'аеёиоуэюяўыАЕЁИОУЭЮЯЎЫ'

export function cyrToLatin(s) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    const low = ch.toLowerCase()
    if (!(low in MAP)) { out += ch; continue }
    let r = MAP[low]
    // «е» в начале слова и после гласной — ye
    if (low === 'е') {
      const prev = s[i - 1]
      if (!prev || !/[А-Яа-яЁёЎўҚқҒғҲҳ]/.test(prev) || VOWELS.includes(prev)) r = 'ye'
    }
    if (low === 'ц') r = /[А-Яа-я]/.test(s[i - 1] || '') && /[А-Яа-я]/.test(s[i + 1] || '') ? 'ts' : 'ts'
    if (ch !== low) r = r.length > 1 ? r[0].toUpperCase() + r.slice(1) : r.toUpperCase()
    out += r
  }
  return out
}
