import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const EXT_NAME = 'animated_cursor';
const STYLE_ID = 'animated-cursor-style';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

if (!extension_settings[EXT_NAME]) {
    extension_settings[EXT_NAME] = {
        enabled: true,
        cssUrl: '',
        cursorList: [],
    };
}

const settings = extension_settings[EXT_NAME];

if (!settings.cursorList) {
    settings.cursorList = [];
}

// ─── CSS 적용 ───────────────────────────────────────────────

async function fetchAndApplyCursor(url) {
    removeStyle();
    if (!url) return;

    let css = '';
    try {
        const direct = await fetch(url).catch(() => null);
        if (direct && direct.ok) {
            css = await direct.text();
        } else {
            const proxied = await fetch(CORS_PROXY + encodeURIComponent(url));
            if (!proxied.ok) throw new Error('fetch failed');
            css = await proxied.text();
        }
    } catch (e) {
        console.error('[AnimatedCursor] fetch 실패:', e);
        showStatus('❌ URL을 불러올 수 없어요. 주소를 확인해주세요.', 'error');
        return;
    }

    const keyframesMatch = css.match(/@keyframes cursor-anim\s*\{[\s\S]*?\}\s*\}/);
    if (!keyframesMatch) {
        showStatus('❌ cursor-anim keyframes를 찾지 못했어요.', 'error');
        return;
    }

    const durationMatch = css.match(/animation:\s*cursor-anim\s+([\d.]+ms)/);
    const duration = durationMatch ? durationMatch[1] : '400ms';

    const finalCSS = `
${keyframesMatch[0]}

*, *::before, *::after {
    animation: cursor-anim ${duration} step-end infinite !important;
}
    `.trim();

    injectStyle(finalCSS);
    showStatus('✅ 커서 적용됨', 'ok');
}

function injectStyle(css) {
    removeStyle();
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
}

function removeStyle() {
    document.getElementById(STYLE_ID)?.remove();
}

