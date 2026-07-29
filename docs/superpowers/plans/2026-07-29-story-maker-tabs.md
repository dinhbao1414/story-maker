# Story Maker Workspace Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tách giao diện Story Maker thành Dashboard mặc định và tab Cài đặt bên trái, chỉ thay đổi bố cục/trạng thái trình bày, giữ nguyên toàn bộ logic hiện có.

**Architecture:** Thêm một runtime UI-only nhỏ để điều khiển hai tab bằng `hidden`, class và ARIA; không tạo state nghiệp vụ mới. Giữ các phần tử hiện có cùng ID và handler; chỉ di chuyển `btn-generate` vào Dashboard, giữ progress/API ở vùng dùng chung, đặt `settings` và `output-panel` làm hai panel thay thế nhau sau rail.

**Tech Stack:** HTML hiện có, CSS hiện có, ES modules, Node test runner, Vite.

---

## Phạm vi file

- **Create:** `src/workspaceTabs.js` — chuyển tab, keyboard navigation, đồng bộ panel trình bày.
- **Create:** `tests/workspaceTabs.test.js` — test pure resolver và runtime với DOM double nhỏ.
- **Modify:** `index.html` — thêm rail/tab ARIA, gắn panel, chuyển vị trí `btn-generate`; không đổi ID nghiệp vụ.
- **Modify:** `src/style.css` — grid rail, trạng thái panel, settings width, responsive/mobile.
- **Modify:** `src/main.js` — import runtime UI sau các runtime hiện có.
- **Modify:** `tests/vietnameseUi.test.js` — kiểm tra markup tab, Dashboard mặc định, ID không trùng.

Không sửa `src/legacyMain.js`, `src/styleAnalyzer.js`, prompt, API, storage, model hoặc schema dữ liệu.

## Task 1: Viết test hợp đồng tab

**Files:**
- Create: `tests/workspaceTabs.test.js`
- Modify: `tests/vietnameseUi.test.js`

- [ ] **Step 1: Viết test đỏ cho resolver và trạng thái panel**

`tests/workspaceTabs.test.js` phải kiểm tra:

```js
assert.equal(resolveWorkspaceTab('dashboard'), 'dashboard');
assert.equal(resolveWorkspaceTab('settings'), 'settings');
assert.equal(resolveWorkspaceTab('unknown'), 'dashboard');
assert.equal(resolveWorkspaceTab(''), 'dashboard');

const runtime = installWorkspaceTabs({ doc, win });
assert.equal(runtime.getActiveTab(), 'dashboard');
assert.equal(dashboardPanel.hidden, false);
assert.equal(settingsPanel.hidden, true);
assert.equal(dashboardTab.getAttribute('aria-selected'), 'true');
assert.equal(settingsTab.getAttribute('aria-selected'), 'false');

settingsTab.listeners.click();
assert.equal(runtime.getActiveTab(), 'settings');
assert.equal(dashboardPanel.hidden, true);
assert.equal(settingsPanel.hidden, false);

win.listeners['story-maker:settings-imported']();
assert.equal(runtime.getActiveTab(), 'settings');
```

DOM double chỉ cần hỗ trợ `dataset`, `hidden`, `setAttribute`, `getAttribute`, `addEventListener`, `querySelectorAll`, `documentElement.dataset` và `window.addEventListener`; không thêm JSDOM.

- [ ] **Step 2: Viết test markup cho tab**

Mở rộng `tests/vietnameseUi.test.js` với các assertion:

```js
assert.match(html, /id="workspace-tabs"/);
assert.match(html, /id="workspace-tab-dashboard"[^>]*aria-selected="true"/);
assert.match(html, /id="workspace-tab-settings"[^>]*aria-selected="false"/);
assert.match(html, /data-workspace-panel="dashboard"/);
assert.match(html, /data-workspace-panel="settings"/);
assert.equal((html.match(/id="btn-generate"/g) || []).length, 1);
assert.equal((html.match(/id="settings"/g) || []).length, 1);
assert.equal((html.match(/id="output-panel"/g) || []).length, 1);
```

- [ ] **Step 3: Chạy test đỏ**

Run: `node tests/workspaceTabs.test.js; node tests/vietnameseUi.test.js`

