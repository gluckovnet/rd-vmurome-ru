# rd.vmurome.ru — Точка входа (Радар)

- **Тип:** микро-проект (статический PWA)
- **Домен:** rd.vmurome.ru
- **Стек:** HTML + CSS + JS (vanilla, один файл index.html)
- **Смысл:** форма обратной связи (жалобы/новости) → API CRM
- **Хостинг:** nginx (FastPanel2), сервер 172.22.14.66
- **SSL:** wildcard *.vmurome.ru покрывает
- **Модель:** Главврач → Webmaster (лечащий-исполнитель, без архи, без врачей)

## Связка доменов

| Домен | Что |
|---|---|
| rd.vmurome.ru | Точка входа (этот проект) — статический PWA |
| radar33.ru | Форум (WordPress, отдельный проект) |
| vmurome.ru | Основной сайт (Astro SSR, отдельный проект) |

## Структура

```
rd.vmurome.ru/
├── public/              ← HTML/CSS/JS (index.html + manifest + иконки)
├── deploy/              ← nginx конфиг + инструкция деплоя
├── tasks/               ← задачи от главврача
│   └── archive/
└── .kiro/
    ├── steering/        ← роль, план, опыт, приветствие
    ├── hooks/           ← сканер задач
    └── my-tasks.sh      ← скрипт сканера
```

## Как работает лечащий

1. При `+` сканер показывает задачи из `tasks/`
2. `python3 -m http.server 8080` из `public/` — локальный просмотр
3. Правит `public/index.html`
4. `rsync -avz public/ prod:/var/www/rd.vmurome.ru/` — деплой
5. Кладёт `.done.md` → главврач проверяет → принимает/отклоняет

## Статус

Этап 2 из 4 — доделать визитку (см. .kiro/steering/PLAN.md).
