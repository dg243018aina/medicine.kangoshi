* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Zen Maru Gothic', sans-serif;
  user-select: none;
}

body {
  background-color: #2c3e50;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 15px;
}

.phone-frame {
  width: 100%;
  max-width: 430px;
  height: auto;
  max-height: 92vh;
  background-color: #ffffff;
  border-radius: 32px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 6px solid #1a252f;
  position: relative;
}

.app-header {
  background-color: #fffaf0;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ffe0b2;
}

.header-title {
  font-size: 1rem;
  font-weight: 900;
  color: #e67e22;
}

.app-content {
  overflow-y: auto;
  background-color: #fcfcfc;
}

/* 画面切り替え */
.screen {
  display: none;
  padding: 16px;
}

.screen.active {
  display: flex;
  flex-direction: column;
}

.pharmacist-container h3 {
  font-size: 0.95rem;
  font-weight: 900;
  color: #333;
  margin-bottom: 6px;
}

.pharmacist-container h4 {
  font-size: 0.85rem;
  font-weight: 700;
  color: #555;
  margin-bottom: 4px;
}

.pharmacist-container label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #444;
  margin-top: 6px;
  margin-bottom: 2px;
  display: block;
}

.pharmacist-container input[type="text"],
.pharmacist-container input[type="time"],
.pharmacist-container select {
  width: 100%;
  padding: 8px;
  border: 1.5px solid #ccc;
  border-radius: 8px;
  font-size: 0.85rem;
  margin-bottom: 4px;
  background-color: #fff;
  color: #333;
  user-select: text;
}

.time-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
}

.divider {
  margin: 12px 0;
  border: 0;
  height: 1px;
  background: #ddd;
}

/* ボタン関連 */
.action-btn {
  width: 100%;
  padding: 12px;
  background: #2ecc71;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 900;
  cursor: pointer;
  margin-top: 8px;
}

.action-btn:active {
  transform: scale(0.98);
}

.btn-orange {
  background-color: #e67e22;
  margin-top: 14px;
}

.btn-blue {
  background-color: #2980b9;
  padding: 8px;
  font-size: 0.85rem;
  margin-top: 0;
  margin-bottom: 8px;
}

.btn-green {
  background-color: #27ae60;
  padding: 9px;
  font-size: 0.9rem;
}

/* 2画面目用要素 */
.target-patient-box {
  background: #fff3e0;
  border: 1.5px solid #ffe0b2;
  border-radius: 8px;
  padding: 6px 10px;
  margin-bottom: 8px;
  font-size: 0.85rem;
  color: #333;
}

.target-patient-box span {
  font-weight: 900;
  color: #e67e22;
}

.instruction-box {
  background: #f8f9fa;
  border-left: 3px solid #27ae60;
  padding: 6px 8px;
  margin-bottom: 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #555;
  line-height: 1.35;
}

#qr-reader-container {
  display: none;
  margin-bottom: 8px;
}

#qr-reader {
  width: 100%;
}

.cancel-scan-btn {
  margin-top: 4px;
  width: 100%;
  padding: 6px;
  background: #e74c3c;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: bold;
  cursor: pointer;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 8px;
  background: #fff;
  border: 1.5px solid #ccc;
  border-radius: 8px;
  margin-bottom: 6px;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  margin: 0;
  cursor: pointer;
}

.registered-medicines-list {
  margin-top: 10px;
}

#medicine-list {
  list-style: none;
  max-height: 90px;
  overflow-y: auto;
}

#medicine-list li {
  background: #fff;
  border: 1.5px solid #eee;
  border-radius: 8px;
  padding: 6px 10px;
  margin-bottom: 4px;
  font-size: 0.8rem;
}

.back-step-btn {
  margin-top: 10px;
  width: 100%;
  padding: 8px;
  background: #7f8c8d;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}
