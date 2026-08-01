'use strict';
/* 演示数据：真实书目（OpenLibrary，封面自托管）与真实播客（Apple Podcasts 接口抓取）
   + 待办/选题库/运动/饮食的演示条目（日期按运行当天动态计算） */
const DEMO = {
  "books": [
    {
      "id": "ol:/works/OL17267881W",
      "title": "三体",
      "author": "刘慈欣",
      "publisher": "重庆出版社",
      "year": "2008",
      "pages": 417,
      "cover": "assets/demo/santi.jpg",
      "status": "在读",
      "rating": null,
      "summary": "",
      "_agoDays": 12
    },
    {
      "id": "ol:/works/OL19755009W",
      "title": "白夜行",
      "author": "東野圭吾",
      "publisher": "Shūeisha",
      "year": "2002",
      "pages": 860,
      "cover": "assets/demo/baiyexing.jpg",
      "status": "在读",
      "rating": null,
      "summary": "",
      "_agoDays": 25
    },
    {
      "id": "ol:/works/OL25129388W",
      "title": "活着",
      "author": "余华",
      "publisher": "作家出版社",
      "year": "2012",
      "pages": 191,
      "cover": "assets/demo/huozhe.jpg",
      "status": "读完",
      "rating": 5,
      "summary": "人是为活着本身而活着的。",
      "_agoDays": 60
    },
    {
      "id": "ol:/works/OL36417231W",
      "title": "小王子",
      "author": "安托万·德·圣-埃克苏佩里",
      "publisher": "藍出版",
      "year": "2021",
      "pages": null,
      "cover": "assets/demo/xiaowangzi.jpg",
      "status": "读完",
      "rating": 4.5,
      "summary": "真正重要的东西，用眼睛是看不见的。",
      "_agoDays": 90
    },
    {
      "id": "ol:/works/OL31608032W",
      "title": "百年孤独",
      "author": "加西亚·马尔克斯",
      "publisher": "南海出版公司",
      "year": "2017",
      "pages": null,
      "cover": "assets/demo/bainiangudu.jpg",
      "status": "想读",
      "rating": null,
      "summary": "",
      "_agoDays": 3
    },
    {
      "id": "ol:/works/OL29403949W",
      "title": "红楼梦",
      "author": "曹雪芹",
      "publisher": "中国画报出版社",
      "year": "2013",
      "pages": 278,
      "cover": "assets/demo/hongloumeng.jpg",
      "status": "想读",
      "rating": null,
      "summary": "",
      "_agoDays": 7
    }
  ],
  "shows": [
    {
      "id": 1671490972,
      "name": "纵横四海",
      "artist": "携隐Melody",
      "artwork": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/df/b4/e4/dfb4e432-0769-9506-09a9-f01fa4b7852d/mza_16915193939148219302.jpeg/600x600bb.jpg",
      "feedUrl": "https://www.ximalaya.com/album/67531569.xml",
      "total": 86,
      "updatedStr": "7月25日"
    },
    {
      "id": 1615939013,
      "name": "半拿铁 | 商业沉浮录",
      "artist": "潇磊&刘飞",
      "artwork": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts112/v4/95/33/4d/95334de1-1492-1ab0-aa7b-8f246bf89bde/mza_10728614257690800956.jpeg/600x600bb.jpg",
      "feedUrl": "https://proxy.wavpub.com/caffebreve.xml",
      "total": 227,
      "updatedStr": "7月29日"
    },
    {
      "id": 1573189055,
      "name": "声动早咖啡",
      "artist": "声动活泼",
      "artwork": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts112/v4/a9/7f/7a/a97f7a8f-4451-05bc-bacc-637773b1b06a/mza_16067595309054880476.png/600x600bb.jpg",
      "feedUrl": "https://www.ximalaya.com/album/51076156.xml",
      "total": 1009,
      "updatedStr": "7月29日"
    },
    {
      "id": 1256399960,
      "name": "故事FM",
      "artist": "寇爱哲",
      "artwork": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/65/3c/2a/653c2a3c-e158-e0a7-3521-f44d7c281978/mza_2401098770430920951.png/600x600bb.jpg",
      "feedUrl": "https://feeds.storyfm.cn/storyfm.xml",
      "total": 982,
      "updatedStr": "7月29日"
    }
  ],
  "episodes": [
    {
      "id": "1000774480942",
      "showId": 1671490972,
      "showName": "纵横四海",
      "title": "EP84《Roar》：生酮、轻断食、168、空腹训练…通通达咩♂️",
      "artwork": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/df/b4/e4/dfb4e432-0769-9506-09a9-f01fa4b7852d/mza_16915193939148219302.jpeg/600x600bb.jpg",
      "audioUrl": "https://jt.ximalaya.com//GKwRIaIOFZX0Bog1qQSuJpVS.m4a?channel=rss&album_id=67531569&track_id=993173602&uid=403479618&jt=https://aod.cos.tx.xmcdn.com/storages/28ff-audiofreehighqps/27/F0/GKwRIaIOFZX0Bog1qQSuJpVS.m4a",
      "duration": 13538,
      "dateStr": "6月27日",
      "state": "在听",
      "inList": true,
      "pos": 5009,
      "notes": [
        {
          "id": "dn1",
          "at": 760,
          "text": "「先有稳定的输出节奏，再谈内容质量」——这段可以直接做一条视频。",
          "createdAt": 0
        },
        {
          "id": "dn2",
          "at": 2290,
          "text": "空腹训练那段的实验设计值得回听。",
          "createdAt": 0
        }
      ]
    },
    {
      "id": "1000770796707",
      "showId": 1671490972,
      "showName": "纵横四海",
      "title": "EP83《少有人走的路》：每个人都有自己的奥德赛",
      "artwork": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/df/b4/e4/dfb4e432-0769-9506-09a9-f01fa4b7852d/mza_16915193939148219302.jpeg/600x600bb.jpg",
      "audioUrl": "https://jt.ximalaya.com//GKwRIUEN9G3NBx2j2gSiEt73.m4a?channel=rss&album_id=67531569&track_id=980723281&uid=403479618&jt=https://aod.cos.tx.xmcdn.com/storages/4bb8-audiofreehighqps/21/3D/GKwRIUEN9G3NBx2j2gSiEt73.m4a",
      "duration": 14748,
      "dateStr": "6月2日",
      "state": "未听",
      "inList": true,
      "pos": 0,
      "notes": []
    },
    {
      "id": "1000778892916",
      "showId": 1615939013,
      "showName": "半拿铁 | 商业沉浮录",
      "title": "No.212 曾经的精神角落：豆瓣、知乎、贴吧、虎扑 | 中国互联网故事25",
      "artwork": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts112/v4/95/33/4d/95334de1-1492-1ab0-aa7b-8f246bf89bde/mza_10728614257690800956.jpeg/600x600bb.jpg",
      "audioUrl": "https://tk.wavpub.com/WPDL_rcFZxnBrLPLprHnsPnLZRBALqKtNPztCLRWDssqcMeWtqSmtPXszyvZCYT-f7.m4a",
      "duration": 11211,
      "dateStr": "7月29日",
      "state": "未听",
      "inList": true,
      "pos": 0,
      "notes": []
    },
    {
      "id": "1000775952591",
      "showId": 1615939013,
      "showName": "半拿铁 | 商业沉浮录",
      "title": "No.209 晋商往事：走西口到乔家大院然后煤了",
      "artwork": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts112/v4/95/33/4d/95334de1-1492-1ab0-aa7b-8f246bf89bde/mza_10728614257690800956.jpeg/600x600bb.jpg",
      "audioUrl": "https://tk.wavpub.com/WPDL_CTkpdZesayvjFgswQbYpWRhVUzjDgfvmvXqehFCmsLgTnhZHFVaCssNSmT-20.m4a",
      "duration": 7733,
      "dateStr": "7月8日",
      "state": "听完",
      "inList": true,
      "pos": 7733,
      "notes": []
    },
    {
      "id": "1000778787442",
      "showId": 1573189055,
      "showName": "声动早咖啡",
      "title": "走大众路线的迪卡侬，为何要投资高端折叠自行车小布？",
      "artwork": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/3e/2f/07/3e2f0764-c4a1-3b76-d7dc-1acf90eb83e7/mza_5607172626967849942.jpeg/600x600bb.jpg",
      "audioUrl": "https://jt.ximalaya.com//GKwRIDoOPnmMAGptlQS-grRm.m4a?channel=rss&album_id=51076156&track_id=1003386051&uid=168606226&jt=https://aod.cos.tx.xmcdn.com/storages/e046-audiofreehighqps/78/08/GKwRIDoOPnmMAGptlQS-grRm.m4a",
      "duration": 861,
      "dateStr": "7月28日",
      "state": "未听",
      "inList": true,
      "pos": 0,
      "notes": []
    },
    {
      "id": "1000778954560",
      "showId": 1256399960,
      "showName": "故事FM",
      "title": "E906.代号 914（下） ：没有了战争，还要面对和平年代的挑战",
      "artwork": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/f7/66/be/f766be23-f867-46bb-331d-a913a444bc52/mza_16008169723946196708.jpg/600x600bb.jpg",
      "audioUrl": "https://tk.wavpub.com/WPDL_TzMThbneYTHEFRkqJdxyngCcTQyPWuBxPjDzaATyePkUNFxCknBPDJmMtr-1e.mp3",
      "duration": 1692,
      "dateStr": "7月29日",
      "state": "未听",
      "inList": true,
      "pos": 0,
      "notes": []
    },
    {
      "id": "1000778204065",
      "showId": 1256399960,
      "showName": "故事FM",
      "title": "E904.21岁，我被父母关进戒网瘾学校，男友穿着护甲来救我",
      "artwork": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/ba/4b/88/ba4b889e-3bd2-c456-4991-41f0c7442a66/mza_6411548252485615097.jpg/600x600bb.jpg",
      "audioUrl": "https://tk.wavpub.com/WPDL_JKjFWVbaRRDMTAvQpGXLQhPSmzgtALNMeDURPgndeyQfHVXWLTtSzTudNF-54.mp3",
      "duration": 2423,
      "dateStr": "7月24日",
      "state": "听完",
      "inList": true,
      "pos": 2423,
      "notes": []
    }
  ]
};

