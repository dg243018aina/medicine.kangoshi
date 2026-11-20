const SHARED_STORAGE_KEY = 'brain_med_app_data';

const defaultData = {
  currentPatientId: '1001',
  patients: [
    {
      id: '1001',
      name: '眞野 宏太',
      updatedAt: '2026/11/16',
      memo: '血圧安定。食後の飲み忘れに注意。',
      schedule: [
        { label: '朝ごはん', time: '07:00' },
        { label: '昼ごはん', time: '12:00' },
        { label: '晩ごはん', time: '19:00' },
        { label: 'お風呂', time: '17:00' }
      ],
      meds: [
        { name: 'ロキソニン', dosage: '1錠', timing: ['朝（食後）', '昼（食後）', '夕（食後）'] }
      ]
    }
  ]
};

function getData() {
  try {
    const saved = localStorage.getItem(SHARED_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.patients) && parsed.patients.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('読み込みエラー:', e);
  }
  saveData(defaultData);
  return JSON.parse(JSON.stringify(defaultData));
}

function saveData(data) {
  try {
    localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('保存エラー:', e);
  }
}

function generateNextPatientId(patients) {
  let maxNum = 1000;
  patients.forEach(p => {
    const num = parseInt(String(p.id), 10);
    if (!isNaN(num) && num >= 1000 && num < 10000 && num > maxNum) {
      maxNum = num;
    }
  });
  return String(maxNum + 1);
}

