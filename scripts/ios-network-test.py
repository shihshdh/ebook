"""Deterministic WebKit regression for cover retries and Lanzou touch links.
Run against Vite at port 5178. Remote responses are fixtures, not live downloads.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.webkit.launch()
    page = browser.new_page(is_mobile=True, has_touch=True)
    page.route('**/cover-test', lambda r: r.fulfill(content_type='text/html', body='<html><body></body></html>'))
    calls = []
    def bgm(route):
        calls.append(1)
        route.fulfill(status=503 if len(calls) == 1 else 200,
            headers={'access-control-allow-origin':'*'}, content_type='application/json',
            body='{}' if len(calls) == 1 else '{"data":[{"name":"Retry Book","platform":"小说","images":{"large":"https://example.org/cover.jpg"}}]}')
    page.route('https://api.bgm.tv/**', bgm)
    page.goto('http://127.0.0.1:5178/cover-test')
    result = page.evaluate('''async () => {
      const {idbSet}=await import('/src/lib/idb.js');
      await idbSet('kv','bgm:retrybook',{url:null,at:Date.now()});
      const {bangumiCover,sourceCoverUrls}=await import('/src/lib/covers.js');
      const first=await bangumiCover({title:'Retry Book'});
      const second=await bangumiCover({title:'Retry Book'});
      return {first,second,urls:sourceCoverUrls('http://img.wenku8.com/test.jpg')};
    }''')
    assert len(calls) == 2, 'cached negative/network error prevented retry'
    assert result['second'] == 'https://example.org/cover.jpg', result
    assert 'http://img.wenku8.com/test.jpg' in result['urls']
    assert 'http%3A%2F%2F' in result['urls'][0], 'proxy lost original HTTP scheme'
    page.route('https://covers.test/**', lambda r: r.fulfill(headers={'access-control-allow-origin':'*'}, content_type='text/html', body='''
      <a class="book" href="/wrong"><b>Pick Book</b><i>Wrong Author</i><img src="/wrong.jpg"></a>
      <a class="book" href="/right"><b>Pick Book</b><i>Right Author</i><img src="/right.jpg"></a>'''))
    cover = page.evaluate('''async () => {
      const {idbSet}=await import('/src/lib/idb.js');
      await idbSet('kv','legado:defaults:1',2);
      await idbSet('kv','legado:sources',[{id:'fixture',enabled:true,source:{bookSourceName:'测试书源',bookSourceUrl:'https://covers.test',searchUrl:'/search?q={{key}}',ruleSearch:{bookList:'.book',name:'b@text',author:'i@text',bookUrl:'href',coverUrl:'img@src'}}}]);
      const {pickCover}=await import('/src/lib/covers.js');
      return await pickCover({title:'Pick Book',author:'Right Author'});
    }''')
    assert cover == 'https://covers.test/right.jpg', 'wrong author cover selected: '+str(cover)
    # Execute the exact WKUserScript embedded in the app, on a mobile page that
    # assigns the actual download link only from its desktop mouse handler.
    swift = Path('ios/App/App/EbookNative.swift').read_text(encoding='utf-8')
    script = swift.split('let sameWindow = """',1)[1].split('"""',1)[0].replace('\\\\','\\')
    context = browser.new_context(is_mobile=True, has_touch=True)
    context.add_init_script(script)
    fixture = '<a id="submit" href="##" target="_blank">Download</a><script>submit.onmousedown=function(){this.href="/book.epub"};</script>'
    context.route('https://test.lanzov.com/**', lambda r: r.fulfill(content_type='text/html',body=fixture))
    mobile = context.new_page()
    mobile.goto('https://test.lanzov.com/download')
    # Synthetic click exercises the missing-mousedown path used by accessibility.
    mobile.evaluate("document.querySelector('a').click()")
    mobile.wait_for_url('https://test.lanzov.com/book.epub')
    assert len(context.pages) == 1, 'download opened an unhandled popup'
    context.close()
    browser.close()
    print('PASS: negative-cache recovery, HTTP 503 retry, original HTTP cover URL, Lanzou click without mouse/focus and same-window navigation')
