"use strict";

const State = { rules: [], editingRuleId: null, draggedRuleId: null, sourceDrafts: [] };
const E = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
    cacheElements();
    bindEvents();
    State.rules = await RedirectStorage.loadRules();
    renderRules();
    await renderLogs();
}

function cacheElements() {
    for (const id of [
        "rule-list", "empty-state", "new-rule-button", "import-button", "export-button", "import-file",
        "editor-backdrop", "editor-drawer", "editor-title", "close-editor-button", "cancel-button", "save-button",
        "rule-name", "rule-enabled", "destination", "source-list", "source-input", "add-source-button",
        "bulk-sources", "add-bulk-sources-button", "source-heading", "source-hint", "redirect-method",
        "top-level-only", "ignore-query-string", "ignore-fragment", "logging-enabled", "editor-message",
        "test-url", "test-button", "test-result", "clear-logs-button", "log-list"
    ]) E[id] = document.getElementById(id);
    E.matchTypes = document.querySelectorAll('input[name="match-type"]');
    E.expandableSections = document.querySelectorAll(".bulk-section, .advanced-section");
}

function bindEvents() {
    E["new-rule-button"].addEventListener("click", openNewRule);
    E["close-editor-button"].addEventListener("click", closeEditor);
    E["cancel-button"].addEventListener("click", closeEditor);
    E["editor-backdrop"].addEventListener("click", closeEditor);
    E["save-button"].addEventListener("click", saveRule);
    E["add-source-button"].addEventListener("click", addSingleSource);
    E["source-input"].addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); addSingleSource(); } });
    E["add-bulk-sources-button"].addEventListener("click", addBulkSources);
    E.matchTypes.forEach(input => input.addEventListener("change", updateSourceLabels));
    E["import-button"].addEventListener("click", () => E["import-file"].click());
    E["import-file"].addEventListener("change", importRules);
    E["export-button"].addEventListener("click", exportRules);
    E["test-button"].addEventListener("click", evaluateTestUrl);
    E["test-url"].addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); evaluateTestUrl(); } });
    E["clear-logs-button"].addEventListener("click", async () => { await RedirectStorage.clearLogs(); await renderLogs(); });

    E.expandableSections.forEach(section => {
        section.addEventListener("toggle", () => {
            if (!section.open) return;

            // Let <details> finish laying out, then move the opened section
            // as high as the scrollable drawer allows.
            requestAnimationFrame(() => {
                section.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                    inline: "nearest"
                });
            });
        });
    });

    document.addEventListener("keydown", event => { if (event.key === "Escape" && E["editor-drawer"].classList.contains("open")) closeEditor(); });
}

function renderRules() {
    E["rule-list"].replaceChildren();
    E["empty-state"].hidden = State.rules.length !== 0;
    State.rules.forEach((rule, index) => E["rule-list"].append(createRuleCard(rule, index)));
}

function createRuleCard(rule, index) {
    const card = el("article", "rule-card");
    card.dataset.ruleId = rule.id;
    card.draggable = true;

    const drag = button("⋮⋮", "drag-handle", `Reorder ${rule.name}`);
    const toggleLabel = el("label", "switch");
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = rule.enabled;
    toggle.setAttribute("aria-label", `Enable ${rule.name}`);
    toggle.addEventListener("change", async () => {
        rule.enabled = toggle.checked;
        State.rules = await RedirectStorage.saveRules(State.rules);
        renderRules();
    });
    toggleLabel.append(toggle, el("span", "switch-track"));

    const content = el("div", "rule-card-content");
    const heading = el("div", "rule-heading-row");
    const title = el("h3", "rule-name", rule.name);
    const priority = el("span", "priority-badge", `Priority ${index + 1}`);
    heading.append(title, priority);
    const meta = el("div", "rule-meta", `${rule.sources.length} source${rule.sources.length === 1 ? "" : "s"} · ${rule.matchType === "exact" ? "Exact URL" : "Host match"}`);
    const previewText = rule.sources.length ? `${rule.sources.slice(0, 4).join(", ")}${rule.sources.length > 4 ? ` and ${rule.sources.length - 4} more` : ""}` : "No sources configured";
    content.append(heading, meta, el("div", "source-preview", previewText), el("div", "destination-preview", rule.destination));

    const actions = el("div", "rule-actions");
    actions.append(
        actionButton("Edit", () => openEditRule(rule.id), "primary-small"),
        actionButton("Duplicate", () => duplicateRule(rule.id)),
        actionButton("Test", () => testRule(rule)),
        actionButton("Delete", () => deleteRule(rule.id), "danger-small")
    );

    card.append(drag, toggleLabel, content, actions);
    attachDrag(card);
    return card;
}

