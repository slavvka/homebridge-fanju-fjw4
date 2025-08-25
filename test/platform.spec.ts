/*
 * Copyright (c) 2021. Slava Mankivski
 */

import { Mock } from "moq.ts";
import { WeatherStationPlatform } from "../src/platform";
import { Logging } from "homebridge/lib/logger";
import { API } from "homebridge";
import { WeatherApi } from "../src/api/weather-api";
import { Session } from "../src/api/session";

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

// Minimal fake HAP API to satisfy WeatherStation construction inside platform
const createApi = (): API =>
  ({
    hap: {
      Service: class anyService {
        static AccessoryInformation = class {
          private name: string;
          private characteristics: Record<string, unknown> = {};
          constructor(name: string) {
            this.name = name;
          }
          setCharacteristic(key: any, value: any) {
            this.characteristics[key] = value;
            return this;
          }
        };
        static TemperatureSensor = class {
          constructor(
            public displayName: string,
            public subtype?: string,
          ) {}
          getCharacteristic() {
            return { onGet: jest.fn() };
          }
        } as any;
        static HumiditySensor = class {
          constructor(
            public displayName: string,
            public subtype?: string,
          ) {}
          getCharacteristic() {
            return { onGet: jest.fn() };
          }
        } as any;
      } as any,
      Characteristic: class anyCharacteristic {} as any,
    },
    on: jest.fn(),
  }) as unknown as API;

