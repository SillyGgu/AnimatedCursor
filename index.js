import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const EXT_NAME = 'AnimatedCursor';
const STYLE_ID = 'animated-cursor-style';
const TEXT_STYLE_ID = 'animated-cursor-text-style';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

if (!extension_settings[EXT_NAME]) {
    extension_settings[EXT_NAME] = {
        enabled: true,
        cssUrl: '',
        cursorList: [],
        textCursorEnabled: false,
        textCssUrl: '',
        textCursorList: [],
    };
}

const settings = extension_settings[EXT_NAME];

if (!settings.cursorList) settings.cursorList = [];
if (!settings.textCursorList) settings.textCursorList = [];
if (settings.textCursorEnabled === undefined) settings.textCursorEnabled = false;
if (settings.textCssUrl === undefined) settings.textCssUrl = '';

// ─── CSS 가져오기 ────────────────────────────────────────────

const cssCache = new Map();

async function fetchCSS(url) {
    if (cssCache.has(url)) return cssCache.get(url);

    const sessionKey = 'ac_css_' + url;
    try {
        const cached = sessionStorage.getItem(sessionKey);
        if (cached) {
            cssCache.set(url, cached);
            return cached;
        }
    } catch (_) {}

    const direct = await fetch(url).catch(() => null);
    if (direct && direct.ok) {
        const text = await direct.text();
        cssCache.set(url, text);
        try { sessionStorage.setItem(sessionKey, text); } catch (_) {}
        return text;
    }
    const proxied = await fetch(CORS_PROXY + encodeURIComponent(url)).catch(() => null);
    if (proxied && proxied.ok) {
        const text = await proxied.text();
        cssCache.set(url, text);
        try { sessionStorage.setItem(sessionKey, text); } catch (_) {}
        return text;
    }
    return null;
}

function extractCursorValue(css) {
    const match = css.match(/cursor\s*:\s*(url\([^)]+\)[^,;]*(?:,\s*url\([^)]+\)[^,;]*)*(?:,\s*\w+)?)/i);
    return match ? match[1].trim() : null;
}

// ─── 스타일 주입 ─────────────────────────────────────────────

function injectStyle(cursorValue, isText, rawCss) {
    const id = isText ? TEXT_STYLE_ID : STYLE_ID;

    // 태그가 없을 때만 새로 만들고, 있으면 재사용
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('style');
        el.id = id;
        document.head.appendChild(el);
    }

    const hasAnimation = rawCss && /@keyframes\s+cursor-anim/i.test(rawCss);

    if (hasAnimation) {
        const keyframesMatch = rawCss.match(/@keyframes\s+cursor-anim\s*\{[\s\S]*?\}\s*\}/i);
        const keyframesOnly = keyframesMatch ? keyframesMatch[0] : '';
        const durationMatch = rawCss.match(/animation\s*:[^;}]*?([\d.]+m?s)/i);
        const duration = durationMatch ? durationMatch[1] : '600ms';

        if (isText) {
            const renamedKeyframes = keyframesOnly.replace(/cursor-anim/g, 'cursor-anim-text');
            el.textContent = renamedKeyframes + `
input, input[type="text"], input[type="search"], input[type="email"],
input[type="password"], input[type="url"], input[type="number"],
textarea, [contenteditable], [contenteditable="true"] {
    animation: cursor-anim-text ${duration} step-end infinite !important;
}`;
        } else {
            el.textContent = keyframesOnly + `
*, *::before, *::after { animation: cursor-anim ${duration} step-end infinite !important; }`;
        }
    } else {
        if (isText) {
            el.textContent = `
input, input[type="text"], input[type="search"], input[type="email"],
input[type="password"], input[type="url"], input[type="number"],
textarea, [contenteditable], [contenteditable="true"] {
    cursor: ${cursorValue} !important;
}`;
        } else {
            el.textContent = `*, *::before, *::after { cursor: ${cursorValue} !important; }`;
        }
    }
}

