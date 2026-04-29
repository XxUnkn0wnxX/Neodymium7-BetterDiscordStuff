import { AnyComponent } from "@lib/utils/react";
import { expectSelectors } from "@lib/utils/webpack";
import { Webpack } from "betterdiscord";

export type TypingUsersContainerTarget = [Record<string, any>, string];

function hasStrings(source: string, ...strings: string[]) {
	return strings.every((string) => source.includes(string));
}

function isTypingUsersContainer(target: unknown): target is AnyComponent {
	if (typeof target !== "function") return false;

	const source = target.toString?.();
	if (!source) return false;

	return (
		(target as { displayName?: string }).displayName === "TypingUsers" ||
		target.name === "TypingUsers" ||
		hasStrings(source, "typingUsers:") ||
		hasStrings(source, "getTypingUsers", "isFocused") ||
		hasStrings(source, "getTypingUsers", "typing") ||
		hasStrings(source, "getTypingUsers", "renderDots")
	);
}

function isTypingUsersMemoContainer(target: unknown): target is { type: AnyComponent } {
	return typeof target === "object" && target !== null && isTypingUsersContainer((target as { type?: unknown }).type);
}

function isTypingUsersExport(target: unknown) {
	return isTypingUsersContainer(target) || isTypingUsersMemoContainer(target);
}

function resolveTypingUsersContainerTarget(exportsObject: Record<string, unknown>): TypingUsersContainerTarget | undefined {
	for (const [key, value] of Object.entries(exportsObject)) {
		if (isTypingUsersContainer(value)) {
			return [exportsObject, key];
		}

		if (isTypingUsersMemoContainer(value)) {
			return [value as Record<string, any>, "type"];
		}
	}

	return undefined;
}

export function getTypingUsersContainerTarget(): TypingUsersContainerTarget | undefined {
	const module = Webpack.getModule<{ exports: Record<string, unknown> }>(isTypingUsersExport, {
		searchExports: true,
		raw: true,
	} as any);

	if (!module?.exports) return undefined;
	return resolveTypingUsersContainerTarget(module.exports);
}

export async function waitForTypingUsersContainerTarget(signal: AbortSignal): Promise<TypingUsersContainerTarget | undefined> {
	const existing = getTypingUsersContainerTarget();
	if (existing) return existing;

	const module = await Webpack.waitForModule<{ exports: Record<string, unknown> }>(isTypingUsersExport, {
		searchExports: true,
		raw: true,
		signal,
	} as any);

	if (!module?.exports) return undefined;
	return resolveTypingUsersContainerTarget(module.exports);
}

export const typingSelector = expectSelectors("Typing Class", ["typingDots", "typing"])?.typing;
