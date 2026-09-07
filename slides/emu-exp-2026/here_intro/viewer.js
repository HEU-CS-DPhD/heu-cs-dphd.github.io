/**
 * 幻灯片排版与播放引擎 (Slide Viewer Engine)
 * 纯原生驱动：异步拉取 slides/*.html，负责 16:9 响应式缩放、GPU 推拉过渡动画、键盘/触控交互与全景概览
 */
(async function() {
  const slideFiles = [
    'slides/01-cover.html',
    'slides/02-system-arch.html',
    'slides/03-macro-codegen.html',
    'slides/04-rvv-vector.html',
    'slides/05-tokio-async-io.html',
    'slides/06-tokio-fence-barrier.html',
    'slides/07-dual-debuggers.html',
    'slides/08-cross-platform-wasm.html',
    'slides/09-linux-boot-topology.html',
    'slides/10-linux-boot-terminal.html',
    'slides/11-x86-jit-compiler.html',
    'slides/12-board-topology.html',
    'slides/13-device-arena.html',
    'slides/14-virtual-clock.html',
    'slides/15-frontend-decoder.html',
    'slides/16-icache.html',
    'slides/17-flamegraph.html',
    'slides/18-backend-exec.html',
    'slides/19-rv-i-integer.html',
    'slides/20-rv-m-multiply-divide.html',
    'slides/21-rv-a-atomic.html',
    'slides/22-rv-f-d-float.html',
    'slides/23-rv-c-compressed.html',
    'slides/24-rv-v-vector-unit.html',
    'slides/25-privilege-csr.html',
    'slides/26-sv39-mmu.html',
    'slides/27-trap-controller.html',
    'slides/28-interrupt-topology.html',
    'slides/29-rvdb-debugger.html',
    'slides/30-gdb-stub.html',
    'slides/31-uart16550a.html',
    'slides/32-virtio-block.html',
    'slides/33-task-spawner.html',
    'slides/34-summary.html'
  ];

  const total = slideFiles.length;
  let current = 1;

  // 初始从 URL Hash (如 #12) 解析当前页
  const hash = parseInt(window.location.hash.replace('#', ''), 10);
  if (!isNaN(hash) && hash >= 1 && hash <= total) {
    current = hash;
  }

  const frame = document.getElementById('slide-frame');
  const progressBar = document.getElementById('progress-bar');
  const pageIndicator = document.getElementById('page-indicator');
  const overviewModal = document.getElementById('overview-modal');
  const gridContainer = document.getElementById('grid-container');

  // 1. 并发请求加载所有 34 个独立的 HTML 页面
  try {
    const rawPages = await Promise.all(
      slideFiles.map(async (url, idx) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
        return { page: idx + 1, raw: await res.text() };
      })
    );

    // 2. 挂载到 slide-frame 画布容器
    frame.innerHTML = rawPages.map(({ page, raw }) => {
      const clean = raw.replace(/<!--[\s\S]*?-->/g, '').trim();
      const titleMatch = clean.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : (page === 1 ? 'HERE RISC-V 模拟器架构与实现' : `第 ${page} 页`);

      return `
        <div class="slide-wrapper" id="slide-${page}" data-index="${page}" data-title="${title}">
          ${clean}
          ${page > 1 ? `<div class="standalone-footer">${page} / ${total}</div>` : ''}
        </div>
      `;
    }).join('');

    // 3. 动态挂载全景概览缩略图
    gridContainer.innerHTML = rawPages.map(({ page, raw }) => {
      const clean = raw.replace(/<!--[\s\S]*?-->/g, '').trim();
      const titleMatch = clean.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : (page === 1 ? 'HERE RISC-V 模拟器架构与实现' : `第 ${page} 页`);
      return `
        <div class="thumb-card" data-index="${page}">
          <div style="font-weight: bold; color: #93c5fd; margin-bottom: 4px;">第 ${page} 页</div>
          <div style="color: #cbd5e1; font-size: 11px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${title}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Slide loading error:', err);
    frame.innerHTML = `
      <div style="padding: 40px; color: #ef4444; font-family: sans-serif;">
        <h2>无法加载幻灯片内容</h2>
        <p>${err.message}</p>
        <p style="color: #64748b; font-size: 13px;">提示：如果在本地 file:// 协议打开受限于浏览器 CORS 策略，请使用 npm run dev 或在 Hugo 等 Web 服务器中访问。</p>
      </div>
    `;
    return;
  }

  // 4. 16:9 响应式自动居中等比缩放 (基准尺寸: 980 x 551.25)
  function updateScale() {
    const baseWidth = 980;
    const baseHeight = 551.25;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    const scale = Math.min(winWidth / baseWidth, winHeight / baseHeight);
    frame.style.transform = 'scale(' + scale + ')';
  }

  window.addEventListener('resize', updateScale);
  updateScale();

  // 5. 平滑推拉切页动画逻辑 (Slide Transition)
  function showSlide(index, forward) {
    if (index < 1) index = 1;
    if (index > total) index = total;
    if (index === current && document.querySelector('.slide-wrapper.active')) return;

    const oldEl = document.getElementById('slide-' + current);
    const newEl = document.getElementById('slide-' + index);

    const isFwd = typeof forward === 'boolean' ? forward : (index > current);

    if (oldEl && newEl && oldEl !== newEl) {
      oldEl.className = 'slide-wrapper ' + (isFwd ? 'slide-left' : 'slide-right');
      newEl.style.transition = 'none';
      newEl.className = 'slide-wrapper ' + (isFwd ? 'slide-right' : 'slide-left');
      newEl.offsetHeight; // 强制回流生效
      newEl.style.transition = '';
      newEl.className = 'slide-wrapper active';
    } else if (newEl) {
      newEl.className = 'slide-wrapper active';
    }

    current = index;

    // 更新指示器与进度条
    if (pageIndicator) pageIndicator.textContent = current + ' / ' + total;
    if (progressBar) progressBar.style.width = ((current / total) * 100) + '%';
    window.location.hash = current;

    // 更新概览模态框高亮项
    document.querySelectorAll('.thumb-card').forEach(card => {
      const cardIdx = parseInt(card.getAttribute('data-index'), 10);
      if (cardIdx === current) {
        card.classList.add('current');
      } else {
        card.classList.remove('current');
      }
    });
  }

  function next() { showSlide(current + 1, true); }
  function prev() { showSlide(current - 1, false); }

  // 6. 监听浏览器前进后退 Hash 变动
  window.addEventListener('hashchange', () => {
    const h = parseInt(window.location.hash.replace('#', ''), 10);
    if (!isNaN(h) && h !== current) {
      showSlide(h);
    }
  });

  // 7. 快捷键监听
  window.addEventListener('keydown', (e) => {
    if (overviewModal && overviewModal.classList.contains('open')) {
      if (e.key === 'Escape' || e.key === 'o' || e.key === 'O') {
        toggleOverview();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
      case 'Enter':
      case 'j':
      case 'l':
        next();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
      case 'Backspace':
      case 'k':
      case 'h':
        prev();
        break;
      case 'Home':
        showSlide(1);
        break;
      case 'End':
        showSlide(total);
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        break;
      case 'o':
      case 'O':
        toggleOverview();
        break;
    }
  });

  // 8. 悬浮工具栏交互
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  if (btnPrev) btnPrev.addEventListener('click', prev);
  if (btnNext) btnNext.addEventListener('click', next);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
  const btnFullscreen = document.getElementById('btn-fullscreen');
  if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);

  function toggleOverview() {
    if (overviewModal) overviewModal.classList.toggle('open');
  }
  const btnOverview = document.getElementById('btn-overview');
  const btnCloseOverview = document.getElementById('btn-close-overview');
  if (btnOverview) btnOverview.addEventListener('click', toggleOverview);
  if (btnCloseOverview) btnCloseOverview.addEventListener('click', toggleOverview);

  // 缩略图点击跳转
  document.querySelectorAll('.thumb-card').forEach(card => {
    card.addEventListener('click', () => {
      const target = parseInt(card.getAttribute('data-index'), 10);
      showSlide(target);
      toggleOverview();
    });
  });

  // 9. 触控滑动支持
  let touchStartX = 0;
  window.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(diff) > 50) {
      if (diff < 0) next();
      else prev();
    }
  }, { passive: true });

  // 初始化展示首页
  showSlide(current);

  // 10. 本地开发自动热重载 (Live Reload)
  // 当本地运行 npm run dev (端口 3030) 时，编辑保存 slides/*.html 将在 80ms 内自动刷新页面
  if (window.location.protocol.startsWith('http') && window.location.port === '3030') {
    try {
      const es = new EventSource('/live-reload');
      es.onmessage = (e) => {
        if (e.data === 'reload') {
          console.log('[LiveReload] 检测到幻灯片内容修改，正在自动刷新...');
          window.location.reload();
        }
      };
    } catch (e) {}
  }
})();
