// ハンバーガーメニュー
const hamburger = document.getElementById('hamburger');
const siteNav   = document.getElementById('site-nav');
if (hamburger && siteNav) {
  hamburger.addEventListener('click', () => {
    siteNav.classList.toggle('open');
    hamburger.textContent = siteNav.classList.contains('open') ? '✕' : '☰';
  });
  // ナビリンクをクリックしたらメニューを閉じる
  siteNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      siteNav.classList.remove('open');
      hamburger.textContent = '☰';
    });
  });
}

// スクロールアニメーション（Intersection Observer）
const fadeEls = document.querySelectorAll('.feature-card, .member-photo-card, .pricing-card');
if (fadeEls.length > 0) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  fadeEls.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}
