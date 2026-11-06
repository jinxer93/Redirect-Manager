"use strict";

const RedirectStorage = (() => {
    const RULES_KEY = "redirectRules";
    const LOGS_KEY = "redirectLogs";
    const MAX_LOG_ENTRIES = 100;

    const DEFAULT_RULES = [
        {
            id: "msn-bing-skip",
            name: "MSN / Bing skip",
            enabled: true,
            matchType: "host",
            sources: ["msn.com", "*.msn.com", "bing.com", "*.bing.com"],
            destination: "about:newtab",
            options: {
                topLevelOnly: true,
                ignoreQueryString: false,
                ignoreFragment: true,
                redirectMethod: "replace",
                loggingEnabled: false
            }
        }
    ];

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function getFrom(area, key) {
        return new Promise((resolve, reject) => {
            area.get(key, (result) => {
                const error = chrome.runtime.lastError;
                if (error) return reject(new Error(error.message));
                resolve(result[key]);
            });
        });
    }

    function setIn(area, values) {
        return new Promise((resolve, reject) => {
            area.set(values, () => {
                const error = chrome.runtime.lastError;
                if (error) return reject(new Error(error.message));
                resolve();
            });
        });
    }

    function removeFrom(area, key) {
        return new Promise((resolve, reject) => {
            area.remove(key, () => {
                const error = chrome.runtime.lastError;
                if (error) return reject(new Error(error.message));
                resolve();
            });
        });
    }

    function createId() {
        if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
        return `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function normalizeOptions(options = {}) {
        return {
            topLevelOnly: options.topLevelOnly !== false,
            ignoreQueryString: options.ignoreQueryString === true,
            ignoreFragment: options.ignoreFragment !== false,
            redirectMethod: options.redirectMethod === "newTab" ? "newTab" : "replace",
            loggingEnabled: options.loggingEnabled === true
        };
    }

    function normalizeRule(rule = {}, index = 0) {
        const sources = Array.isArray(rule.sources) ? rule.sources : [];
        const uniqueSources = [];
        const seen = new Set();

        for (const source of sources) {
            if (typeof source !== "string") continue;
            const cleaned = source.trim();
            const key = cleaned.toLowerCase();
            if (!cleaned || seen.has(key)) continue;
            seen.add(key);
            uniqueSources.push(cleaned);
        }

        return {
            id: typeof rule.id === "string" && rule.id.trim() ? rule.id.trim() : createId(),
            name: typeof rule.name === "string" && rule.name.trim() ? rule.name.trim() : `Rule ${index + 1}`,
            enabled: rule.enabled !== false,
            matchType: rule.matchType === "exact" ? "exact" : "host",
            sources: uniqueSources,
            destination: typeof rule.destination === "string" ? rule.destination.trim() : "",
            options: normalizeOptions(rule.options)
        };
    }

    function normalizeRules(rules) {
        return Array.isArray(rules) ? rules.map(normalizeRule) : [];
    }

    function createBlankRule() {
        return normalizeRule({
            id: createId(),
            name: "",
            enabled: true,
            matchType: "host",
            sources: [],
            destination: "",
            options: {
                topLevelOnly: true,
                ignoreQueryString: false,
                ignoreFragment: true,
                redirectMethod: "replace",
                loggingEnabled: false
            }
        });
    }

    async function loadRules() {
        const stored = await getFrom(chrome.storage.sync, RULES_KEY);
        if (!Array.isArray(stored)) {
            const defaults = clone(DEFAULT_RULES);
            await saveRules(defaults);
            return defaults;
        }
        return normalizeRules(stored);
    }

    async function saveRules(rules) {
        const normalized = normalizeRules(rules);
        await setIn(chrome.storage.sync, { [RULES_KEY]: normalized });
        return normalized;
    }

    async function loadLogs() {
        const logs = await getFrom(chrome.storage.local, LOGS_KEY);
        return Array.isArray(logs) ? logs : [];
    }

    async function addLog(entry) {
        const logs = await loadLogs();
        logs.unshift({
            id: createId(),
            timestamp: new Date().toISOString(),
            source: String(entry.source || ""),
            destination: String(entry.destination || ""),
            ruleId: String(entry.ruleId || ""),
            ruleName: String(entry.ruleName || "")
        });
        const trimmed = logs.slice(0, MAX_LOG_ENTRIES);
        await setIn(chrome.storage.local, { [LOGS_KEY]: trimmed });
        return trimmed;
    }

    async function clearLogs() {
        await removeFrom(chrome.storage.local, LOGS_KEY);
    }

    return {
        RULES_KEY,
        LOGS_KEY,
        DEFAULT_RULES,
        createId,
        createBlankRule,
        normalizeRule,
        normalizeRules,
        loadRules,
        saveRules,
        loadLogs,
        addLog,
        clearLogs
    };
})();
