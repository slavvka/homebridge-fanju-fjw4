/*
 * Copyright (c) 2021. Slava Mankivski
 */

// eslint-disable-next-line
const packageJson = require("../package.json");

/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
export const PLATFORM_NAME = "FanJuFJW4";

/**
 * The version the package is currently on as defined in package.json
 */
export const VERSION: string = packageJson.version;

export const MANUFACTURER = "FanJu";
export const MODEL = "FJW4";
export const DISPLAY_NAME = "FJW4";
