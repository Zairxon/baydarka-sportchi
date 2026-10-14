// Локальное хранилище (всё, что нужно для работы без сети). Ключи с префиксом bs2_.
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem('bs2_' + k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set(k, v) { try { localStorage.setItem('bs2_' + k, JSON.stringify(v)) } catch { /* память переполнена — работаем без кэша */ } },
  del(k) { try { localStorage.removeItem('bs2_' + k) } catch { /* нечего удалять */ } },
  wipe() { try { Object.keys(localStorage).filter(k => k.startsWith('bs2_') && k !== 'bs2_theme').forEach(k => localStorage.removeItem(k)) } catch { /* нечего удалять */ } },
}
