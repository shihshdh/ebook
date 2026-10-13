"""Touch feedback, interrupted navigation and glass rim checks in WebKit."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

out=Path('release/ios-interaction');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.webkit.launch()
    page=browser.new_page(viewport={'width':402,'height':874},is_mobile=True,has_touch=True,
        user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1')
    page.add_init_script("sessionStorage.setItem('librarium.splash','1')")
    page.goto('http://127.0.0.1:5178')
    page.wait_for_selector('.tabbar-item')
    result=page.evaluate('''() => {
      const button=document.querySelector('.tabbar-item');
      const send=(type,x=10,y=10)=>button.dispatchEvent(new PointerEvent(type,{pointerType:'touch',pointerId:1,isPrimary:true,clientX:x,clientY:y,bubbles:true}));
      send('pointerdown');const immediate=button.hasAttribute('data-touch-down');
      send('pointermove',10,30);const cancelled=!button.hasAttribute('data-touch-down');
      send('pointerup');const noReplay=!button.hasAttribute('data-touch-down');
      send('pointerdown');send('pointercancel');const cancel=!button.hasAttribute('data-touch-down');
      const disabled=document.createElement('button');disabled.disabled=true;document.body.append(disabled);
      disabled.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',isPrimary:true,bubbles:true}));
      const excluded=!disabled.hasAttribute('data-touch-down');disabled.remove();
      return {immediate,cancelled,noReplay,cancel,excluded};
    }''')
    assert all(result.values()),result
    for label in ['探索','书架','插件','搜索','首页']:
        page.locator('.tabbar').get_by_text(label,exact=True).tap()
    page.wait_for_timeout(300)
    geometry=page.evaluate('''() => {
      const a=document.querySelector('.tabbar-item.active').getBoundingClientRect();
      const b=document.querySelector('.tabbar .liquid-thumb').getBoundingClientRect();
      const rim=getComputedStyle(document.querySelector('.tabbar'),'::after');
      return {delta:Math.abs(a.x-b.x)+Math.abs(a.width-b.width),rim:rim.display,mask:rim.webkitMaskImage,events:rim.pointerEvents};
    }''')
    assert geometry['delta']<2,geometry
    assert geometry['rim']!='none' and geometry['mask']!='none' and geometry['events']=='none',geometry
    for theme in ['light','dark']:
        page.evaluate("theme=>import('/src/lib/theme.js').then(m=>m.setTheme(theme))",theme)
        page.wait_for_timeout(600)
        page.screenshot(path=str(out/(theme+'.png')))
    page.emulate_media(reduced_motion='reduce')
    assert page.evaluate('''() => {
      const b=document.querySelector('.tabbar-item');b.setAttribute('data-touch-down','');
      const scale=getComputedStyle(b).scale;b.removeAttribute('data-touch-down');return scale;
    }''') in ['none','1']
    browser.close()
    print('PASS: immediate touch, scroll/cancel, no replay, disabled controls, rapid navigation, glass rim, reduced motion')
