import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OdooClient {
  /**
   * Fetches the Odoo login page, extracts the CSRF token, and returns the session cookies.
   */
  async getLoginPage(
    baseUrl: string,
  ): Promise<{ csrfToken: string; cookies: string[] }> {
    const url = `${baseUrl.replace(/\/$/, '')}/web/login`;

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Bulog-WMS/1.0',
        },
        timeout: 10000,
      });

      const html = response.data;
      // Extract CSRF token using RegExp from odoo script layout block
      const csrfMatch = html.match(/csrf_token:\s*["']([^"']+)["']/);
      if (!csrfMatch) {
        throw new Error(
          'Gagal mengekstrak CSRF Token dari halaman login Odoo. Periksa apakah URL Odoo benar.',
        );
      }

      const csrfToken = csrfMatch[1];
      const cookies = response.headers['set-cookie'] || [];

      return { csrfToken, cookies };
    } catch (err: any) {
      throw new Error(`Koneksi ke Odoo gagal: ${err.message}`);
    }
  }

  /**
   * Submits credentials to Odoo and returns the authenticated session ID.
   */
  async login(
    baseUrl: string,
    payload: { csrfToken: string; login: string; pass: string },
    initialCookies: string[],
  ): Promise<{ sessionId: string; csrfToken: string }> {
    const url = `${baseUrl.replace(/\/$/, '')}/web/login`;

    // Extract only cookie name=value from initial cookies array
    const cookieHeader = initialCookies.map((c) => c.split(';')[0]).join('; ');

    const formParams = new URLSearchParams();
    formParams.append('csrf_token', payload.csrfToken);
    formParams.append('login', payload.login);
    formParams.append('password', payload.pass);
    formParams.append('redirect', '');

    try {
      const response = await axios.post(url, formParams.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookieHeader,
          'User-Agent': 'Bulog-WMS/1.0',
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        timeout: 10000,
      });

      const setCookies = response.headers['set-cookie'] || [];
      let sessionId: string | null = null;

      for (const cookie of setCookies) {
        const match = cookie.match(/session_id=([^;]+)/);
        if (match) {
          sessionId = match[1];
          break;
        }
      }

      const location = response.headers['location'] || '';
      if (
        location.includes('error=') ||
        (!sessionId && !cookieHeader.includes('session_id='))
      ) {
        throw new Error('Kredensial Odoo salah atau akses ditolak.');
      }

      // If Odoo didn't set a new session ID but redirect succeeded, fallback to initial session ID
      if (!sessionId) {
        const match = cookieHeader.match(/session_id=([^;]+)/);
        sessionId = match ? match[1] : null;
      }

      if (!sessionId) {
        throw new Error('Gagal mendapatkan Session ID dari respon Odoo.');
      }

      return { sessionId, csrfToken: payload.csrfToken };
    } catch (err: any) {
      if (err.message.includes('Kredensial Odoo')) {
        throw err;
      }
      throw new Error(`Login Odoo gagal: ${err.message}`);
    }
  }

  /**
   * Helper that authenticates directly against Odoo.
   */
  async authenticate(
    baseUrl: string,
    username: string,
    pass: string,
  ): Promise<{ sessionId: string; csrfToken: string }> {
    const { csrfToken, cookies } = await this.getLoginPage(baseUrl);
    return this.login(baseUrl, { csrfToken, login: username, pass }, cookies);
  }

  /**
   * Fetches session information from Odoo (useful for getting uid, company_id, user_context, etc.).
   */
  async getSessionInfo(baseUrl: string, sessionId: string): Promise<any> {
    const url = `${baseUrl.replace(/\/$/, '')}/web/session/info`;
    const payload = {
      id: Math.floor(Math.random() * 1000000),
      jsonrpc: '2.0',
      method: 'call',
      params: {},
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_id=${sessionId}`,
          'User-Agent': 'Bulog-WMS/1.0',
        },
        timeout: 15000,
      });

      if (response.data.error) {
        throw new Error(
          `Odoo Session Info Error: ${JSON.stringify(response.data.error)}`,
        );
      }

      return response.data.result;
    } catch (err: any) {
      throw new Error(`Gagal memanggil Session Info Odoo: ${err.message}`);
    }
  }

  /**
   * General JSON-RPC method to call Odoo models.
   */
  async call(
    baseUrl: string,
    sessionId: string,
    payloadParams: {
      model: string;
      method: string;
      args?: any[];
      kwargs?: any;
    },
  ): Promise<any> {
    const url = `${baseUrl.replace(/\/$/, '')}/web/dataset/call_kw/${payloadParams.model}/${payloadParams.method}`;
    const payload = {
      id: Math.floor(Math.random() * 1000000),
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: payloadParams.model,
        method: payloadParams.method,
        args: payloadParams.args || [],
        kwargs: payloadParams.kwargs || {},
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_id=${sessionId}`,
          'User-Agent': 'Bulog-WMS/1.0',
        },
        timeout: 30000,
      });

      if (response.data.error) {
        throw new Error(
          `Odoo RPC Error: ${JSON.stringify(response.data.error)}`,
        );
      }

      return response.data.result;
    } catch (err: any) {
      throw new Error(`Gagal memanggil RPC Odoo: ${err.message}`);
    }
  }
}
