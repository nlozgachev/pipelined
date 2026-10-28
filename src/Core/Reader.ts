/**
 * A computation that reads from a shared environment `R` and produces a value `A`.
 * Use Reader to thread a dependency (config, logger, DB pool) through a pipeline
 * without passing it explicitly to every function.
 *
 * @example
 * ```ts
 * type Config = { baseUrl: string; apiKey: string };
 *
 * const buildUrl = (path: string): Reader<Config, string> =>
 *   (config) => `${config.baseUrl}${path}`;
 *
 * const withAuth = (url: string): Reader<Config, string> =>
 *   (config) => `${url}?key=${config.apiKey}`;
 *
 * const fetchEndpoint = (path: string): Reader<Config, string> =>
 *   pipe(
 *     buildUrl(path),
 *     Reader.chain(withAuth)
 *   );
 *
 * // Inject the config once at the edge
 * fetchEndpoint("/users")(appConfig); // "https://api.example.com/users?key=secret"
 * ```
 */
export type Reader<R, A> = (env: R) => A;

const mapReader = <A, B>(transform: (value: A) => B) => <R = never>(reader: Reader<R, A>): Reader<R, B> => (env) =>
	transform(reader(env));

const chainReader =
	<A, R2, B>(transform: (value: A) => Reader<R2, B>) =>
	<R1 = never>(reader: Reader<R1, A>): Reader<R1 & R2, B> =>
	(env) => transform(reader(env))(env);

export const Reader = {
	/**
	 * Lifts a pure value into a Reader. The environment is ignored.
	 *
	 * @see {@link ask} to retrieve the environment instead of ignoring it.
	 *
	 * @example
	 * ```ts
	 * const always42: Reader<Config, number> = Reader.make(42);
	 * always42(anyConfig); // 42
	 * ```
	 */
	make: <R = unknown, A = never>(value: A): Reader<R, A> => (_env) => value,

	/**
	 * Returns the full environment as the result.
	 * The fundamental way to access the environment in a pipeline.
	 *
	 * @see {@link make} to lift a static value that ignores the environment.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Reader.ask<Config>(),
	 *   Reader.map(config => config.baseUrl)
	 * )(appConfig); // "https://api.example.com"
	 * ```
	 */
	ask: <R>(): Reader<R, R> => (env) => env,

	/**
	 * Transforms the value produced by a Reader.
	 *
	 * @see {@link chain} to sequence a computation that also reads from the environment.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   (c: Config) => c.baseUrl,
	 *   Reader.map(url => url.toUpperCase())
	 * )(appConfig); // "HTTPS://API.EXAMPLE.COM"
	 * ```
	 */
	map: mapReader,

	/**
	 * Sequences two Readers. Both see the environment.
	 * The output of the first is passed to `transform`, which returns the next Reader.
	 *
	 * @see {@link map} to transform the value without returning a new Reader.
	 *
	 * @example
	 * ```ts
	 * const buildUrl = (path: string): Reader<Config, string> =>
	 *   c => `${c.baseUrl}${path}`;
	 *
	 * const addAuth = (url: string): Reader<Config, string> =>
	 *   c => `${url}?key=${c.apiKey}`;
	 *
	 * pipe(
	 *   buildUrl("/items"),
	 *   Reader.chain(addAuth)
	 * )(appConfig); // "https://api.example.com/items?key=secret"
	 * ```
	 */
	chain: chainReader,

	/**
	 * Applies a function wrapped in a Reader to a value wrapped in a Reader.
	 * Combines environment requirements via intersection.
	 *
	 * @see {@link chain} to sequence dependent Reader computations.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   Reader.make<Config, typeof add>(add),
	 *   Reader.apply((c: Config) => c.timeout),
	 *   Reader.apply(Reader.make(5))
	 * )(appConfig);
	 * ```
	 */
	apply:
		<R2, A>(arg: Reader<R2, A>) => <B, R1 = never>(reader: Reader<R1, (value: A) => B>): Reader<R1 & R2, B> => (env) =>
			reader(env)(arg(env)),

	/**
	 * Executes a side effect on the produced value without changing the Reader.
	 * Useful for logging or debugging inside a pipeline.
	 *
	 * @see {@link map} to transform the value instead of executing a side effect.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   buildUrl("/users"),
	 *   Reader.tap(url => console.log("Requesting:", url)),
	 *   Reader.chain(addAuth)
	 * )(appConfig);
	 * ```
	 */
	tap: <A>(sideEffect: (value: A) => void) => <R = never>(reader: Reader<R, A>): Reader<R, A> => (env) => {
		const a = reader(env);
		sideEffect(a);
		return a;
	},

	/**
	 * Adapts a Reader to work with a different (typically wider) environment
	 * by transforming the environment before passing it to the Reader.
	 * This lets you compose Readers that expect different environments.
	 *
	 * @see {@link run} to supply the final environment rather than transforming it.
	 *
	 * @example
	 * ```ts
	 * type AppEnv = { db: DbPool; config: Config; logger: Logger };
	 *
	 * // buildUrl only needs Config
	 * const buildUrl: Reader<Config, string> = c => c.baseUrl;
	 *
	 * // Zoom in from AppEnv to Config
	 * const buildUrlFromApp: Reader<AppEnv, string> =
	 *   pipe(buildUrl, Reader.local((env: AppEnv) => env.config));
	 *
	 * buildUrlFromApp(appEnv); // works with the full AppEnv
	 * ```
	 */
	local: <R2, R>(transform: (env: R2) => R) => <A>(reader: Reader<R, A>): Reader<R2, A> => (env) =>
		reader(transform(env)),

	/**
	 * Runs a Reader by supplying the environment. Use this at the edge of your
	 * program where the environment is available.
	 *
	 * @see {@link local} to adapt the environment before execution.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   buildEndpoint("/users"),
	 *   Reader.run(appConfig)
	 * ); // "https://api.example.com/users?key=secret"
	 * ```
	 */
	run: <R>(env: R) => <A>(reader: Reader<R, A>): A => reader(env),

	/**
	 * Lifts a Reader value into an accumulator object.
	 *
	 * @see {@link bind} to accumulate subsequent Reader values into the object.
	 *
	 * @example
	 * ```ts
	 * pipe(Reader.make(42), Reader.bindTo("value")); // Reader({ value: 42 })
	 * ```
	 */
	bindTo: <K extends string>(key: K) => <R = never, A = unknown>(reader: Reader<R, A>): Reader<R, { [P in K]: A; }> =>
		mapReader<A, { [P in K]: A; }>((a) => ({ [key]: a } as { [P in K]: A; }))(reader),

	/**
	 * Evaluates a new Reader using the current accumulator and attaches the output to a new key.
	 *
	 * @see {@link bindTo} to initialize the accumulator record.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Reader.make({ a: 1 }),
	 *   Reader.bind("b", ({ a }) => Reader.make(a + 1))
	 * ); // Reader({ a: 1, b: 2 })
	 * ```
	 */
	bind:
		<K extends string, R2, A, B>(key: K, transform: (value: A) => Reader<R2, B>) =>
		<R1 = never>(reader: Reader<R1, A>): Reader<R1 & R2, A & { [P in K]: B; }> =>
			chainReader<A, R2, A & { [P in K]: B; }>((a) =>
				mapReader<B, A & { [P in K]: B; }>((
					b,
				) => ({ ...(a as unknown as Record<string, unknown>), [key]: b } as A & { [P in K]: B; }))(transform(a))
			)(reader),
};
