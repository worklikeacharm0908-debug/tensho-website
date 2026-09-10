require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ディレクトリ確保
const DATA_DIR   = path.join(__dirname, 'data');
const GALLERY_DIR = path.join(__dirname, 'public', 'images', 'gallery');
const MEMBERS_DIR = path.join(__dirname, 'public', 'images', 'members');
[DATA_DIR, GALLERY_DIR, MEMBERS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const GALLERY_FILE  = path.join(DATA_DIR, 'gallery.json');
const ADMIN_FILE    = path.join(DATA_DIR, 'admin.json');
const MEMBER_FILE   = path.join(DATA_DIR, 'member.json');

function initFile(file, def) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(def, null, 2));
}
initFile(SCHEDULE_FILE, { events: [] });
initFile(CONTACTS_FILE, []);
initFile(GALLERY_FILE,  []);
initFile(MEMBER_FILE, {
  comment: '私たちは、地域のお祭りをこれからも盛り上げていきたいという思いから集まった仲間たちです。\n\n近年、高齢化が進み、お神輿を担ぐ人手が足りないというお声をよく耳にするようになりました。お祭りは地域の大切な文化。その文化をしっかりと次の世代へ繋いでいくために、私たちが少しでもお役に立てればと思っています。\n\n京都府舞鶴市を拠点に、半径45km圏内のお祭りへ喜んで参加いたします。まずはお気軽にご相談ください。',
  photos: []
});

if (!fs.existsSync(ADMIN_FILE)) {
  const hash = bcrypt.hashSync('maizuru2024', 10);
  fs.writeFileSync(ADMIN_FILE, JSON.stringify({ passwordHash: hash }, null, 2));
  console.log('管理者パスワードを初期化しました → maizuru2024');
}

function readJSON(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'maizuru-matsuri-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Multer（ギャラリー用）
const galleryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, GALLERY_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
  }
});
const upload = multer({
  storage: galleryStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('画像または動画ファイルのみ可能です'));
  }
});

// Multer（メンバー写真用）
const memberStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEMBERS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
  }
});
const uploadMember = multer({
  storage: memberStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('画像ファイルのみ可能です'));
  }
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: '認証が必要です' });
}

// ===== スケジュール =====
app.get('/api/schedule', (req, res) => {
  const data = readJSON(SCHEDULE_FILE, { events: [] });
  if (!data.events) data.events = [];
  res.json(data);
});

app.post('/api/admin/schedule', requireAdmin, (req, res) => {
  const { date, name } = req.body;
  if (!date || !name) return res.status(400).json({ error: '日付とお祭り名を入力してください' });
  const data = readJSON(SCHEDULE_FILE, { events: [] });
  if (!data.events) data.events = [];
  if (data.events.some(e => e.date === date))
    return res.status(400).json({ error: 'その日付はすでに登録されています' });
  data.events.push({ date, name });
  data.events.sort((a, b) => a.date.localeCompare(b.date));
  writeJSON(SCHEDULE_FILE, data);
  res.json({ success: true });
});

app.delete('/api/admin/schedule/:date', requireAdmin, (req, res) => {
  const data = readJSON(SCHEDULE_FILE, { events: [] });
  if (!data.events) data.events = [];
  data.events = data.events.filter(e => e.date !== req.params.date);
  writeJSON(SCHEDULE_FILE, data);
  res.json({ success: true });
});

