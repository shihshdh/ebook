"""WebKit regression checks. Run against npm run dev (default port 5178).

Requires Python playwright and `python -m playwright install webkit`.
Real tap events cover iOS hit testing; swipe events exercise the gesture state machine.
"""
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5178'
out = Path('release/ios-ui')
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.webkit.launch()
    page = browser.new_page(viewport={'width': 402, 'height': 874}, is_mobile=True,
        has_touch=True, user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script("sessionStorage.setItem('librarium.splash','1')")
    if os.name == 'nt':
        # Windows WebKit cannot persist Blob values; only test blobs use memory.
        def idb_route(route):
            response = route.fetch()
            code = response.text().replace('export const idbGet = (store, key) =>',
                "const testBlobs = new Map(); export const idbGet = (store, key) => store === 'blob' ? Promise.resolve(testBlobs.get(key)) :")
            code = code.replace('export const idbSet = (store, key, value) =>',
                "export const idbSet = (store, key, value) => store === 'blob' ? Promise.resolve(testBlobs.set(key,value)) :")
            route.fulfill(response=response, body=code)
        page.route('**/src/lib/idb.js', idb_route)
    page.goto(base)
    page.wait_for_load_state('networkidle')
    page.evaluate("document.documentElement.style.setProperty('--native-safe-top','62px'); document.documentElement.style.setProperty('--native-safe-bottom','34px')")
    # Exercise the real disc stylesheet with overlapping fixed app layers.
    page.evaluate('''async () => {
        await import('/src/effects/DiscShelf.css');
        const fixture = document.createElement('div'); fixture.id='layer-test';
        fixture.innerHTML='<section class="discshelf" style="position:fixed;inset:0"><div class="disc-footer" style="height:100%">disc</div></section>';
        document.body.append(fixture);
    }''')
    nav = page.locator('.tabbar').bounding_box()
    assert page.evaluate('''([x,y]) => !!document.elementFromPoint(x,y).closest('.tabbar')''',
        [nav['x'] + nav['width']/2, nav['y'] + nav['height']/2]), 'disc covers navigation'
    page.evaluate('''() => {
        const layer=document.createElement('div'); layer.className='sheet-layer'; layer.id='test-sheet';
        layer.style.background='white'; document.body.append(layer);
    }''')
    assert page.evaluate("document.elementFromPoint(200,400).id === 'test-sheet'"), 'disc covers book details'
    page.evaluate("document.querySelector('#layer-test').remove(); document.querySelector('#test-sheet').remove()")
    page.evaluate('''async () => {
        const {addToShelf} = await import('/src/lib/shelf.js');
        const {txtToEpub} = await import('/src/reader/txt.js');
        const {default: JSZip} = await import('/node_modules/.vite/deps/jszip.js');
        const text='第一章 封面\\n封面\\n第二章 正文\\n'+('这是可连续翻页的正文。'.repeat(900))+'\\n第三章 结尾\\n结束';
        const zip=await JSZip.loadAsync(await txtToEpub(new Blob([text]),'iOS 回归书'));
        zip.file('c0.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>封面</title></head><body><svg xmlns="http://www.w3.org/2000/svg" width="300" height="500"><rect width="300" height="500" fill="#947137"/></svg></body></html>');
        await addToShelf({id:'ios-test',title:'iOS 回归书',ext:'epub'},new Blob([await zip.generateAsync({type:'arraybuffer'})]));
        location.hash='/read/ios-test';
    }''')
    page.wait_for_selector('.rd-content.is-ready')
    expect(page.locator('.rd-ambient-top')).to_have_text('第一章 封面')
    assert page.locator('iframe').get_attribute('sandbox') == 'allow-same-origin'
    page.touchscreen.tap(350, 400)
    expect(page.locator('.rd-ambient-top')).to_have_text('第二章 正文')
    def swipe(direction):
        page.locator('.rd-touch-surface').evaluate('''(el, direction) => {
            const start = direction > 0 ? 320 : 80, end = direction > 0 ? 80 : 320;
            for(const [type,x,t] of [['touchstart',start,0],['touchmove',(start+end)/2,60],['touchend',end,120]]) {
                const e=new Event(type,{bubbles:true}); const point={clientX:x,clientY:400};
                Object.defineProperties(e,{touches:{value:type==='touchend'?[]:[point]},changedTouches:{value:[point]},timeStamp:{value:1000+t}});
                el.dispatchEvent(e);
            }
        }''', direction)
    page_number = page.locator('.rd-ambient-bottom > span').first
    before = page_number.inner_text()
    swipe(1)
    expect(page_number).not_to_have_text(before)
    swipe(-1)
    expect(page_number).to_have_text(before)
    swipe(-1)
    expect(page.locator('.rd-ambient-top')).to_have_text('第一章 封面')
    swipe(1)
    expect(page.locator('.rd-ambient-top')).to_have_text('第二章 正文')
    page.touchscreen.tap(200,400)
    expect(page.locator('.reader2')).to_have_class(__import__('re').compile('.*is-open.*'))
    page.get_by_role('tab',name='目录',exact=True).click()
    page.get_by_role('button',name='第三章 结尾',exact=True).click()
    expect(page.locator('.rd-ambient-top')).to_have_text('第三章 结尾')
    page.touchscreen.tap(200,400)
    expect(page.get_by_role('button',name='打开阅读菜单')).to_be_visible()
    page.wait_for_timeout(600)
    page.screenshot(path=str(out/'reader-portrait.png'))
    page.set_viewport_size({'width':874,'height':402})
    page.wait_for_timeout(600)
    assert page.locator('.rd-content').bounding_box()['height'] > 100
    page.screenshot(path=str(out/'reader-landscape.png'))
    page.set_viewport_size({'width':402,'height':874})
    page.evaluate("import('/src/lib/prefs.js').then(m=>m.setPrefs({readerMode:'scrolled'}))")
    page.wait_for_selector('.mode-scrolled .rd-content.is-ready')
    page.get_by_role('button',name='打开阅读菜单').click()
    expect(page.get_by_role('button',name='退出阅读')).to_be_visible()
    page.get_by_role('button',name='退出阅读').click()
    # Common iPhone sizes and landscape: every primary screen stays within the viewport.
    for width,height in [(375,812),(390,844),(402,874),(430,932),(874,402)]:
        page.set_viewport_size({'width':width,'height':height})
        page.evaluate('(landscape)=>{document.documentElement.style.setProperty("--native-safe-top",landscape?"0px":"62px");document.documentElement.style.setProperty("--native-safe-bottom",landscape?"21px":"34px")}',width>height)
        for route in ['/', '/explore', '/search', '/shelf', '/plugins', '/rss']:
            page.evaluate('(route)=>location.hash=route',route)
            page.wait_for_timeout(400)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (width,route,'horizontal overflow')
            expect(page.locator('.tabbar')).to_be_visible()
            bounds=page.locator('.tabbar').bounding_box()
            assert bounds['x'] >= 0 and bounds['x']+bounds['width'] <= width+1
            assert bounds['y'] >= 0 and bounds['y']+bounds['height'] <= height+1
            if width == 402:
                page.screenshot(path=str(out/('screen-'+(route.strip('/') or 'home')+'.png')))
        page.screenshot(path=str(out/f'layout-{width}.png'))
    page.evaluate("location.hash='/'")
    page.wait_for_timeout(800)
    assert page.locator('.page-river canvas.is-live').count() == 0
    assert page.locator('.route.is-kept[data-warming]').count() == 0
    assert page.locator('.tabbar').evaluate("e=>getComputedStyle(e).backdropFilter") == 'none'
    page.evaluate('''async () => {
        const original=window.visualViewport;
        const mock=new EventTarget(); mock.height=200; mock.offsetTop=20;
        Object.defineProperty(window,'visualViewport',{value:mock,configurable:true});
        const {setupIOSViewport}=await import('/src/lib/ios-viewport.js');
        window.stopKeyboardTest=()=>{stop();Object.defineProperty(window,'visualViewport',{value:original,configurable:true});window.dispatchEvent(new Event('resize'));};
        const stop=setupIOSViewport();
    }''')
    expect(page.locator('html')).to_have_class(__import__('re').compile('.*keyboard-open.*'))
    expect(page.locator('.tabbar')).to_be_hidden()
    page.evaluate('window.stopKeyboardTest()')
    assert not errors, errors
    print('PASS: sandbox, cover/chapter turns, forward/back swipes, menu, TOC, landscape, scroll-mode exit, stacking; 30 route/viewport combinations; iOS rendering profile')
    browser.close()
