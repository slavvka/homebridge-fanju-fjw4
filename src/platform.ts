/*
 * Copyright (c) 2021. Slava Mankivski
 */

/**
 * Homebridge platform implementation for the FanJu FJW4 weather station.
 *
 * This platform creates two fixed accessories (Indoor and Outdoor) and is designed as a
 * StaticPlatformPlugin because the device graph is known and does not change at runtime.
 *
 * Polling strategy:
 * - Non-overlapping, self-scheduling loop using setTimeout
 * - Small random jitter on success to avoid synchronized bursts
 * - Exponential backoff on failures, capped at 5x the base interval
 * - Timers are unref’d and cleared on Homebridge shutdown
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
  /** Homebridge logger. */
  private readonly logger: Logging;
  /** Platform configuration provided by Homebridge. */
  private readonly config: PlatformConfig;
  /** Homebridge API instance. */
  private readonly api: API;

  /** REST API client used to communicate with the vendor cloud. */
  private readonly weatherApi?: WeatherApi;
  /** Cached bound device metadata retrieved from the cloud. */
  private device: WeatherDevice | undefined;

  /** Handle of the scheduled polling timer (self-scheduling setTimeout). */
  private stateTimer?: NodeJS.Timeout;
  /** Base polling interval in seconds. Minimum enforced via clamp. */
  private readonly pollingInterval: number = 60;
  /** Current backoff delay in milliseconds (undefined when healthy). */
  private backoffMs: number | undefined;

  /**
   * Construct the platform.
   * @param logger Homebridge logger
   * @param config Homebridge platform configuration
   * @param api Homebridge API
   */
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
  /**
   * Build an AccessoryConfig for the Indoor or Outdoor accessory.
   * @param isIndoor true for the Indoor accessory, false for Outdoor
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
  /**
   * Discover and register accessories with Homebridge.
   * Performs initial token retrieval, device binding fetch, and first state fetch,
   * then starts the self-scheduling polling loop.
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

  /**
   * Start the self-scheduling state retrieval loop with jitter and backoff.
   */
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

  /**
   * Retrieve the current realtime state from the cloud via WeatherApi.
   */
  private async retrieveState(): Promise<void> {
    await this.weatherApi?.retrieveState();
  }
}
