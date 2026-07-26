# Деплой rd.vmurome.ru

## Прод

- Сервер: 172.22.14.66
- Юзер: www-vmurome (алиас `prod` уже настроен)
- Путь: `prod:www/rd.vmurome.ru/` → `/var/www/www-vmurome/data/www/rd.vmurome.ru/`
- SSL: отдельный сертификат (управляется FastPanel)

## Первый деплой

```bash
# Создать директорию на проде
ssh prod 'mkdir -p www/rd.vmurome.ru'

# Залить статику
rsync -avz public/ prod:www/rd.vmurome.ru/

# Проверить что файлы на месте
ssh prod 'ls -la www/rd.vmurome.ru/'
```

## Последующие деплои

```bash
rsync -avz public/ prod:www/rd.vmurome.ru/
```

## nginx

Конфиг управляется FastPanel. Nginx уже настроен на прямую раздачу статики
из `/var/www/www-vmurome/data/www/rd.vmurome.ru/`.

Лечащий НЕ трогает nginx. Только rsync статики.
