export type HttpHeaders = Record<string, string>;

export interface UuidParams {
  uuid: string;
}

export interface UuidActionParams extends UuidParams {
  action: string;
}

export interface ResourceParams {
  resource: string;
}

export interface RpcParams {
  fn: string;
}

export interface ProcessListQuery {
  kind?: string;
}

export interface OAuthCallbackQuery {
  code?: string;
  error_description?: string;
}

export interface UuidRoute {
  Params: UuidParams;
}

export interface UuidActionRoute {
  Params: UuidActionParams;
}

export interface DataQueryRoute {
  Params: ResourceParams;
}

export interface DataRpcRoute {
  Params: RpcParams;
}

export interface ProcessListRoute {
  Querystring: ProcessListQuery;
}

export interface OAuthCallbackRoute {
  Querystring: OAuthCallbackQuery;
}