Expected: `workspaceTabs.test.js` fail vì module/markup chưa tồn tại; test Vietnamese fail vì thiếu rail/tab.

## Task 2: Tạo runtime chuyển tab UI-only

**Files:**
- Create: `src/workspaceTabs.js`
- Test: `tests/workspaceTabs.test.js`

- [ ] **Step 1: Thêm resolver và installer tối thiểu**

API cố định:

```js
export const WORKSPACE_TABS = Object.freeze(['dashboard', 'settings']);
export function resolveWorkspaceTab(value) {
  return WORKSPACE_TABS.includes(value) ? value : 'dashboard';
}

export function installWorkspaceTabs({
  doc = globalThis.document,
  win = globalThis.window,
} = {}) {
  if (!doc) return null;
  const tabs = [...doc.querySelectorAll('[data-workspace-tab]')];
  const panels = [...doc.querySelectorAll('[data-workspace-panel]')];
  if (!tabs.length || !panels.length) return null;

  let activeTab = 'dashboard';
  const setActiveTab = value => {
    activeTab = resolveWorkspaceTab(value);
    doc.documentElement.dataset.workspaceTab = activeTab;
    tabs.forEach(tab => {
      const selected = tab.dataset.workspaceTab === activeTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(panel => {
      const selected = panel.dataset.workspacePanel === activeTab;
      panel.hidden = !selected;
      panel.setAttribute('aria-hidden', String(!selected));
    });
    return activeTab;
  };
  const getActiveTab = () => activeTab;

  tabs.forEach(tab => tab.addEventListener('click', () => setActiveTab(tab.dataset.workspaceTab)));
  setActiveTab(doc.documentElement.dataset.workspaceTab);
  return { setActiveTab, getActiveTab };
}
```

`installWorkspaceTabs()` phải:

- Tìm `[data-workspace-tab]` và `[data-workspace-panel]`.
- Chọn `dashboard` mặc định, không đọc/ghi localStorage.
- Với mỗi lần chuyển tab:
  - đặt `document.documentElement.dataset.workspaceTab`;
  - đặt `aria-selected` cho tab;
  - đặt `tabIndex=0` cho tab đang chọn và `-1` cho tab còn lại;
  - đặt `hidden` cho panel không hoạt động;
  - đặt `aria-hidden` ngược với trạng thái `hidden`.
- Click tab không reset form, không tạo lại DOM, không phát request.
- Trả `{ setActiveTab, getActiveTab }` để test và runtime UI dùng chung.
- Nếu thiếu DOM cần thiết, trả `null` và không throw.

- [ ] **Step 2: Thêm keyboard navigation**

Trong `keydown` của tab:

- `ArrowRight` / `ArrowDown`: chuyển sang tab kế tiếp.
- `ArrowLeft` / `ArrowUp`: chuyển sang tab trước.
- `Home`: về Dashboard.
- `End`: về Cài đặt.
- Sau khi chuyển bằng bàn phím, gọi `.focus()` trên tab mới.
- Không chặn phím khi target không phải tab.

- [ ] **Step 3: Đồng bộ sau khi import settings**

Đăng ký listener UI-only:

```js
win.addEventListener('story-maker:settings-imported', () => setActiveTab('settings'));
```

Listener chỉ đổi tab để người dùng kiểm tra kết quả; không áp dụng lại payload và không thay đổi event gốc.

- [ ] **Step 4: Chạy test xanh**

Run: `node tests/workspaceTabs.test.js`

Expected: tất cả assertion pass; không có dependency mới.

## Task 3: Tái cấu trúc markup, giữ nguyên ID

**Files:**
- Modify: `index.html`
- Test: `tests/vietnameseUi.test.js`

- [ ] **Step 1: Thêm rail tab ở đầu `main-wrap`**

Thêm trước `#settings`:

