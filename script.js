// --- データ管理初期設定 ---
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
        { name: 'ロキソニン', dosage: '1錠', timing: ['朝', '昼', '夕'] },
        { name: '軟膏(塗り薬)', dosage: '適量', timing: ['朝', '就寝前'] }
      ]
    }
  ]
};

function getData() {
  const saved = localStorage.getItem('brain_med_app_data');
  return saved ? JSON.parse(saved) : defaultData;
}

function saveData(data) {
  localStorage.setItem('brain_med_app_data', JSON.stringify(data));
}

let appData = getData();
let html5QrCode = null;

document.addEventListener('DOMContentLoaded', () => {
  // 画面要素の取得
  const step1 = document.getElementById('screen-step1');
  const step2 = document.getElementById('screen-step2');
  const addPatientForm = document.getElementById('add-patient-form');
  const patientInput = document.getElementById('patient-name-input');
  const patientSelect = document.getElementById('patient-select');
  const targetPatientName = document.getElementById('target-patient-name');
  const editScheduleForm = document.getElementById('edit-schedule-form');
  const backBtn = document.getElementById('back-to-step1-btn');
  const medicineList = document.getElementById('medicine-list');

  // 初期描画
  renderPatientSelect();
  loadCurrentSchedule();

  // 1. 新規患者登録
  addPatientForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = patientInput.value.trim();
    if (!name) return;

    const newPatient = {
      id: Date.now(),
      name: name,
      age: 80, // 初期値
      schedule: [
        { label: '朝ごはん', time: '07:00' },
        { label: '昼ごはん', time: '12:00' },
        { label: '晩ごはん', time: '19:00' },
        { label: 'お風呂', time: '17:00' }
      ],
      meds: []
    };

    appData.patients.push(newPatient);
    appData.currentPatientId = newPatient.id;
    saveData(appData);

    renderPatientSelect();
    loadCurrentSchedule();
    patientInput.value = '';
    alert(`「${name}」様を新しく追加登録しました。`);
  });

  // 2. 患者選択ドロップダウン変更時
  patientSelect.addEventListener('change', (e) => {
    const selectedId = parseInt(e.target.value);
    if (selectedId) {
      appData.currentPatientId = selectedId;
      saveData(appData);
      loadCurrentSchedule();
    }
  });

  // 3. 生活時間保存 & 画面2への遷移
  editScheduleForm.addEventListener('submit', (e) => {
    e.preventDefault();

    let patient = appData.patients.find(p => p.id === appData.currentPatientId);
    if (!patient && appData.patients.length > 0) {
      patient = appData.patients[0];
      appData.currentPatientId = patient.id;
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

    // 画面遷移
    step1.classList.remove('active');
    step2.classList.add('active');
  });

  // 4. 画面2から画面1へ戻る
  backBtn.addEventListener('click', () => {
    stopScanner();
    step2.classList.remove('active');
    step1.classList.add('active');
  });

  // 5. お薬追加フォーム送信
  document.getElementById('add-medicine-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('med-name').value;
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
      alert(`「${name}」を登録しました。`);
    }

    e.target.reset();
  });

  // 6. QR読み取り制御
  const startBtn = document.getElementById('start-scan-btn');
  const stopBtn = document.getElementById('stop-scan-btn');
  const readerContainer = document.getElementById('qr-reader-container');

  startBtn.addEventListener('click', () => {
    readerContainer.style.display = 'block';
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("qr-reader");
    }

    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
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

  // --- ヘルパー関数群 ---

  // 患者選択プルダウンの更新
  function renderPatientSelect() {
    patientSelect.innerHTML = '<option value="">-- 患者を選択してください --</option>' +
      appData.patients.map(p => `
        <option value="${p.id}" ${p.id === appData.currentPatientId ? 'selected' : ''}>
          ${p.name} (${p.age}歳)
        </option>
      `).join('');
  }

  // 現在選択中の患者の生活時間をフォームにセット
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

  // 選択中患者の登録済お薬リストを描画
  function renderMedicineList() {
    medicineList.innerHTML = '';
    const patient = appData.patients.find(p => p.id === appData.currentPatientId);
    if (!patient || !patient.meds) return;

    patient.meds.forEach((med, index) => {
      const li = document.createElement('li');
      const timingsStr = med.timing && med.timing.length > 0 ? med.timing.join(', ') : 'タイミング指定なし';
      li.style.marginBottom = '6px';
      li.innerHTML = `<strong>${med.name}</strong> - ${med.dosage} [${timingsStr}]`;
      medicineList.appendChild(li);
    });
  }

  // QRコードの解読処理
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

    if (medName) document.getElementById('med-name').value = medName;
    if (dosage) document.getElementById('med-dosage').value = dosage;

    const checkboxes = document.querySelectorAll('input[name="med-timing"]');
    checkboxes.forEach(cb => {
      cb.checked = timings.includes(cb.value);
    });

    alert(`お薬情報を取り込みました:\n薬品名: ${medName || '未取得'}`);
  }

  function extractTimings(str, targetArray) {
    if (str.includes('朝')) targetArray.push('朝');
    if (str.includes('昼')) targetArray.push('昼');
    if (str.includes('夕') || str.includes('夜')) targetArray.push('夕');
    if (str.includes('寝') || str.includes('就寝')) targetArray.push('就寝前');
    if (str.includes('頓') || str.includes('痛')) targetArray.push('頓服');
  }
});
