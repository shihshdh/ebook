(async () => {
  const accounts = await import('/src/lib/accounts.js');
  const { idbPut } = await import('/src/lib/idb.js');
  const bundle = (await import('/src/comic/default-sources.js')).default;
  sessionStorage.setItem('r8-original-account', accounts.currentId);
  sessionStorage.setItem('r8-original-url', location.href);
  const account = accounts.createAccount({ name: 'R8 漫画验收' });
  sessionStorage.setItem('r8-test-account', account.id);
  const db = accounts.acctDB(account.id);
  const code = `class AcceptanceSource extends ComicSource {
    name = '本地验收源'; key = 'komga'; version = '1.0.0';
    settings = { note: { title: '验收图像', type: 'input', default: '仅本机夹具' } };
    search = { load: async () => ({ comics: [new Comic({ id: 'observatory', title: '静夜观测站', cover: 'http://127.0.0.1:5199/?page=1' })], maxPage: 1 }) };
    explore = [{ title: '奇幻', type: 'multiPageComicList', load: async () => ({ comics: [new Comic({ id: 'observatory', title: '静夜观测站', cover: 'http://127.0.0.1:5199/?page=1', tags: ['奇幻'] })], maxPage: 1 }) }];
    comic = {
      loadInfo: async () => new ComicDetails({ title: '静夜观测站', cover: 'http://127.0.0.1:5199/?page=1', description: '本地验收夹具，不访问漫画网站。', chapters: Object.fromEntries(Array.from({length:80}, (_,i)=>[String(i), '第 '+(i+1)+' 话 · 星光'])) }),
      loadEp: async (_, ep) => ({ images: Array.from({length:48},(_,i)=>'http://127.0.0.1:5199/?page='+(i+1)) })
    };
  }`;
  await idbPut(db, 'kv', 'comic:defaults', bundle.version);
  await idbPut(db, 'kv', 'comic:sources', [{ id: 'venera:komga', repo:'venera', key:'komga', name:'本地验收源', version:'1.0.0', fileName:'komga.js', className:'AcceptanceSource', code, enabled:true }]);
  await idbPut(db, 'kv', 'comic:runtime:venera', {code:bundle.runtime});
  localStorage.setItem(accounts.acctKey('librarium.comic.reader',account.id), JSON.stringify({mode:'page',theme:'night'}));
  accounts.switchAccount(account.id);
  return account.id;
})()
