// 公開カレンダーページ
(async function () {
  const calEl = document.getElementById('public-calendar');
  if (!calEl) return;

  // スケジュールデータ取得
  let scheduleData = { available: [], unavailable: [] };
  try {
    const res = await fetch('/api/schedule');
    scheduleData = await res.json();
  } catch (e) {
    console.error('スケジュール取得エラー:', e);
  }

  const availableSet   = new Set(scheduleData.available);
  const unavailableSet = new Set(scheduleData.unavailable);

  const today = new Date().toISOString().split('T')[0];

  const calendar = new FullCalendar.Calendar(calEl, {
    locale: 'ja',
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: ''
    },
    buttonText: {
      today: '今月'
    },
    height: 'auto',
    dayCellDidMount: (info) => {
      const dateStr = info.date.toISOString().split('T')[0];
      if (availableSet.has(dateStr)) {
        info.el.classList.add('fc-day-available');
        const dot = document.createElement('div');
        dot.className = 'available-indicator';
        dot.textContent = '◎ 参加可';
        info.el.querySelector('.fc-daygrid-day-top')?.appendChild(dot);
      } else if (unavailableSet.has(dateStr)) {
        info.el.classList.add('fc-day-unavailable');
        const dot = document.createElement('div');
        dot.className = 'unavailable-indicator';
        dot.textContent = '× 参加不可';
        info.el.querySelector('.fc-daygrid-day-top')?.appendChild(dot);
      }
    },
    dateClick: (info) => {
      const dateStr = info.dateStr;
      // 過去の日付はクリック不可
      if (dateStr < today) return;

      if (availableSet.has(dateStr)) {
        // 参加可能日をクリック → お問い合わせフォームへ日付付きで遷移
        const formatted = formatDate(dateStr);
        sessionStorage.setItem('selected_festival_date', dateStr);
        sessionStorage.setItem('selected_festival_date_label', formatted);
        window.location.href = '/contact.html?date=' + encodeURIComponent(dateStr);
      } else if (unavailableSet.has(dateStr)) {
        showToast('この日は参加できません');
      } else {
        showToast('この日はスケジュールが未設定です。お問い合わせフォームからご相談ください。', 3500);
      }
    }
  });

  calendar.render();

  function formatDate(str) {
    const d = new Date(str + 'T00:00:00');
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
  }

  function showToast(msg, duration = 2500) {
    let toast = document.getElementById('calendar-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'calendar-toast';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(26,58,92,0.92);color:white;padding:12px 24px;border-radius:8px;font-size:0.9rem;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.3);transition:opacity 0.3s;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, duration);
  }
})();
