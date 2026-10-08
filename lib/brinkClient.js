'use strict';

// Client voor de (niet officieel gedocumenteerde) Brink Home-API v1.1.
// Inloggen gaat via OIDC Authorization Code + PKCE op www.brink-home.com,
// net als de Brink Home-webapp. Gebaseerd op de werkwijze van
// samuolis/brink (Home Assistant, MIT-licentie).

const crypto = require('node:crypto');

const HOST = 'www.brink-home.com';
const API = `https://${HOST}/portal/api/v1.1/`;
const AUTH_URL = `https://${HOST}/idsrv/connect/authorize`;
const TOKEN_URL = `https://${HOST}/idsrv/connect/token`;
const CLIENT_ID = 'spa';
const REDIRECT_URI = `https://${HOST}/app/`;
const SCOPE = 'openid api role locale';
const BROWSER_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'accept-language': 'nl-NL,nl;q=0.9,en;q=0.8',
};

class BrinkAuthError extends Error {
  constructor(message, { credentials = false } = {}) {
    super(message);
    this.name = 'BrinkAuthError';
    this.credentials = credentials;
  }
}

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function isTrusted(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === HOST;
  } catch {
    return false;
  }
}

// Eenvoudige cookie-opslag voor de inlogstappen (fetch bewaart zelf geen cookies).
class CookieJar {
  constructor() { this.cookies = new Map(); }
  store(res) {
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '); }
}

function inputValue(html, name) {
  const re = new RegExp(`<input[^>]*name=["']${name}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag?.match(/value=["']([^"']*)["']/i)?.[1]?.replace(/&amp;/g, '&');
}

function codeFrom(url, state) {
  try {
    const u = new URL(url, `https://${HOST}`);
    if (u.searchParams.get('state') && u.searchParams.get('state') !== state) return null;
    return u.searchParams.get('code');
  } catch {
    return null;
  }
}

class BrinkClient {
  constructor({ username, password, timeoutMs = 20000, debug = () => {} }) {
    this.username = username;
    this.password = password;
    this.timeoutMs = timeoutMs;
    this.debug = debug;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = 0;
  }

  // De inlogpagina geeft status 500 zonder browserachtige kopregels.
  async request(url, opts = {}) {
    const headers = { ...BROWSER_HEADERS, ...(opts.headers || {}) };
    return fetch(url, { ...opts, headers, signal: AbortSignal.timeout(this.timeoutMs) });
  }

  async login() {
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(32));
    const nonce = b64url(crypto.randomBytes(32));
    const jar = new CookieJar();

    // 1. Inlogpagina ophalen (volgt redirects handmatig om cookies te bewaren)
    let url = `${AUTH_URL}?${new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: SCOPE,
      state, nonce, code_challenge: challenge, code_challenge_method: 'S256',
    })}`;
    let res;
    for (let i = 0; i < 10; i++) {
      res = await this.request(url, { redirect: 'manual', headers: { cookie: jar.header() } });
      jar.store(res);
      if (res.status >= 300 && res.status < 400) {
        url = new URL(res.headers.get('location'), url).toString();
        if (!isTrusted(url)) throw new BrinkAuthError('Login page redirected to an unknown host');
        continue;
      }
      break;
    }
    if (res.status !== 200) throw new BrinkAuthError(`Login page returned status ${res.status}`);
    const html = await res.text();
    const csrf = inputValue(html, '__RequestVerificationToken');
    if (!csrf) throw new BrinkAuthError('No CSRF token found on the login page');
    const returnUrl = inputValue(html, 'ReturnUrl');

    // 2. Gebruikersnaam en wachtwoord versturen
    const form = new URLSearchParams({ Username: this.username, Password: this.password, __RequestVerificationToken: csrf });
    if (returnUrl && ((returnUrl.startsWith('/') && !returnUrl.startsWith('//')) || isTrusted(returnUrl))) form.set('ReturnUrl', returnUrl);
    res = await this.request(url, {
      method: 'POST', redirect: 'manual', body: form,
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: jar.header() },
    });
    jar.store(res);
    if (res.status === 200) throw new BrinkAuthError('Brink Home rejected the e-mail address or password', { credentials: true });

