"use strict";

document.addEventListener("DOMContentLoaded", async () => {
    const list = document.getElementById("popup-rule-list");
    document.getElementById("manage-rules-button").addEventListener("click", () => chrome.runtime.openOptionsPage());
    const rules = await RedirectStorage.loadRules();
    if (!rules.length) {
        const empty = document.createElement("div");
        empty.className = "popup-empty";
        empty.textContent = "No redirect rules.";
        list.append(empty);
        return;
    }
    for (const rule of rules) {
        const row = document.createElement("label");
        row.className = "popup-rule";
        const text = document.createElement("span");
        text.className = "popup-rule-text";
        const name = document.createElement("strong");
        name.textContent = rule.name;
        const count = document.createElement("small");
        count.textContent = `${rule.sources.length} source${rule.sources.length === 1 ? "" : "s"}`;
        text.append(name, count);
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.checked = rule.enabled;
        toggle.addEventListener("change", async () => {
            rule.enabled = toggle.checked;
            await RedirectStorage.saveRules(rules);
        });
        row.append(text, toggle);
        list.append(row);
    }
});
