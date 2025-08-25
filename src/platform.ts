/*
 * Copyright (c) 2021. Slava Mankivski
 */

import type {
  AccessoryConfig,
  AccessoryPlugin,
  StaticPlatformPlugin,
  Logging,
  PlatformConfig,
  API,
} from "homebridge";
import { WeatherApi } from "./api/weather-api";
import { WeatherStation } from "./weather-station";
import { WeatherDevice } from "./api/response";

export class WeatherStationPlatform implements StaticPlatformPlugin {
  private readonly logger: Logging;
  private readonly config: PlatformConfig;
  private readonly api: API;

  private readonly weatherApi?: WeatherApi;
  private device: WeatherDevice | undefined;

  private stateTimer?: NodeJS.Timeout;
  private readonly pollingInterval: number = 60;
  private backoffMs: number | undefined;

  constructor(logger: Logging, config: PlatformConfig, api: API) {
    this.logger = logger;
    this.config = config;
    this.api = api;

    if (!config || !config.options) {
      this.logger.info(
        "No options found in configuration file, disabling plugin.",
      );
      return;
    }
    const options = config.options;

    if (options.username === undefined || options.password === undefined) {
      this.logger.error("Missing required config parameter.");
      return;
    }

    this.pollingInterval = config.options.pollingInterval
      ? config.options.pollingInterval
      : this.pollingInterval;

    // Enforce minimum interval of 60s to respect API and schema guidance
    if (this.pollingInterval < 60) {
      this.logger.warn(
        "Polling interval %ds is below recommended minimum (60s). Clamping to 60s.",
        this.pollingInterval,
      );
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - pollingInterval is readonly; we reassign via cast to satisfy runtime while keeping type safety elsewhere
      this.pollingInterval = 60 as unknown as number;
    }

    this.weatherApi = new WeatherApi(
      options.username,
      options.password,
      this.logger,
    );

    this.logger.info("Finished initializing platform: ", this.config.name);

    // Ensure timer is cleaned up on shutdown
    this.api.on("shutdown", () => {
      if (this.stateTimer) {
        clearTimeout(this.stateTimer);
      }
    });
  }

  /**
   * @param {boolean} isIndoor
   * @private
   */
  private getAccessoryConfig(isIndoor: boolean): AccessoryConfig {
    const suffix = isIndoor ? "Indoor" : "Outdoor";
    return {
      accessory: this.config.name + suffix,
      name: this.config.name + suffix,
      isIndoor: isIndoor,
      weatherApi: this.weatherApi,
      device: this.device,
    };
  }

  /**
   * @param {(foundAccessories: AccessoryPlugin[]) => void): void} callback
   */
  async accessories(
    callback: (foundAccessories: AccessoryPlugin[]) => void,
  ): Promise<void> {
    await this.weatherApi?.retrieveToken();
    this.device = await this.weatherApi?.getBoundDevice();
    await this.retrieveState();
    this.setupStateRetrieval();

    const indoorWeatherStation = new WeatherStation(
      this.logger,
      this.getAccessoryConfig(true),
      this.api,
    );
    const outdoorWeatherStation = new WeatherStation(
      this.logger,
      this.getAccessoryConfig(false),
      this.api,
    );

    callback([indoorWeatherStation, outdoorWeatherStation]);
  }

  private setupStateRetrieval(): void {
    const baseMs = this.pollingInterval * 1000;
    const scheduleNext = (delayMs: number) => {
      this.stateTimer = setTimeout(async () => {
        try {
          await this.retrieveState();
          // success → reset backoff and schedule with small jitter (0..5s)
          this.backoffMs = undefined;
          const jitter = Math.floor(Math.random() * 5000);
          scheduleNext(baseMs + jitter);
        } catch (err) {
          // error → exponential backoff capped at 5x base
          const prev = this.backoffMs ?? baseMs;
          this.backoffMs = Math.min(prev * 2, baseMs * 5);
          this.logger?.warn?.(
            "State retrieval failed: %s. Backing off to %dms.",
            (err as Error)?.message ?? String(err),
            this.backoffMs,
          );
          scheduleNext(this.backoffMs);
        }
      }, delayMs);
      this.stateTimer.unref?.();
    };

    // First run after base interval; initial fetch was already performed in accessories()
    scheduleNext(baseMs);
  }

  private async retrieveState(): Promise<void> {
    await this.weatherApi?.retrieveState();
  }
}
