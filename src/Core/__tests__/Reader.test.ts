import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Reader } from "../Reader.ts";
import { pipe } from "../../Composition/pipe.ts";

type Config = { baseUrl: string; apiKey: string; timeout: number };

const testConfig: Config = {
	baseUrl: "https://api.example.com",
	apiKey: "secret",
	timeout: 5000,
};

// ---------------------------------------------------------------------------
// resolve
// ---------------------------------------------------------------------------

Deno.test("Reader.resolve always returns the value regardless of environment", () => {
	const reader = Reader.resolve<Config, number>(42);
	assertStrictEquals(reader(testConfig), 42);
});

Deno.test("Reader.resolve ignores the environment", () => {
	const reader = Reader.resolve<Config, string>("hello");
	assertStrictEquals(reader({ baseUrl: "x", apiKey: "y", timeout: 0 }), "hello");
	assertStrictEquals(reader(testConfig), "hello");
});

// ---------------------------------------------------------------------------
// ask
// ---------------------------------------------------------------------------

Deno.test("Reader.ask returns the full environment", () => {
	const reader = Reader.ask<Config>();
	assertEquals(reader(testConfig), testConfig);
});

// ---------------------------------------------------------------------------
// asks
// ---------------------------------------------------------------------------

Deno.test("Reader.asks projects a value from the environment", () => {
	const getBaseUrl = Reader.asks((c: Config) => c.baseUrl);
	assertStrictEquals(getBaseUrl(testConfig), "https://api.example.com");
});

