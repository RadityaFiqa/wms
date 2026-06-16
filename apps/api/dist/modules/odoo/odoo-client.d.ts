export declare class OdooClient {
    getLoginPage(baseUrl: string): Promise<{
        csrfToken: string;
        cookies: string[];
    }>;
    login(baseUrl: string, payload: {
        csrfToken: string;
        login: string;
        pass: string;
    }, initialCookies: string[]): Promise<{
        sessionId: string;
        csrfToken: string;
    }>;
    authenticate(baseUrl: string, username: string, pass: string): Promise<{
        sessionId: string;
        csrfToken: string;
    }>;
    getSessionInfo(baseUrl: string, sessionId: string): Promise<any>;
    call(baseUrl: string, sessionId: string, payloadParams: {
        model: string;
        method: string;
        args?: any[];
        kwargs?: any;
    }): Promise<any>;
}
