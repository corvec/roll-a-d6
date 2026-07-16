export class ValidationError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super(`Invalid formula! Issues: ${issues.join(', ')}`);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export class UnknownVariablesError extends Error {
  unknownVariables: string[];

  constructor(unknownVariables: string[]) {
    super(`The following variables must be supplied: ${unknownVariables.join(',')}`);
    this.name = 'UnknownVariablesError';
    this.unknownVariables = unknownVariables;
  }
}