function attachDrag(card) {
    card.addEventListener("dragstart", event => {
        State.draggedRuleId = card.dataset.ruleId;
        card.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", State.draggedRuleId);
    });
    card.addEventListener("dragend", clearDragStates);
    card.addEventListener("dragover", event => {
        event.preventDefault();
        if (card.dataset.ruleId === State.draggedRuleId) return;
        const before = event.clientY < card.getBoundingClientRect().top + card.offsetHeight / 2;
        card.classList.toggle("drag-over-before", before);
        card.classList.toggle("drag-over-after", !before);
    });
    card.addEventListener("dragleave", event => {
        if (!card.contains(event.relatedTarget)) card.classList.remove("drag-over-before", "drag-over-after");
    });
    card.addEventListener("drop", async event => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData("text/plain") || State.draggedRuleId;
        const targetId = card.dataset.ruleId;
        if (!draggedId || draggedId === targetId) return clearDragStates();
        const before = event.clientY < card.getBoundingClientRect().top + card.offsetHeight / 2;
        const from = State.rules.findIndex(rule => rule.id === draggedId);
        const [moved] = State.rules.splice(from, 1);
        let to = State.rules.findIndex(rule => rule.id === targetId);
        if (!before) to += 1;
        State.rules.splice(to, 0, moved);
        State.rules = await RedirectStorage.saveRules(State.rules);
        clearDragStates();
        renderRules();
    });
}

function clearDragStates() {
    document.querySelectorAll(".rule-card").forEach(card => card.classList.remove("dragging", "drag-over-before", "drag-over-after"));
    State.draggedRuleId = null;
}

function openNewRule() {
    State.editingRuleId = null;
    populateEditor(RedirectStorage.createBlankRule());
    E["editor-title"].textContent = "New Rule";
    openEditor();
}

function openEditRule(id) {
    const rule = State.rules.find(item => item.id === id);
    if (!rule) return;
    State.editingRuleId = id;
    populateEditor(rule);
    E["editor-title"].textContent = "Edit Rule";
    openEditor();
}

function openEditor() {
    E["editor-backdrop"].hidden = false;
    E["editor-drawer"].hidden = false;
    requestAnimationFrame(() => {
        E["editor-backdrop"].classList.add("open");
        E["editor-drawer"].classList.add("open");
    });
    document.body.classList.add("drawer-open");
    E["rule-name"].focus();
}

function closeEditor() {
    E["editor-backdrop"].classList.remove("open");
    E["editor-drawer"].classList.remove("open");
    document.body.classList.remove("drawer-open");
    setTimeout(() => {
        E["editor-backdrop"].hidden = true;
        E["editor-drawer"].hidden = true;
    }, 180);
    State.editingRuleId = null;
    State.sourceDrafts = [];
}

function populateEditor(rule) {
    E["rule-name"].value = rule.name || "";
    E["rule-enabled"].checked = rule.enabled !== false;
    E.destination.value = rule.destination || "";
    E.matchTypes.forEach(input => input.checked = input.value === rule.matchType);
    State.sourceDrafts = [...(rule.sources || [])];
    E["redirect-method"].value = rule.options?.redirectMethod === "newTab" ? "newTab" : "replace";
    E["top-level-only"].checked = rule.options?.topLevelOnly !== false;
    E["ignore-query-string"].checked = rule.options?.ignoreQueryString === true;
    E["ignore-fragment"].checked = rule.options?.ignoreFragment !== false;
    E["logging-enabled"].checked = rule.options?.loggingEnabled === true;
    E["source-input"].value = "";
    E["bulk-sources"].value = "";
    E["editor-message"].hidden = true;
    renderSources();
    updateSourceLabels();
}

