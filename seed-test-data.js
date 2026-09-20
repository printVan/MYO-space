/* ============================================================
 * MYO Space 本地测试数据批量生成脚本
 * 用法：
 *   1. 浏览器打开 http://localhost:10086/ 任意页面
 *   2. 按 F12 打开开发者工具 → Console
 *   3. 把本文件全部内容粘贴进控制台，回车
 *   4. 脚本写完会自动刷新页面
 *
 * 生成内容：
 *   - 3 个公开项目 + 3 个私密项目（名字带「测试-」前缀，便于识别）
 *   - 每个项目 2~4 个目录
 *   - 每个目录下随机 0~3 个条目（文件 / 子目录混合）
 *   - 子目录下再随机 0~2 个文件
 *   - 全部 synced=false（本地测试数据：作者可见可改，删除只需二次确认、不需密码）
 *   - 文件可见性跟随所属项目（公开项目里的文件=公开，私密项目里的=私密）
 *
 * 清理：这些测试项目都是「未同步」，可直接在项目管理页逐个删除；
 *      或运行文件底部附的 CLEAN 段一键清空。
 * ============================================================ */

(async () => {
  const DB_NAME = 'myblog-db';
  const now = Date.now();
  let counter = 0;
  const uid = (p) => `${p}_qa${now.toString(36)}_${(counter++).toString(36)}`;
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[rand(0, arr.length - 1)];

  const DIR_NAMES = ['架构设计', '开发日志', '部署运维', '需求文档', '会议纪要', '学习资料', '杂项', '归档'];
  const FILE_NAMES = ['README', '方案初稿', 'API设计', '部署记录', '踩坑清单', '周报', '读书笔记', 'TODO', '调研笔记', '复盘总结', '接口联调', '上线清单'];
  const SAMPLE = (t) => `# ${t}\n\n这是造数脚本自动生成的示例笔记，用于验证项目/目录/文件展示。\n\n## 要点\n\n1. 第一条要点\n2. 第二条要点\n3. 第三条要点\n\n> 测试数据，可随时删除。\n`;

  const projects = [], folders = [], notes = [];
  // 项目内目录名去重，避免出现两个同名目录
  function buildProject(name, visibility) {
    const pid = uid('p');
    projects.push({
      id: pid, name,
      description: '造数脚本自动生成的测试数据',
      visibility, password: null, topics: ['测试'],
      createdAt: now, updatedAt: now, synced: false
    });
    const used = new Set();
    const dirCount = rand(2, 4);
    for (let i = 0; i < dirCount; i++) {
      let base = pick(DIR_NAMES);
      let n = 2;
      while (used.has(base)) base = pick(DIR_NAMES) + (n++);
      used.add(base);
      buildFolder(pid, null, base, visibility, used);
    }
  }
  function buildFolder(pid, parentId, name, visibility, used) {
    const fid = uid('f');
    folders.push({ id: fid, projectId: pid, parentId, name, createdAt: now, updatedAt: now });
    const entries = rand(0, 3);
    for (let i = 0; i < entries; i++) {
      if (Math.random() < 0.35) {
        // 再嵌套一层子目录
        let base = pick(DIR_NAMES);
        while (used.has(base)) base = pick(DIR_NAMES) + '_子';
        used.add(base);
        buildFolder(pid, fid, base, visibility, used);
      } else {
        buildNote(pid, fid, visibility);
      }
    }
  }
  function buildNote(pid, folderId, visibility) {
    const title = pick(FILE_NAMES) + ' ' + rand(1, 99);
    notes.push({
      id: uid('n'), projectId: pid, folderId, title,
      content: SAMPLE(title),
      visibility, pinned: false, topics: [],
      createdAt: now, updatedAt: now, synced: false
    });
  }

  // 3 公开 + 3 私密
  for (let i = 1; i <= 3; i++) buildProject(`测试-公开手记${i}`, 'public');
  for (let i = 1; i <= 3; i++) buildProject(`测试-私密备忘${i}`, 'private');

  const req = indexedDB.open(DB_NAME);
  req.onsuccess = () => {
    const dbx = req.result;
    const tx = dbx.transaction(['projects', 'folders', 'notes'], 'readwrite');
    projects.forEach(p => tx.objectStore('projects').put(p));
    folders.forEach(f => tx.objectStore('folders').put(f));
    notes.forEach(n => tx.objectStore('notes').put(n));
    tx.oncomplete = () => {
      console.log(`✅ 造数完成：项目 ${projects.length} 个 / 目录 ${folders.length} 个 / 文件 ${notes.length} 个`);
      console.log('1 秒后自动刷新页面…');
      setTimeout(() => location.reload(), 1000);
    };
    tx.onerror = (e) => console.error('❌ 写入失败', e);
  };
  req.onerror = () => console.error('❌ 打开 IndexedDB 失败');
})();

/* ============================================================
 * 【可选】一键清理所有「测试-」造数数据（需要时取消注释再跑）
 * ============================================================
 * (async () => {
 *   const req = indexedDB.open('myblog-db');
 *   req.onsuccess = () => {
 *     const dbx = req.result;
 *     const tx = dbx.transaction(['projects','folders','notes'], 'readwrite');
 *     const ps = await new Promise(res => {
 *       const g = tx.objectStore('projects').getAll();
 *       g.onsuccess = () => res(g.result);
 *     });
 *     const qaIds = ps.filter(p => (p.name||'').indexOf('测试-') === 0).map(p => p.id);
 *     // 删除这些项目
 *     qaIds.forEach(id => tx.objectStore('projects').delete(id));
 *     // 删除这些项目下的所有目录/文件
 *     const fs = tx.objectStore('folders');
 *     const allF = await new Promise(res => { const g = fs.getAll(); g.onsuccess=()=>res(g.result); });
 *     allF.filter(f => qaIds.includes(f.projectId)).forEach(f => fs.delete(f.id));
 *     const ns = tx.objectStore('notes');
 *     const allN = await new Promise(res => { const g = ns.getAll(); g.onsuccess=()=>res(g.result); });
 *     allN.filter(n => qaIds.includes(n.projectId)).forEach(n => ns.delete(n.id));
 *     tx.oncomplete = () => { console.log('已清理测试项目', qaIds); location.reload(); };
 *   };
 * })();
 */
