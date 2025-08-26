/*
 * Copyright (c) 2021. Slava Mankivski
 */

import { RealtimeState } from "./response";

/**
 * Simple in-memory holder for the most recent realtime state.
 */
export class State {
  private state: RealtimeState = {};

  /** Return the current state snapshot. */
  public getState(): RealtimeState {
    return this.state;
  }

  /** Replace the current state snapshot. */
  public setState(state: RealtimeState): void {
    this.state = state;
  }
}
