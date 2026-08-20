import type { MatchArms } from "@danrabydev/match";

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

export type MatchableNamespace<
  Union extends { tag: string },
  Ctors extends Record<string, (...args: never[]) => object>,
> = Ctors & {
  match: BoundMatch<Union>;
  _tags: readonly (Union["tag"])[];
};
