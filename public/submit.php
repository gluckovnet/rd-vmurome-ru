<?php
/**
 * submit.php — принимает данные формы rd.vmurome.ru и создаёт сделку
 * (+ контакт, если указан телефон) в Concord CRM (cp.murom360.ru) через API.
 *
 * ВАЖНО: файл конфига с API-токеном лежит ВНЕ веб-корня
 * (../../rd-vmurome-secrets/config.php относительно этого файла),
 * чтобы токен не был доступен по прямому HTTP-запросу.
 *
 * Вложения (фото/видео) не грузятся в Concord (нет документированного
 * публичного API для этого) — сохраняются на этом сервере в uploads/
 * и передаются в CRM как прямые ссылки в описании сделки.
 *
 * Ограничение: этот скрипт работает ТОЛЬКО с CRM Concord и локальной
 * папкой uploads/, не трогает WordPress/БД/другие сайты на сервере.
 */

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '0'); // не светим ошибки пользователю

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Запрос к Concord CRM API. Возвращает [httpStatus, decodedBody] либо null при сетевой ошибке.
 */
function crmRequest(string $baseUrl, string $token, string $method, string $path, ?array $payload = null): ?array {
    $ch = curl_init(rtrim($baseUrl, '/') . $path);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT => 15,
    ];
    if ($payload !== null) {
        $opts[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_UNICODE);
    }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        error_log('rd.vmurome.ru submit.php: CRM request failed (' . $method . ' ' . $path . '): ' . $error);
        return null;
    }
    return ['status' => $status, 'body' => json_decode($raw, true), 'raw' => $raw];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'Method not allowed']);
}

// Конфиг с секретами — вне веб-корня
$configPath = __DIR__ . '/../../rd-vmurome-secrets/config.php';
if (!is_file($configPath)) {
    error_log('rd.vmurome.ru submit.php: config not found at ' . $configPath);
    respond(500, ['error' => 'Server misconfiguration']);
}
$config = require $configPath;

$crmBaseUrl = $config['crm_base_url'] ?? '';
$crmToken   = $config['crm_token'] ?? '';
$pipelineStageId = $config['default_stage_id'] ?? 1;

if ($crmBaseUrl === '' || $crmToken === '') {
    error_log('rd.vmurome.ru submit.php: crm_base_url or crm_token missing in config');
    respond(500, ['error' => 'Server misconfiguration']);
}

// --- Читаем данные формы (multipart/form-data) ---
$type      = trim((string)($_POST['type'] ?? 'complaint'));
$issue     = trim((string)($_POST['issue'] ?? ''));
$email     = trim((string)($_POST['email'] ?? ''));
$anonymous = ($_POST['anonymous'] ?? 'true') !== 'false';
$category  = trim((string)($_POST['category'] ?? ''));
$phoneRaw  = trim((string)($_POST['phone'] ?? ''));
$phone     = preg_replace('/\D/', '', $phoneRaw); // только цифры для поиска/хранения
$name      = trim((string)($_POST['name'] ?? ''));
$damageEstimate = trim((string)($_POST['damage_estimate'] ?? ''));
$medicalConsent = ($_POST['medical_consent'] ?? 'false') === 'true';

if ($issue === '') {
    respond(422, ['error' => 'Поле "issue" обязательно']);
}
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(422, ['error' => 'Некорректный email']);
}

// --- Человекочитаемые метки ---
$typeLabels = [
    'complaint'   => 'Жалоба',
    'news'        => 'Новость',
    'thanks'      => 'Благодарность',
    'job'         => 'Резюме/вакансия',
    'initiative'  => 'Инициатива',
    'cooperation' => 'Сотрудничество',
    'other'       => 'Другое',
];
// Диапазон -> [метка, представительная сумма для поля "amount" сделки]
$damageRanges = [
    'under_5k'  => ['label' => 'до 5 000 ₽',          'amount' => 2500],
    '5k_50k'    => ['label' => '5 000–50 000 ₽',      'amount' => 27500],
    '50k_500k'  => ['label' => '50 000–500 000 ₽',    'amount' => 275000],
    'over_500k' => ['label' => 'более 500 000 ₽',     'amount' => 500000],
];

$typeLabel = $typeLabels[$type] ?? 'Обращение';
$dealName = sprintf(
    '%s: %s',
    $typeLabel,
    mb_substr($issue, 0, 80) . (mb_strlen($issue) > 80 ? '…' : '')
);

