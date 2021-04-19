/*
 * Copyright (c) 2021. Slava Mankivski
 */

import {AccessoryConfig, AccessoryPlugin, StaticPlatformPlugin} from 'homebridge';
import {Logging} from 'homebridge/lib/logger';
import {PlatformConfig} from 'homebridge/lib/bridgeService';
import {API} from 'homebridge/lib/api';
import {WeatherApi} from './api/weather-api';
import {WeatherStation} from './weather-station';
import {WeatherDevice} from './api/response';

export class WeatherStationPlatform implements StaticPlatformPlugin {
  private readonly logger: Logging;
  private readonly config: PlatformConfig;
  private readonly api: API;

  private readonly weatherApi?: WeatherApi;
  private device?: WeatherDevice;

  private stateTimer;
  private pollingInterval: number;

  constructor(logger: Logging, config: PlatformConfig, api: API) {
    this.logger = logger;
    this.config = config;
    this.api = api;

    if (!config || !config.options) {
      this.logger.info('No options found in configuration file, disabling plugin.');
      return;
    }
    const options = config.options;

    if (options.username === undefined || options.password === undefined) {
      this.logger.error('Missing required config parameter.');
      return;
    }

    this.pollingInterval = config.options.pollingInterval ? config.options.pollingInterval : 30;

    this.weatherApi = new WeatherApi(
      options.username,
      options.password,
      this.logger,
    );

    this.logger.debug('Finished initializing platform:', this.config.name);
  }

  /**
   * @param {boolean} isIndoor
   * @private
   */
  private getAccessoryConfig(isIndoor: boolean): AccessoryConfig {
    const suffix = isIndoor ? 'Indoor' : 'Outdoor';
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
  async accessories(callback: (foundAccessories: AccessoryPlugin[]) => void): Promise<void> {
    await this.weatherApi?.retrieveToken();
    this.device = await this.weatherApi?.getBoundDevice();
    await this.retrieveState();
    this.setupStateRetrieval();

    const indoorWeatherStation = new WeatherStation(this.logger, this.getAccessoryConfig(true), this.api);
    const outdoorWeatherStation = new WeatherStation(this.logger, this.getAccessoryConfig(false), this.api);

    callback([indoorWeatherStation, outdoorWeatherStation]);
  }

  private setupStateRetrieval(): void {
    this.stateTimer = setTimeout(this.retrieveState.bind(this), this.pollingInterval * 1000);
  }

  private async retrieveState(): Promise<void> {
    await this.weatherApi?.retrieveState();
  }
}
