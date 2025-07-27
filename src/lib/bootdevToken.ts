
const JWT_KEY = 'bootdevJWT';

type JwtPayload = { exp?: number };

export async function getBootDevToken(): Promise<string | null> {
  const tok = await getFromStorage(JWT_KEY);
  if (tok && !isExpired(tok)) return tok;

  const fresh = await waitForPostedToken(4000);
  if (fresh && !isExpired(fresh)) {
    await setInStorage(JWT_KEY, fresh);
    return fresh;
  }

  console.warn('[BDB] No Boot.dev JWT available');
  return null;
}


function isExpired(token: string): boolean {
  try {
    const payload: JwtPayload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp - 30 < now; 
  } catch {
    return true;
  }
}

function mask(tok: string) {
  return tok.slice(0, 16) + '…' + tok.slice(-8);
}

function getFromStorage(key: string): Promise<string | null> {
  return new Promise(res => {
    if (!chrome?.storage?.local) return res(null);
    chrome.storage.local.get(key, out => res(out[key] ?? null));
  });
}

function setInStorage(key: string, val: string): Promise<void> {
  return new Promise(res => {
    if (!chrome?.storage?.local) return res();
    chrome.storage.local.set({ [key]: val }, () => res());
  });
}

function waitForPostedToken(timeoutMs: number): Promise<string | null> {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      window.removeEventListener('message', handler);
      resolve(null);
    }, timeoutMs);

    const handler = (e: MessageEvent) => {
      if (done) return;
      if (e.data?.type === 'BDB_BOOTDEV_TOKEN') {
        done = true;
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        resolve(e.data.token as string);
      }
    };

    window.addEventListener('message', handler);
  });
}

export function clearBootDevToken(): Promise<void> {
  return setInStorage(JWT_KEY, '');
}
