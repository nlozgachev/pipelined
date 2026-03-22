import { NonEmptyList } from "#types/NonEmptyList.ts";

export type WithKind<K extends string> = { readonly kind: K; };

export type WithValue<T> = { readonly value: T; };

export type WithError<T> = { readonly error: T; };

export type WithErrors<T> = { readonly errors: NonEmptyList<T>; };

export type WithFirst<T> = { readonly first: T; };

export type WithSecond<T> = { readonly second: T; };

export type WithLog<T> = { readonly log: ReadonlyArray<T>; };
