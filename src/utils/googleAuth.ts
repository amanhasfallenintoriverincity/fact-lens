const TOKEN_STORAGE_KEY = 'googleOAuthToken';
const TOKEN_EXPIRY_KEY = 'googleOAuthTokenExpiry';

export async function getOAuthToken(): Promise<string> {
  const stored = await chrome.storage.local.get([TOKEN_STORAGE_KEY, TOKEN_EXPIRY_KEY]);
  const token = stored[TOKEN_STORAGE_KEY];
  const expiry = stored[TOKEN_EXPIRY_KEY];

  // 캐시된 토큰이 있고 유효한지 확인
  if (token && expiry && Date.now() < expiry) {
    console.log('[Fact Lens] 캐시된 OAuth 토큰 사용');
    
    // 토큰 유효성 확인
    const isValid = await validateToken(token);
    if (isValid) {
      return token;
    } else {
      console.log('[Fact Lens] 캐시된 토큰이 유효하지 않음, 새로 발급');
      await clearOAuthToken();
    }
  }

  console.log('[Fact Lens] 새 OAuth 토큰 요청 중...');
  return refreshOAuthToken();
}

async function validateToken(token: string): Promise<boolean> {
  try {
    // Google Token Info API로 토큰 유효성 확인
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`);
    if (!response.ok) {
      console.log('[Fact Lens] 토큰 유효성 검사 실패:', response.status);
      return false;
    }
    
    const info = await response.json();
    console.log('[Fact Lens] 토큰 정보:', {
      scope: info.scope,
      expires_in: info.expires_in,
      email: info.email
    });
    
    // factchecktools 스코프가 포함되어 있는지 확인
    const hasRequiredScope = info.scope?.includes('factchecktools');
    if (!hasRequiredScope) {
      console.log('[Fact Lens] 필요한 스코프가 없음. 현재 스코프:', info.scope);
    }
    
    return hasRequiredScope && info.expires_in > 0;
  } catch (error) {
    console.error('[Fact Lens] 토큰 유효성 검사 중 오류:', error);
    return false;
  }
}

export async function refreshOAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('[Fact Lens] OAuth 에러:', chrome.runtime.lastError.message);
        reject(new Error(`OAuth 인증 실패: ${chrome.runtime.lastError.message}`));
        return;
      }

      if (!token) {
        console.error('[Fact Lens] OAuth 토큰이 비어있습니다.');
        reject(new Error('OAuth 토큰을 받지 못했습니다.'));
        return;
      }

      console.log('[Fact Lens] OAuth 토큰 획득 성공');
      
      // 토큰 유효성 즉시 확인
      validateToken(token).then(isValid => {
        if (isValid) {
          const expiry = Date.now() + 3600 * 1000;
          chrome.storage.local.set({
            [TOKEN_STORAGE_KEY]: token,
            [TOKEN_EXPIRY_KEY]: expiry,
          });
          resolve(token);
        } else {
          reject(new Error('획득한 토큰이 유효하지 않습니다. Chrome 설정에서 Fact Lens 권한을 확인해주세요.'));
        }
      });
    });
  });
}

export async function clearOAuthToken(): Promise<void> {
  const stored = await chrome.storage.local.get([TOKEN_STORAGE_KEY]);
  const token = stored[TOKEN_STORAGE_KEY];
  
  if (token) {
    await chrome.identity.removeCachedAuthToken({ token }, () => {
      console.log('[Fact Lens] OAuth 토큰 캐시 제거됨');
    });
  }
  
  await chrome.storage.local.remove([TOKEN_STORAGE_KEY, TOKEN_EXPIRY_KEY]);
  console.log('[Fact Lens] OAuth 토큰 완전 제거됨');
}
