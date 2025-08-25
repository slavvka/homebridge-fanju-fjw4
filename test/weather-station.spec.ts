/*
 * Copyright (c) 2025. Slava Mankivski
 */

import {WeatherStation} from '../src/weather-station';
import {API, AccessoryConfig, Logging} from 'homebridge';

// Minimal fake HAP API
const createFakeApi = (): API => ({
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

const createLogger = (): Logging => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}) as any;

describe('WeatherStation', () => {
  const api = createFakeApi();
  const log = createLogger();

  const makeConfig = (isIndoor: boolean, curVal: number | undefined, type: 1 | 2 = 1, withDevice = true, withApi = true): AccessoryConfig => ({
    accessory: isIndoor ? 'Indoor' : 'Outdoor',
    name: isIndoor ? 'Indoor' : 'Outdoor',
    isIndoor,
    device: withDevice ? ({ sn: 'SN123' } as any) : undefined,
    weatherApi: withApi ? {
      getRealtimeState: () => ({ sensorDatas: [{ type, channel: isIndoor ? 0 : 1, curVal }] }),
    } : undefined,
  }) as any;

  it('converts Fahrenheit to Celsius in temperature getter (indoor)', async () => {
    const config = makeConfig(true, 68, 1); // 20C
    const ws = new WeatherStation(log, config, api);
    const temp = await (ws as any).handleTemperatureGet();
    expect(temp).toBeCloseTo(20, 5);
  });

  it('converts Fahrenheit to Celsius in temperature getter (outdoor)', async () => {
    const config = makeConfig(false, 77, 1); // 25C
    const ws = new WeatherStation(log, config, api);
    const temp = await (ws as any).handleTemperatureGet();
    expect(temp).toBeCloseTo(25, 5);
  });

  it('returns humidity value directly (outdoor)', async () => {
    const cfg = makeConfig(false, 55, 2);
    const ws = new WeatherStation(log, cfg, api);
    const h = await (ws as any).handleHumidityGet();
    expect(h).toBe(55);
  });

  it('returns humidity value directly (indoor)', async () => {
    const cfg = makeConfig(true, 45, 2);
    const ws = new WeatherStation(log, cfg, api);
    const h = await (ws as any).handleHumidityGet();
    expect(h).toBe(45);
  });

  it('handles missing sensor data gracefully (temperature)', async () => {
    const cfg = makeConfig(true, undefined, 1);
    const ws = new WeatherStation(log, cfg, api);
    const t = await (ws as any).handleTemperatureGet();
    expect(Number.isNaN(t as any)).toBe(true);
  });

  it('handles no weatherApi present (returns NaN/undefined values)', async () => {
    const cfg = makeConfig(true, 70, 1, true, false);
    const ws = new WeatherStation(log, cfg, api);
    const t = await (ws as any).handleTemperatureGet();
    const h = await (ws as any).handleHumidityGet();
    expect(Number.isNaN(t as any)).toBe(true);
    expect(h).toBeUndefined();
  });

  it('handles no matching sensor in state (NaN/undefined result)', async () => {
    const cfg = ({
      accessory: 'Indoor',
      name: 'Indoor',
      isIndoor: true,
      device: { sn: 'SN123' },
      weatherApi: { getRealtimeState: () => ({ sensorDatas: [{ type: 2, channel: 9, curVal: 33 }] }) },
    } as any) as AccessoryConfig;
    const ws = new WeatherStation(log, cfg, api);
    const t = await (ws as any).handleTemperatureGet();
    expect(Number.isNaN(t as any)).toBe(true);
  });

  it('exposes services array with 3 services and tolerates missing serial', () => {
    const cfg = makeConfig(true, 68, 1, false);
    const ws = new WeatherStation(log, cfg, api);
    const services = ws.getServices();
    expect(services.length).toBe(3);
  });
});
