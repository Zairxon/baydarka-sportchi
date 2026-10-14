# Baydarka · Sportchi

Приложение спортсмена (PWA, чистый JS + Vite). Данные: Supabase-проект «Baydarka» (функции `athlete_*`).
Оформление — как у приложений «Митти юрак»; логика зала — из Торсо; план и результаты — из «Главного» (Baydarka).

- Отделы: Suv (вода), Zal (зал), Quruqlik (имитация на суше, тренажёр), OFP, O'yin (футбол).
- `npm run dev`, `npm test`, `npm run build`. Деплой — GitHub Pages при пуше в `main`.
- Каталог упражнений: `node scripts/make-catalog.mjs` (из справочника Байдарки). Иконки: `node scripts/gen-icons.mjs`.
