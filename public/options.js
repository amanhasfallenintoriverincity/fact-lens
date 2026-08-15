// Options Page Script

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settingsForm');
  const cancelBtn = document.getElementById('cancelBtn');
  const successMessage = document.getElementById('successMessage');
  
  // 기존 설정 로드
  const settings = await loadSettings();
  if (settings.geminiApiKey) {
    document.getElementById('geminiKey').value = settings.geminiApiKey;
  }
  if (settings.kosisApiKey) {
    document.getElementById('kosisKey').value = settings.kosisApiKey;
  }
  
  // 저장 버튼
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const geminiKey = document.getElementById('geminiKey').value.trim();
    const kosisKey = document.getElementById('kosisKey').value.trim();
    
    if (!geminiKey) {
      alert('Gemini API 키는 필수입니다.');
      return;
    }
    
    await saveSettings({
      geminiApiKey: geminiKey,
      kosisApiKey: kosisKey
    });
    
    // 성공 메시지 표시
    successMessage.classList.add('show');
    
    // 2초 후 창 닫기
    setTimeout(() => {
      window.close();
    }, 2000);
  });
  
  // 취소 버튼
  cancelBtn.addEventListener('click', () => {
    window.close();
  });
});

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['geminiApiKey', 'kosisApiKey'], (settings) => {
      resolve(settings);
    });
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => {
      resolve();
    });
  });
}