function showStatus(msg, type) {
    const el = document.getElementById('ac-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'error' ? 'var(--SmartThemeQuoteColor)' : 'var(--SmartThemeBodyColor)';
}

// ─── 목록 렌더링 ─────────────────────────────────────────────

function renderCursorList() {
    const container = document.getElementById('ac-list');
    if (!container) return;

    if (settings.cursorList.length === 0) {
        container.innerHTML = '<div style="font-size:12px; opacity:0.4; padding:6px 2px;">저장된 커서가 없어요. URL을 입력하고 저장해보세요.</div>';
        return;
    }

    container.innerHTML = '';

    settings.cursorList.forEach((item, index) => {
        const isActive = item.url === settings.cssUrl;

        const row = document.createElement('div');
        row.className = 'ac-row';
        row.dataset.index = index;
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
            position: relative;
        `;

        // 활성 표시 점
        const dot = document.createElement('div');
        dot.style.cssText = `
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: ${isActive ? 'var(--SmartThemeBodyColor)' : 'transparent'};
            border: 1px solid ${isActive ? 'var(--SmartThemeBodyColor)' : 'var(--SmartThemeBodyColor)'};
            flex-shrink: 0;
            opacity: ${isActive ? '1' : '0.3'};
        `;

        // 이름 표시 (클릭하면 편집 모드)
        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        nameSpan.style.cssText = `
            flex: 1;
            font-size: 12px;
            cursor: pointer;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;
        nameSpan.title = '클릭: 적용 / 이름 수정은 ✎ 버튼';

        // 이름 클릭 → 적용
        nameSpan.addEventListener('click', () => {
            settings.cssUrl = item.url;
            $('#ac-url').val(item.url);
            saveSettingsDebounced();
            if (settings.enabled) fetchAndApplyCursor(item.url);
            renderCursorList();
        });

        // 편집 버튼 ✎
        const editBtn = document.createElement('button');
        editBtn.textContent = '✎';
        editBtn.title = '이름 수정';
        editBtn.style.cssText = `
            background: none;
            border: none;
            color: var(--SmartThemeBodyColor);
            opacity: 0.4;
            cursor: pointer;
            font-size: 13px;
            padding: 0 3px;
            flex-shrink: 0;
            line-height: 1;
        `;
        editBtn.addEventListener('mouseenter', () => editBtn.style.opacity = '1');
        editBtn.addEventListener('mouseleave', () => editBtn.style.opacity = '0.4');

        editBtn.addEventListener('click', () => {
            // 편집 모드 진입
            const input = document.createElement('input');
            input.type = 'text';
            input.value = item.name;
            input.style.cssText = `
                flex: 1;
                font-size: 12px;
                padding: 1px 4px;
                background: var(--SmartThemeChatTintColor, rgba(0,0,0,0.2));
                border: 1px solid var(--SmartThemeBodyColor);
                color: var(--SmartThemeBodyColor);
                border-radius: 3px;
                outline: none;
                min-width: 0;
            `;

            // nameSpan을 input으로 교체
            row.replaceChild(input, nameSpan);
            editBtn.textContent = '✔';
            editBtn.title = '저장';
            input.focus();
            input.select();

            const save = () => {
                const newName = input.value.trim();
                if (newName) {
                    settings.cursorList[index].name = newName;
                    saveSettingsDebounced();
                }
                renderCursorList();
            };

            editBtn.onclick = save;
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') renderCursorList();
            });
            input.addEventListener('blur', (e) => {
                // 편집 버튼 클릭이면 blur 무시
                if (e.relatedTarget === editBtn) return;
                save();
            });
        });

        // 삭제 버튼
        const delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.title = '삭제';
        delBtn.style.cssText = `
            background: none;
            border: none;
            color: var(--SmartThemeQuoteColor);
            opacity: 0.35;
            cursor: pointer;
            font-size: 12px;
            padding: 0 3px;
            flex-shrink: 0;
            line-height: 1;
        `;
        delBtn.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
        delBtn.addEventListener('mouseleave', () => delBtn.style.opacity = '0.35');

        delBtn.addEventListener('click', () => {
            const wasActive = item.url === settings.cssUrl;
            settings.cursorList.splice(index, 1);
            if (wasActive) {
                settings.cssUrl = '';
                $('#ac-url').val('');
                removeStyle();
                showStatus('', '');
            }
            saveSettingsDebounced();
            renderCursorList();
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
        <span>커서 활성화</span>
    </label>

    <div style="font-size:11px; opacity:0.5; margin-bottom:4px;">CSS URL</div>
    <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
        <input
            type="text"
            id="ac-url"
            placeholder="https://cdn.cursors-4u.net/cursors/animated/....css"
            value="${settings.cssUrl}"
            style="flex:1; font-size:12px; padding:4px 6px;"
        />
        <input type="button" id="ac-apply" value="적용" class="menu_button" style="white-space:nowrap;" />
    </div>

    <div id="ac-status" style="font-size:12px; margin-bottom:10px; min-height:16px;"></div>

    <div style="font-size:11px; opacity:0.5; margin-bottom:4px;">목록에 저장</div>
    <div style="display:flex; gap:6px; align-items:center;">
        <input
            type="text"
            id="ac-save-name"
            placeholder="이름 (예: 반짝이 별)"
            style="flex:1; font-size:12px; padding:4px 6px;"
        />
        <input type="button" id="ac-save" value="+ 저장" class="menu_button" style="white-space:nowrap;" />
    </div>

    <div style="margin-top: 2px; font-size:11px; opacity:0.35;">URL을 먼저 입력한 뒤 이름 지정 → 저장</div>

    <hr style="margin: 12px 0; opacity:0.15;" />

    <div style="font-size:11px; opacity:0.5; margin-bottom:6px;">저장된 목록 <span id="ac-count" style="opacity:0.6;"></span></div>
    <div id="ac-list" style="max-height:220px; overflow-y:auto;"></div>

</div>
    `;

    $('#extensions_settings2').append(`
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Animated Cursor</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">${html}</div>
        </div>
    `);

    // URL 입력 시 → 이름 입력창 힌트 업데이트
    $('#ac-url').on('input', function () {
        const url = this.value.trim();
        if (url && !$('#ac-save-name').val()) {
            // URL 마지막 세그먼트에서 자동 힌트 추출 (입력은 안 함)
            try {
                const seg = decodeURIComponent(url.split('/').pop().replace('.css', ''));
                $('#ac-save-name').attr('placeholder', seg.slice(0, 30) || '이름 (예: 반짝이 별)');
            } catch (_) {}
        }
    });

    // 적용 버튼
    $('#ac-apply').on('click', () => {
        const url = $('#ac-url').val().trim();
        if (!url) return;
        settings.cssUrl = url;
        saveSettingsDebounced();
        if (settings.enabled) fetchAndApplyCursor(url);
        renderCursorList();
    });

    $('#ac-url').on('keydown', (e) => {
        if (e.key === 'Enter') {
            $('#ac-apply').trigger('click');
            // 적용 후 이름 입력창으로 포커스 이동
            setTimeout(() => $('#ac-save-name').focus(), 100);
        }
    });

    // 활성화 토글
    $('#ac-enabled').on('change', function () {
        settings.enabled = this.checked;
        saveSettingsDebounced();
        if (settings.enabled && settings.cssUrl) {
            fetchAndApplyCursor(settings.cssUrl);
        } else {
            removeStyle();
        }
    });

    // 저장 버튼
    $('#ac-save').on('click', () => {
        const url = $('#ac-url').val().trim();
        const rawName = $('#ac-save-name').val().trim();
        // 이름 없으면 placeholder(자동 추출) 사용
        const name = rawName || $('#ac-save-name').attr('placeholder') || '';

        if (!url) {
            showStatus('❌ URL을 먼저 입력해주세요.', 'error');
            return;
        }
        if (!name || name === '이름 (예: 반짝이 별)') {
            showStatus('❌ 이름을 입력해주세요.', 'error');
            $('#ac-save-name').focus();
            return;
        }

        const exists = settings.cursorList.find(item => item.url === url);
        if (exists) {
            showStatus(`❌ 이미 "${exists.name}"으로 저장돼 있어요.`, 'error');
            return;
        }

        settings.cursorList.push({ name, url });
        saveSettingsDebounced();
        $('#ac-save-name').val('').attr('placeholder', '이름 (예: 반짝이 별)');
        showStatus(`✅ "${name}" 저장됨`, 'ok');

        // 저장과 동시에 적용
        settings.cssUrl = url;
        saveSettingsDebounced();
        if (settings.enabled) fetchAndApplyCursor(url);

        renderCursorList();
    });

    $('#ac-save-name').on('keydown', (e) => {
        if (e.key === 'Enter') $('#ac-save').trigger('click');
    });

    renderCursorList();

    if (settings.enabled && settings.cssUrl) {
        fetchAndApplyCursor(settings.cssUrl);
    }
}

// ─── 초기화 ──────────────────────────────────────────────────

jQuery(async () => {
    renderSettings();
});