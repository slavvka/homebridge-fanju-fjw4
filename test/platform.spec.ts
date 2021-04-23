/*
 * Copyright (c) 2021. Slava Mankivski
 */

import {Mock} from 'moq.ts';
import {WeatherStationPlatform} from '../src/platform';
import {Logging} from 'homebridge/lib/logger';
import {API} from 'homebridge';

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
});
