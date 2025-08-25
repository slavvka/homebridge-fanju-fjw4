/*
 * Copyright (c) 2021. Slava Mankivski
 */

import {Mock} from 'moq.ts';
import {WeatherStationPlatform} from '../src/platform';
import {Logging} from 'homebridge/lib/logger';
import {API} from 'homebridge';
import {WeatherApi} from '../src/api/weather-api';
import {Session} from '../src/api/session';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

// Minimal fake HAP API to satisfy WeatherStation construction inside platform
const createApi = (): API => ({
  hap: {
    Service: class anyService {
      static AccessoryInformation = class {
        private name: string;
        private characteristics: Record<string, unknown> = {};
        constructor(name: string) { this.name = name; }
        setCharacteristic(key: any, value: any) { this.characteristics[key] = value; return this; }
      };
      static TemperatureSensor = class {
        constructor(public displayName: string, public subtype?: string) {}
        getCharacteristic() { return { onGet: jest.fn() }; }
      } as any;
      static HumiditySensor = class {
        constructor(public displayName: string, public subtype?: string) {}
        getCharacteristic() { return { onGet: jest.fn() }; }
      } as any;
    } as any,
    Characteristic: class anyCharacteristic {} as any,
  },
} as unknown as API);

describe('FJW4 Platform', () => {
  it('should be successfully created', () => {
    const logger = new Mock<Logging>()
      .setup((instance) => instance.info('Finished initializing platform:', 'NAME'))
      .returns()
      .object();
    const config = {
      platform: 'PLATFORM',
      name: 'NAME',
      options: {
        'username': 'USERNAME',
        'password': 'PASSWORD',
      },
    };
    const api = new Mock<API>().object();

    const platform = new WeatherStationPlatform(logger, config, api);
    expect(platform).toBeInstanceOf(WeatherStationPlatform);
  });

  it('logs info and exits when no options provided', () => {
    const logger = createLogger();
    const config: any = { platform: 'PL', name: 'NAME' };
    const api = createApi();

    // eslint-disable-next-line no-new
    new WeatherStationPlatform(logger as any, config, api);

    expect(logger.info).toHaveBeenCalledWith('No options found in configuration file, disabling plugin.');
  });

  it('logs error and exits when credentials missing', () => {
    const logger = createLogger();
    const config: any = { platform: 'PL', name: 'NAME', options: {} };
    const api = createApi();

    // eslint-disable-next-line no-new
    new WeatherStationPlatform(logger as any, config, api);

    expect(logger.error).toHaveBeenCalledWith('Missing required config parameter.');
  });

  it('registers two accessories and schedules state retrieval', async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const config: any = {
      platform: 'PL',
      name: 'NAME',
      options: { username: 'u', password: 'p', pollingInterval: 1 },
    };
    const api = createApi();

    // mock WeatherApi methods on prototype for instances created inside platform
    jest.spyOn(WeatherApi.prototype, 'retrieveToken').mockResolvedValue(new Session('abc') as any);
    jest.spyOn(WeatherApi.prototype, 'getBoundDevice').mockResolvedValue({ sn: 'SN' } as any);
    jest.spyOn(WeatherApi.prototype, 'retrieveState').mockResolvedValue();

    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    const platform = new WeatherStationPlatform(logger as any, config, api);

    let accessories: any[] = [];
    await platform.accessories((found) => { accessories = found; });

    expect(accessories.length).toBe(2);
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('uses default polling interval when not provided', async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const config: any = {
      platform: 'PL',
      name: 'NAME',
      options: { username: 'u', password: 'p' },
    };
    const api = createApi();

    jest.spyOn(WeatherApi.prototype, 'retrieveToken').mockResolvedValue(new Session('abc') as any);
    jest.spyOn(WeatherApi.prototype, 'getBoundDevice').mockResolvedValue({ sn: 'SN' } as any);
    jest.spyOn(WeatherApi.prototype, 'retrieveState').mockResolvedValue();

    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    const platform = new WeatherStationPlatform(logger as any, config, api);

    await platform.accessories(() => {});

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('propagates error in retrieveState', async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const config: any = {
      platform: 'PL',
      name: 'NAME',
      options: { username: 'u', password: 'p', pollingInterval: 1 },
    };
    const api = createApi();

    jest.spyOn(WeatherApi.prototype, 'retrieveToken').mockResolvedValue(new Session('abc') as any);
    jest.spyOn(WeatherApi.prototype, 'getBoundDevice').mockResolvedValue({ sn: 'SN' } as any);
    jest.spyOn(WeatherApi.prototype, 'retrieveState').mockRejectedValue(new Error('boom'));

    const platform = new WeatherStationPlatform(logger as any, config, api);
    await expect(platform.accessories((a) => a)).rejects.toThrow('boom');
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
