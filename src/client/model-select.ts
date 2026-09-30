// @ts-nocheck
/**
 * Searchable composer model seat.
 *
 * Vendored from the standalone `dsh-model-search` v0.1.0 client bundle and merged
 * into this plugin (see CHANGELOG). It replaces the composer's single-winner
 * `conversation.input.model` seat with a type-to-filter variant reading the same
 * per-session model directory as the stock seat, so a choice made in either place
 * stays in sync.
 *
 * The body is kept close to that bundle's original form so the two remain
 * diffable. Only the ModuleLoader wrapper became ESM imports/exports, and the
 * locale namespace was renamed: a profile that still has `dsh-model-search`
 * installed during migration must not register the same namespace twice.
 *
 * `@ts-nocheck` is deliberate -- this is vendored, untyped JavaScript and a typed
 * rewrite is tracked as follow-up. The rest of src/client/ is fully typechecked.
 *
 * Requires only `react` and `react-dom`, both external in the client build, so it
 * adds no `dsh.client.inject` entry and cannot strand the plugin's client fiber.
 */
import * as react from 'react'
import * as reactDom from 'react-dom'



/** Locale namespace owned by this plugin (registered by apply()). */
const NS = "dsh-omp-advisor-model-select";

/** English dictionary: the key-set source of truth. */
const en = {
	"trigger.label": "Model",
	"search.placeholder": "Search models…",
	"search.aria": "Search models by name",
	"list.loading": "Loading models…",
	"list.empty": "No models available",
	"list.noMatch": "No model matches “{query}”",
	"list.failures": "{count} provider(s) failed to load",
	"status.error": "Could not load the model catalog.",
	"effort.label": "Effort",
	"effort.default": "Provider default",
	"action.retry": "Retry",
	"action.clear": "Clear"
};

/** Simplified Chinese dictionary. */
const zh = {
	"trigger.label": "模型",
	"search.placeholder": "搜索模型…",
	"search.aria": "按名称搜索模型",
	"list.loading": "正在加载模型…",
	"list.empty": "暂无可用模型",
	"list.noMatch": "没有匹配“{query}”的模型",
	"list.failures": "{count} 个提供商加载失败",
	"status.error": "无法加载模型目录。",
	"effort.label": "推理强度",
	"effort.default": "提供商默认",
	"action.retry": "重试",
	"action.clear": "清除"
};

/* ------------------------------------------------------------------ *
 * Styles. The stock seat's classes are hashed CSS-module names, so this
 * surface carries its own, keyed by the platform's data-plugin-css tag
 * convention. Colours ride the app's own theme tokens with a neutral
 * fallback, so light and dark themes both read correctly.
 * ------------------------------------------------------------------ */

const CSS_ID = "dsh-model-search/ModelSearch.module.css";

const CSS = [
	".dsh-ms{position:relative;display:inline-flex;min-width:0}",
	".dsh-ms-trigger{display:inline-flex;align-items:center;gap:6px;height:28px;max-width:240px;padding:0 8px;border:1px solid transparent;border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:12px;line-height:1;cursor:pointer}",
	".dsh-ms-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18))}",
	".dsh-ms-trigger:disabled{opacity:.5;cursor:default}",
	".dsh-ms-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".dsh-ms-effort{opacity:.6;white-space:nowrap}",
	".dsh-ms-caret{font-size:10px;opacity:.6}",
	".dsh-ms-panel{position:fixed;z-index:90;display:flex;flex-direction:column;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:12px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,#1c1c20));box-shadow:0 12px 32px rgba(0,0,0,.35);overflow:hidden}",
	".dsh-ms-search{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent)}",
	".dsh-ms-input{flex:1;min-width:0;height:26px;border:0;background:transparent;color:inherit;font:inherit;font-size:13px;outline:none}",
	".dsh-ms-input::placeholder{color:inherit;opacity:.45}",
	".dsh-ms-clear{padding:2px 6px;border:0;border-radius:6px;background:transparent;color:inherit;opacity:.55;font:inherit;font-size:11px;cursor:pointer}",
	".dsh-ms-clear:hover{opacity:1;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18))}",
	".dsh-ms-list{display:flex;flex-direction:column;gap:2px;padding:6px;overflow-y:auto}",
	".dsh-ms-group{padding:6px 8px 2px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.5}",
	".dsh-ms-item{display:flex;align-items:baseline;gap:8px;width:100%;padding:6px 8px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px;text-align:left;cursor:pointer}",
	".dsh-ms-item:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18))}",
	".dsh-ms-item[data-active=true]{background:var(--dsw-alias-interactive-bg-active,rgba(127,127,127,.26))}",
	".dsh-ms-item:disabled{cursor:default}",
	".dsh-ms-item[data-current=true] .dsh-ms-item-name{font-weight:600}",
	".dsh-ms-item-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".dsh-ms-item-id{margin-left:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;opacity:.45}",
	".dsh-ms-note{padding:8px 10px;font-size:12px;opacity:.65}",
	".dsh-ms-error{display:flex;align-items:center;gap:8px;padding:8px 10px;font-size:12px}",
	".dsh-ms-link{padding:0;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;text-decoration:underline;cursor:pointer}",
	".dsh-ms-foot{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 10px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent)}",
	".dsh-ms-foot-label{margin-right:2px;font-size:11px;opacity:.5}",
	".dsh-ms-chip{padding:3px 8px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:999px;background:transparent;color:inherit;font:inherit;font-size:11px;cursor:pointer}",
	".dsh-ms-chip[data-current=true]{border-color:transparent;background:var(--dsw-alias-interactive-bg-active,rgba(127,127,127,.26))}"
].join("\n");

