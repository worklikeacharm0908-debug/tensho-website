// 公開ギャラリーページ
(async function () {
  const grid  = document.getElementById('gallery-grid');
  const modal = document.getElementById('gallery-modal');
  const modalImg = document.getElementById('modal-image');
  const modalVideo = document.getElementById('modal-video');
  const closeBtn = document.getElementById('modal-close');

  if (!grid) return;

  try {
    const res  = await fetch('/api/gallery');
    const items = await res.json();

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="gallery-empty">
          <span>📷</span>
          <p>写真は準備中です。しばらくお待ちください。</p>
        </div>`;
      return;
    }

    grid.innerHTML = items.map(item => `
      <div class="gallery-item" data-src="/images/gallery/${item.filename}" data-type="${item.type || 'image'}">
        ${item.type === 'video'
          ? `<video src="/images/gallery/${item.filename}" muted playsinline preload="metadata"></video>`
          : `<img src="/images/gallery/${item.filename}" alt="${item.caption || '天翔'}">`}
        ${item.caption ? `<div class="gallery-caption">${item.caption}</div>` : ''}
      </div>
    `).join('');

    // クリックでモーダル表示
    grid.querySelectorAll('.gallery-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.dataset.type === 'video') {
          modalImg.hidden = true;
          modalVideo.hidden = false;
          modalVideo.src = item.dataset.src;
          modalVideo.play().catch(() => {});
        } else {
          modalVideo.hidden = true;
          modalVideo.pause();
          modalVideo.src = '';
          modalImg.hidden = false;
          modalImg.src = item.dataset.src;
        }
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    });

  } catch (e) {
    grid.innerHTML = `
      <div class="gallery-empty">
        <span>⚠️</span>
        <p>読み込みに失敗しました。ページを更新してください。</p>
      </div>`;
  }

  // モーダルを閉じる
  function closeModal() {
    modal.classList.remove('active');
    modalImg.src = '';
    modalVideo.pause();
    modalVideo.src = '';
    document.body.style.overflow = '';
  }
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
})();
