// 切页不再销毁页面：去过的标签页留在后台（content-visibility: hidden，排版和渲染状态都留着），切回来几乎不花时间。
// 留在后台的页面用这个知道自己现在是不是前台的那一页：比如书架的「管理」模式切走时收起来，别让它占着返回键。
import { createContext, useContext } from 'react';

export const PageActiveContext = createContext(true);
/** 当前页面是否在前台（不在后台留着的那些里） */
export const usePageActive = () => useContext(PageActiveContext);
