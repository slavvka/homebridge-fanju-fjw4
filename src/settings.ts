/*
 * Copyright (c) 2021. Slava Mankivski
 */

import packageJson from "../package.json";

/** Name used to register the platform in Homebridge config.json. */
export const PLATFORM_NAME = "FanJuFJW4";

/** Plugin version from package.json. */
export const VERSION: string = packageJson.version as string;

/** Accessory information constants. */
export const MANUFACTURER = "FanJu";
export const MODEL = "FJW4";
export const DISPLAY_NAME = "FJW4";
