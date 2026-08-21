export type ExtractUrlParams<S extends string> = string extends S
  ? never
  : S extends `${string}{${infer P}}${infer Rest}`
    ? (P extends "" ? never : P) | ExtractUrlParams<Rest>
    : never;

export type CallParams<
  TUrlParams extends Record<string, string | number> = {},
  TPath extends string = string,
> = string extends TPath
  ? TUrlParams
  : TUrlParams & {
      [K in ExtractUrlParams<TPath>]: string | number;
    };

export type InitWithParams<P, TInit> = [keyof P] extends [never]
  ? [init?: TInit & { params?: UrlParams }]
  : [init: TInit & { params: P & UrlParams }];

/** Args for a verb: path literals get path+class keys; Request/URL skip params; unions require class keys. */
export type VerbArgs<
  TUrlParams extends Record<string, string | number>,
  TPath,
  TInit,
> = [TPath] extends [string]
  ? InitWithParams<CallParams<TUrlParams, TPath & string>, TInit>
  : [TPath] extends [Request | URL]
    ? [init?: TInit]
    : InitWithParams<TUrlParams, TInit>;

export type UrlParams = Record<string, string | number>;

const PLACEHOLDER = /\{([^{}]*)\}/g;

export class MissingUrlParamError extends Error {
  readonly name = "MissingUrlParamError";
  constructor(names: readonly string[]) {
    super(`missing url param: ${names.join(", ")}`);
  }
}

/** Replace `{name}` with encoded `params[name]`. Throws if any placeholder is missing or empty. */
export function substituteUrl(template: string, params: UrlParams): string {
  const missing: string[] = [];
  const out = template.replace(PLACEHOLDER, (match, name: string) => {
    if (name === "" || !Object.hasOwn(params, name)) {
      missing.push(name === "" ? "(empty)" : name);
      return match;
    }
    return encodeURIComponent(String(params[name]));
  });
  if (missing.length > 0) {
    throw new MissingUrlParamError(missing);
  }
  return out;
}