(function installStyle() {
	if (typeof document === "undefined") return;
	if (document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_ID) + "]") !== null) return;
	const tag = document.createElement("style");
	tag.dataset.pluginCss = CSS_ID;
	tag.textContent = CSS;
	document.head.appendChild(tag);
})();

/* ------------------------------------------------------------------ *
 * Small pure helpers.
 * ------------------------------------------------------------------ */

/** Neutral snapshot for a session whose directory is not mounted yet. */
const EMPTY_STATE = Object.freeze({
	current: null,
	routable: null,
	groups: [],
	failures: [],
	status: "idle",
	error: null
});

function noopUnsubscribe() {}

/** Bind the seat's translator, falling back to the bundled copy. */
function makeText(translate) {
	return (key, fallback) => {
		if (typeof translate === "function") {
			try {
				const value = translate(key);
				if (typeof value === "string" && value !== "" && value !== key) return value;
			} catch (error) {
				/* an unregistered key must never break the composer */
			}
		}
		return fallback;
	};
}

/** Case-folded haystack for the substring filter. */
function joinHay(parts) {
	const kept = [];
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (typeof part === "string" && part !== "") kept.push(part);
	}
	return kept.join(" ").toLowerCase();
}

function asString(value) {
	return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Build a complete selection for the directory.
 * @param effort - a string pins that effort, `null` asks for the provider
 * default, and `undefined` takes the model's advertised default.
 */
function selectionOf(group, model, effort) {
	const selection = { provider: group.id, model: model.id };
	let chosen = effort;
	if (chosen === undefined && model.reasoning !== undefined && model.reasoning !== null) {
		chosen = model.reasoning.defaultEffort;
	}
	if (typeof chosen === "string") selection.reasoningEffort = chosen;
	return selection;
}

/** Display name of one advertised effort id, or null when unknown. */
function effortName(reasoning, effort) {
	const efforts = reasoning !== undefined && reasoning !== null && Array.isArray(reasoning.efforts) ? reasoning.efforts : [];
	for (let i = 0; i < efforts.length; i++) {
		const level = efforts[i];
		if (level !== undefined && level !== null && level.id === effort) return asString(level.name) ?? String(effort);
	}
	return typeof effort === "string" ? effort : null;
}

/* ------------------------------------------------------------------ *
 * The searchable seat.
 * ------------------------------------------------------------------ */

/**
 * @param props - owner share (`locked`) + injected face (`available`,
 * `directory`, `load`, `select`) + the standard locale seat (`t`).
 */
function SearchableModelSelect(props) {
	const available = props.available !== false;
	const directory = props.directory;
	const load = props.load;
	const select = props.select;
	const text = react.useMemo(() => makeText(props.t), [props.t]);

	const subscribe = react.useCallback((notify) => {
		if (directory === undefined || directory === null || typeof directory.subscribe !== "function") return noopUnsubscribe;
		return directory.subscribe(notify);
	}, [directory]);
	const getSnapshot = react.useCallback(() => {
		if (directory === undefined || directory === null || typeof directory.getSnapshot !== "function") return EMPTY_STATE;
		const snapshot = directory.getSnapshot();
		return snapshot === undefined || snapshot === null ? EMPTY_STATE : snapshot;
	}, [directory]);
	const state = react.useSyncExternalStore(subscribe, getSnapshot);

	const [open, setOpen] = react.useState(false);
	const [query, setQuery] = react.useState("");
	const [active, setActive] = react.useState(0);
	const [busy, setBusy] = react.useState(false);
	const [failed, setFailed] = react.useState(false);
	const [placement, setPlacement] = react.useState(null);

	const rootRef = react.useRef(null);
	const panelRef = react.useRef(null);
	const inputRef = react.useRef(null);
	const activeRef = react.useRef(null);
	const triggerRef = react.useRef(null);

	/** Opening the panel refreshes the advisory catalog. */
	react.useEffect(() => {
		if (!open) return undefined;
		if (typeof load === "function") load();
		return undefined;
	}, [open, load]);

	/** Dismiss on any pointer press outside the trigger and the portalled panel. */
	react.useEffect(() => {
		if (!open) return undefined;
		const onPointerDown = (event) => {
			const root = rootRef.current;
			const panel = panelRef.current;
			if (root !== null && root.contains(event.target) === true) return;
			if (panel !== null && panel.contains(event.target) === true) return;
			setOpen(false);
		};
		document.addEventListener("mousedown", onPointerDown);
		return () => document.removeEventListener("mousedown", onPointerDown);
	}, [open]);

	/** Measure the trigger before paint: fixed placement clears every clipping ancestor. */
	react.useLayoutEffect(() => {
		if (!open) {
			setPlacement(null);
			return undefined;
		}
		const trigger = triggerRef.current;
		if (trigger === null) return undefined;
		const rect = trigger.getBoundingClientRect();
		const width = Math.max(240, Math.min(440, window.innerWidth - 24));
		const maxLeft = Math.max(12, window.innerWidth - width - 12);
		setPlacement({
			left: Math.min(Math.max(12, rect.left), maxLeft),
			bottom: Math.max(12, window.innerHeight - rect.top + 8),
			width: width,
			maxHeight: Math.max(180, Math.min(440, rect.top - 24))
		});
		return undefined;
	}, [open]);

	/** Keyboard navigation must keep the active row on screen. */
	react.useLayoutEffect(() => {
		const node = activeRef.current;
		if (node !== null && typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "nearest" });
		return undefined;
	});

	/** Directory projection: the same per-session store the stock seat renders. */
	const groups = Array.isArray(state.groups) ? state.groups : [];
	const current = state.current === undefined ? null : state.current;
	const failures = Array.isArray(state.failures) ? state.failures : [];
	const needle = query.trim().toLowerCase();

	const items = [];
	for (let g = 0; g < groups.length; g++) {
		const group = groups[g] === undefined || groups[g] === null ? {} : groups[g];
		const models = Array.isArray(group.models) ? group.models : [];
		const provider = asString(group.name) ?? asString(group.id) ?? "";
		for (let m = 0; m < models.length; m++) {
			const model = models[m] === undefined || models[m] === null ? {} : models[m];
			const name = asString(model.name) ?? asString(model.id) ?? "";
			items.push({
				group: group,
				model: model,
				provider: provider,
				name: name,
				hay: joinHay([name, model.id, model.description, provider, group.id])
			});
		}
	}

	const matches = needle === "" ? items : items.filter((item) => item.hay.indexOf(needle) >= 0);
	const activeIndex = matches.length === 0 ? -1 : Math.min(Math.max(active, 0), matches.length - 1);

	let currentItem = null;
	if (current !== null) {
		for (let i = 0; i < items.length; i++) {
			if (items[i].model.id === current.model && items[i].group.id === current.provider) {
				currentItem = items[i];
				break;
			}
		}
	}
	const currentName = currentItem !== null
		? currentItem.name
		: (current !== null ? asString(current.model) : null);
	const reasoning = currentItem !== null ? currentItem.model.reasoning : null;
	const effort = current !== null && current.reasoningEffort !== undefined
		? current.reasoningEffort
		: (reasoning !== undefined && reasoning !== null ? reasoning.defaultEffort : undefined);
	const effortLabel = reasoning === undefined || reasoning === null
		? null
		: (effort === undefined ? text("effort.default", "Provider default") : effortName(reasoning, effort));

	const submit = (selection) => {
		if (busy === true || typeof select !== "function") return;
		setBusy(true);
		setFailed(false);
		Promise.resolve()
			.then(() => select(selection))
			.then((accepted) => {
				setBusy(false);
				if (accepted === false) {
					setFailed(true);
					return;
				}
				setOpen(false);
				setQuery("");
				setActive(0);
			}, () => {
				setBusy(false);
				setFailed(true);
			});
	};

	const choose = (item) => submit(selectionOf(item.group, item.model, undefined));

	if (directory === undefined || directory === null) return null;

	const trigger = react.createElement("div", { className: "dsh-ms", ref: rootRef, key: "seat" },
		react.createElement("button", {
			ref: triggerRef,
			type: "button",
			className: "dsh-ms-trigger",
			disabled: available === false || busy === true,
			title: currentName ?? text("trigger.label", "Model"),
			"aria-haspopup": "dialog",
			"aria-expanded": open === true,
			onClick: () => {
				if (available === false) return;
				setOpen((value) => !value);
			}
		}, [
			react.createElement("span", { className: "dsh-ms-name", key: "name" }, currentName ?? text("trigger.label", "Model")),
			effortLabel === null ? null : react.createElement("span", { className: "dsh-ms-effort", key: "effort" }, effortLabel),
			react.createElement("span", { className: "dsh-ms-caret", key: "caret" }, "▾")
		]));

	if (open !== true || available === false || placement === null) return trigger;

	/** Result rows: provider headers interleaved with their models. */
	const rows = [];
	if (matches.length === 0) {
		const loading = state.status === "loading" || state.status === "idle";
		const note = needle !== ""
			? text("list.noMatch", "No model matches “{query}”").replace("{query}", query.trim())
			: (items.length === 0 && loading ? text("list.loading", "Loading models…") : text("list.empty", "No models available"));
		rows.push(react.createElement("div", { className: "dsh-ms-note", key: "empty" }, note));
	} else {
		let lastGroup = null;
		for (let i = 0; i < matches.length; i++) {
			const item = matches[i];
			const groupId = item.group.id === undefined ? item.provider : item.group.id;
			if (groupId !== lastGroup) {
				lastGroup = groupId;
				rows.push(react.createElement("div", { className: "dsh-ms-group", key: "group:" + String(groupId) }, item.provider));
			}
			const isCurrent = currentItem !== null && item.group.id === currentItem.group.id && item.model.id === currentItem.model.id;
			rows.push(react.createElement("button", {
				ref: i === activeIndex ? activeRef : undefined,
				type: "button",
				key: "item:" + String(groupId) + "/" + String(item.model.id),
				className: "dsh-ms-item",
				"data-active": i === activeIndex,
				"data-current": isCurrent,
				"aria-current": isCurrent === true ? "true" : undefined,
				disabled: busy === true,
				onMouseEnter: () => setActive(i),
				onClick: () => choose(item)
			}, [
				react.createElement("span", { className: "dsh-ms-item-name", key: "name" }, item.name),
				item.model.id === item.name ? null : react.createElement("span", { className: "dsh-ms-item-id", key: "id" }, String(item.model.id))
			]));
		}
	}

	if (failures.length > 0 && matches.length > 0) {
		rows.push(react.createElement("div", { className: "dsh-ms-note", key: "failures" },
			text("list.failures", "{count} provider(s) failed to load").replace("{count}", String(failures.length))));
	}

	const errorText = failed === true
		? text("status.error", "Could not load the model catalog.")
		: asString(state.error);
	const errorRow = errorText === null ? null : react.createElement("div", { className: "dsh-ms-error", key: "error" }, [
		react.createElement("span", { key: "text" }, errorText),
		typeof load !== "function" ? null : react.createElement("button", {
			type: "button",
			className: "dsh-ms-link",
			key: "retry",
			onClick: () => {
				setFailed(false);
				load();
			}
		}, text("action.retry", "Retry"))
	]);

	/** Effort belongs to the model, so its chips only exist for the current one. */
	let foot = null;
	const efforts = currentItem !== null && reasoning !== undefined && reasoning !== null && Array.isArray(reasoning.efforts)
		? reasoning.efforts
		: [];
	if (currentItem !== null && efforts.length > 0) {
		const chips = [react.createElement("span", { className: "dsh-ms-foot-label", key: "label" }, text("effort.label", "Effort"))];
		chips.push(react.createElement("button", {
			type: "button",
			className: "dsh-ms-chip",
			key: "default",
			"data-current": effort === undefined,
			disabled: busy === true,
			onClick: () => submit(selectionOf(currentItem.group, currentItem.model, null))
		}, text("effort.default", "Provider default")));
		for (let i = 0; i < efforts.length; i++) {
			const level = efforts[i] === undefined || efforts[i] === null ? {} : efforts[i];
			chips.push(react.createElement("button", {
				type: "button",
				className: "dsh-ms-chip",
				key: "effort:" + String(level.id),
				"data-current": effort === level.id,
				disabled: busy === true,
				onClick: () => submit(selectionOf(currentItem.group, currentItem.model, level.id))
			}, asString(level.name) ?? String(level.id)));
		}
		foot = react.createElement("div", { className: "dsh-ms-foot", key: "foot" }, chips);
	}

	const panel = react.createElement("div", {
		ref: panelRef,
		className: "dsh-ms-panel",
		role: "dialog",
		"aria-label": text("search.aria", "Search models by name"),
		style: {
			left: placement.left + "px",
			bottom: placement.bottom + "px",
			width: placement.width + "px"
		}
	}, [
		react.createElement("div", { className: "dsh-ms-search", key: "search" }, [
			react.createElement("input", {
				ref: inputRef,
				className: "dsh-ms-input",
				type: "search",
				autoFocus: true,
				spellCheck: false,
				autoComplete: "off",
				placeholder: text("search.placeholder", "Search models…"),
				"aria-label": text("search.aria", "Search models by name"),
				value: query,
				onChange: (event) => {
					setQuery(event.target.value);
					setActive(0);
				},
				onKeyDown: (event) => {
					if (event.key === "ArrowDown") {
						event.preventDefault();
						setActive(activeIndex + 1);
					} else if (event.key === "ArrowUp") {
						event.preventDefault();
						setActive(activeIndex - 1);
					} else if (event.key === "Enter") {
						event.preventDefault();
						if (activeIndex >= 0 && activeIndex < matches.length) choose(matches[activeIndex]);
					} else if (event.key === "Escape") {
						event.preventDefault();
						setOpen(false);
					}
				}
			}),
			query === "" ? null : react.createElement("button", {
				type: "button",
				className: "dsh-ms-clear",
				key: "clear",
				onClick: () => {
					setQuery("");
					setActive(0);
					if (inputRef.current !== null) inputRef.current.focus();
				}
			}, text("action.clear", "Clear"))
		]),
		react.createElement("div", { className: "dsh-ms-list", key: "list", style: { maxHeight: (placement.maxHeight - 92) + "px" } }, rows),
		errorRow,
		foot
	]);

	return react.createElement(react.Fragment, null, [trigger, reactDom.createPortal(panel, document.body, "dsh-model-search")]);
}