function encodePatientSyncCode(patient) {
  const payload = {
    id: patient.id,
    name: patient.name,
    updatedAt: patient.updatedAt || '',
    memo: patient.memo || '',
    schedule: patient.schedule || [],
    meds: patient.meds || []
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binStr = '';
  bytes.forEach(b => { binStr += String.fromCharCode(b); });
  return 'MED:' + btoa(binStr);
}

function copyTextSafely(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => {});
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

/* ===================================================
   服用タイミング（朝/昼/夕 ＋ 食前/食後/食間/起床時）の変換ヘルパー
=================================================== */
const MEAL_SLOTS = ['朝', '昼', '夕'];
const MEAL_OPTIONS = [
  { value: '', label: '指定なし' },
  { value: '食前', label: '食前' },
  { value: '食後', label: '食後' },
  { value: '食間', label: '食間' },
  { value: '起床時', label: '起床時' }
];

function extractMealModifier(text) {
  if (!text) return '';
  if (text.includes('食前')) return '食前';
  if (text.includes('食後')) return '食後';
  if (text.includes('食間')) return '食間';
  if (text.includes('起床')) return '起床時';
  return '';
}

function parseMedTimings(timingArr) {
  const state = {
    '朝': { active: false, meal: '' },
    '昼': { active: false, meal: '' },
    '夕': { active: false, meal: '' },
    '就寝前': false,
    '頓服': false
  };

  if (!Array.isArray(timingArr)) return state;

  let globalMeal = '';
  timingArr.forEach(item => {
    const str = String(item);
    const mod = extractMealModifier(str);
    if (str.includes('朝')) {
      state['朝'].active = true;
      if (mod) state['朝'].meal = mod;
    } else if (str.includes('昼')) {
      state['昼'].active = true;
      if (mod) state['昼'].meal = mod;
    } else if (str.includes('夕')) {
      state['夕'].active = true;
      if (mod) state['夕'].meal = mod;
    } else if (str.includes('就寝前')) {
      state['就寝前'] = true;
    } else if (str.includes('頓服')) {
      state['頓服'] = true;
    } else if (mod) {
      globalMeal = mod;
    }
  });

  if (globalMeal) {
    MEAL_SLOTS.forEach(slot => {
      if (state[slot].active && !state[slot].meal) {
        state[slot].meal = globalMeal;
      }
    });
  }

  return state;
}

function buildTimingArray(state) {
  const result = [];
  MEAL_SLOTS.forEach(slot => {
    if (state[slot] && state[slot].active) {
      result.push(state[slot].meal ? `${slot}（${state[slot].meal}）` : slot);
    }
  });
  if (state['就寝前']) result.push('就寝前');
  if (state['頓服']) result.push('頓服');
  return result;
}

let appData = getData();
let html5QrCode = null;
let draftPatient = null;

document.addEventListener('DOMContentLoaded', () => {
  const step1 = document.getElementById('screen-step1');
  const step2 = document.getElementById('screen-step2');
  const stepCarte = document.getElementById('screen-carte');

  const patientInput = document.getElementById('patient-name-input');
  const patientSelect = document.getElementById('patient-select');
  const targetPatientName = document.getElementById('target-patient-name');
  const targetPatientId = document.getElementById('target-patient-id');
  const editScheduleForm = document.getElementById('edit-schedule-form');
  const medicineList = document.getElementById('medicine-list');

  function showScreen(targetScreen) {
    if (!targetScreen) return;
    stopScanner();
    [step1, step2, stepCarte].forEach(s => {
      if (s) s.classList.remove('active');
    });
    targetScreen.classList.add('active');
  }

  function openEditMedForCurrentPatient() {
    const existing = appData.patients.find(p => String(p.id) === String(appData.currentPatientId)) || appData.patients[0];
    if (!existing) return;

    draftPatient = {
      ...existing,
      schedule: Array.isArray(existing.schedule) ? existing.schedule.map(s => ({ ...s })) : [],
      meds: Array.isArray(existing.meds) ? existing.meds.map(m => ({ ...m, timing: [...(m.timing || [])] })) : [],
      isNew: false
    };

    if (targetPatientName) targetPatientName.textContent = draftPatient.name;
    if (targetPatientId) targetPatientId.textContent = draftPatient.id;

    renderDraftMedicineList();
    showScreen(step2);
  }

  renderPatientSelect();
  loadCurrentSchedule();

  const headerCarteBtn = document.getElementById('header-carte-btn');
  if (headerCarteBtn) {
    headerCarteBtn.addEventListener('click', () => {
      renderCarteScreen(appData.currentPatientId);
      showScreen(stepCarte);
    });
  }

  const editCurrentMedBtn = document.getElementById('edit-current-patient-med-btn');
  if (editCurrentMedBtn) {
    editCurrentMedBtn.addEventListener('click', openEditMedForCurrentPatient);
  }

  if (patientInput && patientSelect) {
    patientInput.addEventListener('input', () => {
      if (patientInput.value.trim() !== '') {
        patientSelect.value = '';
      }
    });

    patientSelect.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      if (selectedId) {
        appData.currentPatientId = selectedId;
        patientInput.value = '';
        loadCurrentSchedule();
      }
    });
  }

  if (editScheduleForm) {
    editScheduleForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const newName = patientInput ? patientInput.value.trim() : '';
      const scheduleData = [
        { label: '朝ごはん', time: document.getElementById('sched-bf')?.value || '07:00' },
        { label: '昼ごはん', time: document.getElementById('sched-lunch')?.value || '12:00' },
        { label: '晩ごはん', time: document.getElementById('sched-dinner')?.value || '19:00' },
        { label: 'お風呂', time: document.getElementById('sched-bath')?.value || '17:00' }
      ];

      if (newName) {
        const issuedId = generateNextPatientId(appData.patients);
        draftPatient = {
          id: issuedId,
          name: newName,
          updatedAt: new Date().toLocaleDateString('ja-JP'),
          memo: '',
          schedule: scheduleData,
          meds: [],
          isNew: true
        };
        if (targetPatientName) targetPatientName.textContent = `${draftPatient.name}（新規）`;
        if (targetPatientId) targetPatientId.textContent = issuedId;
      } else {
        const targetId = (patientSelect && patientSelect.value) ? patientSelect.value : appData.currentPatientId;
        const existing = appData.patients.find(p => String(p.id) === String(targetId)) || appData.patients[0];
        draftPatient = {
          ...existing,
          schedule: scheduleData,
          meds: existing && Array.isArray(existing.meds) ? existing.meds.map(m => ({ ...m, timing: [...(m.timing || [])] })) : [],
          isNew: false
        };
        if (targetPatientName) targetPatientName.textContent = draftPatient ? draftPatient.name : '未指定';
        if (targetPatientId) targetPatientId.textContent = draftPatient ? draftPatient.id : '----';
      }

      renderDraftMedicineList();
      showScreen(step2);
    });
  }

  const addMedicineForm = document.getElementById('add-medicine-form');
  if (addMedicineForm) {
    addMedicineForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!draftPatient) return;

      const medNameInput = document.getElementById('med-name');
      const medDosageInput = document.getElementById('med-dosage');
      const name = cleanProductName(medNameInput ? medNameInput.value : '');
      if (!name) return;

      const dosage = medDosageInput ? medDosageInput.value : '';
      const checkedTimings = Array.from(document.querySelectorAll('input[name="med-timing"]:checked')).map(cb => cb.value);
      const selectedMealRadio = document.querySelector('input[name="med-meal-timing"]:checked');
      const mealModifier = selectedMealRadio ? selectedMealRadio.value : '';

      const formattedTimings = checkedTimings.map(t => {
        if (MEAL_SLOTS.includes(t) && mealModifier) {
          return `${t}（${mealModifier}）`;
        }
        return t;
      });

      if (formattedTimings.length === 0 && mealModifier) {
        formattedTimings.push(mealModifier);
      }

      draftPatient.meds.push({
        name: name,
        dosage: dosage || '指定なし',
        timing: formattedTimings,
        isNewlyAdded: true
      });

      renderDraftMedicineList();
      e.target.reset();
    });
  }

  const completePatientBtn = document.getElementById('complete-patient-btn');
  if (completePatientBtn) {
    completePatientBtn.addEventListener('click', () => {
      if (!draftPatient) return;

      draftPatient.updatedAt = new Date().toLocaleDateString('ja-JP');

      if (draftPatient.isNew) {
        delete draftPatient.isNew;
        appData.patients.push(draftPatient);
      } else {
        const idx = appData.patients.findIndex(p => String(p.id) === String(draftPatient.id));
        if (idx !== -1) {
          delete draftPatient.isNew;
          appData.patients[idx] = draftPatient;
        }
      }

      appData.currentPatientId = draftPatient.id;
      saveData(appData);

      if (patientInput) patientInput.value = '';
      renderPatientSelect();

      renderCarteScreen(draftPatient.id);
      showScreen(stepCarte);
    });
  }

  const backToStep1Btn = document.getElementById('back-to-step1-btn');
  if (backToStep1Btn) {
    backToStep1Btn.addEventListener('click', () => {
      showScreen(step1);
    });
  }

  const cartePatientSelect = document.getElementById('carte-patient-select');
  if (cartePatientSelect) {
    cartePatientSelect.addEventListener('change', (e) => {
      const id = e.target.value;
      if (id) {
        appData.currentPatientId = id;
        saveData(appData);
        renderCarteScreen(id);
      }
    });
  }

  const saveMemoBtn = document.getElementById('save-memo-btn');
  if (saveMemoBtn) {
    saveMemoBtn.addEventListener('click', () => {
      const patient = appData.patients.find(p => String(p.id) === String(appData.currentPatientId));
      if (patient) {
        const memoEl = document.getElementById('carte-memo');
        patient.memo = memoEl ? memoEl.value : '';
        saveData(appData);
        alert('診察メモを保存しました。');
      }
    });
  }

  const newRegisterBtn = document.getElementById('new-register-btn');
  if (newRegisterBtn) {
    newRegisterBtn.addEventListener('click', () => {
      if (patientInput) patientInput.value = '';
      if (patientSelect) patientSelect.value = '';
      showScreen(step1);
    });
  }

  function renderPatientSelect() {
    if (!patientSelect) return;
    patientSelect.innerHTML = '<option value="">-- 患者を選択してください --</option>' +
      appData.patients.map(p => `
        <option value="${p.id}" ${String(p.id) === String(appData.currentPatientId) ? 'selected' : ''}>
          [ID: ${p.id}] ${p.name}
        </option>
      `).join('');
  }

  function loadCurrentSchedule() {
    const patient = appData.patients.find(p => String(p.id) === String(appData.currentPatientId));
    if (!patient || !Array.isArray(patient.schedule)) return;

    const bf = patient.schedule.find(s => s.label === '朝ごはん');
    const lunch = patient.schedule.find(s => s.label === '昼ごはん');
    const dinner = patient.schedule.find(s => s.label === '晩ごはん');
    const bath = patient.schedule.find(s => s.label === 'お風呂');

    if (bf && document.getElementById('sched-bf')) document.getElementById('sched-bf').value = bf.time;
    if (lunch && document.getElementById('sched-lunch')) document.getElementById('sched-lunch').value = lunch.time;
    if (dinner && document.getElementById('sched-dinner')) document.getElementById('sched-dinner').value = dinner.time;
    if (bath && document.getElementById('sched-bath')) document.getElementById('sched-bath').value = bath.time;
  }

  function renderDraftMedicineList() {
    if (!medicineList) return;
    medicineList.innerHTML = '';
    if (!draftPatient || !Array.isArray(draftPatient.meds)) return;

    if (draftPatient.meds.length === 0) {
      medicineList.innerHTML = '<li style="font-size:0.78rem; color:#888; padding:6px;">まだお薬が登録されていません</li>';
      return;
    }

    draftPatient.meds.forEach((med, idx) => {
      const li = document.createElement('li');
      li.className = 'med-edit-card';

      const newBadge = med.isNewlyAdded
        ? '<span style="background:#ff922b;color:#fff;font-size:0.65rem;padding:1px 5px;border-radius:4px;margin-right:4px;">追加</span>'
        : '';

      const slotState = parseMedTimings(med.timing);

      const slotsHtml = MEAL_SLOTS.map(slot => {
        const isChecked = slotState[slot].active;
        const currentMeal = slotState[slot].meal;
        const optionsHtml = MEAL_OPTIONS.map(opt =>
          `<option value="${opt.value}" ${currentMeal === opt.value ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        return `
          <div class="meal-slot-row">
            <label class="meal-slot-check">
              <input type="checkbox" class="slot-active-cb" data-slot="${slot}" ${isChecked ? 'checked' : ''}>
              ${slot}
            </label>
            <select class="meal-slot-select" data-slot="${slot}" ${isChecked ? '' : 'disabled'}>
              ${optionsHtml}
            </select>
          </div>
        `;
      }).join('');

      li.innerHTML = `
        <div class="med-edit-header">
          <span class="med-edit-title">${newBadge}<strong>${med.name}</strong>（${med.dosage}）</span>
          <button type="button" class="del-med-btn">削除</button>
        </div>
        <div class="med-meal-slots">
          ${slotsHtml}
        </div>
        <div class="extra-timing-row">
          <label><input type="checkbox" class="extra-slot-cb" data-slot="就寝前" ${slotState['就寝前'] ? 'checked' : ''}> 就寝前</label>
          <label><input type="checkbox" class="extra-slot-cb" data-slot="頓服" ${slotState['頓服'] ? 'checked' : ''}> 頓服</label>
        </div>
      `;

      const syncCardTimings = () => {
        const updatedState = {
          '朝': { active: false, meal: '' },
          '昼': { active: false, meal: '' },
          '夕': { active: false, meal: '' },
          '就寝前': false,
          '頓服': false
        };

        MEAL_SLOTS.forEach(slot => {
          const cb = li.querySelector(`.slot-active-cb[data-slot="${slot}"]`);
          const sel = li.querySelector(`.meal-slot-select[data-slot="${slot}"]`);
          const active = cb ? cb.checked : false;
          if (sel) sel.disabled = !active;
          updatedState[slot] = {
            active,
            meal: sel ? sel.value : ''
          };
        });

        const sleepCb = li.querySelector('.extra-slot-cb[data-slot="就寝前"]');
        const tonpukuCb = li.querySelector('.extra-slot-cb[data-slot="頓服"]');
        updatedState['就寝前'] = sleepCb ? sleepCb.checked : false;
        updatedState['頓服'] = tonpukuCb ? tonpukuCb.checked : false;

        draftPatient.meds[idx].timing = buildTimingArray(updatedState);
      };

      li.querySelectorAll('.slot-active-cb, .extra-slot-cb').forEach(cb => {
        cb.addEventListener('change', syncCardTimings);
      });

      li.querySelectorAll('.meal-slot-select').forEach(sel => {
        sel.addEventListener('change', syncCardTimings);
      });

      li.querySelector('.del-med-btn').addEventListener('click', () => {
        draftPatient.meds.splice(idx, 1);
        renderDraftMedicineList();
      });

      medicineList.appendChild(li);
    });
  }

  function renderCarteScreen(patientId) {
    const carteSelect = document.getElementById('carte-patient-select');
    if (carteSelect) {
      carteSelect.innerHTML = appData.patients.map(p => `
        <option value="${p.id}" ${String(p.id) === String(patientId) ? 'selected' : ''}>
          [ID: ${p.id}] ${p.name} 様
        </option>
      `).join('');

      if (!document.getElementById('edit-current-patient-med-btn')) {
        const addMedBtn = document.createElement('button');
        addMedBtn.type = 'button';
        addMedBtn.id = 'edit-current-patient-med-btn';
        addMedBtn.className = 'action-btn btn-orange';
        addMedBtn.style.marginTop = '8px';
        addMedBtn.textContent = '💊 この患者にお薬を追加・編集する';
        addMedBtn.addEventListener('click', openEditMedForCurrentPatient);
        carteSelect.insertAdjacentElement('afterend', addMedBtn);
      }
    }

    const patient = appData.patients.find(p => String(p.id) === String(patientId)) || appData.patients[0];
    if (!patient) return;

    const issuedIdEl = document.getElementById('carte-issued-id');
    if (issuedIdEl) issuedIdEl.textContent = patient.id;

    const syncCode = encodePatientSyncCode(patient);
    const banner = document.querySelector('.issued-id-banner');
    if (banner) {
      let syncBox = document.getElementById('sync-code-box');
      if (!syncBox) {
        syncBox = document.createElement('div');
        syncBox.id = 'sync-code-box';
        syncBox.style.cssText = 'margin-top:8px; padding-top:8px; border-top:1px dashed #7fb3d5;';
        syncBox.innerHTML = `
          <div style="font-size:0.72rem; font-weight:700; color:#1f618d; margin-bottom:4px;">
            別デバイス用（QRコード または 連携コード）
          </div>
          <div style="display:flex; gap:4px; margin-bottom:6px;">
            <input type="text" id="sync-code-input" readonly style="font-size:0.72rem; padding:4px 6px; margin:0; background:#fff; border:1px solid #2980b9; border-radius:6px;">
            <button type="button" id="copy-sync-code-btn" style="background:#2980b9; color:#fff; border:none; border-radius:6px; padding:4px 10px; font-size:0.75rem; font-weight:700; white-space:nowrap; cursor:pointer;">コピー</button>
          </div>
          <div id="sync-qr-wrap" style="text-align:center;">
            <img id="sync-qr-img" alt="患者連携QR" style="width:120px; height:120px; border:2px solid #fff; border-radius:8px; background:#fff;">
          </div>
        `;
        banner.appendChild(syncBox);

        document.getElementById('copy-sync-code-btn').addEventListener('click', () => {
          const val = document.getElementById('sync-code-input').value;
          copyTextSafely(val);
          alert('最新の連携コードをコピーしました！');
        });
      }

      const syncInput = document.getElementById('sync-code-input');
      if (syncInput) syncInput.value = syncCode;

      let qrTarget = syncCode;
      if (location.protocol.startsWith('http')) {
        const patientUrl = location.href.replace(/\/medicine\.kangoshi\/.*$/, '/medicine-app/').replace(/pharmacist\.html.*$/, 'patient.html');
        qrTarget = `${patientUrl}?sync=${encodeURIComponent(syncCode)}`;
      }
      const qrImg = document.getElementById('sync-qr-img');
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrTarget)}`;
      }
    }

    const carteName = document.getElementById('carte-name');
    const carteDate = document.getElementById('carte-date');
    const carteMemo = document.getElementById('carte-memo');
    if (carteName) carteName.textContent = patient.name;
    if (carteDate) carteDate.textContent = `更新日: ${patient.updatedAt || '本日'}`;
    if (carteMemo) carteMemo.value = patient.memo || '';

    const schedContainer = document.getElementById('carte-schedule-list');
    if (schedContainer) {
      schedContainer.innerHTML = (patient.schedule || []).map(s => `
        <div><strong>${s.label}:</strong> ${s.time}</div>
      `).join('');
    }

    const medContainer = document.getElementById('carte-med-list');
    if (medContainer) {
      if (!patient.meds || patient.meds.length === 0) {
        medContainer.innerHTML = '<li style="background:#f9f9f9; border-color:#ccc;">登録されたお薬はありません</li>';
      } else {
        medContainer.innerHTML = patient.meds.map(m => `
          <li>
            <strong>${m.name}</strong>（${m.dosage}）<br>
            <span style="color:#27ae60; font-weight:bold;">服用: ${(m.timing || []).join('・') || '指定なし'}</span>
          </li>
        `).join('');
      }
    }
  }

  const startBtn = document.getElementById('start-scan-btn');
  const stopBtn = document.getElementById('stop-scan-btn');
  const readerContainer = document.getElementById('qr-reader-container');

  if (startBtn && readerContainer) {
    startBtn.addEventListener('click', () => {
      if (typeof Html5Qrcode === 'undefined') {
        alert('QR読み取りライブラリの読み込み中です。');
        return;
      }
      readerContainer.style.display = 'block';
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode('qr-reader');
      }

      html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          parseMedicineQR(decodedText);
          stopScanner();
        },
        () => {}
      ).catch(err => {
        alert('カメラの起動に失敗しました: ' + err);
        readerContainer.style.display = 'none';
      });
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', stopScanner);
  }

  function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop().then(() => {
        if (readerContainer) readerContainer.style.display = 'none';
      }).catch(() => {
        if (readerContainer) readerContainer.style.display = 'none';
      });
    } else if (readerContainer) {
      readerContainer.style.display = 'none';
    }
  }

  function cleanProductName(text) {
    return text.replace(/(https?:\/\/[^\s]+|www\.[^\s]+)/g, '').trim();
  }

  function parseMedicineQR(text) {
    let medName = '';
    let dosage = '';
    let timings = [];
    let mealModifier = '';

    const lines = text.split('\n');
    let isJahis = false;

    lines.forEach(line => {
      const cols = line.split(',');
      if (cols[0] === '201' || cols[0] === '281') {
        isJahis = true;
        medName = cols[4] || cols[3] || medName;
        if (cols[5]) dosage = cols[5] + (cols[6] || '');
      }
      if (cols[0] === '301' || cols[0] === '311') {
        const usageText = cols[4] || '';
        extractTimings(usageText, timings);
        const mod = extractMealModifier(usageText);
        if (mod) mealModifier = mod;
      }
    });

    if (!isJahis) {
      try {
        const data = JSON.parse(text);
        medName = data.name || '';
        dosage = data.dosage || '';
        if (Array.isArray(data.timing)) {
          data.timing.forEach(t => {
            extractTimings(t, timings);
            const mod = extractMealModifier(t);
            if (mod) mealModifier = mod;
          });
        }
      } catch (e) {
        medName = text.split(/\s+/)[0] || text;
        extractTimings(text, timings);
        mealModifier = extractMealModifier(text);
      }
    }

    medName = cleanProductName(medName);

    if (medName && document.getElementById('med-name')) document.getElementById('med-name').value = medName;
    if (dosage && document.getElementById('med-dosage')) document.getElementById('med-dosage').value = dosage;

    const checkboxes = document.querySelectorAll('input[name="med-timing"]');
    checkboxes.forEach(cb => {
      cb.checked = timings.includes(cb.value);
    });

    const mealRadios = document.querySelectorAll('input[name="med-meal-timing"]');
    mealRadios.forEach(rb => {
      rb.checked = (rb.value === mealModifier);
    });
  }

  function extractTimings(str, targetArray) {
    if (str.includes('朝') && !targetArray.includes('朝')) targetArray.push('朝');
    if (str.includes('昼') && !targetArray.includes('昼')) targetArray.push('昼');
    if ((str.includes('夕') || str.includes('夜')) && !targetArray.includes('夕')) targetArray.push('夕');
    if ((str.includes('寝') || str.includes('就寝')) && !targetArray.includes('就寝前')) targetArray.push('就寝前');
    if ((str.includes('頓') || str.includes('痛')) && !targetArray.includes('頓服')) targetArray.push('頓服');
  }
});
