import Axios, { AxiosRequestConfig } from 'axios';

interface IRpcResponseEnvelop<T> {
  jsonrpc: string;
  id: number | string;
  result: T;
  error?: {
    code: number;
    message: string;
  };
}

interface IRpcRequest {
  jsonrpc: '2.0' | '1.0';
  id: number | string;
  method: string;
  params: any[];
}

interface IRpcConfig {
  protocol: string;
  host: string;
  port: string;
  user: string;
  pass: string;
}

export class RPCClient {
  protected _config: IRpcConfig;

  constructor(config: IRpcConfig) {
    this._config = config;
  }

  /**
   * JSON-RPC call func
   * @param method RPC Request Method
   * @param params RPC Request Params
   * @param id RPC Request id
   * @returns RPCResponse<T>
   * @throws Response non-2xx response or request error
   */
  public async call<T>(method: string, params?: any[], id?: number | string): Promise<T> {
    const reqData: IRpcRequest = {
      id: id || Date.now(),
      jsonrpc: '2.0',
      method,
      params: params || [],
    };

    const endpoint = this._getEndpoint();
    const reqConfig = this._getRequestConfig();

    try {
      const response = await Axios.post<IRpcResponseEnvelop<T>>(endpoint, reqData, reqConfig);
      const rawData = response.data;
      if (rawData.error) {
        throw new Error(`Something wrong: ${JSON.stringify(rawData.error)}`);
      }

      return rawData.result;
    } catch (error) {
      // Axios error handling: https://github.com/axios/axios#handling-errors
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw error;
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        throw error;
      } else {
        // Something happened in setting up the request that triggered an Error
        throw error;
      }
    }
  }

  public _getEndpoint(): string {
    const protocol = this._config.protocol;
    const host = this._config.host;
    const port = this._config.port;
    if (!port) {
      return `${protocol}://${host}`;
    }
    return `${protocol}://${host}:${port}`;
  }

  protected _getRequestConfig(): AxiosRequestConfig {
    if (!this._config.user || !this._config.pass) {
      return null;
    }
    return {
      auth: {
        username: this._config.user,
        password: this._config.pass,
      },
      timeout: 15 * 1000, // 60 sec
    };
  }
}

export default RPCClient;
