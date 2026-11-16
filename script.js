const defaultData = {
  coins: 11,
  love: 100,
  currentPatientId: 1,
  patients: [
    {
      id: 1,
      name: '眞野 宏太',
      age: 86,
      schedule: [
        { label: '朝ごはん', time: '07:00' },
        { label: '昼ごはん', time: '12:00' },
        { label: '晩ごはん', time: '19:00' },
        { label: 'お風呂', time: '17:00' }
      ],
      meds: [
        { name: 'ロキソニン', dosage: '1錠', timing: ['朝', '昼', '夕'] }
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
    console.warn("保存スキップ:", e);
  }
}

let appData = getData();
let html5QrCode = null;

document.addEventListener('DOMContentLoaded', () => {
  const step1 = document.getElementById('screen-step1');
  const step2 = document.getElementById('screen-step2');
  const patientInput = document.getElementById('patient-name-input');
  const patientSelect = document.getElementById('patient-select');
  const targetPatientName = document.getElementById('target-patient-name');
  const editScheduleForm = document.getElementById('edit-schedule-form');
  const backBtn = document.getElementById('back-to-step1-btn');
  const medicineList = document.getElementById('medicine-list');

  // 初期表示
  renderPatientSelect();
  loadCurrentSchedule();

  // 既存患者を選択したら新規入力欄をクリア
  patientSelect.addEventListener('change', (e) => {
    const selectedId = parseInt(e.target.value, 10);
    if (selectedId) {
      appData.currentPatientId = selectedId;
      patientInput.value = '';
      saveData(appData);
      loadCurrentSchedule();
    }
  });

  // 「保存して次へ」ボタン処理
  editScheduleForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const newName = patientInput.value.trim();
    let patient = null;

    if (newName) {
      patient = {
        id: Date.now(),
        name: newName,
        age: 80,
        schedule: [],
        meds: []
      };
      appData.patients.push(patient);
      appData.currentPatientId = patient.id;
      patientInput.value = '';
      renderPatientSelect();
    } else {
      patient = appData.patients.find(p => p.id === appData.currentPatientId);
      if (!patient && appData.patients.length > 0) {
        patient = appData.patients[0];
        appData.currentPatientId = patient.id;
      }
    }

    if (patient) {
      patient.schedule = [
        { label: '朝ごはん', time: document.getElementById('sched-bf').value || '07:00' },
        { label: '昼ごはん', time: document.getElementById('sched-lunch').value || '12:00' },
        { label: '晩ごはん', time: document.getElementById('sched-dinner').value || '19:00' },
        { label: 'お風呂', time: document.getElementById('sched-bath').value || '17:00' }
      ];
      saveData(appData);
      targetPatientName.textContent = patient.name;
    } else {
      targetPatientName.textContent = '未指定';
    }

    renderMedicineList();

    // 画面切り替え
    step1.classList.remove('active');
    step2.classList.add('active');
  });

  // 画面2から画面1へ戻る
  backBtn.addEventListener('click', () => {
    stopScanner();
    step2.classList.remove('active');
    step1.classList.add('active');
  });

  // お薬追加フォーム送信
  document.getElementById('add-medicine-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = cleanProductName(document.getElementById('med-name').value);
    const dosage = document.getElementById('med-dosage').value;
    const checkedTimings = Array.from(document.querySelectorAll('input[name="med-timing"]:checked')).map(cb => cb.value);

    const patient = appData.patients.find(p => p.id === appData.currentPatientId);
    if (patient) {
      patient.meds.push({
        name: name,
        dosage: dosage || '指定なし',
        timing: checkedTimings
      });
      saveData(appData);
      renderMedicineList();
    }

    e.target.reset();
  });

  // QR読み取り制御
  const startBtn = document.getElementById('start-scan-btn');
  const stopBtn = document.getElementById('stop-scan-btn');
  const readerContainer = document.getElementById('qr-reader-container');

  startBtn.addEventListener('click', () => {
    if (typeof Html5Qrcode === 'undefined') {
      alert("QR読み取りライブラリの読み込み中です。少し待つかネット接続を確認してください。");
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

  // URL除去
  function cleanProductName(text) {
    return text.replace(/(https?:\/\/[^\s]+|www\.[^\s]+)/g, '').trim();
  }

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

  function renderMedicineList() {
    medicineList.innerHTML = '';
    const patient = appData.patients.find(p => p.id === appData.currentPatientId);
    if (!patient || !patient.meds) return;

    patient.meds.forEach((med) => {
      const li = document.createElement('li');
      const timingsStr = med.timing && med.timing.length > 0 ? med.timing.join(', ') : '指定なし';
      li.innerHTML = `<strong>${med.name}</strong> (${med.dosage}) [${timingsStr}]`;
      medicineList.appendChild(li);
    });
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

  function extractTimings(str, targetArray) {
    if (str.includes('朝')) targetArray.push('朝');
    if (str.includes('昼')) targetArray.push('昼');
    if (str.includes('夕') || str.includes('夜')) targetArray.push('夕');
    if (str.includes('寝') || str.includes('就寝')) targetArray.push('就寝前');
    if (str.includes('頓') || str.includes('痛')) targetArray.push('頓服');
  }
});
