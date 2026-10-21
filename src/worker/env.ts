/** What the Worker is given: bindings and settings (see wrangler.jsonc and .dev.vars). */
export interface Env {
  ASSETS: Fetcher;
  OPENROUTER_API_KEY: string;
  LOOKUP_MODEL: string;
  /** Faster model for sentence translation. Falls back to LOOKUP_MODEL. */
  TRANSLATE_MODEL?: string;
  /** Answer cache and daily counters. */
  CACHE?: KVNamespace;
  /** Accounts, synced data and word counts. */
  DB: D1Database;
  /** Cloudflare Email Service. */
  EMAIL: {
    send(message: {
      to: string;
      from: { email: string; name?: string };
      subject: string;
      html?: string;
      text?: string;
    }): Promise<unknown>;
  };
  EMAIL_FROM: string;
  /** Sign-in emails allowed per day across everyone. Default 300. */
  EMAILS_PER_DAY?: string;
  /** Model calls allowed per day across all visitors. Cache hits do not count. Default 6000. */
  DAILY_MODEL_CALLS?: string;
  /** The site's address, used in sign-in links. Ignored on localhost. */
  PUBLIC_URL?: string;
  /** Set only in .dev.vars: return the sign-in link in the response instead of relying on email. */
  DEV_SHOW_LINK?: string;
}

export interface AppEnv {
  Bindings: Env;
  Variables: { user?: { id: string; email: string } };
}
