"""WebKit checks for bundled covers and the actual BookSheet download button.

Uses the real Capacitor JS proxy with a controlled native transport; this tests
the JS/native boundary, not presentation of a UIKit window on a physical phone.
Run with Vite on port 5178.
"""
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5178'
HTML = '<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="test"></div></body></html>'
PREAMBLE = '''async () => {
  const {default: RefreshRuntime}=await import('/@react-refresh');
  RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;
  window.__vite_plugin_react_preamble_installed__=true;
  document.documentElement.classList.add('platform-ios');
}'''

with sync_playwright() as p:
    browser = p.webkit.launch()
    context = browser.new_context(viewport={'width':402,'height':874}, is_mobile=True, has_touch=True)
    remote = []
    def local_only(route):
        if route.request.url.startswith(BASE):
            route.continue_()
        else:
            remote.append(route.request.url)
            route.abort()
    context.route('**/*', local_only)
    context.route('**/entry-test', lambda r: r.fulfill(content_type='text/html',body=HTML))
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE+'/entry-test')
    page.evaluate(PREAMBLE)
    page.evaluate('''async () => {
      const {default:React}=await import('/node_modules/.vite/deps/react.js');
      const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
      const {default:Cover}=await import('/src/components/Cover.jsx');
      const {SOURCE_PICKS}=await import('/src/lib/picks.js');
      const {curatedCover}=await import('/src/lib/curated-covers.js');
      const manifest=await fetch('/covers/sources.json').then(r=>r.json());
      const books=[...SOURCE_PICKS.map(b=>({...b,source:'pick'})),...manifest.featured.map(b=>({aid:b.aid,source:'mojimoon',title:b.aid}))];
      if(books.length!==40 || books.some(b=>!curatedCover(b))) throw Error('Missing curated cover');
      if(curatedCover({source:'pick',title:'玄鉴仙族',author:'Someone else'})) throw Error('Wrong author matched');
      createRoot(document.getElementById('test')).render(React.createElement('div',null,...books.map((book,i)=>React.createElement(Cover,{key:i,book,eager:true}))));
    }''')
    page.wait_for_function("document.querySelectorAll('.cover.is-real img').length===40 && [...document.querySelectorAll('.cover img')].every(i=>i.complete&&i.naturalWidth>=100)")
    assert not remote, 'Bundled covers attempted external requests: '+str(remote)
    assert not errors, errors
    context.close()

    context = browser.new_context(viewport={'width':402,'height':874}, is_mobile=True, has_touch=True)
    context.route('**/entry-test', lambda r: r.fulfill(content_type='text/html',body=HTML))
    context.add_init_script('''
      window.calls=[];window.webkit={messageHandlers:{bridge:{}}};
      window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',
        PluginHeaders:[{name:'EbookNative',methods:[{name:'openLanzou',rtype:'promise'}]}],
        nativePromise:(plugin,method,options)=>{
          calls.push({plugin,method,options});
          return new Promise((resolve,reject)=>{window.finishOpen=resolve;window.failOpen=()=>reject(Error('Native window unavailable'));});
        }
      };
    ''')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE+'/entry-test')
    page.evaluate(PREAMBLE)
    page.evaluate('''async () => {
      await Promise.all(['tokens','base','app','ios'].map(n=>import(`/src/styles/${n}.css`)));
      const {default:React}=await import('/node_modules/.vite/deps/react.js');
      const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
      const {UIProvider,useUIActions}=await import('/src/lib/ui.jsx');
      const {default:BookSheet}=await import('/src/components/BookSheet.jsx');
      const {default:Toasts}=await import('/src/components/Toasts.jsx');
      function Fixture(){const {openBook}=useUIActions();React.useEffect(()=>openBook({id:'test',title:'Bridge test',author:'Test',source:'local',tags:[],downloads:[{kind:'external',label:'蓝奏云',url:'https://example.com/book',pwd:'1234'}]}),[]);return React.createElement(React.Fragment,null,React.createElement(BookSheet),React.createElement(Toasts));}
      createRoot(document.getElementById('test')).render(React.createElement(UIProvider,null,React.createElement(Fixture)));
    }''')
    button = page.get_by_role('button',name='打开下载',exact=True)
    button.tap()
    expect(page.get_by_role('button',name='打开中…',exact=True)).to_be_disabled()
    page.wait_for_function('calls.length===1')
    assert page.evaluate('calls[0]') == {'plugin':'EbookNative','method':'openLanzou','options':{'url':'https://example.com/book','pwd':'1234','title':'Bridge test'}}
    page.evaluate('failOpen()')
    expect(page.get_by_text('无法打开下载页：Native window unavailable',exact=True)).to_be_visible()
    expect(button).to_be_enabled()
    button.tap()
    page.wait_for_function('calls.length===2')
    page.evaluate('finishOpen({})')
    expect(button).to_be_enabled()
    button.tap()
    expect(page.get_by_text('无法打开下载页：打开超时，请重试',exact=True)).to_be_visible(timeout=12000)
    expect(button).to_be_enabled()
    assert not errors, errors
    context.close()
    browser.close()
    print('PASS: 40 offline covers; actual download button reaches Capacitor; busy, rejection, retry, timeout feedback')