describe("FJW4 Platform", () => {
  it("should be successfully created", () => {
    const logger = new Mock<Logging>()
      .setup((instance) =>
        instance.info("Finished initializing platform:", "NAME"),
      )
      .returns()
      .object();
    const config = {
      platform: "PLATFORM",
      name: "NAME",
      options: {
        username: "USERNAME",
        password: "PASSWORD",
      },
    };
    const api = createApi();

    const platform = new WeatherStationPlatform(logger, config, api);
    expect(platform).toBeInstanceOf(WeatherStationPlatform);
  });

  it("logs info and exits when no options provided", () => {
    const logger = createLogger();
    const config: any = { platform: "PL", name: "NAME" };
    const api = createApi();

    // eslint-disable-next-line no-new
    new WeatherStationPlatform(logger as any, config, api);

    expect(logger.info).toHaveBeenCalledWith(
      "No options found in configuration file, disabling plugin.",
    );
  });

  it("logs info and exits when config has no options", () => {
    const logger = createLogger();
    const api = createApi();
    const cfg = { platform: "PL", name: "NAME" } as any;
    new WeatherStationPlatform(logger as any, cfg, api);
    expect(logger.info).toHaveBeenCalledWith(
      "No options found in configuration file, disabling plugin.",
    );
  });

  it("logs error and exits when credentials missing", () => {
    const logger = createLogger();
    const config: any = { platform: "PL", name: "NAME", options: {} };
    const api = createApi();

    // eslint-disable-next-line no-new
    new WeatherStationPlatform(logger as any, config, api);

    expect(logger.error).toHaveBeenCalledWith(
      "Missing required config parameter.",
    );
  });

  it("registers two accessories and schedules state retrieval", async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const config: any = {
      platform: "PL",
      name: "NAME",
      options: { username: "u", password: "p", pollingInterval: 1 },
    };
    const api = createApi();

    // mock WeatherApi methods on prototype for instances created inside platform
    jest
      .spyOn(WeatherApi.prototype, "retrieveToken")
      .mockResolvedValue(new Session("abc") as any);
    jest
      .spyOn(WeatherApi.prototype, "getBoundDevice")
      .mockResolvedValue({ sn: "SN" } as any);
    jest.spyOn(WeatherApi.prototype, "retrieveState").mockResolvedValue();

    const timeoutSpy = jest.spyOn(global, "setTimeout");

    const platform = new WeatherStationPlatform(logger as any, config, api);

    let accessories: any[] = [];
    await platform.accessories((found) => {
      accessories = found;
    });

    expect(accessories.length).toBe(2);
    // pollingInterval=1 is clamped to 60s
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
    expect(logger.warn).toHaveBeenCalledWith(
      "Polling interval %ds is below recommended minimum (60s). Clamping to 60s.",
      1,
    );
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("uses default polling interval when not provided", async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const config: any = {
      platform: "PL",
      name: "NAME",
      options: { username: "u", password: "p" },
    };
    const api = createApi();

    jest
      .spyOn(WeatherApi.prototype, "retrieveToken")
      .mockResolvedValue(new Session("abc") as any);
    jest
      .spyOn(WeatherApi.prototype, "getBoundDevice")
      .mockResolvedValue({ sn: "SN" } as any);
    jest.spyOn(WeatherApi.prototype, "retrieveState").mockResolvedValue();

    const timeoutSpy = jest.spyOn(global, "setTimeout");

    const platform = new WeatherStationPlatform(logger as any, config, api);

    await platform.accessories(() => {});

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("propagates error in retrieveState", async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const config: any = {
      platform: "PL",
      name: "NAME",
      options: { username: "u", password: "p", pollingInterval: 1 },
    };
    const api = createApi();

    jest
      .spyOn(WeatherApi.prototype, "retrieveToken")
      .mockResolvedValue(new Session("abc") as any);
    jest
      .spyOn(WeatherApi.prototype, "getBoundDevice")
      .mockResolvedValue({ sn: "SN" } as any);
    jest
      .spyOn(WeatherApi.prototype, "retrieveState")
      .mockRejectedValue(new Error("boom"));

    const platform = new WeatherStationPlatform(logger as any, config, api);
    await expect(platform.accessories((a) => a)).rejects.toThrow("boom");
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("registers shutdown handler and clears interval on shutdown", async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const onSpy = jest.fn();
    const api = ({ ...createApi(), on: onSpy } as unknown) as API;
    const config: any = {
      platform: "PL",
      name: "NAME",
      options: { username: "u", password: "p", pollingInterval: 10 },
    };

    jest
      .spyOn(WeatherApi.prototype, "retrieveToken")
      .mockResolvedValue(new Session("abc") as any);
    jest
      .spyOn(WeatherApi.prototype, "getBoundDevice")
      .mockResolvedValue({ sn: "SN" } as any);
    jest.spyOn(WeatherApi.prototype, "retrieveState").mockResolvedValue();

    const clearSpy = jest.spyOn(global, "clearTimeout");
    const platform = new WeatherStationPlatform(logger as any, config, api);
    // start interval
    (platform as any).setupStateRetrieval();

    expect(onSpy).toHaveBeenCalledWith("shutdown", expect.any(Function));
    const shutdownHandler = onSpy.mock.calls[0][1] as () => void;
    shutdownHandler();
    expect(clearSpy).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("getAccessoryConfig returns proper names for indoor/outdoor", () => {
    const logger = createLogger();
    const api = createApi();
    const config: any = {
      platform: "PL",
      name: "NAME",
      options: { username: "u", password: "p" },
    };
    const platform = new WeatherStationPlatform(logger as any, config, api);
    const indoor = (platform as any).getAccessoryConfig(true);
    const outdoor = (platform as any).getAccessoryConfig(false);
    expect(indoor.name).toBe("NAME" + "Indoor");
    expect(outdoor.name).toBe("NAME" + "Outdoor");
  });

  it("does not clamp when pollingInterval is >= 600", async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const api = createApi();
    const config: any = {
      platform: "PL",
      name: "NAME",
      options: { username: "u", password: "p", pollingInterval: 601 },
    };

    jest
      .spyOn(WeatherApi.prototype, "retrieveToken")
      .mockResolvedValue(new Session("abc") as any);
    jest
      .spyOn(WeatherApi.prototype, "getBoundDevice")
      .mockResolvedValue({ sn: "SN" } as any);
    jest.spyOn(WeatherApi.prototype, "retrieveState").mockResolvedValue();

    const timeoutSpy = jest.spyOn(global, "setTimeout");
    const platform = new WeatherStationPlatform(logger as any, config, api);
    await platform.accessories(() => {});

    expect(timeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      601000,
    );
    expect(logger.warn).not.toHaveBeenCalled();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("accessories still registers without weatherApi (optional chain false)", async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const api = createApi();
    const config: any = { platform: "PL", name: "NAME" };

    const timeoutSpy = jest.spyOn(global, "setTimeout");
    const platform = new WeatherStationPlatform(logger as any, config, api);

    let accessories: any[] = [];
    await platform.accessories((found) => {
      accessories = found;
    });

    expect(accessories.length).toBe(2);
    expect(timeoutSpy).toHaveBeenCalled();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("schedules next run only after success (no overlap)", async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const api = createApi();
    const config: any = {
      platform: "PL",
      name: "NAME",
      options: { username: "u", password: "p", pollingInterval: 60 },
    };

    jest
      .spyOn(WeatherApi.prototype, "retrieveToken")
      .mockResolvedValue(new Session("abc") as any);
    jest
      .spyOn(WeatherApi.prototype, "getBoundDevice")
      .mockResolvedValue({ sn: "SN" } as any);
    const retrieveStateSpy = jest
      .spyOn(WeatherApi.prototype, "retrieveState")
      .mockResolvedValue();

    const timeoutSpy = jest.spyOn(global, "setTimeout");
    jest.spyOn(Math, "random").mockReturnValue(0);
    const platform = new WeatherStationPlatform(logger as any, config, api);
    await platform.accessories(() => {});
    // First schedule
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
    expect(timeoutSpy).toHaveBeenCalled();
    const firstHandler = timeoutSpy.mock.calls[0]![0] as () => Promise<void>;
    await firstHandler();
    expect(retrieveStateSpy.mock.calls.length).toBeGreaterThanOrEqual(2); // initial + at least first tick
    const lastCall = timeoutSpy.mock.calls[timeoutSpy.mock.calls.length - 1];
    expect(lastCall?.[1]).toBe(60000);
    jest.useRealTimers();
  });

  it("backs off on error and logs warning", async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const api = createApi();
    const config: any = {
      platform: "PL",
      name: "NAME",
      options: { username: "u", password: "p", pollingInterval: 60 },
    };

    jest
      .spyOn(WeatherApi.prototype, "retrieveToken")
      .mockResolvedValue(new Session("abc") as any);
    jest
      .spyOn(WeatherApi.prototype, "getBoundDevice")
      .mockResolvedValue({ sn: "SN" } as any);
    const retrieveStateSpy = jest
      .spyOn(WeatherApi.prototype, "retrieveState")
      .mockResolvedValueOnce() // initial in accessories
      .mockRejectedValueOnce(new Error("neterr")); // first loop tick

    const timeoutSpy = jest.spyOn(global, "setTimeout");
    jest.spyOn(Math, "random").mockReturnValue(0);
    const platform = new WeatherStationPlatform(logger as any, config, api);
    await platform.accessories(() => {});

    // run only the next scheduled tick → it will error and back off to 120000ms
    expect(timeoutSpy).toHaveBeenCalled();
    const firstHandler = timeoutSpy.mock.calls[0]![0] as () => Promise<void>;
    await firstHandler();
    expect(retrieveStateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(logger.warn).toHaveBeenCalled();
    // There should now be another timeout scheduled with backoff delay
    const backoffCall = timeoutSpy.mock.calls[timeoutSpy.mock.calls.length - 1];
    expect(backoffCall?.[1]).toBe(120000);
    jest.useRealTimers();
  });

  it("backs off and caps at 5x base on repeated errors", async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const api = createApi();
    const config: any = {
      platform: "PL",
      name: "NAME",
      options: { username: "u", password: "p", pollingInterval: 60 },
    };

    jest
      .spyOn(WeatherApi.prototype, "retrieveToken")
      .mockResolvedValue(new Session("abc") as any);
    jest
      .spyOn(WeatherApi.prototype, "getBoundDevice")
      .mockResolvedValue({ sn: "SN" } as any);
    const retrieveStateSpy = jest
      .spyOn(WeatherApi.prototype, "retrieveState")
      .mockResolvedValueOnce() // initial in accessories
      .mockRejectedValueOnce(new Error("err1"))
      .mockRejectedValueOnce(new Error("err2"))
      .mockRejectedValueOnce(new Error("err3"));

    const timeoutSpy = jest.spyOn(global, "setTimeout");
    jest.spyOn(Math, "random").mockReturnValue(0);
    const platform = new WeatherStationPlatform(logger as any, config, api);
    await platform.accessories(() => {});

    // First scheduled (base 60000)
    expect(timeoutSpy).toHaveBeenCalled();
    let handler = timeoutSpy.mock.calls[0]![0] as () => Promise<void>;
    await handler();
    // Backoff 120000
    let last = timeoutSpy.mock.calls[timeoutSpy.mock.calls.length - 1];
    expect(last?.[1]).toBe(120000);

    handler = last![0] as () => Promise<void>;
    await handler();
    // Backoff 240000
    last = timeoutSpy.mock.calls[timeoutSpy.mock.calls.length - 1];
    expect(last?.[1]).toBe(240000);

    handler = last![0] as () => Promise<void>;
    await handler();
    // Capped at 300000
    last = timeoutSpy.mock.calls[timeoutSpy.mock.calls.length - 1];
    expect(last?.[1]).toBe(300000);

    // Ensure we invoked three additional ticks + initial
    expect(retrieveStateSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
    jest.useRealTimers();
  });

  it("uses jitter on success when Math.random > 0", async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const api = createApi();
    const config: any = {
      platform: "PL",
      name: "NAME",
      options: { username: "u", password: "p", pollingInterval: 60 },
    };

    jest
      .spyOn(WeatherApi.prototype, "retrieveToken")
      .mockResolvedValue(new Session("abc") as any);
    jest
      .spyOn(WeatherApi.prototype, "getBoundDevice")
      .mockResolvedValue({ sn: "SN" } as any);
    jest.spyOn(WeatherApi.prototype, "retrieveState").mockResolvedValue();

    const timeoutSpy = jest.spyOn(global, "setTimeout");
    // Jitter = floor(0.5 * 5000) = 2500
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    const platform = new WeatherStationPlatform(logger as any, config, api);
    await platform.accessories(() => {});

    // Call the first scheduled tick
    const firstHandler = timeoutSpy.mock.calls[0]![0] as () => Promise<void>;
    await firstHandler();

    const last = timeoutSpy.mock.calls[timeoutSpy.mock.calls.length - 1];
    expect(last?.[1]).toBe(60000 + 2500);
    jest.useRealTimers();
  });

  it("recovers after error and resets backoff to base with jitter", async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const api = createApi();
    const config: any = {
      platform: "PL",
      name: "NAME",
      options: { username: "u", password: "p", pollingInterval: 60 },
    };

    jest
      .spyOn(WeatherApi.prototype, "retrieveToken")
      .mockResolvedValue(new Session("abc") as any);
    jest
      .spyOn(WeatherApi.prototype, "getBoundDevice")
      .mockResolvedValue({ sn: "SN" } as any);
    const retrieveStateSpy = jest
      .spyOn(WeatherApi.prototype, "retrieveState")
      .mockResolvedValueOnce() // initial in accessories
      .mockRejectedValueOnce(new Error("neterr")) // first loop tick (error)
      .mockResolvedValueOnce(); // recovery on backoff tick

    const timeoutSpy = jest.spyOn(global, "setTimeout");
    jest.spyOn(Math, "random").mockReturnValue(0); // no jitter for determinism
    const platform = new WeatherStationPlatform(logger as any, config, api);
    await platform.accessories(() => {});

    // First scheduled (base 60000) → run it to error and backoff
    const firstHandler = timeoutSpy.mock.calls[0]![0] as () => Promise<void>;
    await firstHandler();
    let last = timeoutSpy.mock.calls[timeoutSpy.mock.calls.length - 1];
    expect(last?.[1]).toBe(120000);

    // Now run the backoff handler → this time it succeeds and should reset to base (60000 + jitter 0)
    const backoffHandler = last![0] as () => Promise<void>;
    await backoffHandler();
    last = timeoutSpy.mock.calls[timeoutSpy.mock.calls.length - 1];
    expect(last?.[1]).toBe(60000);
    expect(retrieveStateSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    jest.useRealTimers();
  });

  it("after recovery, schedules next with jitter > 0", async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const api = createApi();
    const config: any = {
      platform: "PL",
      name: "NAME",
      options: { username: "u", password: "p", pollingInterval: 60 },
    };

    jest
      .spyOn(WeatherApi.prototype, "retrieveToken")
      .mockResolvedValue(new Session("abc") as any);
    jest
      .spyOn(WeatherApi.prototype, "getBoundDevice")
      .mockResolvedValue({ sn: "SN" } as any);
    const retrieveStateSpy = jest
      .spyOn(WeatherApi.prototype, "retrieveState")
      .mockResolvedValueOnce() // initial in accessories
      .mockRejectedValueOnce(new Error("neterr")) // first loop tick (error)
      .mockResolvedValueOnce(); // recovery on backoff tick

    const timeoutSpy = jest.spyOn(global, "setTimeout");
    jest.spyOn(Math, "random").mockReturnValue(0); // deterministic first schedules

    const platform = new WeatherStationPlatform(logger as any, config, api);
    await platform.accessories(() => {});

    // First scheduled (base 60000) → run it to error and backoff
    const firstHandler = timeoutSpy.mock.calls[0]![0] as () => Promise<void>;
    await firstHandler();
    let last = timeoutSpy.mock.calls[timeoutSpy.mock.calls.length - 1];
    expect(last?.[1]).toBe(120000);

    // Now set jitter to 0.4 and run the backoff handler (which will succeed)
    ;(Math.random as jest.Mock).mockReturnValue(0.4);
    const backoffHandler = last![0] as () => Promise<void>;
    await backoffHandler();
    last = timeoutSpy.mock.calls[timeoutSpy.mock.calls.length - 1];
    expect(last?.[1]).toBe(60000 + Math.floor(0.4 * 5000));
    expect(retrieveStateSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    jest.useRealTimers();
  });

  it("logs optional chaining path when logger.warn is missing", async () => {
    jest.useFakeTimers();
    // Intentionally provide a logger without warn method to hit logger?.warn false branch
    const logger = ({ info: jest.fn(), error: jest.fn(), debug: jest.fn() } as unknown) as Logging;
    const api = createApi();
    const config: any = {
      platform: "PL",
      name: "NAME",
      options: { username: "u", password: "p", pollingInterval: 60 },
    };

    jest
      .spyOn(WeatherApi.prototype, "retrieveToken")
      .mockResolvedValue(new Session("abc") as any);
    jest
      .spyOn(WeatherApi.prototype, "getBoundDevice")
      .mockResolvedValue({ sn: "SN" } as any);
    // Force an error on the first scheduled tick to trigger catch branch
    jest
      .spyOn(WeatherApi.prototype, "retrieveState")
      .mockResolvedValueOnce() // initial
      .mockRejectedValueOnce(new Error("oops"));

    const timeoutSpy = jest.spyOn(global, "setTimeout");
    jest.spyOn(Math, "random").mockReturnValue(0);
    const platform = new WeatherStationPlatform(logger as any, config, api);
    await platform.accessories(() => {});

    expect(timeoutSpy).toHaveBeenCalled();
    const firstHandler = timeoutSpy.mock.calls[0]![0] as () => Promise<void>;
    await firstHandler();
    // Backoff to 120000 without calling warn (since it's missing)
    const last = timeoutSpy.mock.calls[timeoutSpy.mock.calls.length - 1];
    expect(last?.[1]).toBe(120000);
    jest.useRealTimers();
  });
});
