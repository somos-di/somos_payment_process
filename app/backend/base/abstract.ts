import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { HttpHeaders } from '../types/http.js';

export abstract class AsyncHttpClient {
  protected client: AxiosInstance;

  constructor(baseURL: string, timeoutMs?: number) {
    this.client = axios.create({ baseURL, ...(timeoutMs !== undefined && { timeout: timeoutMs }) });
    this.client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
      const headers = await this.getAuthHeaders();
      for (const [headerName, headerValue] of Object.entries(headers)) config.headers[headerName] = headerValue;
      return config;
    });
  }

  protected async getAuthHeaders(): Promise<HttpHeaders> { return {}; }
  protected async getAuthToken(): Promise<string> { return ''; }

  protected async post(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<unknown> {
    return (await this.client.post(url, body, config)).data;
  }
  protected async get(url: string, config?: AxiosRequestConfig): Promise<unknown> {
    return (await this.client.get(url, config)).data;
  }
}
