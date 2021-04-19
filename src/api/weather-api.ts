/*
 * Copyright (c) 2021. Slava Mankivski
 */

import {Logger} from 'homebridge';
import {AuthenticationError} from '../errors';
import axios, {AxiosRequestConfig, AxiosResponse} from 'axios';
import {Session} from './session';
import {BoundDevicePayload, RealtimeState, RealtimeStatePayload, WeatherDevice} from './response';
import crypto from 'crypto';
import {State} from './state';

export class WeatherApi {
  private session: Session | undefined;
  private state: State;
  private apiBaseUrl = 'https://app.emaxlife.net/V1.0';
  private md5Key = 'emax@pwd123';

  constructor(
    private username: string,
    private password: string,
    private log?: Logger,
  ) {
    this.state = new State();
  }

  public async getBoundDevice(): Promise<WeatherDevice | undefined> {
    if (!this.session?.hasToken()) {
      throw new Error('No valid token');
    }

    const {data} = await this.sendRequest<BoundDevicePayload>(
      '/weather/getBindedDevice',
      {},
      {
        emaxToken: this.session?.getAccessToken(),
      },
      'GET',
    );

    if (data.status === 0) {
      return data.content;
    } else {
      throw new Error(`No valid response from API: ${JSON.stringify(data)}`);
    }
  }

  public getRealtimeState(): RealtimeState {
    return this.state.getState();
  }

  public async retrieveState(): Promise<void> {
    if (!this.session?.hasToken()) {
      throw new Error('No valid token');
    }

    const {data} = await this.sendRequest<RealtimeStatePayload>(
      '/weather/devData/getRealtime',
      {},
      {
        emaxToken: this.session?.getAccessToken(),
      },
      'GET',
    );

    if (data.status === 0) {
      this.state.setState(data.content);
    } else {
      throw new Error(`No valid response from API: ${JSON.stringify(data)}`);
    }
  }

  public async retrieveToken(): Promise<Session> {
    let data: AxiosResponse['data'] = {status: 0};
    if (!this.session?.hasToken()) {
      this.log?.debug('Requesting new token');
      // No token, lets get a token from the Emaxlife API
      if (!this.username) {
        throw new AuthenticationError('No username configured');
      }
      if (!this.password) {
        throw new AuthenticationError('No password configured');
      }

      const form = {
        email: this.username,
        pwd: crypto.createHash('md5').update(this.password + this.md5Key).digest('hex'),
      };

      data = (
        await axios({
          url: '/account/login',
          baseURL: this.apiBaseUrl,
          data: form,
          method: 'POST',
        })
      ).data;
    }

    if (data.status !== 0) {
      throw new AuthenticationError(data.errorMsg);
    }

    if (!this.session?.hasToken()) {
      this.session = new Session(data.content.token);
    } else {
      this.session.resetToken(data.access_token);
    }

    return this.session;
  }

  /*
   * --------------------------------------
   * HTTP methods
   */

  public async sendRequest<T = Record<string, unknown>>(
    url: AxiosRequestConfig['url'],
    data: AxiosRequestConfig['data'],
    headers: AxiosRequestConfig['headers'],
    method: AxiosRequestConfig['method'],
  ): Promise<{ data: T }> {
    this.log?.debug(
      'Sending HTTP %s request to %s.',
      method,
      url,
    );

    const response = await axios({
      baseURL: this.apiBaseUrl,
      url,
      data,
      headers,
      method,
    });

    return {data: response.data};
  }
}
