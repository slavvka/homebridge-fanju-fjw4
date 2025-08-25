/*
 * Copyright (c) 2021. Slava Mankivski
 */

export class Session {
  private accessToken!: string;

  /**
   * @param {string} accessToken
   */
  constructor(accessToken: string) {
    this.resetToken(accessToken);
  }

  public getAccessToken(): string {
    return this.accessToken;
  }

  /**
   * @param {string} accessToken
   */
  public resetToken(accessToken: string): void {
    this.accessToken = accessToken;
  }

  public hasToken(): boolean {
    return !!this.accessToken;
  }
}