// ===== お問い合わせ =====
app.post('/api/contact', async (req, res) => {
  const d = req.body;
  if (!d.contactName || !d.email || !d.festivalName) {
    return res.status(400).json({ error: '必須項目を入力してください' });
  }

  const contacts = readJSON(CONTACTS_FILE, []);
  contacts.unshift({
    id: Date.now().toString(),
    ...d,
    submittedAt: new Date().toISOString(),
    isRead: false
  });
  writeJSON(CONTACTS_FILE, contacts);

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: false,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });

      const rows = [
        ['神社名', d.shrineName],
        ['団体名', d.organizationName],
        ['担当者名', d.contactName],
        ['メールアドレス', d.email],
        ['電話番号', d.phone],
        ['お祭りの名前', d.festivalName],
        ['開催日', d.festivalDate],
        ['開催場所', d.festivalLocation],
        ['必要な人数', d.requiredPeople ? `${d.requiredPeople}人` : '-'],
        ['Zoom相談', d.zoomAvailable === 'yes' ? '希望する' : '希望しない'],
        ['メッセージ', d.message]
      ].map(([k, v]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold;width:140px">${k}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${v || '-'}</td></tr>`
      ).join('');

      await transporter.sendMail({
        from: `"天翔" <${process.env.EMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
        subject: `【お問い合わせ】${d.festivalName}（${d.contactName}様）`,
        html: `<div style="font-family:sans-serif;max-width:620px;margin:0 auto"><h2 style="color:#1a3a5c;border-left:4px solid #b5292a;padding-left:12px">新しいお問い合わせ</h2><table style="width:100%;border-collapse:collapse">${rows}</table></div>`
      });

      await transporter.sendMail({
        from: `"天翔" <${process.env.EMAIL_USER}>`,
        to: d.email,
        subject: '【天翔】お問い合わせを受け付けました',
        html: `<div style="font-family:sans-serif;max-width:620px;margin:0 auto"><h2 style="color:#1a3a5c">お問い合わせありがとうございます</h2><p>${d.contactName} 様</p><p>この度は天翔へのお問い合わせをいただき、誠にありがとうございます。</p><p>内容を確認の上、3営業日以内にご連絡いたします。しばらくお待ちください。</p><hr style="border:none;border-top:1px solid #eee;margin:24px 0"><p style="color:#888;font-size:0.9em">天翔<br>京都府舞鶴市</p></div>`
      });
    } catch (err) {
      console.error('メール送信エラー:', err.message);
    }
  }

  res.json({ success: true });
});

app.get('/api/admin/contacts', requireAdmin, (req, res) => {
  res.json(readJSON(CONTACTS_FILE, []));
});

app.patch('/api/admin/contacts/:id/read', requireAdmin, (req, res) => {
  const contacts = readJSON(CONTACTS_FILE, []);
  const idx = contacts.findIndex(c => c.id === req.params.id);
  if (idx !== -1) { contacts[idx].isRead = true; writeJSON(CONTACTS_FILE, contacts); }
  res.json({ success: true });
});

// ===== ギャラリー =====
app.get('/api/gallery', (req, res) => {
  res.json(readJSON(GALLERY_FILE, []));
});

app.post('/api/admin/gallery', requireAdmin, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルが必要です' });
  const gallery = readJSON(GALLERY_FILE, []);
  gallery.push({
    id: Date.now().toString(),
    filename: req.file.filename,
    type: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
    caption: req.body.caption || '',
    uploadedAt: new Date().toISOString()
  });
  writeJSON(GALLERY_FILE, gallery);
  res.json({ success: true, filename: req.file.filename });
});

app.delete('/api/admin/gallery/:id', requireAdmin, (req, res) => {
  let gallery = readJSON(GALLERY_FILE, []);
  const item = gallery.find(g => g.id === req.params.id);
  if (item) {
    try { fs.unlinkSync(path.join(GALLERY_DIR, item.filename)); } catch {}
    gallery = gallery.filter(g => g.id !== req.params.id);
    writeJSON(GALLERY_FILE, gallery);
  }
  res.json({ success: true });
});

// ===== メンバー =====
app.get('/api/member', (req, res) => {
  res.json(readJSON(MEMBER_FILE, { comment: '', photos: [] }));
});

app.post('/api/admin/member/photo', requireAdmin, uploadMember.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルが必要です' });
  const data = readJSON(MEMBER_FILE, { comment: '', photos: [] });
  data.photos.push({
    id: Date.now().toString(),
    filename: req.file.filename,
    uploadedAt: new Date().toISOString()
  });
  writeJSON(MEMBER_FILE, data);
  res.json({ success: true, filename: req.file.filename });
});

app.delete('/api/admin/member/photo/:id', requireAdmin, (req, res) => {
  const data = readJSON(MEMBER_FILE, { comment: '', photos: [] });
  const item = data.photos.find(p => p.id === req.params.id);
  if (item) {
    try { fs.unlinkSync(path.join(MEMBERS_DIR, item.filename)); } catch {}
    data.photos = data.photos.filter(p => p.id !== req.params.id);
    writeJSON(MEMBER_FILE, data);
  }
  res.json({ success: true });
});

app.post('/api/admin/member/comment', requireAdmin, (req, res) => {
  const { comment } = req.body;
  const data = readJSON(MEMBER_FILE, { comment: '', photos: [] });
  data.comment = comment || '';
  writeJSON(MEMBER_FILE, data);
  res.json({ success: true });
});

// ===== 管理者認証 =====
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'パスワードを入力してください' });
  const adminData = readJSON(ADMIN_FILE, {});
  const ok = await bcrypt.compare(password, adminData.passwordHash || '');
  if (ok) { req.session.isAdmin = true; res.json({ success: true }); }
  else res.status(401).json({ error: 'パスワードが正しくありません' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/admin/check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.isAdmin) });
});

app.post('/api/admin/change-password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: '全項目を入力してください' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
  const adminData = readJSON(ADMIN_FILE, {});
  const ok = await bcrypt.compare(currentPassword, adminData.passwordHash || '');
  if (!ok) return res.status(401).json({ error: '現在のパスワードが正しくありません' });
  writeJSON(ADMIN_FILE, { passwordHash: await bcrypt.hash(newPassword, 10) });
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🏮 天翔 → http://localhost:${PORT}`);
});
