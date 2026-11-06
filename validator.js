"use strict";

const RedirectValidator = (() => {
    function isHttpUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch {
            return false;
        }
    }
	
    function isValidDestination(value) {
        const input = String(value || "").trim().toLowerCase();

        return (
            input === "about:blank" ||
            input === "about:newtab" ||
            isHttpUrl(input)
        );
    }

    function validateHostSource(source) {
        const value = String(source || "").trim().toLowerCase();
        if (!value) return "Source host is empty.";
        if (value.includes("/") || value.includes("?") || value.includes("#")) {
            return "Host rules must contain only a hostname.";
        }
        const host = value.startsWith("*.") ? value.slice(2) : value;
        const label = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
        const hostnamePattern = new RegExp(`^(?=.{1,253}$)${label}(?:\\.${label})+$`, "i");
        return hostnamePattern.test(host) ? "" : "Enter a valid hostname such as bing.com or *.bing.com.";
    }

    function validateExactSource(source) {
        return isHttpUrl(source) ? "" : "Exact URL sources must begin with http:// or https://.";
    }

    function cleanSources(sources) {
        const cleaned = [];
        const seen = new Set();
        for (const source of sources || []) {
            const value = String(source).trim();
            const key = value.toLowerCase();
            if (!value || seen.has(key)) continue;
            seen.add(key);
            cleaned.push(value);
        }
        return cleaned;
    }

    function validateRule(rule, otherRules = []) {
        const errors = [];
        const warnings = [];
        if (!rule.name?.trim()) errors.push("Enter a rule name.");
        if (!Array.isArray(rule.sources) || rule.sources.length === 0) errors.push("Add at least one source.");
        if (!isValidDestination(rule.destination)) errors.push("Destination must be a valid HTTP/HTTPS URL, about:blank, or about:newtab.");

        for (const source of rule.sources || []) {
            const error = rule.matchType === "exact" ? validateExactSource(source) : validateHostSource(source);
            if (error) errors.push(`${source || "Empty source"}: ${error}`);
        }

        if (RedirectMatcher.destinationMatchesRule({ ...rule, enabled: true })) {
            errors.push("The destination matches this rule's source and would create a redirect loop.");
        }

        if (otherRules.some((item) => item.id !== rule.id && item.name.trim().toLowerCase() === rule.name.trim().toLowerCase())) {
            warnings.push(`Another rule is already named "${rule.name}".`);
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    return { isHttpUrl, isValidDestination, validateHostSource, validateExactSource, cleanSources, validateRule };
})();