```html
<nav class="workspace-tabs" id="workspace-tabs" aria-label="Khu vực làm việc" role="tablist">
  <button type="button" class="workspace-tab is-active" id="workspace-tab-dashboard"
          role="tab" data-workspace-tab="dashboard" aria-controls="output-panel"
          aria-selected="true" tabindex="0">
    <span class="workspace-tab-icon" aria-hidden="true">▣</span>
    <span>Dashboard</span>
  </button>
  <button type="button" class="workspace-tab" id="workspace-tab-settings"
          role="tab" data-workspace-tab="settings" aria-controls="settings"
          aria-selected="false" tabindex="-1">
    <span class="workspace-tab-icon" aria-hidden="true">⚙</span>
    <span>Cài đặt</span>
  </button>
</nav>
```

- [ ] **Step 2: Gắn role/panel metadata**

Giữ nguyên `id="settings"` và `id="output-panel"`, chỉ thêm:

```html
<aside id="settings" data-workspace-panel="settings" role="tabpanel"
       aria-labelledby="workspace-tab-settings" hidden>

<article id="output-panel" data-workspace-panel="dashboard" role="tabpanel"
         aria-labelledby="workspace-tab-dashboard">
```

Không đổi các con ID như `btn-generate`, `panel-scroll`, `output`, `sa-section`, `style-preset-panel`, `longify-beta`, `kakuyomu-assist`, `alphapolis-assist`.

- [ ] **Step 3: Chuyển CTA tạo truyện**

Di chuyển nguyên khối hiện có chứa `#btn-generate` từ `#settings .panel-fixed-top` vào một `<div class="dashboard-primary-action">` là con đầu tiên của `#output-panel`, ngay trước `.output-sticky-header`.

Giữ nguyên:

```html
<button class="btn-generate" id="btn-generate">Tạo truyện</button>
```

Không tạo button thứ hai, không đổi listener và không đổi disabled/spinner state.

- [ ] **Step 4: Giữ progress/API là vùng dùng chung**

Không di chuyển hoặc đổi ID vùng header API/progress hiện có. Vùng này nằm ngoài hai panel để các runtime hiện tại tiếp tục tìm thấy `progress-title-text`, `progress-log`, `progress-content`, `apikey` và các control API.

- [ ] **Step 5: Chạy markup tests**

Run: `node tests/vietnameseUi.test.js`

Expected: pass; mỗi ID nghiệp vụ xuất hiện đúng một lần.

## Task 4: Định dạng rail, panel và responsive

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Đổi layout chính sang rail + panel thay thế**

Thay grid hai cột hiện tại bằng layout tương đương:

```css
.main-wrap {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.workspace-tabs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 8px;
  background: var(--surface2);
  border-right: 1px solid var(--border);
}

.workspace-tab {
  min-height: 52px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 800;
}

.workspace-tab.is-active,
.workspace-tab[aria-selected="true"] {
  color: var(--text);
  background: var(--accent-glow);
  border-color: var(--border-accent);
}

[data-workspace-panel][hidden] {
  display: none !important;
}
```

- [ ] **Step 2: Giữ settings dễ đọc**

`#settings` khi mở tab Cài đặt dùng chiều rộng tối đa khoảng 720 px, căn giữa trong vùng nội dung; `#panel-scroll` giữ scroll riêng. Không thay đổi selector section/chip/input hiện có.

- [ ] **Step 3: Định dạng Dashboard**

`#output-panel` chiếm toàn bộ vùng sau rail; Output giữ scroll riêng. CTA `#btn-generate` dùng style nổi bật hiện có, không tạo style logic mới. `.dashboard-tools` dùng `display:flex`, `flex-direction:column`, `gap:16px`; không thêm accordion hoặc cơ chế đóng/mở mới cho các tool.

- [ ] **Step 4: Responsive**

Ở `max-width: 900px`:

```css
.main-wrap { display: block; height: auto; overflow: visible; }
.workspace-tabs { flex-direction: row; border-right: 0; border-bottom: 1px solid var(--border); }
.workspace-tab { flex: 1; min-height: 48px; }
```

Giữ `settings-panel` và `output-panel` scroll/height behavior hiện có theo breakpoint; không tạo overflow ngang.

- [ ] **Step 5: Accessibility polish**

Thêm `:focus-visible` rõ ràng, giữ contrast hiện tại, tôn trọng `prefers-reduced-motion` cho transition của tab ở mức 150–200 ms.

- [ ] **Step 6: Kiểm tra CSS contract**

