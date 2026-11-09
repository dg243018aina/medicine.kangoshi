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
        { label: '朝ごはん', time: '7:00' },
        { label: '昼ごはん', time: '12:00' },
        { label: '晩ごはん', time: '19:00' },
        { label: 'お風呂', time: '17:00' }
      ],
      meds: [
        { name: 'ロキソニン', instruction: '朝 食後 2錠' },
        { name: '軟膏(塗り薬)', instruction: '朝洗顔後 入浴後 就寝前' }
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

document.addEventListener('DOMContentLoaded', () => {
  renderPatientList();
  loadCurrentSchedule();

  document.getElementById('edit-schedule-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const patient = appData.patients.find(p => p.id === appData.currentPatientId);
    if (!patient) return;

    patient.schedule = [
      { label: '朝ごはん', time: document.getElementById('sched-bf').value || '7:00' },
      { label: '昼ごはん', time: document.getElementById('sched-lunch').value || '12:00' },
      { label: '晩ごはん', time: document.getElementById('sched-dinner').value || '19:00' },
      { label: 'お風呂', time: document.getElementById('sched-bath').value || '17:00' }
    ];

    saveData(appData);
    alert(`${patient.name} 様のスケジュールを保存しました。`);
  });

  document.getElementById('add-med-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('input-med-name').value;
    const instruction = document.getElementById('input-med-instruction').value;

    const patient = appData.patients.find(p => p.id === appData.currentPatientId);
    if (patient) {
      patient.meds.push({ name, instruction });
      saveData(appData);
      alert(`${patient.name} 様に「${name}」を追加登録しました。`);
      document.getElementById('add-med-form').reset();
    }
  });
});

function renderPatientList() {
  const container = document.getElementById('pharmacist-patient-list');
  container.innerHTML = appData.patients.map(p => `
    <div class="patient-card-item ${p.id === appData.currentPatientId ? 'active' : ''}" data-id="${p.id}">
      ${p.name} (${p.age})
    </div>
  `).join('');

  container.querySelectorAll('.patient-card-item').forEach(item => {
    item.addEventListener('click', (e) => {
      appData.currentPatientId = parseInt(e.currentTarget.getAttribute('data-id'));
      saveData(appData);
      renderPatientList();
      loadCurrentSchedule();
    });
  });
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
