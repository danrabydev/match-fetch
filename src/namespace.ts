import type {
  DiagOptions,
  MatchArms,
  MatchTraceEvent,
  PeekArms,
  PeekTraceEvent,
} from "@danrabydev/match";

/** Extra arms allowed on bound `Ns.match` when the value is a narrowed variant. */
type ExtraMatchArms<
  Union extends { tag: string },
  V extends { tag: string },
  R,
> = {
  [K in Exclude<Union["tag"], V["tag"]>]?: (
    value: Extract<Union, { tag: K }>,
  ) => R;
};

type ExtraPeekArms<
  Union extends { tag: string },
  V extends { tag: string },
> = {
  [K in Exclude<Union["tag"], V["tag"]>]?: (
    value: Readonly<Extract<Union, { tag: K }>>,
  ) => void;
};

/**
 * Local `match` signature so emitted `.d.ts` does not name `match`'s
 * unexported `matchableUnion` brand.
 */
export type BoundMatch<Union extends { tag: string }> = <V, R>(
  value: V,
  arms: [V] extends [{ tag: Union["tag"] }]
    ? MatchArms<V, R> & ExtraMatchArms<Union, V, R>
    : MatchArms<Union, R>,
) => R;

export type BoundPeek<Union extends { tag: string }> = <V>(
  value: V,
  arms: [V] extends [{ tag: Union["tag"] }]
    ? PeekArms<V> & ExtraPeekArms<Union, V>
    : PeekArms<Union>,
) => V;

export type FetchDiag = DiagOptions & {
  onPeek?: (event: PeekTraceEvent) => void;
  onMatch?: (event: MatchTraceEvent) => void;
};

export type MatchableNamespace<
  Union extends { tag: string },
  Ctors extends Record<string, (...args: never[]) => object>,
> = Ctors & {
  match: BoundMatch<Union>;
  peek: BoundPeek<Union>;
  withDiagnostics: (opts: FetchDiag) => MatchableNamespace<Union, Ctors>;
  _tags: readonly (Union["tag"])[];
};

export function nsWithDiag<Ns extends { withDiagnostics: (opts: FetchDiag) => Ns }>(
  ns: Ns,
  opts: FetchDiag | undefined,
): Ns {
  return opts === undefined ? ns : ns.withDiagnostics(opts);
}
