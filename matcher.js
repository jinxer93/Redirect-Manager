"use strict";

const RedirectMatcher = (() => {
    function normalizeHostname(hostname) {
        return String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
    }

    function normalizeHostSource(source) {
        let value = String(source || "").trim().toLowerCase();
        if (!value) return "";
        if (value.includes("://")) {
            try { value = new URL(value).hostname; } catch { return ""; }
        }
        return value.split("/")[0].split("?")[0].split("#")[0].replace(/\.$/, "");
    }

    function hostMatches(hostname, source) {
        const host = normalizeHostname(hostname);
        const pattern = normalizeHostSource(source);
        if (!host || !pattern) return false;
        if (pattern.startsWith("*.")) {
            const base = pattern.slice(2);
            return host !== base && host.endsWith(`.${base}`);
        }
        return host === pattern;
    }

    function normalizedExactUrl(value, options = {}) {
        const url = new URL(value);
        url.hostname = url.hostname.toLowerCase();
        if (options.ignoreQueryString) url.search = "";
        if (options.ignoreFragment) url.hash = "";
        return url.href;
    }

    function exactUrlMatches(current, source, options) {
        try {
            return normalizedExactUrl(current, options) === normalizedExactUrl(source, options);
        } catch {
            return false;
        }
    }

    function matchSource(urlValue, rule) {
        let url;
        try { url = new URL(urlValue); } catch { return null; }
        for (const source of rule.sources || []) {
            const matched = rule.matchType === "exact"
                ? exactUrlMatches(url.href, source, rule.options || {})
                : hostMatches(url.hostname, source);
            if (matched) return source;
        }
        return null;
    }

    function matchRule(urlValue, rule, context = {}) {
        if (!rule?.enabled) return null;
        if (rule.options?.topLevelOnly !== false && Number.isInteger(context.frameId) && context.frameId !== 0) return null;
        const matchedSource = matchSource(urlValue, rule);
        return matchedSource ? { rule, matchedSource, destination: rule.destination } : null;
    }

    function findFirstMatch(urlValue, rules, context = {}) {
        for (const rule of rules || []) {
            const match = matchRule(urlValue, rule, context);
            if (match) return match;
        }
        return null;
    }

    function destinationMatchesRule(rule) {
        return Boolean(rule?.destination && matchSource(rule.destination, { ...rule, enabled: true }));
    }

    return {
        normalizeHostname,
        normalizeHostSource,
        hostMatches,
        normalizedExactUrl,
        exactUrlMatches,
        matchSource,
        matchRule,
        findFirstMatch,
        destinationMatchesRule
    };
})();