const DEMO_VER = 3;

async function seedDemo() {
  const ver = (await DB.getMeta('seedDemo')) || 0;
  if (ver >= DEMO_VER) return;
  const now = Date.now();
  const T = todayStr();
  const D = n => addDays(T, n);

  /* ── 书籍 / 播客 ── */
  for (const b of DEMO.books) {
    const { _agoDays, ...rest } = b;
    await DB.putBooks({
      ...rest,
      addedAt: now - (_agoDays || 0) * 864e5,
      finishedAt: b.status === '读完' ? now - (_agoDays || 0) * 432e5 : null,
      updatedAt: now - (_agoDays || 0) * 864e5
    });
  }
  for (const s of DEMO.shows) await DB.putShows({ ...s, subscribedAt: now });
  {
    let i = 0;
    for (const e of DEMO.episodes) {
      await DB.putEpisodes({
        ...e,
        notes: (e.notes || []).map(n => ({ ...n, createdAt: now })),
        addedAt: now - i * 36e5, updatedAt: now - i * 36e5
      });
      i++;
    }
  }

  /* ── 选题库 ── */
  const topics = [
    { id: 'demo-tp1', title: 'AI 工具横评：这 6 个我每天真的在用', status: '进行中',
      notes: '开头三秒直接给结论表。\n每个工具只讲一个我真实用它做的事，不念参数。\n结尾留一个「你们最想我测哪个」的钩子。',
      links: [{ url: 'https://sspai.com/post/85000', domain: 'sspai.com', title: '2026 年生产力工具年度盘点' }],
      shots: [], createdAt: now - 5 * 864e5, updatedAt: now - 864e5 },
    { id: 'demo-tp2', title: '城市漫步 vlog：一条地铁线走完', status: '想法',
      notes: '选一号线，早六点出发。', links: [], shots: [], createdAt: now - 3 * 864e5, updatedAt: now - 3 * 864e5 },
    { id: 'demo-tp3', title: '为什么你的复盘总是没用', status: '想法',
      notes: '复盘的目的不是记录，是改下一次的动作。\n找三个反例。', links: [], shots: [], createdAt: now - 8 * 864e5, updatedAt: now - 6 * 864e5 },
    { id: 'demo-tp4', title: '桌面改造：从杂乱到能开机就干活', status: '已发布',
      notes: '成片 8 分钟，置顶评论放清单。', links: [], shots: [],
      createdAt: now - 20 * 864e5, updatedAt: now - 9 * 864e5, publishedAt: now - 9 * 864e5 },
    { id: 'demo-tp5', title: '一个人做内容，怎么排一周', status: '想法',
      notes: '', links: [], shots: [], createdAt: now - 864e5, updatedAt: now - 864e5 }
  ];
  for (const t of topics) await DB.putTopics(t);

  /* ── 待办 ── */
  // 清掉旧版演示待办
  for (let i = 1; i <= 7; i++) await DB.delTodos('demo-td' + i);
  for (let off = -10; off <= 40; off++) for (let k = 0; k < 2; k++) await DB.delTodos(`demo-v3-${off}-${k}`);

  const mkTodo = (id, title, date, time, src, extra) => ({
    id, title, note: '', date, time, src: src || null,
    done: false, doneAt: null, focusMin: 0, focusRounds: 0,
    createdAt: now - 864e5, updatedAt: now - 864e5, ...(extra || {})
  });
  const srcTp1 = st => ({ type: 'topic', id: 'demo-tp1', label: '选题库', stage: st });
  // 选题阶段待办：昨天已完成 / 今天 / 明天
  const linked = [
    mkTodo('demo-td1', '写脚本：AI 工具横评：这 6 个我每天真的在用', D(-1), '14:00', srcTp1('写脚本'),
      { done: true, doneAt: now - 864e5, focusMin: 50, focusRounds: 2 }),
    mkTodo('demo-td2', '拍摄：AI 工具横评：这 6 个我每天真的在用', T, '10:00', srcTp1('拍摄')),
    mkTodo('demo-td3', '剪辑：AI 工具横评：这 6 个我每天真的在用', D(1), '14:00', srcTp1('剪辑')),
    mkTodo('demo-td4', '读《白夜行》30 分钟', D(-3), null,
      { type: 'book', id: 'ol:/works/OL19755009W', label: '读书' })
  ];
  for (const t of linked) await DB.putTodos(t);

  // 每天 2 条，从一周前铺到下个月：过去约三分之一没做完（自然形成逾期）
  const POOL = [
    ['晨间写作 30 分钟', '09:00'],
    ['回复合作邮件', '16:00'],
    ['整理截图素材', '14:00'],
    ['读《三体》30 分钟', '21:30', { type: 'book', id: 'ol:/works/OL17267881W', label: '读书' }],
    ['给视频写 3 个备选标题', '11:00'],
    ['清理相册和下载文件夹', '20:00'],
    ['周复盘 20 分钟', '19:00'],
    ['选题头脑风暴 15 分钟', '10:30'],
    ['备份工作硬盘', '15:00'],
    ['学英语 20 分钟', '08:30']
  ];
  for (let off = -7; off <= 35; off++) {
    for (let k = 0; k < 2; k++) {
      const p = POOL[(((off + 7) * 2 + k) % POOL.length + POOL.length) % POOL.length];
      const done = off < 0 && ((off + k) % 3 !== 0);
      await DB.putTodos(mkTodo(`demo-v3-${off}-${k}`, p[0], D(off), p[1], p[2] || null,
        done ? { done: true, doneAt: now + off * 864e5 } : {}));
    }
  }

  /* ── 运动 ── */
  const mkSport = (id, type, kind, date, extra) => ({
    id, type, kind, date, planned: false, doneFromPlan: false,
    duration: 30, distance: null, feel: '正常', lifts: [],
    createdAt: now - 864e5, updatedAt: now - 864e5, ...(extra || {})
  });
  const backLifts = [
    { part: '背', name: '高位下拉', bw: false, secs: false, weight: 45, reps: 10, seconds: null, sets: 4 },
    { part: '背', name: '坐姿划船', bw: false, secs: false, weight: 40, reps: 12, seconds: null, sets: 3 },
    { part: '背', name: '引体向上', bw: true, secs: false, weight: null, reps: 8, seconds: null, sets: 3 }
  ];
  const sports = [
    mkSport('demo-sp1', '跑步', 'timed', D(-1), { duration: 32, distance: 5.2 }),
    mkSport('demo-sp2', '力量训练', 'strength', D(-3), { duration: 45, feel: null, lifts: backLifts }),
    mkSport('demo-sp3', '羽毛球', 'ball', D(-5), { duration: 60, feel: '吃力' }),
    mkSport('demo-sp4', '跑步', 'timed', D(-8), { duration: 28, distance: 4.5, feel: '轻松' }),
    mkSport('demo-sp5', '游泳', 'timed', D(-11), { duration: 40, distance: 1.0 }),
    mkSport('demo-sp6', '力量训练', 'strength', D(-14), { duration: 50, feel: null, lifts: backLifts.slice(0, 2) }),
    mkSport('demo-sp7', '力量训练', 'strength', T, { planned: true, duration: 45 }),
    mkSport('demo-sp8', '游泳', 'timed', D(3), { planned: true, duration: 40 }),
    mkSport('demo-sp9', '跑步', 'timed', D(-2), { planned: true, duration: 30 })
  ];
  for (const s of sports) await DB.putSports(s);

  /* ── 饮食 ── */
  const mkMeal = (id, date, slot, time, text, amount) => ({
    id, date, slot, time, text, amount, photos: [],
    createdAt: now - 864e5, updatedAt: now - 864e5
  });
  const meals = [
    mkMeal('demo-ml1', T, '早餐', '08:20', '豆浆、鸡蛋、一个包子', '正常'),
    mkMeal('demo-ml2', T, '午餐', '12:40', '食堂：糙米饭、青椒鸡丁', '偏多'),
    mkMeal('demo-ml3', D(-1), '早餐', '08:10', '燕麦拿铁、可颂', '少'),
    mkMeal('demo-ml4', D(-1), '午餐', '12:30', '牛肉面', '正常'),
    mkMeal('demo-ml5', D(-1), '晚餐', '19:00', '自己煮：番茄鸡蛋面', '正常'),
    mkMeal('demo-ml6', D(-2), '午餐', '13:00', '轻食沙拉 + 鸡胸', '少'),
    mkMeal('demo-ml7', D(-2), '晚餐', '18:40', '外卖：麻辣香锅', '偏多'),
    mkMeal('demo-ml8', D(-3), '早餐', '08:30', '小米粥、咸鸭蛋', '正常'),
    mkMeal('demo-ml9', D(-3), '午餐', '12:20', '公司食堂：两荤一素', '正常'),
    mkMeal('demo-ml10', D(-3), '晚餐', '19:30', '和朋友吃火锅', '偏多'),
    mkMeal('demo-ml11', D(-4), '晚餐', '20:00', '饺子一盘', '正常'),
    mkMeal('demo-ml12', D(-5), '早餐', '08:00', '包子豆浆', '正常'),
    mkMeal('demo-ml13', D(-5), '午餐', '12:10', '盖浇饭', '正常'),
    mkMeal('demo-ml14', D(-5), '晚餐', '18:50', '清蒸鱼、米饭', '正常')
  ];
  for (const m of meals) await DB.putMeals(m);

  await DB.setMeta('seedDemo', DEMO_VER);
}
