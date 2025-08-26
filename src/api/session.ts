/*
 * Copyright (c) 2021. Slava Mankivski
 */

/**
 * Holds a bearer token used to authenticate API calls.
 */
export class Session {
  private accessToken!: string;

  /**
   * @param {string} accessToken
   */
  /** Create a session with the given access token. */
  constructor(accessToken: string) {
    this.resetToken(accessToken);
  }

  /** Get the current access token. */
  public getAccessToken(): string {
    return this.accessToken;
  }

  /**
   * @param {string} accessToken
   */
  /** Replace the access token with a new value. */
  public resetToken(accessToken: string): void {
    this.accessToken = accessToken;
  }

  /** Whether a non-empty token is present. */
  public hasToken(): boolean {
    return !!this.accessToken;
  }
}
