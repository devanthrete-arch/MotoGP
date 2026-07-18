import crypto from 'crypto';
import db from './db.js';

const posts = [
  { title: 'DIY: Killing turbo lag on the Tata Nexon (petrol)', author: 'RevMatchRohan', brand: 'Tata', topic: 'DIY & Optimization',
    cover: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200',
    body: `After 18 months with my Nexon I finally cracked the low-end lag.\n\n## What I changed\n- Switched to a colder heat-range plug\n- Cleaned the throttle body\n- Remapped the pedal response via an aftermarket module\n\nThe result: **noticeably crisper** off-the-line response below 2000rpm. Fuel economy dropped ~0.4 km/l which I'm fine with.\n\nAnyone else tried a Stage-1 map on the Revotron? Curious about long-term reliability.` },
  { title: 'New launch watch: is the 2026 Hyundai Creta N-Line worth the premium?', author: 'GearHeadGita', brand: 'Hyundai', topic: 'New Launches',
    cover: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200',
    body: `Spec sheet looks spicy — stiffer suspension, paddle shifters, red accents everywhere.\n\nBut here's my question: for the ~1.2L premium over the SX(O), are you actually getting a *driver's car*, or just cosmetics?\n\n- Same engine, retuned\n- Firmer ride (city comfort tradeoff)\n- Better brakes\n\nPost your thoughts if you've test driven one.` },
  { title: 'Ownership review: 40,000 km with the Mahindra XUV700', author: 'DieselDon', brand: 'Mahindra', topic: 'Ownership Review',
    cover: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1200',
    body: `Two years, 40k km, mostly highway. The good, the bad, the ADAS.\n\n### The good\n- Diesel torque is addictive\n- ADAS actually works on well-marked highways\n- Space is limousine-grade\n\n### The bad\n- Occasional infotainment reboots\n- Second-row squeaks appeared around 30k\n\nWould I buy again? Yes, but I'd wait for the software to mature.` },
];

const insert = db.prepare(`INSERT INTO posts (title, body, author, brand, topic, cover, edit_token, views, likes) VALUES (@title,@body,@author,@brand,@topic,@cover,@token,@views,@likes)`);
const comment = db.prepare(`INSERT INTO comments (post_id, author, body) VALUES (?,?,?)`);

const count = db.prepare('SELECT COUNT(*) n FROM posts').get().n;
if (count === 0) {
  for (const p of posts) {
    const info = insert.run({ ...p, token: crypto.randomBytes(24).toString('hex'), views: Math.floor(20 + Math.random() * 400), likes: Math.floor(Math.random() * 40) });
    comment.run(info.lastInsertRowid, 'TorqueTalk', 'Great writeup — did you notice any knock after the remap?');
    comment.run(info.lastInsertRowid, 'Anonymous', 'Following this. Been meaning to try the same.');
  }
  console.log('Seeded', posts.length, 'posts');
} else {
  console.log('Posts already exist (', count, ') — skipping seed');
}
