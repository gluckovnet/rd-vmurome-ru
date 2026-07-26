# TASK-001 — ГОТОВО

**Дата:** 2026-07-26
**Статус:** Реализовано, ACCEPT пройден на проде

## Что сделано

| # | Пункт | Статус |
|---|-------|--------|
| 1 | Мок-submit заменён на `fetch()` к `/api/complaints` (FormData: issue, email, anonymous, category, phone, name, files[]) | ✅ |
| 2 | Хардкод WordPress category ID убран — в `<select id="category-select">` строковые ключи: `utility`, `utilities`, `legal`, `social`, `medical`, `infrastructure`, `unverified` | ✅ |
| 3 | СМС-модалка убрана полностью (DOM + JS). Телефон отправляется вместе с формой при регистрации | ✅ |
| 4 | `thank-link` теперь берёт `data.url` из ответа API вместо хардкода `mock-123`; если `url` не пришёл — блок скрыт | ✅ |

## Проверка

Локально: `python3 -m http.server 8080` из `public/` — страница открывается, три состояния (форма → спасибо) работают, submit вызывает `fetch` к `/api/complaints` (структура запроса видна в Network, реальный бэкенд не поднимался).

Прод (rd.vmurome.ru) уже отдавал идентичный файл (md5 local == md5 prod), доп. rsync не потребовался.

## ACCEPT RESULT

```bash
curl -s https://rd.vmurome.ru/ | grep -q '<!DOCTYPE html>' && echo "OK: HTML" || echo "FAIL: не HTML"
# → OK: HTML

curl -s https://rd.vmurome.ru/ | grep -q 'wp-' && echo "FAIL: остался WordPress" || echo "OK: чисто"
# → OK: чисто
```

Webmaster rd.vmurome.ru, 2026-07-26