Bổ sung assertion vào `tests/workspaceTabs.test.js` để bảo đảm stylesheet chứa `.workspace-tabs`, `.workspace-tab` và `[data-workspace-panel][hidden]`.

## Task 5: Tích hợp, hồi quy và kiểm tra trình duyệt

**Files:**
- Modify: `src/main.js`
- Test: `tests/workspaceTabs.test.js`, `tests/vietnameseUi.test.js`

- [ ] **Step 1: Import runtime UI**

Thêm import side-effect sau các runtime hiện có:

```js
import './workspaceTabs.js';
```

Module tự chờ `DOMContentLoaded` nếu cần; không chạy trước khi markup tồn tại.

- [ ] **Step 2: Chạy focused tests và syntax**

Run:

```powershell
node tests/workspaceTabs.test.js
node tests/vietnameseUi.test.js
node --check src/workspaceTabs.js
node --check src/main.js
```

Expected: tất cả pass, syntax exit code `0`.

- [ ] **Step 3: Chạy toàn bộ test suite**

Run: `node --test "tests/**/*.test.js"`

Expected: toàn bộ test hiện có pass; không thêm test skip hoặc dependency.

- [ ] **Step 4: Chạy guard/build phù hợp**

Run:

```powershell
npm.cmd run check:generic-rules
npm.cmd run check:nano-4koma-contract
npm.cmd run build
```

Expected: guard pass; contract có thể skip nếu source Nano Banana Pro không tồn tại; build exit code `0`. Không chạy `npm run deploy`, không tăng version, không commit.

- [ ] **Step 5: Kiểm tra local UI**

Chạy `npm.cmd run dev`, xác nhận URL `http://localhost:5179/` hoặc port Vite thực tế.

Dùng browser kiểm tra:

1. Tải mới: Dashboard đang chọn, Output hiển thị, Cài đặt ẩn.
2. Bấm Cài đặt: panel settings hiển thị, mọi input/chip/character vẫn dùng được.
3. Đổi qua lại: giá trị mode, 7 trục, nhân vật, supplement không mất.
4. Bấm `Tạo truyện`: đúng button cũ, đúng spinner/disabled behavior.
5. Thêm TXT: nút phân tích và hồ sơ phong cách vẫn hoạt động.
6. Apply settings import/preset: event hiện có chuyển sang tab Cài đặt để kiểm tra, không đổi payload.
7. Đang tạo truyện: chuyển tab không hủy request; progress/API vẫn cập nhật.
8. Viewport 1440px, 900px và 390px: không có scroll ngang, tab vẫn reachable bằng bàn phím.

## Bổ sung bắt buộc trong các task trên

- **Progress disclosure:** đổi wrapper hiện có của `#progress-window` thành `details` nhưng giữ nguyên các ID `progress-title-text`, `progress-content` và `progress-log`. `src/workspaceTabs.js` dùng `MutationObserver` trên `#progress-title-text`: trạng thái `Đang chờ` đóng panel; mọi trạng thái xử lý mở panel. Không thay đổi log hoặc text.
- **Nút quay lại:** thêm một button trình bày trong `#settings .panel-fixed-top` với `data-workspace-action="dashboard"`; runtime dùng cùng `setActiveTab('dashboard')`, không thêm handler nghiệp vụ.
- **Nhóm công cụ Dashboard:** bọc các block `#kakuyomu-assist`, `#alphapolis-assist`, `#longify-beta` và `#sa-section` trong một container `.dashboard-tools`; không đổi thứ tự, ID hoặc listener. `#style-preset-panel` tiếp tục được runtime chèn vào `#sa-section`.
- **Test bổ sung:** kiểm tra action quay lại gọi đúng tab, progress đóng lúc idle/mở lúc hoạt động, và tất cả tool ID vẫn xuất hiện đúng một lần trong `index.html`.

## Ràng buộc bàn giao

- Không sửa `legacyMain.js` hoặc logic API/generation.
- Không thêm package.
- Không deploy, release, tag, commit hoặc tăng version trong task UI này.
- Nếu test/build phát hiện lỗi không liên quan, ghi nhận và dừng ở lỗi đó; không sửa lan sang logic khác.
