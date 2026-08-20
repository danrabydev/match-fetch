import type { MatchArms } from "@danrabydev/match";

/** Local `match` signature so emitted `.d.ts` does not name `match`'s unexported brand. */
export type BoundMatch<Union extends { tag: string }> = <V, R>(
  value: V & Union,
  arms: [V] extends [{ tag: Union["tag"] }]
    ? MatchArms<Extract<V, { tag: string }>, R>
    : MatchArms<Union, R>,
) => R;

export type MatchableNamespace<
  Union extends { tag: string },
  Ctors extends Record<string, (...args: never[]) => object>,
> = Ctors & {
  match: BoundMatch<Union>;
  _tags: readonly (Union["tag"])[];
};
