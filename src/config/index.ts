declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
    }
  }
}

function initConfig() {
  const _CONFIG = {
    SUPABASE: {
      URL: process.env.SUPABASE_URL,
      ANON_KEY: process.env.SUPABASE_ANON_KEY,
    }
  }
  return _CONFIG;
}

const CONFIG = initConfig();
export default CONFIG;