    // 3. Redirects volgen tot de autorisatiecode verschijnt
    let code = null;
    let next = res.headers.get('location');
    for (let i = 0; i < 10 && next && !code; i++) {
      next = new URL(next, url).toString();
      code = codeFrom(next, state);
      if (code || !isTrusted(next)) break;
      res = await this.request(next, { redirect: 'manual', headers: { cookie: jar.header() } });
      jar.store(res);
      url = next;
      next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    }
    if (!code) throw new BrinkAuthError('No authorization code received from Brink Home');

    // 4. Code inwisselen voor tokens
    this.debug('Login: authorization code received');
    await this.tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, client_id: CLIENT_ID, code_verifier: verifier });
  }

  async tokenRequest(params) {
    const res = await this.request(TOKEN_URL, {
      method: 'POST', body: new URLSearchParams(params),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    if (res.status !== 200) throw new BrinkAuthError(`Token request returned status ${res.status}`);
    const p = await res.json();
    if (!p.access_token) throw new BrinkAuthError('No access token received');
    this.accessToken = p.access_token;
    this.refreshToken = p.refresh_token || this.refreshToken;
    this.tokenExpiry = Date.now() + ((p.expires_in || 3599) - 60) * 1000;
    this.debug(`Token received (${params.grant_type}), valid ${p.expires_in || 3599}s, refresh token: ${p.refresh_token ? 'yes' : 'no'}`);
  }

  async ensureToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) return;
    if (this.refreshToken) {
      try {
        await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: this.refreshToken, client_id: CLIENT_ID });
        return;
      } catch {
        this.refreshToken = null;
      }
    }
    await this.login();
  }

  async api(method, path, body) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await this.ensureToken();
      const res = await this.request(API + path, {
        method,
        headers: { authorization: `Bearer ${this.accessToken}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      this.debug(`${method} ${path} -> ${res.status}`);
      if (res.status === 401 && attempt === 0) { this.accessToken = null; this.tokenExpiry = 0; continue; }
      if (!res.ok) throw new Error(`Brink Home ${method} ${path}: status ${res.status}`);
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }
    throw new BrinkAuthError('Authentication failed after retry');
  }

  async getSystems() {
    const p = await this.api('GET', 'systems?pageSize=10');
    return (p?.items || []).map((s) => ({
      id: s.systemShareId, name: s.systemName || 'Brink', serial: s.serialNumber, gatewayState: s.gatewayState, raw: s,
    }));
  }

  // Alle parameters plat, op naam (de API gebruikt Duitse namen als sleutel).
  async getParameters(systemId) {
    const p = await this.api('GET', `systems/${systemId}/uidescription`);
    const out = {};
    const walk = (items) => {
      for (const nav of items || []) {
        for (const group of nav.parameterGroups || []) {
          for (const prm of group.parameters || []) {
            out[prm.name || `id_${prm.id}`] = {
              name: prm.name, value: prm.value, valueId: prm.valueId, readWrite: prm.readWrite,
              controlType: prm.controlType, min: prm.minValue, max: prm.maxValue, unit: prm.unit || prm.unitOfMeasure,
              options: (prm.listItems || []).filter((i) => i.isSelectable !== false).map((i) => ({ value: String(i.value), label: i.displayText || i.text || i.translationId })),
            };
          }
        }
        walk(nav.navigationItems);
      }
    };
    walk(p?.root?.navigationItems);
    return out;
  }

  async writeParameters(systemId, values) {
    return this.api('PUT', `systems/${systemId}/parameter-values`, {
      writeValues: values.map(({ valueId, value }) => ({ valueId, value: String(value), state: 0 })),
    });
  }
}

module.exports = { BrinkClient, BrinkAuthError };
