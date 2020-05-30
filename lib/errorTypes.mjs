'use strict';

export class UnknownVariablesError extends Error {
  constructor(unknownVariables) {
    super(`The following variables must be supplied: ${unknownVariables.join(',')}`);
    this.name = 'UnknownVariablesError';
    this.unknownVariables = unknownVariables;
  }
}