/* ------------------------------------------------------------------ *
 * Cordis plugin: required services + the seat contribution.
 * ------------------------------------------------------------------ */

/** Required services: the slot registry, the session wire face, the directory, locale. */
const inject = ["slots", "sessions", "modelDirectories", "locale"];

/**
 * Client plugin body: publish this plugin's dictionaries, then occupy the
 * composer model seat with the searchable variant.
 * @param ctx - client root context.
 */
function apply(ctx) {
	ctx.effect(() => {
		const locale = ctx.locale;
		if (locale === undefined || locale === null || typeof locale.register !== "function") return undefined;
		return locale.register(NS, { en: en, zh: zh });
	}, "dsh-omp-advisor: model-select dictionaries");

	ctx.inject(["slots", "modelDirectories", "sessions"], (scope) => {
		const directories = scope.modelDirectories;
		const sessions = scope.sessions;
		scope.slots.inject("conversation.input.model", () => scope.slots.register({
			name: "conversation.input.model",
			locale: NS,
			/* A single slot renders one winner: -1 retires the stock ModelSelect. */
			priority: -1,
			registrant: "dsh-omp-advisor",
			inject: (sessionId) => {
				const directory = directories.directoryFor(sessionId);
				const available = sessions.subagentAddress(sessionId) === void 0;
				return {
					available: available,
					directory: directory.store,
					load: () => {
						if (available) directory.load().catch(() => {});
					},
					select: (selection) => available ? directory.select(selection).then(() => true, () => false) : Promise.resolve(false)
				};
			}
		}, SearchableModelSelect));
	}, "dsh-omp-advisor: composer model seat");
}

/** Register the searchable model seat on a client root context. */
export { apply as applyModelSeat }
