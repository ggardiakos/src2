export class ConflictError extends Error {
  constructor(message: string) {
    super(`Conflict: ${message}`);
    this.name = 'ConflictError';
  }
}
