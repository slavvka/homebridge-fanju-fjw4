/*
 * Copyright (c) 2021. Slava Mankivski
 */

import {API} from 'homebridge';

import {PLATFORM_NAME} from './settings';
import {WeatherStationPlatform} from './platform';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, WeatherStationPlatform);
};
