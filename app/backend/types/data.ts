export type QueryOp = [string, ...unknown[]];

export type RpcArgs = Record<string, unknown>;

export interface UploadedFile {
  url: string;
}
