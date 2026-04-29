import { DOM, Patcher, Utils, Meta, Plugin, Changes } from "betterdiscord";
import { showChangelog } from "@lib";
import { changelog } from "./manifest.json";
import { getTypingUsersContainerTarget, typingSelector, TypingUsersContainerTarget, waitForTypingUsersContainerTarget } from "./modules";
import { RelationshipStore, TypingStore, UserStore } from "@discord/stores";
import { UserPopoutWrapper } from "@lib/components";

const nameSelector = `${typingSelector} strong`;

export default class TypingUsersPopouts implements Plugin {
	meta: Meta;
	abortController?: AbortController;

	constructor(meta: Meta) {
		this.meta = meta;
	}

	start() {
		showChangelog(changelog as Changes[], this.meta);
		if (typingSelector) {
			DOM.addStyle(`${nameSelector} { cursor: pointer; } ${nameSelector}:hover { text-decoration: underline; }`);
		}
		this.abortController = new AbortController();
		void this.patch(this.abortController.signal);
	}

	async patch(signal: AbortSignal) {
		const target = getTypingUsersContainerTarget() ?? (await waitForTypingUsersContainerTarget(signal));
		if (!target || signal.aborted) return;

		const patchType = (props: any, ret: any) => {
			const text = Utils.findInTree(ret, (e) => Array.isArray(e?.children) && e.children[0]?.type === "strong", {
				walkable: ["props", "children"],
			});
			if (!text) return;

			const channel = props.channel;
			const guildId = channel.guild_id;

			const typingUsersIds = Object.keys(TypingStore.getTypingUsers(channel.id)).filter(
				(id) =>
					id !== UserStore.getCurrentUser().id &&
					!RelationshipStore.isBlocked(id) &&
					!RelationshipStore.isIgnored(id)
			);

			let i = 0;
			text.children = text.children.map((e: React.ReactElement) => {
				if (e.type !== "strong") return e;

				const user = UserStore.getUser(typingUsersIds[i++]);
				if (!user) return e;

				return (
					<UserPopoutWrapper id={user.id} guildId={guildId} channelId={channel.id}>
						{e}
					</UserPopoutWrapper>
				);
			});
		};

		let patchedType: ((props: any) => React.ReactNode) | undefined;

		Patcher.after(...target, (_: unknown, __: unknown, containerRet: any) => {
			if (patchedType) {
				containerRet.type = patchedType;
				return containerRet;
			}

			const original = containerRet.type as React.FunctionComponent<any>;

			patchedType = (props) => {
				const ret = original(props);
				patchType(props, ret);
				return ret;
			};

			containerRet.type = patchedType;
		});
	}

	stop() {
		this.abortController?.abort();
		this.abortController = undefined;
		DOM.removeStyle();
		Patcher.unpatchAll();
	}
}
