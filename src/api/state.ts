/*
 * Copyright (c) 2021. Slava Mankivski
 */

import {RealtimeState} from './response';

export class State {
  private state: RealtimeState;

  public getState(): RealtimeState {
    return this.state;
  }

  /**
   * @param {RealtimeState} state
   */
  public setState(state: RealtimeState): void {
    this.state = state;
  }
}
