'use strict';

const formView = document.getElementById('form-view');
const thankView = document.getElementById('thank-view');
const issueEl = document.getElementById('issue');
const cameraInput = document.getElementById('camera-input');
const previewsEl = document.getElementById('previews');
const fileCounter = document.getElementById('file-counter');
const emailEl = document.getElementById('email');
const consentEl = document.getElementById('consent');
const medicalConsentEl = document.getElementById('medical-consent');
const expMedicalConsent = document.getElementById('expandable-medical-consent');
const categorySelectEl = document.getElementById('category-select');
const typeSelectEl = document.getElementById('type-select');
const issueLabelEl = document.getElementById('issue-label');
const categoryFieldEl = document.getElementById('category-field');
const registerRadarLabelEl = document.getElementById('register-radar-label');
const damageFieldEl = document.getElementById('damage-field');
const damageSelectEl = document.getElementById('damage-select');
const phoneEl = document.getElementById('phone');
const registerCheck = document.getElementById('register-radar');
const nameEl = document.getElementById('name');
const submitBtn = document.getElementById('submit-btn');
const submitText = document.getElementById('submit-text');
const submitSpinner = document.getElementById('submit-spinner');

const footerMode = document.getElementById('footer-mode');
const thankMsg = document.getElementById('thank-msg');
const thankLink = document.getElementById('thank-link');

const expRegister = document.getElementById('expandable-register');

// File handling
let files = [];

function updatePreviews() {
  previewsEl.innerHTML = '';
  files.forEach((f, i) => {
    const isVideo = f.type.startsWith('video/');
    const url = URL.createObjectURL(f);
    const div = document.createElement('div');
    div.className = 'preview-item';
    if (isVideo) {
      div.innerHTML = '<video src="' + url + '" muted></video><div class="play-icon"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19"/></svg></div><button class="del" data-idx="' + i + '">&times;</button>';
    } else {
      div.innerHTML = '<img src="' + url + '" alt="preview"><button class="del" data-idx="' + i + '">&times;</button>';
    }
    previewsEl.appendChild(div);
  });
  if (files.length > 0) {
    fileCounter.classList.remove('hidden');
    fileCounter.textContent = files.length + '/21';
  } else {
    fileCounter.classList.add('hidden');
  }
  previewsEl.querySelectorAll('.del').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(btn.dataset.idx);
      files.splice(idx, 1);
      updatePreviews();
    });
  });
}

var MAX_FILE_SIZE = 999 * 1024 * 1024; // 999 МБ — подтверждено на сервере (upload_max_filesize/post_max_size)

cameraInput.addEventListener('change', function() {
  var incoming = Array.from(cameraInput.files || []);
  var remaining = 21 - files.length;

  var tooBig = incoming.filter(function(f) { return f.size > MAX_FILE_SIZE; });
  var okFiles = incoming.filter(function(f) { return f.size <= MAX_FILE_SIZE; });

  if (tooBig.length > 0) {
    showToast('Файл слишком большой (макс. 999 МБ): ' + tooBig.map(function(f) { return f.name; }).join(', '), 'error');
  }

  files = files.concat(okFiles.slice(0, remaining));
  cameraInput.value = '';
  updatePreviews();
});

// Phone mask (no expandable trigger)
phoneEl.addEventListener('input', function() {
  var val = phoneEl.value.replace(/\D/g, '');
  if (val.length === 0) { phoneEl.value = ''; updateExpandables(); return; }
  if (val[0] !== '7') val = '7' + val.replace(/^[78]/, '');
  val = val.slice(0, 11);
  var formatted = '+7';
  if (val.length > 1) formatted += ' (' + val.slice(1, Math.min(4, val.length));
  if (val.length >= 5) formatted += ') ' + val.slice(4, Math.min(7, val.length));
  if (val.length >= 8) formatted += '-' + val.slice(7, Math.min(9, val.length));
  if (val.length >= 10) formatted += '-' + val.slice(9, Math.min(11, val.length));
  phoneEl.value = formatted;
});

