export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

export class ConnectionError extends CliError {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionError";
  }
}

export class MetadataError extends CliError {
  constructor(message: string) {
    super(message);
    this.name = "MetadataError";
  }
}
