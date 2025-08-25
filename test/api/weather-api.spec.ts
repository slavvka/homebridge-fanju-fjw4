/*
 * Copyright (c) 2025. Slava Mankivski
 */

import axios from 'axios';
import {WeatherApi} from '../../src/api/weather-api';
import {AuthenticationError} from '../../src/errors';

jest.mock('axios');
const mockedAxios = axios as unknown as jest.MockedFunction<typeof axios>;

describe('WeatherApi', () => {
  const username = 'user@example.com';
  const password = 'password123';

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('token retrieval', () => {
    it('retrieves token with correct request and stores session', async () => {
      mockedAxios.mockResolvedValueOnce({
        data: { status: 0, content: { token: 'abc123' } },
      } as any);

      const api = new WeatherApi(username, password);
      const session = await api.retrieveToken();

      expect(session.getAccessToken()).toBe('abc123');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/account/login', method: 'POST' }),
      );
    });

    it('second retrieveToken call uses existing session path', async () => {
      mockedAxios.mockResolvedValueOnce({ data: { status: 0, content: { token: 'abc123' } } } as any);
      const api = new WeatherApi(username, password);
      await api.retrieveToken();

      (mockedAxios as any).mockResolvedValueOnce({ data: { status: 0, access_token: 'def456' } });
      const session = await api.retrieveToken();
      expect(session.getAccessToken()).toBeUndefined();
    });

    it('throws AuthenticationError when username missing', async () => {
      const api = new WeatherApi('', password);
      await expect(api.retrieveToken()).rejects.toBeInstanceOf(AuthenticationError);
    });

    it('throws AuthenticationError when password missing', async () => {
      const api = new WeatherApi(username, '');
      await expect(api.retrieveToken()).rejects.toBeInstanceOf(AuthenticationError);
    });

    it('logs debug when requesting new token and on sendRequest', async () => {
      const logger = { debug: jest.fn() } as any;
      mockedAxios.mockResolvedValueOnce({ data: { status: 0, content: { token: 'abc123' } } } as any);
      const api = new WeatherApi(username, password, logger);
      await api.retrieveToken();
      expect(logger.debug).toHaveBeenCalledWith('Requesting new token');

      mockedAxios.mockResolvedValueOnce({ data: {} } as any);
      await api.sendRequest('/any', {}, {}, 'GET');
      expect(logger.debug).toHaveBeenCalled();
    });
  });

  describe('device and state', () => {
    it('getBoundDevice sends GET with token header', async () => {
      mockedAxios.mockResolvedValueOnce({
        data: { status: 0, content: { token: 'abc123' } },
      } as any);

      const api = new WeatherApi(username, password);
      await api.retrieveToken();

      mockedAxios.mockResolvedValueOnce({
        data: { status: 0, content: { id: 1 } },
      } as any);

      const device = await api.getBoundDevice();
      expect(device).toEqual({ id: 1 });
      expect(mockedAxios).toHaveBeenLastCalledWith(
        expect.objectContaining({ url: '/weather/getBindedDevice', method: 'GET' }),
      );
    });

    it('retrieveState updates state when API returns status 0', async () => {
      mockedAxios.mockResolvedValueOnce({
        data: { status: 0, content: { token: 'abc123' } },
      } as any);

      const api = new WeatherApi(username, password);
      await api.retrieveToken();

      mockedAxios.mockResolvedValueOnce({
        data: { status: 0, content: { deviceMac: 'AA', sensorDatas: [] } },
      } as any);

      await api.retrieveState();
      expect(api.getRealtimeState()).toEqual({ deviceMac: 'AA', sensorDatas: [] });
    });

    it('error branches: no token', async () => {
      const api = new WeatherApi(username, password);
      await expect(api.getBoundDevice()).rejects.toThrow('No valid token');
      await expect(api.retrieveState()).rejects.toThrow('No valid token');
    });

    it('error branches: non-zero status responses', async () => {
      // retrieveToken non-zero
      mockedAxios.mockResolvedValueOnce({ data: { status: 1, errorMsg: 'bad' } } as any);
      const api1 = new WeatherApi(username, password);
      await expect(api1.retrieveToken()).rejects.toBeInstanceOf(AuthenticationError);

      // getBoundDevice non-zero
      mockedAxios.mockResolvedValueOnce({ data: { status: 0, content: { token: 't' } } } as any);
      const api2 = new WeatherApi(username, password);
      await api2.retrieveToken();
      mockedAxios.mockResolvedValueOnce({ data: { status: 1, errorMsg: 'bad' } } as any);
      await expect(api2.getBoundDevice()).rejects.toThrow('No valid response from API');

      // retrieveState non-zero
      mockedAxios.mockResolvedValueOnce({ data: { status: 0, content: { token: 't' } } } as any);
      const api3 = new WeatherApi(username, password);
      await api3.retrieveToken();
      mockedAxios.mockResolvedValueOnce({ data: { status: 1, errorMsg: 'bad' } } as any);
      await expect(api3.retrieveState()).rejects.toThrow('No valid response from API');
    });
  });
});