Deno.test("Reader.asks applies the selector to the environment", () => {
	const getTimeout = Reader.asks((c: Config) => c.timeout);
	assertStrictEquals(getTimeout(testConfig), 5000);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

Deno.test("Reader.map transforms the produced value", () => {
	const reader = pipe(
		Reader.asks((c: Config) => c.baseUrl),
		Reader.map((url) => url.toUpperCase()),
	);
	assertStrictEquals(reader(testConfig), "HTTPS://API.EXAMPLE.COM");
});

Deno.test("Reader.map can change the value type", () => {
	const reader = pipe(
		Reader.asks((c: Config) => c.timeout),
		Reader.map((ms) => `${ms}ms`),
	);
	assertStrictEquals(reader(testConfig), "5000ms");
});

Deno.test("Reader.map still receives the same environment", () => {
	let receivedEnv: Config | undefined;
	const reader = pipe(
		Reader.ask<Config>(),
		Reader.map((env) => {
			receivedEnv = env;
			return env.apiKey;
		}),
	);
	reader(testConfig);
	assertEquals(receivedEnv, testConfig);
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

Deno.test("Reader.chain sequences two readers sharing the same environment", () => {
	const buildUrl = Reader.asks((c: Config) => `${c.baseUrl}/users`);
	const addAuth = (url: string): Reader<Config, string> => Reader.asks((c) => `${url}?key=${c.apiKey}`);

	const reader = pipe(buildUrl, Reader.chain(addAuth));
	assertStrictEquals(reader(testConfig), "https://api.example.com/users?key=secret");
});

Deno.test("Reader.chain passes the output of the first reader to the function", () => {
	const reader = pipe(
		Reader.resolve<Config, number>(10),
		Reader.chain((n) => Reader.resolve(n * 2)),
	);
	assertStrictEquals(reader(testConfig), 20);
});

Deno.test("Reader.chain threads the environment through multiple steps", () => {
	const reader = pipe(
		Reader.asks((c: Config) => c.baseUrl),
		Reader.chain((url) => Reader.asks((c) => `${url}:${c.timeout}`)),
		Reader.chain((s) => Reader.resolve(s.length)),
	);
	// "https://api.example.com:5000".length === 29
	assertStrictEquals(reader(testConfig), "https://api.example.com:5000".length);
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

Deno.test("Reader.ap applies a function reader to a value reader", () => {
	const add = (a: number) => (b: number) => a + b;
	const reader = pipe(
		Reader.resolve<Config, typeof add>(add),
		Reader.ap(Reader.asks((c) => c.timeout)),
		Reader.ap(Reader.resolve(500)),
	);
	assertStrictEquals(reader(testConfig), 5500);
});

Deno.test("Reader.ap both readers see the same environment", () => {
	const combine = (a: string) => (b: string) => `${a}/${b}`;
	const reader = pipe(
		Reader.resolve<Config, typeof combine>(combine),
		Reader.ap(Reader.asks((c) => c.baseUrl)),
		Reader.ap(Reader.asks((c) => c.apiKey)),
	);
	assertStrictEquals(reader(testConfig), "https://api.example.com/secret");
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

Deno.test("Reader.tap executes a side effect and returns the original value", () => {
	let captured = "";
	const reader = pipe(
		Reader.asks((c: Config) => c.baseUrl),
		Reader.tap((url) => {
			captured = url;
		}),
	);
	const result = reader(testConfig);
	assertStrictEquals(result, "https://api.example.com");
	assertStrictEquals(captured, "https://api.example.com");
});

Deno.test("Reader.tap does not alter the produced value", () => {
	const reader = pipe(
		Reader.resolve<Config, number>(42),
		Reader.tap(() => {/* side effect */}),
		Reader.map((n) => n + 1),
	);
	assertStrictEquals(reader(testConfig), 43);
});

// ---------------------------------------------------------------------------
// local
// ---------------------------------------------------------------------------

Deno.test("Reader.local adapts the environment before passing it to the reader", () => {
	type AppEnv = { config: Config; debug: boolean };

	const getBaseUrl: Reader<Config, string> = Reader.asks((c) => c.baseUrl);

	const fromAppEnv: Reader<AppEnv, string> = pipe(
		getBaseUrl,
		Reader.local((env: AppEnv) => env.config),
	);

	const appEnv: AppEnv = { config: testConfig, debug: true };
	assertStrictEquals(fromAppEnv(appEnv), "https://api.example.com");
});

Deno.test("Reader.local allows composing readers with different environments", () => {
	type DbEnv = { host: string; port: number };
	type AppEnv = { db: DbEnv; name: string };

	const getConnectionString: Reader<DbEnv, string> = Reader.asks((db) => `${db.host}:${db.port}`);

	const fromApp: Reader<AppEnv, string> = pipe(
		getConnectionString,
		Reader.local((env: AppEnv) => env.db),
	);

	const appEnv: AppEnv = { db: { host: "localhost", port: 5432 }, name: "myapp" };
	assertStrictEquals(fromApp(appEnv), "localhost:5432");
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

Deno.test("Reader.run executes a reader with the provided environment", () => {
	const reader = Reader.asks((c: Config) => c.apiKey);
	assertStrictEquals(Reader.run(testConfig)(reader), "secret");
});

Deno.test("Reader.run works as a data-last step in pipe", () => {
	const result = pipe(
		Reader.asks((c: Config) => c.baseUrl),
		Reader.map((url) => `${url}/health`),
		Reader.run(testConfig),
	);
	assertStrictEquals(result, "https://api.example.com/health");
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("Reader composes a realistic URL-building pipeline", () => {
	const buildUrl = (path: string): Reader<Config, string> => Reader.asks((c) => `${c.baseUrl}${path}`);

	const addApiKey = (url: string): Reader<Config, string> => Reader.asks((c) => `${url}?key=${c.apiKey}`);

	const endpoint = pipe(
		buildUrl("/data"),
		Reader.chain(addApiKey),
		Reader.run(testConfig),
	);

	assertStrictEquals(endpoint, "https://api.example.com/data?key=secret");
});

Deno.test("Reader.resolve and Reader.chain work together like map", () => {
	const doubled = pipe(
		Reader.asks((c: Config) => c.timeout),
		Reader.chain((n) => Reader.resolve(n * 2)),
	);
	assertStrictEquals(doubled(testConfig), 10000);
});