// Expandables: register checkbox → phone + name + categories
function updateExpandables() {
  var emailLabel = document.querySelector('label[for="email"]');
  if (registerCheck.checked) {
    expRegister.classList.remove('collapsed');
    expRegister.style.maxHeight = expRegister.scrollHeight + 'px';
    footerMode.textContent = 'Режим регистрации';
    submitText.textContent = 'Отправить обращение';
    emailLabel.innerHTML = 'Email <span style="color:var(--red)">*</span>';
  } else {
    expRegister.classList.add('collapsed');
    expRegister.style.maxHeight = '0px';
    phoneEl.value = '';
    nameEl.value = '';
    footerMode.textContent = 'Анонимно';
    submitText.textContent = 'Отправить анонимно';
    emailLabel.textContent = 'Email (необязательно)';
  }
  updateSubmitState();
}

registerCheck.addEventListener('change', updateExpandables);

// Тип обращения → меняет подпись textarea, видимость категорий, текст согласия на регистрацию
var TYPE_CONFIG = {
  complaint: {
    issuePlaceholder: 'Яма на Ленина, 5',
    issueLabel: 'Опишите ситуацию',
    showCategory: true,
    showDamage: true,
    registerLabel: 'Хочу указать свои данные для обратной связи'
  },
  news: {
    issuePlaceholder: 'Расскажите новость: что, где, когда',
    issueLabel: 'Расскажите новость',
    showCategory: false,
    showDamage: false,
    registerLabel: 'Хочу указать свои данные для публикации в редакции'
  },
  thanks: {
    issuePlaceholder: 'Кого и за что хотите поблагодарить',
    issueLabel: 'Кому благодарность',
    showCategory: false,
    showDamage: false,
    registerLabel: 'Хочу указать свои данные для публикации в редакции'
  },
  job: {
    issuePlaceholder: 'Расскажите о себе или о вакансии',
    issueLabel: 'Резюме / рабочее место',
    showCategory: false,
    showDamage: false,
    registerLabel: 'Хочу оставить контакты для связи по вакансии'
  },
  other: {
    issuePlaceholder: 'Инициатива, предложение сотрудничества или другое обращение',
    issueLabel: 'Опишите обращение',
    showCategory: false,
    showDamage: false,
    registerLabel: 'Хочу указать свои данные для публикации в редакции'
  }
};

function updateTypeUI() {
  var cfg = TYPE_CONFIG[typeSelectEl.value] || TYPE_CONFIG.complaint;
  issueEl.placeholder = cfg.issuePlaceholder;
  issueLabelEl.textContent = cfg.issueLabel;
  registerRadarLabelEl.textContent = cfg.registerLabel;

  if (cfg.showCategory) {
    categoryFieldEl.classList.remove('hidden');
  } else {
    categoryFieldEl.classList.add('hidden');
    categorySelectEl.value = '';
    updateMedicalConsent();
  }

  if (cfg.showDamage) {
    damageFieldEl.classList.remove('hidden');
  } else {
    damageFieldEl.classList.add('hidden');
    damageSelectEl.value = '';
  }

  // Обновляем текст кнопки при смене типа (если чекбокс регистрации включён)
  if (registerCheck.checked) {
    submitText.textContent = 'Отправить обращение';
  }
}

typeSelectEl.addEventListener('change', updateTypeUI);

// Medical category → показать доп. согласие на спецкатегорию ПД (ст. 10 152-ФЗ)
function updateMedicalConsent() {
  var isMedical = categorySelectEl.value === 'medical';
  if (isMedical) {
    expMedicalConsent.classList.remove('collapsed');
    expMedicalConsent.style.maxHeight = expMedicalConsent.scrollHeight + 'px';
  } else {
    expMedicalConsent.classList.add('collapsed');
    expMedicalConsent.style.maxHeight = '0px';
    medicalConsentEl.checked = false;
  }
  updateSubmitState();
}

categorySelectEl.addEventListener('change', updateMedicalConsent);
medicalConsentEl.addEventListener('change', updateSubmitState);

