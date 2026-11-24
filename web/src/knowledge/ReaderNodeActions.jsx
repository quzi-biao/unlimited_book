import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../components/common/Icons.jsx';
import styles from './ReaderNodeActions.module.css';

/** AI 解读旁的更多菜单，每项直接打开对应任务。 */
export function ReaderNodeActions({node,onOpen,onPrint,onExpand}) {
  const [open,setOpen]=useState(false),menuId=useId();
  const container=useRef(null),trigger=useRef(null),menu=useRef(null);

  useEffect(()=>{
    if(!open)return;
    /** 点击其他位置时收起页面菜单，不拦截原来的阅读操作。 */
    function outside(event){if(!container.current?.contains(event.target))setOpen(false);}
    /** Esc 收起菜单并把焦点交还入口。 */
    function escape(event){if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus();}}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    menu.current?.querySelector('button')?.focus();
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);

  /** 每一项直接到对应功能，不经过综合详情页。 */
  function choose(name){close();onOpen(name);}

  /** 收起菜单后让焦点留在可见入口。 */
  function close(){setOpen(false);trigger.current?.focus();}

  /** 更多菜单展开时收起探索队列，避免浮层重叠。 */
  function expand(){onExpand?.();setOpen(true);}

  /** 菜单支持方向键切换和 Tab 离开。 */
  function move(event){
    if(event.key==='Tab'){close();return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();const items=[...menu.current.querySelectorAll('button')],index=items.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    items[next]?.focus();
  }

  return <div className={styles.menuContainer} ref={container}>
      <button type="button" className={styles.button} ref={trigger} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}
        onClick={()=>open?close():expand()} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();expand();}}}>
        更多 <Icon name="chevronDown" size={12}/></button>
      {open&&<div className={styles.menu} role="menu" aria-label="更多操作" id={menuId} ref={menu} onKeyDown={move}>
        <button role="menuitem" onClick={()=>choose('notes')}>笔记</button>
        <button role="menuitem" onClick={()=>choose('explore')}>深入探索</button>
        <button role="menuitem" onClick={()=>choose('node-learning')}>学习记录</button>
        <button role="menuitem" onClick={()=>{close();onPrint(node);}}>导出这一枝</button>
        <button role="menuitem" onClick={()=>choose('correction')}>我想核查</button>
        {node.deletable&&<button role="menuitem" className={styles.danger} onClick={()=>choose('delete')}>删除节点</button>}
      </div>}
    </div>;
}
