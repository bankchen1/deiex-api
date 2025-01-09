export class StrategyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StrategyError';
  }
}
