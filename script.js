const defaultData = {
  currentPatientId: 1,
  patients: [
    {
      id: 1,
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
    const saved = localStorage.getItem('brain_med_app_data');
    return saved ? JSON.parse(saved) : defaultData;
  } catch (e) {
    return defaultData;
  }
}

function saveData(data) {
  try {
    localStorage.setItem('brain_med_app_data', JSON.stringify(data));
  } catch (e) {
    console.warn("保存エラー:", e);
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
  const editScheduleForm = document.getElementById('edit-schedule-form');
  const medicineList = document.getElementById('medicine-list');

  function showScreen(targetScreen) {
    stopScanner();
    [step1, step2, stepCarte].forEach(s => s.classList.remove('active'));
    targetScreen.classList.add('active');
  }

  renderPatientSelect();
  loadCurrentSchedule();

  // ヘッダーの「診察カルテ」ボタン
  document.getElementById('header-carte-btn').addEventListener('click', () => {
    renderCarteScreen(appData.currentPatientId);
    showScreen(stepCarte);
  });

  // 既存患者を選択したら新規入力欄をクリア
  patientSelect.addEventListener('change', (e) => {
    const selectedId = parseInt(e.target.value, 10);
    if (selectedId) {
      appData.currentPatientId = selectedId;
      patientInput.value = '';
      loadCurrentSchedule();
    }
  });

  // 1画面目「次へ（お薬登録）」押下時
  editScheduleForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const newName = patientInput.value.trim();
    const scheduleData = [
      { label: '朝ごはん', time: document.getElementById('sched-bf').value || '07:00' },
      { label: '昼ごはん', time: document.getElementById('sched-lunch').value || '12:00' },
      { label: '晩ごはん', time: document.getElementById('sched-dinner').value || '19:00' },
      { label: 'お風呂', time: document.getElementById('sched-bath').value || '17:00' }
    ];

    if (newName) {
      draftPatient = {
        id: Date.now(),
        name: newName,
        updatedAt: new Date().toLocaleDateString('ja-JP'),
        memo: '',
        schedule: scheduleData,
        meds: [],
        isNew: true
      };
      targetPatientName.textContent = draftPatient.name + "（新規）";
    } else {
      const existing = appData.patients.find(p => p.id === appData.currentPatientId) || appData.patients[0];
      draftPatient = {
        ...existing,
        schedule: scheduleData,
        meds: existing ? [...existing.meds] : [],
        isNew: false
      };
      targetPatientName.textContent = draftPatient ? draftPatient.name : '未指定';
    }

    renderDraftMedicineList();
    showScreen(step2);
  });

  // 2画面目：薬を追加リストに入れる
  document.getElementById('add-medicine-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!draftPatient) return;

    const name = cleanProductName(document.getElementById('med-name').value);
    const dosage = document.getElementById('med-dosage').value;
    const checkedTimings = Array.from(document.querySelectorAll('input[name="med-timing"]:checked')).map(cb => cb.value);

    draftPatient.meds.push({
      name: name,
      dosage: dosage || '指定なし',
      timing: checkedTimings
    });

    renderDraftMedicineList();
    e.target.reset();
  });

  // 2画面目：「患者データを確定して診察画面を見る」
  document.getElementById('complete-patient-btn').addEventListener('click', () => {
    if (!draftPatient) return;

    draftPatient.updatedAt = new Date().toLocaleDateString('ja-JP');

    if (draftPatient.isNew) {
      delete draftPatient.isNew;
      appData.patients.push(draftPatient);
    } else {
      const idx = appData.patients.findIndex(p => p.id === draftPatient.id);
      if (idx !== -1) {
        delete draftPatient.isNew;
        appData.patients[idx] = draftPatient;
      }
    }

    appData.currentPatientId = draftPatient.id;
    saveData(appData);

    patientInput.value = '';
    renderPatientSelect();

    renderCarteScreen(draftPatient.id);
    showScreen(stepCarte);
  });

  // 2画面目：戻るボタン
  document.getElementById('back-to-step1-btn').addEventListener('click', () => {
    showScreen(step1);
  });

  // 3画面目（診察カルテ）：患者切り替え
  document.getElementById('carte-patient-select').addEventListener('change', (e) => {
    const id = parseInt(e.target.value, 10);
    if (id) {
      appData.currentPatientId = id;
      saveData(appData);
      renderCarteScreen(id);
    }
  });

  // 3画面目（診察カルテ）：メモ保存
  document.getElementById('save-memo-btn').addEventListener('click', () => {
    const patient = appData.patients.find(p => p.id === appData.currentPatientId);
    if (patient) {
      patient.memo = document.getElementById('carte-memo').value;
      saveData(appData);
      alert('診察メモを保存しました。');
    }
  });

  // 3画面目：「新しい患者・お薬を登録する」
  document.getElementById('new-register-btn').addEventListener('click', () => {
    patientInput.value = '';
    patientSelect.value = '';
    showScreen(step1);
  });

  // --- 描画用ヘルパー関数 ---

  function renderPatientSelect() {
    patientSelect.innerHTML = '<option value="">-- 患者を選択してください --</option>' +
      appData.patients.map(p => `
        <option value="${p.id}" ${p.id === appData.currentPatientId ? 'selected' : ''}>
          ${p.name}
        </option>
      `).join('');
  }

  function loadCurrentSchedule() {
    const patient = appData.patients.find(p => p.id === appData.currentPatientId);
    if (!patient) return;

    const bf = patient.schedule.find(s => s.label === '朝ごはん');
    const lunch = patient.schedule.find(s => s.label === '昼ごはん');
    const dinner = patient.schedule.find(s => s.label === '晩ごはん');
    const bath = patient.schedule.find(s => s.label === 'お風呂');

    if (bf) document.getElementById('sched-bf').value = bf.time;
    if (lunch) document.getElementById('sched-lunch').value = lunch.time;
    if (dinner) document.getElementById('sched-dinner').value = dinner.time;
    if (bath) document.getElementById('sched-bath').value = bath.time;
  }

  function renderDraftMedicineList() {
    medicineList.innerHTML = '';
    if (!draftPatient || !draftPatient.meds) return;

    draftPatient.meds.forEach((med) => {
      const li = document.createElement('li');
      const timingsStr = med.timing && med.timing.length > 0 ? med.timing.join('・') : '指定なし';
      li.innerHTML = `<strong>${med.name}</strong> (${med.dosage}) [${timingsStr}]`;
      medicineList.appendChild(li);
    });
  }

  function renderCarteScreen(patientId) {
    const carteSelect = document.getElementById('carte-patient-select');
    carteSelect.innerHTML = appData.patients.map(p => `
      <option value="${p.id}" ${p.id === patientId ? 'selected' : ''}>
        ${p.name} 様
      </option>
    `).join('');

    const patient = appData.patients.find(p => p.id === patientId) || appData.patients[0];
    if (!patient) return;

    document.getElementById('carte-name').textContent = patient.name;
    document.getElementById('carte-date').textContent = `更新日: ${patient.updatedAt || '本日'}`;
    document.getElementById('carte-memo').value = patient.memo || '';

    const schedContainer = document.getElementById('carte-schedule-list');
    schedContainer.innerHTML = patient.schedule.map(s => `
      <div><strong>${s.label}:</strong> ${s.time}</div>
    `).join('');

    const medContainer = document.getElementById('carte-med-list');
    if (patient.meds.length === 0) {
      medContainer.innerHTML = '<li style="background:#f9f9f9; border-color:#ccc;">登録されたお薬はありません</li>';
    } else {
      medContainer.innerHTML = patient.meds.map(m => `
        <li>
          <strong>${m.name}</strong>（${m.dosage}）<br>
          <span style="color:#27ae60; font-weight:bold;">服用: ${m.timing.join('・') || '指定なし'}</span>
        </li>
      `).join('');
    }
  }

  // --- QR読み取り制御 ---
  const startBtn = document.getElementById('start-scan-btn');
  const stopBtn = document.getElementById('stop-scan-btn');
  const readerContainer = document.getElementById('qr-reader-container');

  startBtn.addEventListener('click', () => {
    if (typeof Html5Qrcode === 'undefined') {
      alert("QR読み取りライブラリの読み込み中です。");
      return;
    }
    readerContainer.style.display = 'block';
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("qr-reader");
    }

    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (decodedText) => {
        parseMedicineQR(decodedText);
        stopScanner();
      },
      () => {}
    ).catch(err => {
      alert("カメラの起動に失敗しました: " + err);
      readerContainer.style.display = 'none';
    });
  });

  stopBtn.addEventListener('click', stopScanner);

  function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop().then(() => {
        readerContainer.style.display = 'none';
      }).catch(() => {
        readerContainer.style.display = 'none';
      });
    } else {
      readerContainer.style.display = 'none';
    }
  }

  function cleanProductName(text) {
    return text.replace(/(https?:\/\/[^\s]+|www\.[^\s]+)/g, '').trim();
  }

  function parseMedicineQR(text) {
    let medName = "";
    let dosage = "";
    let timings = [];

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
      }
    });

    if (!isJahis) {
      try {
        const data = JSON.parse(text);
        medName = data.name || "";
        dosage = data.dosage || "";
        if (Array.isArray(data.timing)) timings = data.timing;
      } catch (e) {
        medName = text.split(/\s+/)[0] || text;
        extractTimings(text, timings);
      }
    }

    medName = cleanProductName(medName);

    if (medName) document.getElementById('med-name').value = medName;
    if (dosage) document.getElementById('med-dosage').value = dosage;

    const checkboxes = document.querySelectorAll('input[name="med-timing"]');
    checkboxes.forEach(cb => {
      cb.checked = timings.includes(cb.value);
    });
  }

  // 細分化された「食前・食後」の自動判定
  function extractTimings(str, targetArray) {
    const isBeforeMeal = str.includes('食前');
    // 「食前」と明記されていなければ基本的に「食後」として判定
    const suffix = isBeforeMeal ? '食前' : '食後';

    if (str.includes('朝')) targetArray.push('朝' + suffix);
    if (str.includes('昼')) targetArray.push('昼' + suffix);
    if (str.includes('夕') || str.includes('夜')) targetArray.push('夕' + suffix);
    if (str.includes('寝') || str.includes('就寝')) targetArray.push('就寝前');
    if (str.includes('頓') || str.includes('痛')) targetArray.push('頓服');
  }
});