// Email необязателен при анонимной отправке.
// Но если юзер отмечает "Хочу указать свои данные" (registerCheck) — email обязателен.
function isEmailValid() {
  if (registerCheck.checked) {
    // Email обязателен при регистрации
    return emailEl.value.indexOf('@') > -1 && emailEl.value.indexOf('.') > -1;
  }
  // Анонимно — email можно не указывать, но если указал, должен быть валидным
  if (!emailEl.value) return true;
  return emailEl.value.indexOf('@') > -1 && emailEl.value.indexOf('.') > -1;
}

// Описание обязательно, минимум несколько слов (не просто пара символов)
var MIN_ISSUE_WORDS = 3;
function isIssueValid() {
  var words = issueEl.value.trim().split(/\s+/).filter(function(w) { return w.length > 0; });
  return words.length >= MIN_ISSUE_WORDS;
}

// Submit state
function updateSubmitState() {
  var medicalOk = categorySelectEl.value !== 'medical' || medicalConsentEl.checked;
  submitBtn.disabled = !(isIssueValid() && isEmailValid() && consentEl.checked && medicalOk);
}

issueEl.addEventListener('input', function() {
  updateSubmitState();
  if (issueEl.value && !isIssueValid()) {
    issueEl.classList.add('error');
  } else {
    issueEl.classList.remove('error');
  }
});

emailEl.addEventListener('input', function() {
  updateSubmitState();
  if (!isEmailValid()) {
    emailEl.classList.add('error');
  } else {
    emailEl.classList.remove('error');
  }
});

// Email разблокируется только после согласия на обработку данных.
// Разблокировали — но заполнять всё равно не обязательно.
consentEl.addEventListener('change', function() {
  emailEl.disabled = !consentEl.checked;
  phoneEl.disabled = !consentEl.checked;
  nameEl.disabled = !consentEl.checked;
  if (!consentEl.checked) {
    emailEl.value = '';
    emailEl.classList.remove('error');
    phoneEl.value = '';
    nameEl.value = '';
  }
  updateSubmitState();
});

function validateEmail() {
  if (!isEmailValid()) {
    emailEl.classList.add('error');
    return false;
  }
  emailEl.classList.remove('error');
  return true;
}

// Toast
function showToast(text, type) {
  var toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.className = 'toast ' + type + ' show';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(function() {
    toast.classList.remove('show');
  }, 4000);
}

// Thank you
function showThankYou(registered, ticketUrl, dealId) {
  formView.classList.add('hidden');
  thankView.classList.remove('hidden');
  window.scrollTo(0, 0);

  var ticketNumberEl = document.getElementById('ticket-number');
  if (dealId) {
    ticketNumberEl.textContent = 'Номер обращения: №' + dealId;
    ticketNumberEl.classList.remove('hidden');
  } else {
    ticketNumberEl.classList.add('hidden');
  }

  if (registered) {
    thankMsg.textContent = 'Обращение зарегистрировано! Ваши данные переданы редакции murom360.ru.';
    if (ticketUrl) {
      thankLink.classList.remove('hidden');
      thankLink.innerHTML = 'Ссылка на тему: <a href="' + ticketUrl + '" style="color:var(--red)">' + ticketUrl + '</a>';
    } else {
      thankLink.classList.add('hidden');
    }
  } else {
    thankMsg.textContent = 'Обращение зарегистрировано в системе. Ответ придёт на указанную почту, если она была указана.';
    thankLink.classList.add('hidden');
  }
}

// Back button
document.getElementById('back-btn').addEventListener('click', resetForm);

function resetForm() {
  issueEl.value = '';
  files = [];
  updatePreviews();
  emailEl.value = '';
  emailEl.classList.remove('error');
  emailEl.disabled = true;
  consentEl.checked = false;
  medicalConsentEl.checked = false;
  categorySelectEl.value = '';
  damageSelectEl.value = '';
  typeSelectEl.value = 'complaint';
  updateTypeUI();
  phoneEl.value = '';
  phoneEl.disabled = true;
  registerCheck.checked = false;
  nameEl.value = '';
  nameEl.disabled = true;

  [expRegister, expMedicalConsent].forEach(function(el) {
    el.classList.add('collapsed');
    el.style.maxHeight = '0px';
  });

  footerMode.textContent = 'Анонимно';
  submitText.textContent = 'Отправить анонимно';
  document.getElementById('ticket-number').classList.add('hidden');
  updateSubmitState();
  thankView.classList.add('hidden');
  formView.classList.remove('hidden');
  window.scrollTo(0, 0);
}