function renderSources() {
    E["source-list"].replaceChildren();
    if (!State.sourceDrafts.length) return E["source-list"].append(el("div", "source-empty", "No sources added."));
    State.sourceDrafts.forEach((source, index) => {
        const row = el("div", "source-item");
        const remove = actionButton("Remove", () => { State.sourceDrafts.splice(index, 1); renderSources(); }, "remove-source");
        row.append(el("span", "", source), remove);
        E["source-list"].append(row);
    });
}

function matchType() {
    return [...E.matchTypes].find(input => input.checked)?.value || "host";
}

function updateSourceLabels() {
    const exact = matchType() === "exact";
    E["source-heading"].textContent = exact ? "Source URLs" : "Source hosts";
    E["source-hint"].textContent = exact ? "Enter complete URL. Assumes https:// if not explicitly defined." : "Enter hosts such as bing.com or *.bing.com.";
    E["source-input"].placeholder = exact ? "https://example.com/" : "*.example.com";
}

function addSingleSource() {
    const value = E["source-input"].value.trim();
    if (!value) return;
    State.sourceDrafts = RedirectValidator.cleanSources([...State.sourceDrafts, value]);
    E["source-input"].value = "";
    renderSources();
    E["source-input"].focus();
}

function addBulkSources() {
    const values = E["bulk-sources"].value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    State.sourceDrafts = RedirectValidator.cleanSources([...State.sourceDrafts, ...values]);
    E["bulk-sources"].value = "";
    renderSources();
}

function editorRule() {
    return {
        id: State.editingRuleId || RedirectStorage.createId(),
        name: E["rule-name"].value.trim(),
        enabled: E["rule-enabled"].checked,
        matchType: matchType(),
        sources: RedirectValidator.cleanSources(State.sourceDrafts),
        destination: E.destination.value.trim(),
        options: {
            topLevelOnly: E["top-level-only"].checked,
            ignoreQueryString: E["ignore-query-string"].checked,
            ignoreFragment: E["ignore-fragment"].checked,
            redirectMethod: E["redirect-method"].value === "newTab" ? "newTab" : "replace",
            loggingEnabled: E["logging-enabled"].checked
        }
    };
}

function normalizeHttpUrl(value) {
    const input = String(value || "").trim();
    if (!input) return "";

    return /^[a-z][a-z0-9+.-]*:/i.test(input)
        ? input
        : `https://${input}`;
}

async function saveRule() {
    let pendingSource = E["source-input"].value.trim();

    // Treat a value still present in the source input as implicitly added.
    if (pendingSource) {
        if (matchType() === "exact") {
            pendingSource = normalizeHttpUrl(pendingSource);
        }

        State.sourceDrafts = RedirectValidator.cleanSources([
            ...State.sourceDrafts,
            pendingSource
        ]);

        E["source-input"].value = "";
        renderSources();
    }

    // Browser-like convenience: assume HTTPS when no scheme is supplied.
    E.destination.value = normalizeHttpUrl(E.destination.value);

    const rule = editorRule();
    const validation = RedirectValidator.validateRule(rule, State.rules);
    if (!validation.valid) return showMessage(validation.errors.join("\n"), "error");
    if (State.editingRuleId) {
        const index = State.rules.findIndex(item => item.id === State.editingRuleId);
        if (index >= 0) State.rules[index] = rule;
    } else State.rules.push(rule);
    State.rules = await RedirectStorage.saveRules(State.rules);
    renderRules();
    closeEditor();
}

function showMessage(message, type) {
    E["editor-message"].hidden = false;
    E["editor-message"].className = `editor-message ${type}`;
    E["editor-message"].textContent = message;
}

async function duplicateRule(id) {
    const source = State.rules.find(item => item.id === id);
    if (!source) return;

    const copy = RedirectStorage.normalizeRule({
        ...JSON.parse(JSON.stringify(source)),
        id: RedirectStorage.createId(),
        name: `${source.name} Copy`,
        enabled: false
    });

    const index = State.rules.findIndex(item => item.id === id);
    State.rules.splice(index + 1, 0, copy);
    State.rules = await RedirectStorage.saveRules(State.rules);
    renderRules();

    openEditRule(copy.id);
}

async function deleteRule(id) {
    const rule = State.rules.find(item => item.id === id);
    if (!rule || !confirm(`Delete "${rule.name}"?`)) return;
    State.rules = State.rules.filter(item => item.id !== id);
    State.rules = await RedirectStorage.saveRules(State.rules);
    renderRules();
}