function removeStyle() {
    document.getElementById(STYLE_ID)?.remove();
}

function removeTextStyle() {
    document.getElementById(TEXT_STYLE_ID)?.remove();
}

// ─── 적용 ────────────────────────────────────────────────────

const SAFE_CURSOR = /^(?:url\(["']?(?:https?:\/\/|data:image\/)[^)]*["']?\)\s*(?:\d+\s+\d+\s*)?[,\s]*)+(?:\s*\w+)?$/i;

async function fetchAndApplyCursor(url, isText = false) {
    const statusTarget = isText ? 'text' : 'global';
    if (!url) {
        isText ? removeTextStyle() : removeStyle();
        return;
    }

    showStatus(statusTarget, '⏳ 불러오는 중...', 'ok');

    const css = await fetchCSS(url);
    if (!css) {
        showStatus(statusTarget, '❌ URL을 불러올 수 없어요. 주소를 확인해주세요.', 'error');
        return;
    }

    const hasAnimation = /@keyframes\s+cursor-anim/i.test(css);
    if (hasAnimation) {
        injectStyle(null, isText, css);
        showStatus(statusTarget, isText ? '✅ 입력창 커서 적용됨' : '✅ 커서 적용됨', 'ok');
        return;
    }

    const cursorValue = extractCursorValue(css);
    if (!cursorValue) {
        const fallback = css.match(/cursor\s*:\s*([^;]+)/i);
        if (!fallback) {
            showStatus(statusTarget, '❌ CSS에서 cursor 속성을 찾지 못했어요.', 'error');
            return;
        }
        const fallbackValue = fallback[1].trim();
        if (!SAFE_CURSOR.test(fallbackValue)) {
            showStatus(statusTarget, '❌ 안전하지 않은 cursor 값이 감지됐어요.', 'error');
            return;
        }
        injectStyle(fallbackValue, isText, css);
    } else {
        if (!SAFE_CURSOR.test(cursorValue)) {
            showStatus(statusTarget, '❌ 안전하지 않은 cursor 값이 감지됐어요.', 'error');
            return;
        }
        injectStyle(cursorValue, isText, css);
    }

    showStatus(statusTarget, isText ? '✅ 입력창 커서 적용됨' : '✅ 커서 적용됨', 'ok');
}

// ─── 상태 표시 ───────────────────────────────────────────────

function showStatus(target, msg, type) {
    const id = target === 'text' ? 'ac-text-status' : 'ac-status';
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'error' ? 'var(--SmartThemeQuoteColor)' : 'var(--SmartThemeBodyColor)';
}

// ─── 목록 렌더링 ─────────────────────────────────────────────

function renderCursorList(isText = false) {
    const containerId = isText ? 'ac-text-list' : 'ac-list';
    const container = document.getElementById(containerId);
    if (!container) return;

    const list = isText ? settings.textCursorList : settings.cursorList;
    const activeUrl = isText ? settings.textCssUrl : settings.cssUrl;

    if (list.length === 0) {
        container.innerHTML = '<div style="font-size:12px; opacity:0.4; padding:6px 2px;">저장된 커서가 없어요. URL을 입력하고 저장해보세요.</div>';
        return;
    }

    container.innerHTML = '';

    list.forEach((item, index) => {
        const isActive = item.url === activeUrl;

        const row = document.createElement('div');
        row.className = 'ac-row';
        row.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 5px 6px;
            margin-bottom: 3px;
            border-radius: 4px;
            background: ${isActive ? 'var(--SmartThemeBlurTintColor, rgba(255,255,255,0.07))' : 'transparent'};
            border: 1px solid ${isActive ? 'var(--SmartThemeBodyColor)' : 'transparent'};
            transition: background 0.15s;
        `;

        const dot = document.createElement('div');
        dot.style.cssText = `
            width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
            background: ${isActive ? 'var(--SmartThemeBodyColor)' : 'transparent'};
            border: 1px solid var(--SmartThemeBodyColor);
            opacity: ${isActive ? '1' : '0.3'};
        `;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        nameSpan.style.cssText = `flex:1; font-size:12px; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`;
        nameSpan.title = '클릭: 적용 / 이름 수정은 ✎ 버튼';

        nameSpan.addEventListener('click', () => {
            if (isText) {
                settings.textCssUrl = item.url;
                $('#ac-text-url').val(item.url);
            } else {
                settings.cssUrl = item.url;
                $('#ac-url').val(item.url);
            }
            saveSettingsDebounced();
            const enabled = isText ? settings.textCursorEnabled : settings.enabled;
            if (enabled) fetchAndApplyCursor(item.url, isText);
            renderCursorList(isText);
        });

        const editBtn = document.createElement('button');
        editBtn.textContent = '✎';
        editBtn.title = '이름 수정';
        editBtn.style.cssText = `background:none; border:none; color:var(--SmartThemeBodyColor); opacity:0.4; cursor:pointer; font-size:13px; padding:0 3px; flex-shrink:0; line-height:1;`;
        editBtn.addEventListener('mouseenter', () => editBtn.style.opacity = '1');
        editBtn.addEventListener('mouseleave', () => editBtn.style.opacity = '0.4');

        editBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = item.name;
            input.style.cssText = `flex:1; font-size:12px; padding:1px 4px; background:var(--SmartThemeChatTintColor,rgba(0,0,0,0.2)); border:1px solid var(--SmartThemeBodyColor); color:var(--SmartThemeBodyColor); border-radius:3px; outline:none; min-width:0;`;

            row.replaceChild(input, nameSpan);
            editBtn.textContent = '✔';
            editBtn.title = '저장';
            input.focus();
            input.select();

            const save = () => {
                const newName = input.value.trim();
                if (newName) { list[index].name = newName; saveSettingsDebounced(); }
                renderCursorList(isText);
            };

            editBtn.onclick = save;
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') renderCursorList(isText);
            });
            input.addEventListener('blur', (e) => {
                if (e.relatedTarget === editBtn) return;
                save();
            });
        });

        const delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.title = '삭제';
        delBtn.style.cssText = `background:none; border:none; color:var(--SmartThemeQuoteColor); opacity:0.35; cursor:pointer; font-size:12px; padding:0 3px; flex-shrink:0; line-height:1;`;
        delBtn.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
        delBtn.addEventListener('mouseleave', () => delBtn.style.opacity = '0.35');

        delBtn.addEventListener('click', () => {
            const wasActive = item.url === activeUrl;
            list.splice(index, 1);
            if (wasActive) {
                if (isText) { settings.textCssUrl = ''; $('#ac-text-url').val(''); removeTextStyle(); }
                else { settings.cssUrl = ''; $('#ac-url').val(''); removeStyle(); }
                showStatus(isText ? 'text' : 'global', '', '');
            }
            saveSettingsDebounced();
            renderCursorList(isText);
        });

        row.appendChild(dot);
        row.appendChild(nameSpan);
        row.appendChild(editBtn);
        row.appendChild(delBtn);
        container.appendChild(row);
    });
}

// ─── 설정 UI ─────────────────────────────────────────────────

function renderSettings() {
    const html = `
<div id="ac-settings" style="padding: 6px 0;">

    <label style="display:flex; align-items:center; gap:8px; margin-bottom:12px; cursor:pointer;">
        <input type="checkbox" id="ac-enabled" ${settings.enabled ? 'checked' : ''} />
        <span>전체 커서 활성화</span>
    </label>

    <div style="font-size:11px; opacity:0.5; margin-bottom:4px;">CSS URL</div>
    <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
        <input type="text" id="ac-url" placeholder="https://..." value="${settings.cssUrl}" style="flex:1; font-size:12px; padding:4px 6px;" />
        <input type="button" id="ac-apply" value="적용" class="menu_button" style="white-space:nowrap;" />
    </div>
    <div id="ac-status" style="font-size:12px; margin-bottom:10px; min-height:16px;"></div>

    <div style="font-size:11px; opacity:0.5; margin-bottom:4px;">목록에 저장</div>
    <div style="display:flex; gap:6px; align-items:center;">
        <input type="text" id="ac-save-name" placeholder="이름 (예: 반짝이 별)" style="flex:1; font-size:12px; padding:4px 6px;" />
        <input type="button" id="ac-save" value="+ 저장" class="menu_button" style="white-space:nowrap;" />
    </div>
    <div style="margin-top:2px; font-size:11px; opacity:0.35;">URL을 먼저 입력한 뒤 이름 지정 → 저장</div>

    <hr style="margin:12px 0; opacity:0.15;" />
    <div style="font-size:11px; opacity:0.5; margin-bottom:6px;">저장된 목록</div>
    <div id="ac-list" style="max-height:220px; overflow-y:auto;"></div>

    <hr style="margin:16px 0; opacity:0.15;" />

    <label style="display:flex; align-items:center; gap:8px; margin-bottom:12px; cursor:pointer;">
        <input type="checkbox" id="ac-text-enabled" ${settings.textCursorEnabled ? 'checked' : ''} />
        <span>입력창 커서 활성화</span>
    </label>

    <div style="font-size:11px; opacity:0.5; margin-bottom:4px;">입력창 커서 CSS URL</div>
    <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
        <input type="text" id="ac-text-url" placeholder="https://..." value="${settings.textCssUrl}" style="flex:1; font-size:12px; padding:4px 6px;" />
        <input type="button" id="ac-text-apply" value="적용" class="menu_button" style="white-space:nowrap;" />
    </div>
    <div id="ac-text-status" style="font-size:12px; margin-bottom:10px; min-height:16px;"></div>

    <div style="font-size:11px; opacity:0.5; margin-bottom:4px;">목록에 저장</div>
    <div style="display:flex; gap:6px; align-items:center;">
        <input type="text" id="ac-text-save-name" placeholder="이름 (예: 텍스트 별)" style="flex:1; font-size:12px; padding:4px 6px;" />
        <input type="button" id="ac-text-save" value="+ 저장" class="menu_button" style="white-space:nowrap;" />
    </div>
    <div style="margin-top:2px; font-size:11px; opacity:0.35;">URL을 먼저 입력한 뒤 이름 지정 → 저장</div>

    <hr style="margin:12px 0; opacity:0.15;" />
    <div style="font-size:11px; opacity:0.5; margin-bottom:6px;">텍스트 저장된 목록</div>
    <div id="ac-text-list" style="max-height:220px; overflow-y:auto;"></div>

</div>`;

    $('#extensions_settings2').append(`
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>애니커서</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">${html}</div>
        </div>
    `);

    // ── 전체 커서 ──

    $('#ac-url').on('input', function () {
        if (this.value.trim() && !$('#ac-save-name').val()) {
            try {
                const seg = decodeURIComponent(this.value.trim().split('/').pop().replace('.css', ''));
                $('#ac-save-name').attr('placeholder', seg.slice(0, 30) || '이름 (예: 반짝이 별)');
            } catch (_) {}
        }
    });

    $('#ac-apply').on('click', () => {
        const url = $('#ac-url').val().trim();
        if (!url) return;
        settings.cssUrl = url;
        saveSettingsDebounced();
        if (settings.enabled) fetchAndApplyCursor(url, false);
        renderCursorList(false);
    });

    $('#ac-url').on('keydown', (e) => {
        if (e.key === 'Enter') { $('#ac-apply').trigger('click'); setTimeout(() => $('#ac-save-name').focus(), 100); }
    });

    $('#ac-enabled').on('change', function () {
        settings.enabled = this.checked;
        saveSettingsDebounced();
        if (settings.enabled && settings.cssUrl) fetchAndApplyCursor(settings.cssUrl, false);
        else removeStyle();
    });

    $('#ac-save').on('click', () => {
        const url = $('#ac-url').val().trim();
        const name = $('#ac-save-name').val().trim() || $('#ac-save-name').attr('placeholder') || '';
        if (!url) { showStatus('global', '❌ URL을 먼저 입력해주세요.', 'error'); return; }
        if (!name || name === '이름 (예: 반짝이 별)') { showStatus('global', '❌ 이름을 입력해주세요.', 'error'); $('#ac-save-name').focus(); return; }
        const exists = settings.cursorList.find(i => i.url === url);
        if (exists) { showStatus('global', `❌ 이미 "${exists.name}"으로 저장돼 있어요.`, 'error'); return; }
        settings.cursorList.push({ name, url });
        settings.cssUrl = url;
        saveSettingsDebounced();
        $('#ac-save-name').val('').attr('placeholder', '이름 (예: 반짝이 별)');
        showStatus('global', `✅ "${name}" 저장됨`, 'ok');
        if (settings.enabled) fetchAndApplyCursor(url, false);
        renderCursorList(false);
    });

    $('#ac-save-name').on('keydown', (e) => { if (e.key === 'Enter') $('#ac-save').trigger('click'); });

    // ── 텍스트 커서 ──

    $('#ac-text-url').on('input', function () {
        if (this.value.trim() && !$('#ac-text-save-name').val()) {
            try {
                const seg = decodeURIComponent(this.value.trim().split('/').pop().replace('.css', ''));
                $('#ac-text-save-name').attr('placeholder', seg.slice(0, 30) || '이름 (예: 텍스트 별)');
            } catch (_) {}
        }
    });

    $('#ac-text-apply').on('click', () => {
        const url = $('#ac-text-url').val().trim();
        if (!url) return;
        settings.textCssUrl = url;
        saveSettingsDebounced();
        if (settings.textCursorEnabled) fetchAndApplyCursor(url, true);
        renderCursorList(true);
    });

    $('#ac-text-url').on('keydown', (e) => {
        if (e.key === 'Enter') { $('#ac-text-apply').trigger('click'); setTimeout(() => $('#ac-text-save-name').focus(), 100); }
    });

    $('#ac-text-enabled').on('change', function () {
        settings.textCursorEnabled = this.checked;
        saveSettingsDebounced();
        if (settings.textCursorEnabled && settings.textCssUrl) fetchAndApplyCursor(settings.textCssUrl, true);
        else removeTextStyle();
    });

    $('#ac-text-save').on('click', () => {
        const url = $('#ac-text-url').val().trim();
        const name = $('#ac-text-save-name').val().trim() || $('#ac-text-save-name').attr('placeholder') || '';
        if (!url) { showStatus('text', '❌ URL을 먼저 입력해주세요.', 'error'); return; }
        if (!name || name === '이름 (예: 텍스트 별)') { showStatus('text', '❌ 이름을 입력해주세요.', 'error'); $('#ac-text-save-name').focus(); return; }
        const exists = settings.textCursorList.find(i => i.url === url);
        if (exists) { showStatus('text', `❌ 이미 "${exists.name}"으로 저장돼 있어요.`, 'error'); return; }
        settings.textCursorList.push({ name, url });
        settings.textCssUrl = url;
        saveSettingsDebounced();
        $('#ac-text-save-name').val('').attr('placeholder', '이름 (예: 텍스트 별)');
        showStatus('text', `✅ "${name}" 저장됨`, 'ok');
        if (settings.textCursorEnabled) fetchAndApplyCursor(url, true);
        renderCursorList(true);
    });

    $('#ac-text-save-name').on('keydown', (e) => { if (e.key === 'Enter') $('#ac-text-save').trigger('click'); });

    renderCursorList(false);
    renderCursorList(true);

    if (settings.enabled && settings.cssUrl) fetchAndApplyCursor(settings.cssUrl, false);
    if (settings.textCursorEnabled && settings.textCssUrl) fetchAndApplyCursor(settings.textCssUrl, true);
}

// ─── 초기화 ──────────────────────────────────────────────────

jQuery(async () => {
    renderSettings();
});