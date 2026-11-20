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
        { name: 'ロキソニン', dosage: '1錠', timing: ['朝食後', '昼食後', '夕食後'] }
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

      draftPatient.meds.push({
        name: name,
        dosage: dosage || '指定なし',
        timing: checkedTimings,
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
          [ID: ${p.id}]${p.name}
        </
