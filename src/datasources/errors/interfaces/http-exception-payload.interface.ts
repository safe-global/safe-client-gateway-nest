export interface HttpExceptionPayload {
  message: string;
  code: number;
  arguments: Array<string>;
}