// --- Собираем описание сделки со всеми деталями (без ссылок на файлы — их добавим после создания сделки) ---
$descriptionLines = [];
$descriptionLines[] = 'Тип обращения: ' . $typeLabel;
$descriptionLines[] = 'Текст обращения: ' . $issue;
$descriptionLines[] = 'Email: ' . $email;
$descriptionLines[] = 'Режим: ' . ($anonymous ? 'Анонимно' : 'С регистрацией');

if (!$anonymous) {
    if ($category !== '') {
        $descriptionLines[] = 'Категория: ' . $category;
    }
    if ($phoneRaw !== '') {
        $descriptionLines[] = 'Телефон: ' . $phoneRaw;
    }
    if ($name !== '') {
        $descriptionLines[] = 'Имя: ' . $name;
    }
}

$dealAmount = 0;
if ($type === 'complaint' && $damageEstimate !== '' && isset($damageRanges[$damageEstimate])) {
    $range = $damageRanges[$damageEstimate];
    $descriptionLines[] = 'Оценка ущерба (со слов заявителя): ' . $range['label'];
    $dealAmount = $range['amount'];
}

if ($medicalConsent) {
    $descriptionLines[] = 'Дано согласие на обработку данных о здоровье (ст. 10 152-ФЗ)';
}

$descriptionLines[] = '';
$descriptionLines[] = 'Источник: rd.vmurome.ru';

// --- Контакт: ищем по телефону, создаём если не найден (только для не-анонимных с телефоном) ---
$contactId = null;
if (!$anonymous && $phone !== '') {
    $search = crmRequest(
        $crmBaseUrl, $crmToken, 'GET',
        '/api/contacts?q=' . urlencode($phone) . '&search_fields=' . urlencode('phones.number:=') . '&per_page=1'
    );

    if ($search !== null && $search['status'] === 200 && !empty($search['body']['data'])) {
        $contactId = $search['body']['data'][0]['id'] ?? null;
    } else {
        $contactPayload = [
            'first_name' => $name !== '' ? $name : 'Без имени',
            'email'      => $email,
            'phones'     => [['number' => $phoneRaw, 'type' => 'mobile']],
        ];
        if (!empty($config['default_user_id'])) {
            $contactPayload['user_id'] = (int)$config['default_user_id'];
        }
        $created = crmRequest($crmBaseUrl, $crmToken, 'POST', '/api/contacts', $contactPayload);
        if ($created !== null && $created['status'] >= 200 && $created['status'] < 300) {
            $contactId = $created['body']['id'] ?? null;
        } else {
            error_log('rd.vmurome.ru submit.php: contact creation failed: ' . ($created['raw'] ?? 'no response'));
        }
    }
}

// --- Создаём сделку ---
// ВАЖНО: ресурс Deal в API Concord НЕ поддерживает поле "description"
// (подтверждено: его нет ни в create-, ни в retrieve-ответе, и оно не
// входит в список допустимых search_fields). Полное описание жалобы
// кладём отдельной Note, привязанной к сделке, сразу после её создания.
$dealPayload = [
    'name'     => $dealName,
    'stage_id' => $pipelineStageId,
];
if ($dealAmount > 0) {
    $dealPayload['amount'] = $dealAmount;
}
if (!empty($config['default_user_id'])) {
    $dealPayload['user_id'] = (int)$config['default_user_id'];
}
if ($contactId !== null) {
    $dealPayload['contacts'] = [$contactId];
}

$dealResult = crmRequest($crmBaseUrl, $crmToken, 'POST', '/api/deals', $dealPayload);

if ($dealResult === null) {
    respond(502, ['error' => 'Не удалось связаться с CRM']);
}
if ($dealResult['status'] < 200 || $dealResult['status'] >= 300) {
    error_log('rd.vmurome.ru submit.php: CRM returned ' . $dealResult['status'] . ': ' . $dealResult['raw']);
    respond(502, ['error' => 'CRM вернула ошибку', 'crm_status' => $dealResult['status']]);
}

$dealId = $dealResult['body']['id'] ?? null;

