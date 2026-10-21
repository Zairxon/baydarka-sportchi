// В браузере нативных плагинов Capacitor нет: приложение работает как обычная веб-страница.
export const Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web' }
export const registerPlugin = () => null