// CRM API endpoint
var API_URL = '/submit.php';

// Submit flow
submitBtn.addEventListener('click', function() {
  if (!validateEmail()) return;
  if (!consentEl.checked) return;

  submitText.style.display = 'none';
  submitSpinner.classList.add('active');
  submitBtn.disabled = true;

  // Оверлей по центру экрана на всё время отправки — виден статус,
  // особенно важно при загрузке крупных файлов (видео и т.п.)
  var totalBytes = files.reduce(function(sum, f) { return sum + f.size; }, 0);
  var uploadOverlay = document.getElementById('upload-overlay');
  var uploadOverlayText = document.getElementById('upload-overlay-text');
  uploadOverlayText.textContent = totalBytes > 10 * 1024 * 1024
    ? 'Загружаем файлы, это может занять время…'
    : 'Отправляем обращение…';
  uploadOverlay.classList.remove('hidden');

  var formData = new FormData();
  formData.append('type', typeSelectEl.value);
  formData.append('issue', issueEl.value);
  formData.append('email', emailEl.value);
  formData.append('anonymous', !registerCheck.checked);

  if (typeSelectEl.value === 'complaint' && damageSelectEl.value) {
    formData.append('damage_estimate', damageSelectEl.value);
  }

  if (registerCheck.checked) {
    formData.append('category', categorySelectEl.value);
    formData.append('phone', phoneEl.value.replace(/\D/g, ''));
    formData.append('name', nameEl.value);
  }

  if (categorySelectEl.value === 'medical') {
    formData.append('medical_consent', medicalConsentEl.checked);
  }

  files.forEach(function(f) {
    formData.append('files[]', f);
  });

  // Таймаут отправки: чтобы экран "Отправляем обращение…" никогда не висел
  // бесконечно, даже если сервер/сеть зависли без ответа.
  var abortController = new AbortController();
  var abortTimeout = setTimeout(function() {
    abortController.abort();
  }, 5 * 60 * 1000); // 5 минут — с запасом для крупных видео

  function finishSubmit() {
    clearTimeout(abortTimeout);
    submitText.style.display = '';
    submitSpinner.classList.remove('active');
    submitBtn.disabled = false;
    uploadOverlay.classList.add('hidden');
  }

  fetch(API_URL, {
    method: 'POST',
    body: formData,
    signal: abortController.signal
  })
  .then(function(res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  })
  .then(function(data) {
    finishSubmit();

    var ticketUrl = data && data.url ? data.url : null;
    showThankYou(registerCheck.checked, ticketUrl, data && data.deal_id);

    if (data && data.skipped_files && data.skipped_files.length > 0) {
      showToast('Не удалось прикрепить: ' + data.skipped_files.join(', '), 'error');
    } else if (registerCheck.checked) {
      showToast('Обращение отправлено', 'success');
    } else {
      showToast('Обращение отправлено анонимно', 'success');
    }
  })
  .catch(function(err) {
    finishSubmit();
    if (err.name === 'AbortError') {
      showToast('Отправка занимает слишком много времени. Проверьте соединение и попробуйте ещё раз.', 'error');
    } else {
      showToast('Ошибка отправки. Возможно, файл слишком большой (макс. 999 МБ). Попробуйте ещё раз.', 'error');
    }
  });
});

// Deep-link по hash: rd.vmurome.ru/#abuse → автоматически выбирает тип обращения
var HASH_TO_TYPE = {
  '#abuse': 'complaint',
  '#content': 'news',
  '#thanks': 'thanks',
  '#job': 'job',
  '#addons': 'other'
};
var hashType = HASH_TO_TYPE[location.hash];
if (hashType) {
  typeSelectEl.value = hashType;
}

updateTypeUI();
updateSubmitState();