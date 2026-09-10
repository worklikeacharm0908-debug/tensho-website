// お問い合わせフォーム
(function () {
  const form       = document.getElementById('contact-form');
  const dateInput  = document.getElementById('festival-date');
  const banner     = document.getElementById('date-selected-banner');
  const bannerText = document.getElementById('date-selected-text');
  const successEl  = document.getElementById('form-success');
  const errorEl    = document.getElementById('form-error');
  const submitBtn  = document.getElementById('submit-btn');

  // カレンダーから遷移してきた場合、日付を自動入力
  const params = new URLSearchParams(window.location.search);
  const dateFromUrl = params.get('date') || sessionStorage.getItem('selected_festival_date');
  const labelFromSession = sessionStorage.getItem('selected_festival_date_label');

  if (dateFromUrl && dateInput) {
    dateInput.value = dateFromUrl;
    dateInput.classList.add('prefilled');

    if (banner) {
      const label = labelFromSession || formatDate(dateFromUrl);
      bannerText.textContent = `開催日として「${label}」が選択されています`;
      banner.style.display = 'flex';
    }
    // sessionStorageをクリア
    sessionStorage.removeItem('selected_festival_date');
    sessionStorage.removeItem('selected_festival_date_label');
  }

  // フォーム送信
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.classList.remove('show');

      // バリデーション
      const contactName = document.getElementById('contact-name').value.trim();
      const email       = document.getElementById('email').value.trim();
      const message     = document.getElementById('message').value.trim();

      if (!contactName || !email || !message) {
        errorEl.textContent = 'お名前、メールアドレス、参加動機は必須項目です。';
        errorEl.classList.add('show');
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      if (!isValidEmail(email)) {
        errorEl.textContent = 'メールアドレスの形式が正しくありません。';
        errorEl.classList.add('show');
        return;
      }

      // データ収集
      const formData = {
        formType:     'member_recruitment',
        contactName,
        email,
        phone:        document.getElementById('phone')?.value.trim() || '',
        age:          document.getElementById('age')?.value || '',
        area:         document.getElementById('area')?.value.trim() || '',
        availability: document.getElementById('availability')?.value.trim() || '',
        experience:   document.getElementById('experience')?.value || '',
        message
      };

      submitBtn.textContent = '送信中...';
      submitBtn.disabled = true;

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await res.json();

        if (data.success) {
          form.style.display = 'none';
          if (banner) banner.style.display = 'none';
          successEl.style.display = 'block';
          successEl.scrollIntoView({ behavior: 'smooth' });
        } else {
          errorEl.textContent = data.error || '送信に失敗しました。再度お試しください。';
          errorEl.classList.add('show');
        }
      } catch {
        errorEl.textContent = '通信エラーが発生しました。しばらく経ってから再度お試しください。';
        errorEl.classList.add('show');
      } finally {
        submitBtn.textContent = '🎉 送信する';
        submitBtn.disabled = false;
      }
    });
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function formatDate(str) {
    const d = new Date(str + 'T00:00:00');
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
  }
})();
