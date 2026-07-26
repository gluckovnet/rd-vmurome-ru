# TASK-002: Добивка визуала (ТЗ)

**От:** Главврач
**Кому:** Webmaster anon.vmurome.ru
**Дата:** 2026-07-25
**Приоритет:** NORMAL

## Что сделать

Довести визуал до ТЗ. Без API. Править public/index.html.

## Правки

1. Камера: accept="image/*,video/*", подпись «Прикрепить фото/видео», превью видео с иконкой треугольника
2. Индикатор в футере: «Анонимно» / «Режим регистрации» (мелкий серый текст)
3. Кнопка камеры крупнее: aspect-ratio 1/1, иконка 48-56px
4. Подпись под email: «Куда прислать результат?» (серый, 12px)
5. Страница «Спасибо»: два варианта текста (аноним / зарегистрирован)
6. Тост-уведомления (зелёный/красный, авто-скрытие 4 сек) вместо alert
7. Иконки PWA цветные (красный квадрат с белой V)

## ACCEPT

```bash
grep -q 'video' /home/webmaster/vs_code/vmurome.ru/anon.vmurome.ru/public/index.html && grep -q 'Анонимно' /home/webmaster/vs_code/vmurome.ru/anon.vmurome.ru/public/index.html && grep -q 'Куда прислать' /home/webmaster/vs_code/vmurome.ru/anon.vmurome.ru/public/index.html && echo "PASS"
```
