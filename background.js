"use strict";

importScripts("storage.js", "matcher.js");

let cachedRules = [];
let rulesLoaded = false;

async function refreshRules() {
    try {
        cachedRules = await RedirectStorage.loadRules();
    } catch (error) {
        console.error("Unable to load redirect rules:", error);
        cachedRules = [];
    } finally {
        rulesLoaded = true;
    }
}

async function executeRedirect(details, match) {
    const method = match.rule.options?.redirectMethod === "newTab" ? "newTab" : "replace";
    if (method === "newTab") {
        let tab;
        try { tab = await chrome.tabs.get(details.tabId); } catch { tab = null; }
        await chrome.tabs.create({
            url: match.destination,
            active: tab?.active ?? true,
            ...(Number.isInteger(tab?.index) ? { index: tab.index + 1 } : {})
        });
        try { await chrome.tabs.remove(details.tabId); } catch (error) { console.warn("Could not close source tab:", error); }
    } else {
        await chrome.tabs.update(details.tabId, { url: match.destination });
    }

    if (match.rule.options?.loggingEnabled) {
        await RedirectStorage.addLog({
            source: details.url,
            destination: match.destination,
            ruleId: match.rule.id,
            ruleName: match.rule.name
        });
    }
}

chrome.runtime.onInstalled.addListener(refreshRules);
chrome.runtime.onStartup.addListener(refreshRules);

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes[RedirectStorage.RULES_KEY]) {
        cachedRules = RedirectStorage.normalizeRules(changes[RedirectStorage.RULES_KEY].newValue || []);
        rulesLoaded = true;
    }
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    try {
        if (!rulesLoaded) await refreshRules();
        const match = RedirectMatcher.findFirstMatch(details.url, cachedRules, { frameId: details.frameId });
        if (match) await executeRedirect(details, match);
    } catch (error) {
        console.error("Redirect execution failed:", error);
    }
});

refreshRules();
