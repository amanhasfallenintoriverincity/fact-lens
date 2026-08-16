// 설정 저장
document.getElementById('save').addEventListener('click', async () => {
  const geminiApiKey = document.getElementById('geminiApiKey').value.trim();

  if (!geminiApiKey) {
    showStatus('Gemini API Key는 필수입니다.', 'error');
    return;
  }

  try {
    await chrome.storage.sync.set({ geminiApiKey });
    showStatus('설정이 저장되었습니다.', 'success');
  } catch {
    showStatus('저장 중 오류가 발생했습니다.', 'error');
  }
});

// 설정 불러오기
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get(['geminiApiKey']);
  if (settings.geminiApiKey) {
    document.getElementById('geminiApiKey').value = settings.geminiApiKey;
  }
});

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;

  setTimeout(() => {
    status.className = 'status';
  }, 3000);
}
