import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const EXT_NAME = 'animated_cursor';
const STYLE_ID = 'animated-cursor-style';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// 기본 설정
if (!extension_settings[EXT_NAME]) {
    extension_settings[EXT_NAME] = {
        enabled: true,
        cssUrl: '',
    };
}

const settings = extension_settings[EXT_NAME];

// CSS 파싱 및 적용
async function fetchAndApplyCursor(url) {
    removeStyle();
    if (!url) return;

    let css = '';
    try {
        // 직접 fetch 시도
        const direct = await fetch(url).catch(() => null);
        if (direct && direct.ok) {
            css = await direct.text();
        } else {
            // CORS 프록시 fallback
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

    // duration 파싱
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

// 설정 UI 렌더링
function renderSettings() {
    const html = `
<div id="ac-settings" style="padding: 6px 0;">
    <label style="display:flex; align-items:center; gap:8px; margin-bottom:10px; cursor:pointer;">
        <input type="checkbox" id="ac-enabled" ${settings.enabled ? 'checked' : ''} />
        <span>커서 활성화</span>
    </label>

    <div style="margin-bottom:6px; font-size:12px; opacity:0.7;">
        cursors-4u.com CSS URL을 입력하세요
    </div>
    <div style="display:flex; gap:6px; align-items:center;">
        <input
            type="text"
            id="ac-url"
            placeholder="https://cdn.cursors-4u.net/cursors/animated/....css"
            value="${settings.cssUrl}"
            style="flex:1; font-size:12px; padding:4px 6px;"
        />
        <input type="button" id="ac-apply" value="적용" class="menu_button" style="white-space:nowrap;" />
    </div>
    <div id="ac-status" style="font-size:12px; margin-top:6px; min-height:18px;"></div>

    <div style="margin-top:10px; font-size:11px; opacity:0.5;">
        예시: <code>https://cdn.cursors-4u.net/cursors/animated/flashy-colorful-purple-pink-star-4-68370932-32.css</code>
    </div>
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

    // 이벤트
    $('#ac-enabled').on('change', function () {
        settings.enabled = this.checked;
        saveSettingsDebounced();
        if (settings.enabled && settings.cssUrl) {
            fetchAndApplyCursor(settings.cssUrl);
        } else {
            removeStyle();
        }
    });

    $('#ac-apply').on('click', () => {
        const url = $('#ac-url').val().trim();
        settings.cssUrl = url;
        saveSettingsDebounced();
        if (settings.enabled) {
            fetchAndApplyCursor(url);
        }
    });

    $('#ac-url').on('keydown', (e) => {
        if (e.key === 'Enter') $('#ac-apply').trigger('click');
    });

    // 초기 적용
    if (settings.enabled && settings.cssUrl) {
        fetchAndApplyCursor(settings.cssUrl);
    }
}

// 초기화
jQuery(async () => {
    renderSettings();
});
