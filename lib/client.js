window.__ModuleLoader__.load({ id: "dsh-omp-advisor", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/SettingsSection.tsx
var React = __toESM(require("react"), 1);

// src/client/model-catalog.ts
function unwrapRpcResult(response, label) {
  if (!response || typeof response !== "object") {
    throw new Error(`${label}: malformed response`);
  }
  const outer = response;
  const result = outer.result && typeof outer.result === "object" ? outer.result : outer;
  if (result.ok === false) {
    throw new Error(`${label}: ${result.error?.code ?? "error"}: ${result.error?.message ?? "unknown"}`);
  }
  if ("value" in result) return result.value;
  return result;
}
async function fetchModelCatalog(connection) {
  const raw = await connection.api.llm.models({});
  const value = unwrapRpcResult(raw, "llm.models");
  return {
    groups: (value.groups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      models: (group.models ?? []).map((model) => ({
        id: model.id,
        name: model.name,
        ...model.description ? { description: model.description } : {},
        efforts: model.reasoning?.efforts ?? [],
        ...model.reasoning?.defaultEffort ? { defaultEffort: model.reasoning.defaultEffort } : {}
      }))
    })),
    failures: value.failures ?? []
  };
}

// src/client/SettingsSection.tsx
var { useCallback, useEffect, useMemo, useRef, useState } = React;
var styles = {
  root: { display: "flex", flexDirection: "column", gap: 16, fontSize: 13 },
  card: {
    border: "1px solid var(--dsh-border, rgba(128,128,128,0.25))",
    borderRadius: 10,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10
  },
  row: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  label: { minWidth: 150, opacity: 0.85 },
  input: {
    background: "var(--dsh-input-bg, rgba(128,128,128,0.08))",
    border: "1px solid var(--dsh-border, rgba(128,128,128,0.25))",
    borderRadius: 6,
    padding: "5px 8px",
    color: "inherit",
    font: "inherit"
  },
  select: {
    background: "var(--dsh-input-bg, rgba(128,128,128,0.08))",
    border: "1px solid var(--dsh-border, rgba(128,128,128,0.25))",
    borderRadius: 6,
    padding: "5px 8px",
    color: "inherit",
    font: "inherit",
    maxWidth: 320,
    textAlign: "center"
  },
  button: {
    border: "1px solid var(--dsh-border, rgba(128,128,128,0.3))",
    borderRadius: 6,
    padding: "5px 12px",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    font: "inherit"
  },
  dangerButton: {
    border: "1px solid rgba(220,80,80,0.5)",
    borderRadius: 6,
    padding: "4px 10px",
    background: "transparent",
    color: "rgb(220,110,110)",
    cursor: "pointer",
    font: "inherit"
  },
  hint: { opacity: 0.6, fontSize: 12 },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "2px 10px",
    border: "1px solid var(--dsh-border, rgba(128,128,128,0.25))",
    fontSize: 12
  },
  textarea: {
    background: "var(--dsh-input-bg, rgba(128,128,128,0.08))",
    border: "1px solid var(--dsh-border, rgba(128,128,128,0.25))",
    borderRadius: 6,
    padding: "6px 8px",
    color: "inherit",
    font: "inherit",
    minHeight: 54,
    resize: "vertical"
  }
};
var STATUS_COLORS = {
  running: "#4caf7d",
  paused: "#c9a227",
  quota_exhausted: "#e08a3c",
  error: "#dc5050",
  halted: "#dc5050",
  no_model: "#8a8a8a"
};
function createSettingsSection(ctx) {
  return function OmpAdvisorSettingsSection() {
    const [view, setView] = useState(null);
    const [draft, setDraft] = useState(null);
    const [phase, setPhase] = useState("loading");
    const [writeError, setWriteError] = useState(null);
    const [catalog, setCatalog] = useState(null);
    const [catalogError, setCatalogError] = useState(null);
    const viewRef = useRef(null);
    viewRef.current = view;
    const queueRef = useRef(Promise.resolve());
    const pendingRef = useRef(0);
    const settledSettingsRef = useRef(null);
    useEffect(() => {
      let cancelled = false;
      fetchModelCatalog(ctx.connection).then((result) => {
        if (!cancelled) setCatalog(result);
      }).catch((err) => {
        if (!cancelled) setCatalogError(String(err instanceof Error ? err.message : err));
      });
      return () => {
        cancelled = true;
      };
    }, []);
    useEffect(() => {
      let cancelled = false;
      const poll = () => {
        ctx.connection.rpc.call("/dsh-omp-advisor", "snapshot", {}).then((result) => {
          const value2 = unwrapRpcResult(result, "advisor snapshot");
          if (cancelled) return;
          setPhase("ready");
          if (pendingRef.current > 0) return;
          settledSettingsRef.current = value2.settings;
          setView(value2);
        }).catch(() => {
          if (!cancelled) setPhase((current) => current === "ready" ? current : "error");
        });
      };
      poll();
      const timer = setInterval(poll, 5e3);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, []);
    const write = useCallback((field, next) => {
      setWriteError(null);
      setDraft((current) => {
        const base = current ?? settledSettingsRef.current ?? viewRef.current?.settings;
        if (!base) return current;
        return { ...base, [field]: next };
      });
      pendingRef.current += 1;
      queueRef.current = queueRef.current.then(() => ctx.connection.rpc.call("/dsh-omp-advisor", "update", { patch: { [field]: next } })).then((result) => {
        const updated = unwrapRpcResult(result, "advisor settings update");
        settledSettingsRef.current = updated.settings;
      }).catch((err) => {
        setWriteError(String(err instanceof Error ? err.message : err));
      }).finally(() => {
        pendingRef.current -= 1;
        if (pendingRef.current !== 0) return;
        const settled = settledSettingsRef.current;
        if (settled) setView((current) => current ? { ...current, settings: settled } : current);
        setDraft(null);
      });
    }, []);
    const value = draft ?? view?.settings;
    const advisors = useMemo(() => value?.advisors ?? [], [value]);
    const updateAdvisor = useCallback(
      (index, patch) => {
        const next = advisors.map((entry, i) => i === index ? { ...entry, ...patch } : entry);
        write("advisors", next);
      },
      [advisors, write]
    );
    const removeAdvisor = useCallback(
      (index) => {
        write(
          "advisors",
          advisors.filter((_, i) => i !== index)
        );
      },
      [advisors, write]
    );
    const addAdvisor = useCallback(() => {
      const firstGroup = catalog?.groups.find((group) => group.models.length > 0);
      const firstModel = firstGroup?.models[0];
      const baseNames = new Set(advisors.map((entry) => entry.name));
      let name2 = "advisor";
      let suffix = 2;
      while (baseNames.has(name2)) name2 = `advisor-${suffix++}`;
      write("advisors", [
        ...advisors,
        {
          name: name2,
          provider: firstGroup?.id ?? "",
          model: firstModel?.id ?? "",
          maxTurns: 4,
          enabled: true
        }
      ]);
    }, [advisors, catalog, write]);
    if (!value) {
      if (phase === "loading") {
        return /* @__PURE__ */ React.createElement("div", { style: styles.root }, "Loading advisor settings\u2026");
      }
      return /* @__PURE__ */ React.createElement("div", { style: styles.root }, /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("strong", null, "Advisor settings unavailable"), /* @__PURE__ */ React.createElement("span", { style: styles.hint }, "The dsh-omp-advisor host service is not reachable. Restart DSH after installing the plugin.")));
    }
    const severities = value.interruptSeverities ?? ["concern", "blocker"];
    return /* @__PURE__ */ React.createElement("div", { style: styles.root }, writeError && /* @__PURE__ */ React.createElement("div", { style: styles.hint }, "Settings write failed: ", writeError), /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("label", { style: styles.label }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: value.enabled,
        onChange: (event) => write("enabled", event.target.checked)
      }
    ), " ", "Attach advisors to sessions"), /* @__PURE__ */ React.createElement("span", { style: styles.hint }, "Master switch. When off, no advisor runs and session runtimes are released.")), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("span", { style: styles.label }, "Review trigger"), /* @__PURE__ */ React.createElement(
      "select",
      {
        style: styles.select,
        value: value.reviewTrigger,
        onChange: (event) => write("reviewTrigger", event.target.value)
      },
      /* @__PURE__ */ React.createElement("option", { value: "turn" }, "Turn end \u2014 review completed turns"),
      /* @__PURE__ */ React.createElement("option", { value: "step" }, "Step end \u2014 review while the turn runs")
    )), /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("span", { style: styles.label }, "Interrupting severities"), ["nit", "concern", "blocker"].map((severity) => /* @__PURE__ */ React.createElement("label", { key: severity }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: severities.includes(severity),
        onChange: (event) => {
          const next = event.target.checked ? [...severities, severity] : severities.filter((item) => item !== severity);
          write("interruptSeverities", next);
        }
      }
    ), " ", severity)), /* @__PURE__ */ React.createElement("span", { style: styles.hint }, "Checked severities steer at the nearest step boundary; others ride as non-interrupting context."))), /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement("strong", null, "Advisors"), /* @__PURE__ */ React.createElement("span", { style: styles.hint }, "Each advisor reviews transcript updates with its own model and read-only tools.")), catalogError && /* @__PURE__ */ React.createElement("div", { style: styles.hint }, "Model list unavailable: ", catalogError), advisors.map((entry, index) => {
      const group = catalog?.groups.find((item) => item.id === entry.provider);
      const model = group?.models.find((item) => item.id === entry.model);
      const efforts = model?.efforts ?? [];
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: `${entry.name}-${index}`,
          style: {
            border: "1px dashed var(--dsh-border, rgba(128,128,128,0.3))",
            borderRadius: 8,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8
          }
        },
        /* @__PURE__ */ React.createElement("div", { style: styles.row }, /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "checkbox",
            checked: entry.enabled !== false,
            onChange: (event) => updateAdvisor(index, { enabled: event.target.checked }),
            title: "Enable this advisor"
          }
        ), /* @__PURE__ */ React.createElement(
          "input",
          {
            style: { ...styles.input, width: 160 },
            value: entry.name,
            placeholder: "advisor name",
            onChange: (event) => updateAdvisor(index, { name: event.target.value })
          }
        ), /* @__PURE__ */ React.createElement(
          "select",
          {
            style: styles.select,
            value: entry.provider,
            onChange: (event) => {
              const nextGroup = catalog?.groups.find((item) => item.id === event.target.value);
              updateAdvisor(index, {
                provider: event.target.value,
                model: nextGroup?.models[0]?.id ?? "",
                reasoningEffort: void 0
              });
            }
          },
          /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 provider \u2014"),
          (catalog?.groups ?? []).map((item) => /* @__PURE__ */ React.createElement("option", { key: item.id, value: item.id }, item.name))
        ), /* @__PURE__ */ React.createElement(
          "select",
          {
            style: styles.select,
            value: entry.model,
            onChange: (event) => updateAdvisor(index, { model: event.target.value, reasoningEffort: void 0 })
          },
          /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 model \u2014"),
          (group?.models ?? []).map((item) => /* @__PURE__ */ React.createElement("option", { key: item.id, value: item.id }, item.name || item.id))
        ), efforts.length > 0 && /* @__PURE__ */ React.createElement(
          "select",
          {
            style: styles.select,
            value: entry.reasoningEffort ?? "",
            onChange: (event) => updateAdvisor(index, { reasoningEffort: event.target.value || void 0 }),
            title: "Reasoning effort"
          },
          /* @__PURE__ */ React.createElement("option", { value: "" }, "default effort"),
          efforts.map((effort) => /* @__PURE__ */ React.createElement("option", { key: effort.id, value: effort.id }, effort.name || effort.id))
        ), /* @__PURE__ */ React.createElement("label", { style: { display: "inline-flex", alignItems: "center", gap: 6 } }, "max turns", /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "number",
            min: 1,
            max: 10,
            style: { ...styles.input, width: 60 },
            value: entry.maxTurns,
            onChange: (event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(parsed)) {
                updateAdvisor(index, { maxTurns: Math.min(10, Math.max(1, parsed)) });
              }
            }
          }
        )), /* @__PURE__ */ React.createElement("button", { style: styles.dangerButton, onClick: () => removeAdvisor(index) }, "remove")),
        /* @__PURE__ */ React.createElement(
          "textarea",
          {
            style: styles.textarea,
            placeholder: "Optional specialization, e.g. 'Focus on security: injection, secrets, unsafe deserialization.'",
            value: entry.instructions ?? "",
            onChange: (event) => updateAdvisor(index, { instructions: event.target.value })
          }
        )
      );
    }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("button", { style: styles.button, onClick: addAdvisor }, "+ Add advisor"))), /* @__PURE__ */ React.createElement("div", { style: styles.card }, /* @__PURE__ */ React.createElement("strong", null, "Live status"), (view?.sessions ?? []).length === 0 ? /* @__PURE__ */ React.createElement("span", { style: styles.hint }, value.enabled ? "No sessions with attached advisors yet. Start a session and advisors will attach." : "Advisors are disabled.") : (view?.sessions ?? []).map((session) => /* @__PURE__ */ React.createElement("div", { key: session.sessionId, style: { display: "flex", flexDirection: "column", gap: 6 } }, /* @__PURE__ */ React.createElement("span", { style: styles.hint }, "session ", session.sessionId), /* @__PURE__ */ React.createElement("div", { style: styles.row }, session.advisors.map((advisor) => /* @__PURE__ */ React.createElement("span", { key: advisor.name, style: styles.chip, title: advisor.lastError ?? "" }, /* @__PURE__ */ React.createElement(
      "span",
      {
        style: {
          width: 8,
          height: 8,
          borderRadius: 999,
          background: STATUS_COLORS[advisor.status] ?? "#8a8a8a",
          display: "inline-block"
        }
      }
    ), advisor.name, " \xB7 ", advisor.status, advisor.backlog > 0 ? ` \xB7 backlog ${advisor.backlog}` : "", ` \xB7 ${advisor.reviewsCompleted} reviews / ${advisor.adviceDelivered} notes`)))))), /* @__PURE__ */ React.createElement("div", { style: styles.hint }, `Advice semantics ported from oh-my-pi (can1357/oh-my-pi, MIT). Advisors investigate with read-only tools and deliver notes as <advisory guidance="weigh, don't blindly obey"> \u2014 the primary agent decides what to do with them.`));
  };
}

// src/client/index.ts
var name = "dsh-omp-advisor";
var inject = ["slots", "connection"];
function apply(ctx) {
  ctx.effect(
    () => ctx.slots.inject("settings.section", function* () {
      yield ctx.slots.register(
        {
          name: "settings.section",
          id: "dsh-omp-advisor",
          order: 13,
          label: () => "OMP Advisor",
          inject: () => ({})
        },
        createSettingsSection(ctx)
      );
    }),
    "dsh-omp-advisor: settings section"
  );
}

return module.exports; } });
//# sourceMappingURL=client.js.map