// --- Сохраняем вложения в папку, названную по ID сделки (uploads/{deal_id}/) ---
// Это делается ПОСЛЕ создания сделки, чтобы папка сразу была привязана
// к конкретному ID и не терялась в общей куче по датам.
$uploadedFileUrls = [];
if ($dealId !== null && !empty($_FILES['files']['name']) && is_array($_FILES['files']['name'])) {
    $maxFiles = 21;
    $allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'mp4', 'mov', 'webm', '3gp'];
    $maxFileSize = 50 * 1024 * 1024; // 50 МБ на файл

    // Структура: uploads/{год}/{месяц}/{deal_id}/ — по дате ЛЕГКО найти
    // все жалобы за период, а по deal_id — все файлы конкретной сделки.
    $uploadSubPath = date('Y/m') . '/' . $dealId;
    $uploadDirFs = __DIR__ . '/uploads/' . $uploadSubPath;
    if (!is_dir($uploadDirFs)) {
        mkdir($uploadDirFs, 0755, true);
    }

    // Сайт всегда отдаётся по https (nginx редиректит http -> https),
    // поэтому жёстко используем https независимо от $_SERVER['HTTPS']
    // (за прокси этот флаг не всегда доходит до PHP-FPM).
    $host = $_SERVER['HTTP_HOST'] ?? 'rd.vmurome.ru';
    $publicBaseUrl = 'https://' . $host . '/uploads/' . $uploadSubPath;

    $fileCount = count($_FILES['files']['name']);
    for ($i = 0; $i < $fileCount && count($uploadedFileUrls) < $maxFiles; $i++) {
        if (($_FILES['files']['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            continue;
        }
        $tmpPath = $_FILES['files']['tmp_name'][$i];
        $origName = (string)$_FILES['files']['name'][$i];
        $size = (int)($_FILES['files']['size'][$i] ?? 0);

        if ($size <= 0 || $size > $maxFileSize) {
            continue;
        }

        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExt, true)) {
            continue; // не тот тип файла — пропускаем молча
        }

        // Имя файла: порядковый номер + короткий случайный суффикс
        // (не нужен полноценный random_bytes(16), т.к. изоляция уже
        // обеспечена папкой uploads/{deal_id}/)
        $safeName = ($i + 1) . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
        $destFs = $uploadDirFs . '/' . $safeName;

        if (move_uploaded_file($tmpPath, $destFs)) {
            chmod($destFs, 0644);
            $uploadedFileUrls[] = $publicBaseUrl . '/' . $safeName;
        }
    }
}

// --- Собираем HTML-описание для Activity (поле description — rich text,
// значит переносы строк нужны как <br>, а ссылки на файлы делаем кликабельными) ---
$descriptionHtmlLines = array_map(
    fn($l) => htmlspecialchars($l, ENT_QUOTES, 'UTF-8'),
    $descriptionLines
);

if (!empty($uploadedFileUrls)) {
    $descriptionHtmlLines[] = '';
    $descriptionHtmlLines[] = 'Вложения (' . count($uploadedFileUrls) . '):';
    foreach ($uploadedFileUrls as $idx => $url) {
        $escapedUrl = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
        $descriptionHtmlLines[] = '<a href="' . $escapedUrl . '" target="_blank">Файл ' . ($idx + 1) . '</a> — ' . $escapedUrl;
    }
}

// --- Прикрепляем полное описание (+ ссылки на файлы) через Activity ---
// ВАЖНО: привязка заметки (Note) к сделке через via_resource/via_resource_id
// оказалась НЕНАДЁЖНОЙ — сделка не всегда получала associations_count > 0
// (проверено на нескольких реальных сделках). Ресурс Activity с явным
// массивом deals: [id] при создании привязывается гарантированно
// (подтверждено многократно), поэтому используем его вместо Note.
if ($dealId !== null) {
    $activityPayload = [
        'title'       => 'Обращение с сайта rd.vmurome.ru',
        'user_id'     => (int)($config['default_user_id'] ?? 5),
        'due_date'    => date('Y-m-d'),
        'description' => implode('<br>', $descriptionHtmlLines),
        'deals'       => [$dealId],
    ];
    if ($contactId !== null) {
        $activityPayload['contacts'] = [$contactId];
    }
    $activityResult = crmRequest($crmBaseUrl, $crmToken, 'POST', '/api/activities', $activityPayload);
    if ($activityResult === null || $activityResult['status'] < 200 || $activityResult['status'] >= 300) {
        error_log('rd.vmurome.ru submit.php: activity creation failed for deal ' . $dealId . ': ' . ($activityResult['raw'] ?? 'no response'));
        // не блокируем ответ пользователю — сделка уже создана
    }
}

respond(200, [
    'success'    => true,
    'deal_id'    => $dealId,
    'contact_id' => $contactId,
    'files'      => count($uploadedFileUrls),
    'url'        => null, // Concord не отдаёт публичную ссылку на сделку в API-ответе
]);
