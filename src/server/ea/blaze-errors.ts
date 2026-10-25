export class BlazeRpcError extends Error {
  errorcode?: number;
  errorname?: string;

  constructor(message: string, errorcode?: number, errorname?: string) {
    super(message);
    this.name = "BlazeRpcError";
    this.errorcode = errorcode;
    this.errorname = errorname;
  }
}

const TRANSIENT_BLAZE_CODES = new Set([
  67606, // MCA_ERR_SERVER_ERROR
  1073807360, // high load / timeout style (ERR_SYSTEM)
]);

export function isTransientBlazeCode(code: number | undefined): boolean {
  return code !== undefined && TRANSIENT_BLAZE_CODES.has(code);
}
