// 管理画面ダッシュボード
(async function () {

  // 認証チェック
  const authRes = await fetch('/api/admin/check');
  const authData = await authRes.json();
  if (!authData.authenticated) {
    window.location.href = '/admin/index.html';
    return;
  }

  // ===== サイドバーナビゲーション =====
  const menuLinks = document.querySelectorAll('.admin-sidebar a[data-section]');
  const sections  = document.querySelectorAll('.admin-section');

  menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.dataset.section;
      menuLinks.forEach(l => l.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      link.classList.add('active');
      document.getElementById(`section-${target}`)?.classList.add('active');

      if (target === 'contacts') loadContacts();
      if (target === 'members')  loadMemberSection();
      if (target === 'gallery')  loadAdminGallery();
    });
  });

  // ===== ログアウト =====
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/index.html';
  });

  // ========================================
  // スケジュール管理
  // ========================================
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  function formatDateJP(str) {
    const d = new Date(str + 'T00:00:00');
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
  }

  async function loadScheduleAdmin() {
    const listEl = document.getElementById('schedule-list-admin');
    if (!listEl) return;
    try {
      const res  = await fetch('/api/schedule');
      const data = await res.json();
      const events = data.events || [];

      if (events.length === 0) {
        listEl.innerHTML = '<p style="font-size:0.85rem; color:var(--text-light);">スケジュールはまだ登録されていません</p>';
        return;
      }

      listEl.innerHTML = `
        <table style="width:100%; border-collapse:collapse; font-size:0.87rem;">
          <thead>
            <tr>
              <th style="background:var(--black); color:white; padding:9px 14px; text-align:left; font-weight:700; letter-spacing:0.04em; font-size:0.78rem;">日付</th>
              <th style="background:var(--black); color:white; padding:9px 14px; text-align:left; font-weight:700; letter-spacing:0.04em; font-size:0.78rem;">お祭り名</th>
              <th style="background:var(--black); color:white; padding:9px 14px; text-align:center; font-size:0.78rem; width:80px;">削除</th>
            </tr>
          </thead>
          <tbody>
            ${events.map(ev => `
              <tr>
                <td style="padding:11px 14px; border-bottom:1px solid var(--border); font-family:'Noto Serif JP',serif;">${formatDateJP(ev.date)}</td>
                <td style="padding:11px 14px; border-bottom:1px solid var(--border); font-family:'Noto Serif JP',serif;">${esc(ev.name)}</td>
                <td style="padding:11px 14px; border-bottom:1px solid var(--border); text-align:center;">
                  <button onclick="deleteScheduleEvent('${ev.date}')"
                    style="background:var(--red); color:white; border:none; padding:4px 10px; font-size:0.78rem; cursor:pointer; font-family:'Noto Sans JP',sans-serif;">
                    削除
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    } catch {
      listEl.innerHTML = '<p style="color:var(--red); font-size:0.85rem;">読み込みに失敗しました</p>';
    }
  }

  window.deleteScheduleEvent = async function (date) {
    if (!confirm(`${formatDateJP(date)} を削除しますか？`)) return;
    try {
      await fetch(`/api/admin/schedule/${encodeURIComponent(date)}`, { method: 'DELETE' });
      loadScheduleAdmin();
    } catch {}
  };

  document.getElementById('add-schedule-btn')?.addEventListener('click', async () => {
    const dateInput = document.getElementById('schedule-date-input');
    const nameInput = document.getElementById('schedule-name-input');
    const msgEl     = document.getElementById('schedule-msg');
    const btn       = document.getElementById('add-schedule-btn');

    const date = dateInput.value;
    const name = nameInput.value.trim();

    msgEl.classList.remove('show');

    if (!date || !name) {
      msgEl.textContent = '日付とお祭り名を入力してください';
      msgEl.className = 'alert alert-error show';
      return;
    }

    btn.disabled = true;
    btn.textContent = '追加中...';

    try {
      const res = await fetch('/api/admin/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, name })
      });
      const data = await res.json();

      if (data.success) {
        dateInput.value = '';
        nameInput.value = '';
        msgEl.textContent = '追加しました';
        msgEl.className = 'alert alert-success show';
        loadScheduleAdmin();
      } else {
        msgEl.textContent = data.error || '追加に失敗しました';
        msgEl.className = 'alert alert-error show';
      }
    } catch {
      msgEl.textContent = 'エラーが発生しました';
      msgEl.className = 'alert alert-error show';
    }

    btn.textContent = '追加する';
    btn.disabled = false;
    setTimeout(() => msgEl.classList.remove('show'), 3500);
  });

  loadScheduleAdmin();

  // ========================================
  // 応募一覧
  // ========================================
  let contactsLoaded = false;

  async function loadContacts() {
    if (contactsLoaded) return;
    const loading = document.getElementById('contacts-loading');
    const emptyEl = document.getElementById('contacts-empty');
    const table   = document.getElementById('contacts-table');
    const tbody   = document.getElementById('contacts-tbody');

    try {
      const res = await fetch('/api/admin/contacts');
      const contacts = await res.json();

      loading.style.display = 'none';

      if (contacts.length === 0) {
        emptyEl.style.display = 'block';
        return;
      }

      table.style.display = 'table';
      const unreadCount = contacts.filter(c => !c.isRead).length;
      updateUnreadBadge(unreadCount);

      tbody.innerHTML = contacts.map(c => `
        <tr class="${c.isRead ? '' : 'unread'}" data-id="${c.id}">
          <td>${c.isRead ? '<span class="badge-read">確認済</span>' : '<span class="badge-new">未読</span>'}</td>
          <td style="white-space:nowrap;">${formatDateTime(c.submittedAt)}</td>
          <td>${esc(c.contactName)}</td>
          <td>${esc(c.email)}</td>
          <td>
            <button onclick="openContactDetail('${c.id}')"
              style="background:var(--black);color:white;border:none;padding:4px 10px;font-size:0.8rem;cursor:pointer;font-family:'Noto Sans JP',sans-serif;">
              詳細
            </button>
          </td>
        </tr>
      `).join('');

      contactsLoaded = true;
      window._contacts = contacts;

    } catch {
      loading.textContent = '読み込みに失敗しました。';
    }
  }

  window.openContactDetail = async function (id) {
    const contact = (window._contacts || []).find(c => c.id === id);
    if (!contact) return;

    const modal   = document.getElementById('contact-modal');
    const content = document.getElementById('contact-detail-content');

    const fields = [
      ['お名前',     contact.contactName],
      ['メール',     contact.email ? `<a href="mailto:${contact.email}" style="color:var(--navy-light)">${contact.email}</a>` : ''],
      ['電話番号',   contact.phone],
      ['年齢',       contact.age ? contact.age + '歳' : ''],
      ['地域',       contact.area],
      ['参加可能日', contact.availability],
      ['経験',       contact.experience],
      ['参加動機',   contact.message?.replace(/\n/g, '<br>')],
      ['受信日時',   formatDateTime(contact.submittedAt)]
    ];

    content.innerHTML = fields.map(([label, value]) => value ? `
      <div class="detail-row">
        <span class="detail-label">${label}</span>
        <span class="detail-value">${value}</span>
      </div>
    ` : '').join('');

    modal.classList.add('active');

    if (!contact.isRead) {
      await fetch(`/api/admin/contacts/${id}/read`, { method: 'PATCH' });
      contact.isRead = true;
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) {
        row.classList.remove('unread');
        row.querySelector('td:first-child').innerHTML = '<span class="badge-read">確認済</span>';
      }
      const unreadCount = (window._contacts || []).filter(c => !c.isRead).length;
      updateUnreadBadge(unreadCount);
    }
  };

  document.getElementById('modal-close-btn')?.addEventListener('click', () => {
    document.getElementById('contact-modal')?.classList.remove('active');
  });
  document.getElementById('contact-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('contact-modal'))
      document.getElementById('contact-modal').classList.remove('active');
  });

  function updateUnreadBadge(count) {
    const badge = document.getElementById('unread-badge');
    if (!badge) return;
    if (count > 0) { badge.textContent = count; badge.style.display = 'inline'; }
    else badge.style.display = 'none';
  }

  // ========================================
  // メンバー管理
  // ========================================
  async function loadMemberSection() {
    try {
      const res  = await fetch('/api/member');
      const data = await res.json();

      const commentInput = document.getElementById('member-comment-input');
      if (commentInput) commentInput.value = data.comment || '';

      renderMemberPhotos(data.photos || []);
    } catch {}
  }

  function renderMemberPhotos(photos) {
    const grid = document.getElementById('member-photos-grid');
    if (!grid) return;
    if (photos.length === 0) {
      grid.innerHTML = '<p style="font-size:0.85rem;color:var(--text-light);">写真はまだありません</p>';
      return;
    }
    grid.innerHTML = photos.map(p => `
      <div class="admin-gallery-item">
        <img src="/images/members/${p.filename}" alt="メンバー写真">
        <button class="delete-btn" onclick="deleteMemberPhoto('${p.id}')">✕</button>
      </div>
    `).join('');
  }

  window.deleteMemberPhoto = async function (id) {
    if (!confirm('この写真を削除しますか？')) return;
    await fetch(`/api/admin/member/photo/${id}`, { method: 'DELETE' });
    loadMemberSection();
  };

  document.getElementById('member-upload-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('member-photo-input');
    const msgEl = document.getElementById('member-upload-msg');
    const btn   = document.getElementById('member-upload-btn');
    if (!input.files.length) {
      msgEl.textContent = '写真を選択してください';
      msgEl.className = 'alert alert-error show';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'アップロード中...';
    let ok = 0;
    for (const file of input.files) {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch('/api/admin/member/photo', { method: 'POST', body: fd });
      if ((await res.json()).success) ok++;
    }
    btn.textContent = 'アップロード';
    btn.disabled = false;
    input.value = '';
    if (ok > 0) {
      msgEl.textContent = `${ok}枚アップロードしました`;
      msgEl.className = 'alert alert-success show';
      loadMemberSection();
    } else {
      msgEl.textContent = 'アップロードに失敗しました';
      msgEl.className = 'alert alert-error show';
    }
    setTimeout(() => msgEl.classList.remove('show'), 3500);
  });

  document.getElementById('save-comment-btn')?.addEventListener('click', async () => {
    const comment = document.getElementById('member-comment-input')?.value || '';
    const msg     = document.getElementById('comment-saved-msg');
    await fetch('/api/admin/member/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment })
    });
    msg.style.display = 'inline';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  });

  // ========================================
  // ギャラリー管理
  // ========================================
  async function loadAdminGallery() {
    const grid = document.getElementById('admin-gallery-grid');
    if (!grid) return;
    try {
      const res = await fetch('/api/gallery');
      const items = await res.json();
      if (items.length === 0) {
        grid.innerHTML = '<p style="font-size:0.85rem;color:var(--text-light);">写真はまだありません</p>';
        return;
      }
      grid.innerHTML = items.map(item => `
        <div class="admin-gallery-item">
          ${item.type === 'video'
            ? `<video src="/images/gallery/${item.filename}" muted></video>`
            : `<img src="/images/gallery/${item.filename}" alt="${item.caption || ''}">`}
          <button class="delete-btn" onclick="deleteGalleryItem('${item.id}')">✕</button>
        </div>
      `).join('');
    } catch {
      grid.innerHTML = '<p style="color:var(--red);font-size:0.85rem;">読み込みに失敗しました</p>';
    }
  }

  window.deleteGalleryItem = async function (id) {
    if (!confirm('この写真を削除しますか？')) return;
    try {
      await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
      loadAdminGallery();
    } catch {}
  };

  document.getElementById('upload-btn')?.addEventListener('click', async () => {
    const input   = document.getElementById('photo-input');
    const caption = document.getElementById('photo-caption').value.trim();
    const msgEl   = document.getElementById('upload-msg');
    const btn     = document.getElementById('upload-btn');

    if (!input.files.length) {
      msgEl.textContent = '写真を選択してください';
      msgEl.className = 'alert alert-error show';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'アップロード中...';
    msgEl.classList.remove('show');

    let successCount = 0;
    for (const file of input.files) {
      const fd = new FormData();
      fd.append('photo', file);
      fd.append('caption', caption);
      try {
        const res = await fetch('/api/admin/gallery', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) successCount++;
      } catch {}
    }

    btn.textContent = 'アップロード';
    btn.disabled = false;
    input.value = '';
    document.getElementById('photo-caption').value = '';

    if (successCount > 0) {
      msgEl.textContent = `${successCount}枚アップロードしました`;
      msgEl.className = 'alert alert-success show';
      loadAdminGallery();
    } else {
      msgEl.textContent = 'アップロードに失敗しました';
      msgEl.className = 'alert alert-error show';
    }
    setTimeout(() => msgEl.classList.remove('show'), 3500);
  });

  // ========================================
  // パスワード変更
  // ========================================
  document.getElementById('change-pw-btn')?.addEventListener('click', async () => {
    const currentPw = document.getElementById('current-pw').value;
    const newPw     = document.getElementById('new-pw').value;
    const confirmPw = document.getElementById('confirm-pw').value;
    const successEl = document.getElementById('pw-success');
    const errorEl   = document.getElementById('pw-error');

    successEl.classList.remove('show');
    errorEl.classList.remove('show');

    if (!currentPw || !newPw || !confirmPw) {
      errorEl.textContent = '全ての項目を入力してください';
      errorEl.classList.add('show');
      return;
    }
    if (newPw !== confirmPw) {
      errorEl.textContent = '新しいパスワードが一致しません';
      errorEl.classList.add('show');
      return;
    }
    if (newPw.length < 6) {
      errorEl.textContent = 'パスワードは6文字以上にしてください';
      errorEl.classList.add('show');
      return;
    }

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
      });
      const data = await res.json();
      if (data.success) {
        successEl.textContent = 'パスワードを変更しました';
        successEl.classList.add('show');
        document.getElementById('current-pw').value = '';
        document.getElementById('new-pw').value = '';
        document.getElementById('confirm-pw').value = '';
      } else {
        errorEl.textContent = data.error || 'パスワードの変更に失敗しました';
        errorEl.classList.add('show');
      }
    } catch {
      errorEl.textContent = 'エラーが発生しました';
      errorEl.classList.add('show');
    }
  });

  // ========================================
  // ユーティリティ
  // ========================================
  function formatDateTime(str) {
    if (!str) return '-';
    const d = new Date(str);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function esc(str) {
    if (!str) return '-';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // 未読バッジ初期表示
  (async () => {
    try {
      const res = await fetch('/api/admin/contacts');
      const contacts = await res.json();
      window._contacts = contacts;
      updateUnreadBadge(contacts.filter(c => !c.isRead).length);
    } catch {}
  })();

})();
