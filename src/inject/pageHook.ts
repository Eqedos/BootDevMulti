(() => {
    if ((window as any).__bdb_token_hooked) return;
    (window as any).__bdb_token_hooked = true;
  
    const jwtRx = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    const capture = (auth: string | null) => {
      if (!auth || !auth.startsWith('Bearer ')) return;
      const tok = auth.slice(7);
      if (jwtRx.test(tok)) {
        window.postMessage({ type: 'BDB_BOOTDEV_TOKEN', token: tok }, '*');
      }
    };
  
    const origHeadersSet = (Headers.prototype as any).set;
    (Headers.prototype as any).set = function (name: any, value: any) {
      if (/^authorization$/i.test(name)) capture(value);
      return origHeadersSet.apply(this, arguments as any);
    };
  
    const OrigRequest = Request as any;
    (window as any).Request = function (input: any, init: any) {
      if (init?.headers) {
        const h = init.headers.Authorization || init.headers.authorization;
        capture(h);
      }
      const req = new OrigRequest(input, init);
      try { capture(req.headers.get('authorization')); } catch {}
      return req;
    };
    (window as any).Request.prototype = OrigRequest.prototype;
  
    const origFetch = window.fetch;
    window.fetch = async (input: any, init: any) => {
      try {
        if (init?.headers) {
          const h = init.headers.Authorization || init.headers.authorization;
          capture(h);
        }
        if (input instanceof Request) capture((input as Request).headers.get('authorization'));
      } catch {}
      return origFetch(input, init);
    };
  
    const origSetHeader = (XMLHttpRequest.prototype as any).setRequestHeader;
    (XMLHttpRequest.prototype as any).setRequestHeader = function (name: string, value: string) {
      if (/^authorization$/i.test(name)) capture(value);
      return origSetHeader.apply(this, arguments as any);
    };
  
    try {
      const tok = (() => {
        const scan = (store: any) => {
          for (const v of Object.values(store)) {
            if (typeof v === 'string' && jwtRx.test(v)) return v;
            try {
              const o = JSON.parse(v as string);
              for (const k of ['token', 'access_token', 'authToken']) {
                const c = o?.[k];
                if (typeof c === 'string' && jwtRx.test(c)) return c;
              }
            } catch {}
          }
          return null;
        };
        return scan(localStorage) || scan(sessionStorage);
      })();
      if (tok) capture(`Bearer ${tok}`);
    } catch {}
  })();
  