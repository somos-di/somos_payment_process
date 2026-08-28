export type QueryOp = [string, ...unknown[]];

export type CountMode = 'exact' | 'planned' | 'estimated';

export type RpcArgs = Record<string, unknown>;

export interface UploadedFile {
  url: string;
}