function testRule(rule) {
    E["test-url"].value = rule.matchType === "exact" ? (rule.sources[0] || "") : `https://${String(rule.sources[0] || "").replace(/^\*\./, "www.")}/`;
    evaluateTestUrl();
    E["test-url"].focus();
}

function normalizeTestUrl(value) {
    const input = String(value || "").trim();
    if (!input) return "";

    return /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
        ? input
        : `https://${input}`;
}

function evaluateTestUrl() {
    const value = normalizeTestUrl(E["test-url"].value);

    if (!RedirectValidator.isHttpUrl(value)) {
        return testResult("Enter a valid host or HTTP/HTTPS URL.", "error");
    }

    E["test-url"].value = value;

    const match = RedirectMatcher.findFirstMatch(value, State.rules, { frameId: 0 });
    
    if (!match) {
        const disabledMatch = RedirectMatcher.findFirstMatch(
            value, 
            State.rules.filter(r => !r.enabled).map(r => ({ ...r, enabled: true })),
			//State.rules.filter(r => !r.enabled), 
            { frameId: 0 }
        );

        if (disabledMatch) {
            E["test-result"].className = "test-result disabled";
            return E["test-result"].replaceChildren(
                el("div", "", `Matched rule: ${disabledMatch.rule.name} (Disabled)`),
                el("div", "", `Matched source: ${disabledMatch.matchedSource}`),
                el("div", "", `Destination: ${disabledMatch.destination}`)
            );
        }

        return testResult("No available rule matches this URL.", "no-match");
    }

    E["test-result"].className = "test-result matched";
    E["test-result"].replaceChildren(
        el("div", "", `Matched rule: ${match.rule.name}`),
        el("div", "", `Matched source: ${match.matchedSource}`),
        el("div", "", `Destination: ${match.destination}`)
    );
}

function testResult(text, type) {
    E["test-result"].className = `test-result ${type}`;
    E["test-result"].textContent = text;
}

function exportRules() {
    const data = { format: "redirect-manager-rules", version: 1, exportedAt: new Date().toISOString(), rules: State.rules };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "redirect-manager-rules.json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function importRules(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
        const parsed = JSON.parse(await file.text());
        const raw = Array.isArray(parsed) ? parsed : parsed.rules;
        if (!Array.isArray(raw)) throw new Error("The file does not contain a rules array.");
        const imported = RedirectStorage.normalizeRules(raw);
        for (const rule of imported) {
            const validation = RedirectValidator.validateRule(rule, imported);
            if (!validation.valid) throw new Error(`${rule.name}: ${validation.errors.join(" ")}`);
        }
        const replace = confirm("OK replaces existing rules. Cancel appends imported rules.");
        if (replace) State.rules = imported;
        else {
            const ids = new Set(State.rules.map(rule => rule.id));
            imported.forEach(rule => { if (ids.has(rule.id)) rule.id = RedirectStorage.createId(); State.rules.push(rule); });
        }
        State.rules = await RedirectStorage.saveRules(State.rules);
        renderRules();
    } catch (error) {
        alert(`Import failed: ${error.message}`);
    }
}

async function renderLogs() {
    const logs = await RedirectStorage.loadLogs();
    E["log-list"].replaceChildren();
    if (!logs.length) return E["log-list"].append(el("div", "log-empty", "Log empty. Only rules with logging enabled appear."));
    for (const log of logs) {
        const item = el("div", "log-item");
        const header = el("div", "log-header");
        const time = document.createElement("time");
        time.dateTime = log.timestamp;
        time.textContent = new Date(log.timestamp).toLocaleString();
        header.append(el("strong", "", log.ruleName || "Unknown rule"), time);
        item.append(header, el("div", "log-url", `${log.source}  →  ${log.destination}`));
        E["log-list"].append(item);
    }
}

function el(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

function button(text, className, label) {
    const node = actionButton(text, () => {}, className);
    if (label) node.setAttribute("aria-label", label);
    return node;
}

function actionButton(text, onClick, className = "") {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = text;
    if (className) node.className = className;
    node.addEventListener("click", onClick);
    return node;
}
