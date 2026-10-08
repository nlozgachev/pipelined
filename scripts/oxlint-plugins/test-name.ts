function getModuleNames(filename: string): string[] {
	const match = filename.match(/([^/]+)\.(?:prop\.)?test\.ts$/);
	if (!match) { return []; }
	const base = match[1];

	// Handle compound names like TaskResult -> ["TaskResult", "Task.Result"]
	if (base === "TaskResult") { return ["TaskResult", "Task.Result", "taskResult"]; }
	if (base === "TaskMaybe") { return ["TaskMaybe", "Task.Maybe", "taskMaybe"]; }
	if (base === "TaskValidation") { return ["TaskValidation", "Task.Validation", "taskValidation"]; }

	return [base, base.toLowerCase()];
}

export default {
	meta: { name: "pipelined-internal" },
	rules: {
		"test-name": {
			create(context: any) {
				const filename = context.filename || "";
				if (!/\.(?:prop\.)?test\.ts$/.test(filename)) {
					return {};
				}

				const moduleNames = getModuleNames(filename);

				return {
					CallExpression(node: any) {
						let callee = node.callee;
						// Handle test.skip, test.only, test.fails, test.todo, test.concurrent
						if (callee.type === "MemberExpression" && callee.object.name === "test") {
							callee = callee.object;
						}

						// Handle test.each(...)("...")
						let firstArg = node.arguments[0];
						if (
							node.callee.type === "CallExpression"
							&& node.callee.callee.type === "MemberExpression"
							&& node.callee.callee.object.name === "test"
							&& node.callee.callee.property.name === "each"
						) {
							firstArg = node.arguments[0];
						} else if (callee.name !== "test") {
							return;
						}

						if (!firstArg) { return; }

						let title: string | null = null;
						if (firstArg.type === "Literal" && typeof firstArg.value === "string") {
							title = firstArg.value;
						} else if (firstArg.type === "TemplateLiteral" && firstArg.quasis.length > 0) {
							title = firstArg.quasis.map((q: any) => q.value.raw).join("");
						}

						if (title === null) {return;}

						// 1. Enforce "<target>: <behavior>" format
						const match = title.match(/^([\w.-]+):\s+(.+)$/);
						if (!match) {
							context.report({
								node: firstArg,
								message: `Test title must follow '<target>: <behavior>' format. Got: "${title}"`,
							});
							return;
						}

						const [, target] = match;

						// 2. Reject redundant module prefix (e.g. "Maybe.map: ..." in Maybe.test.ts)
						for (const mod of moduleNames) {
							const modPrefix = `${mod.toLowerCase()}.`;
							if (target.toLowerCase().startsWith(modPrefix)) {
								context.report({
									node: firstArg,
									message: `Redundant module prefix in test title target "${target}". Omit "${mod}."`,
								});
								return;
							}
						}
					},
				};
			},
		},
	},
};
