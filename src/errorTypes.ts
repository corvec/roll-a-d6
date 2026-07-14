export class UnknownVariablesError extends Error {
  unknownVariables: string[];

  constructor(unknownVariables: string[]) {
    super(`The following variables must be supplied: ${unknownVariables.join(',')}`);
    this.name = 'UnknownVariablesError';
    this.unknownVariables = unknownVariables;
  }
}
