#!/usr/bin/env bash
# my-tasks.sh — сканер задач для WEBMASTER-а микро-проекта.
# Хук promptSubmit. Показывает новые задачи из tasks/.

TASKS_DIR="/home/webmaster/vs_code/rd.vmurome.ru/tasks"

echo "════════════════════════════════════════"
echo " ЗАДАЧИ WEBMASTER  ($(date '+%H:%M'))"
echo " проект: rd.vmurome.ru"
echo "════════════════════════════════════════"

new=0; rej=0

for f in "$TASKS_DIR"/*.md; do
  [ -e "$f" ] || continue
  case "$f" in *.done.md|*.reject.md|*/archive/*) continue ;; esac
  bn=$(basename "$f" .md)
  donef="${TASKS_DIR}/${bn}.done.md"
  rejf="${TASKS_DIR}/${bn}.reject.md"

  if [ -f "$rejf" ] && [ "$rejf" -nt "$donef" ] 2>/dev/null; then
    echo "🟠 ОТКЛОНЕНО  $bn — прочитай reject, переделай"
    rej=$((rej+1))
  elif [ -f "$donef" ]; then
    continue  # уже сделан, ждёт приёмки
  else
    echo "🟢 НОВАЯ ЗАДАЧА  $bn.md"
    new=$((new+1))
  fi
done

echo "────────────────────────────────────────"
echo " ИТОГО: 🟢 новые=$new  🟠 отклонены=$rej"

if [ $new -eq 0 ] && [ $rej -eq 0 ]; then
  echo " Нет активных задач. Жди указаний Главврача."
fi
echo
