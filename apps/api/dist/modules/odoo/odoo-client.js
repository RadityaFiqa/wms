"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdooClient = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
let OdooClient = class OdooClient {
    async getLoginPage(baseUrl) {
        const url = `${baseUrl.replace(/\/$/, '')}/web/login`;
        try {
            const response = await axios_1.default.get(url, {
                headers: {
                    'User-Agent': 'Bulog-WMS/1.0',
                },
                timeout: 10000,
            });
            const html = response.data;
            const csrfMatch = html.match(/csrf_token:\s*["']([^"']+)["']/);
            if (!csrfMatch) {
                throw new Error('Gagal mengekstrak CSRF Token dari halaman login Odoo. Periksa apakah URL Odoo benar.');
            }
            const csrfToken = csrfMatch[1];
            const cookies = response.headers['set-cookie'] || [];
            return { csrfToken, cookies };
        }
        catch (err) {
            throw new Error(`Koneksi ke Odoo gagal: ${err.message}`);
        }
    }
    async login(baseUrl, payload, initialCookies) {
        const url = `${baseUrl.replace(/\/$/, '')}/web/login`;
        const cookieHeader = initialCookies.map((c) => c.split(';')[0]).join('; ');
        const formParams = new URLSearchParams();
        formParams.append('csrf_token', payload.csrfToken);
        formParams.append('login', payload.login);
        formParams.append('password', payload.pass);
        formParams.append('redirect', '');
        try {
            const response = await axios_1.default.post(url, formParams.toString(), {
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
            let sessionId = null;
            for (const cookie of setCookies) {
                const match = cookie.match(/session_id=([^;]+)/);
                if (match) {
                    sessionId = match[1];
                    break;
                }
            }
            const location = response.headers['location'] || '';
            if (location.includes('error=') ||
                (!sessionId && !cookieHeader.includes('session_id='))) {
                throw new Error('Kredensial Odoo salah atau akses ditolak.');
            }
            if (!sessionId) {
                const match = cookieHeader.match(/session_id=([^;]+)/);
                sessionId = match ? match[1] : null;
            }
            if (!sessionId) {
                throw new Error('Gagal mendapatkan Session ID dari respon Odoo.');
            }
            return { sessionId, csrfToken: payload.csrfToken };
        }
        catch (err) {
            if (err.message.includes('Kredensial Odoo')) {
                throw err;
            }
            throw new Error(`Login Odoo gagal: ${err.message}`);
        }
    }
    async authenticate(baseUrl, username, pass) {
        const { csrfToken, cookies } = await this.getLoginPage(baseUrl);
        return this.login(baseUrl, { csrfToken, login: username, pass }, cookies);
    }
    async getSessionInfo(baseUrl, sessionId) {
        const url = `${baseUrl.replace(/\/$/, '')}/web/session/info`;
        const payload = {
            id: Math.floor(Math.random() * 1000000),
            jsonrpc: '2.0',
            method: 'call',
            params: {},
        };
        try {
            const response = await axios_1.default.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `session_id=${sessionId}`,
                    'User-Agent': 'Bulog-WMS/1.0',
                },
                timeout: 15000,
            });
            if (response.data.error) {
                throw new Error(`Odoo Session Info Error: ${JSON.stringify(response.data.error)}`);
            }
            return response.data.result;
        }
        catch (err) {
            throw new Error(`Gagal memanggil Session Info Odoo: ${err.message}`);
        }
    }
    async call(baseUrl, sessionId, payloadParams) {
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
            const response = await axios_1.default.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `session_id=${sessionId}`,
                    'User-Agent': 'Bulog-WMS/1.0',
                },
                timeout: 30000,
            });
            if (response.data.error) {
                throw new Error(`Odoo RPC Error: ${JSON.stringify(response.data.error)}`);
            }
            return response.data.result;
        }
        catch (err) {
            throw new Error(`Gagal memanggil RPC Odoo: ${err.message}`);
        }
    }
};
exports.OdooClient = OdooClient;
exports.OdooClient = OdooClient = __decorate([
    (0, common_1.Injectable)()
], OdooClient);
//# sourceMappingURL=odoo-client.js.map