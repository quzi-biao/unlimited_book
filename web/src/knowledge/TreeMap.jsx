import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { treeLayout } from './forestLayout.js';
import { ForestDrawing } from './ForestDrawing.jsx';
import './forest.css';

export { treeLayout } from './forestLayout.js';

/** 一位读者一棵树，各话题沿真实探索关系分枝，保留原有画布操作。 */
export function TreeMap({nodes,connections=[],selected,onSelect}) {
  const layout=useMemo(()=>treeLayout(nodes),[nodes]);
  const [zoom,setZoom]=useState(1),[size,setSize]=useState({width:0,height:0});
  const scroll=useRef(null),drag=useRef(null),anchor=useRef(null),initialized=useRef(null);
  const scale=Math.max(.8,Math.min(1,size.height/layout.height || 1))*zoom;
  const rootKeys=layout.branches.map(branch=>branch.key).join('|');

  useLayoutEffect(()=>{
    const element=scroll.current;
    setSize({width:element.clientWidth,height:element.clientHeight});
    const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));
    observer.observe(element);return()=>observer.disconnect();
  },[]);

  useLayoutEffect(()=>{
    const element=scroll.current;
    if(!size.width || !layout.branches.length)return;
    if(anchor.current){
      element.scrollLeft=anchor.current.x*scale-element.clientWidth/2;
      element.scrollTop=anchor.current.y*scale-element.clientHeight/2;
      anchor.current=null;
    }else if(initialized.current!==rootKeys){
      const active=layout.nodes.find(node=>node.assetKey===selected),focus=active||layout.root;
      element.scrollLeft=Math.max(0,focus.x*scale-element.clientWidth/2);
      element.scrollTop=active?Math.max(0,focus.y*scale-element.clientHeight*.5):element.scrollHeight-element.clientHeight;
      initialized.current=rootKeys;
    }
  },[scale,rootKeys,size.width,layout,selected]);

  /** 缩放保留正在查看的位置；适合画布则完整显示个人知识树。 */
  function changeZoom(next,fit=false) {
    const element=scroll.current;
    const margin=Math.max(0,(element.clientWidth-layout.width*scale)/2);
    anchor.current=fit?{x:layout.width/2,y:layout.height/2}:{x:(element.scrollLeft+element.clientWidth/2-margin)/scale,y:(element.scrollTop+element.clientHeight/2)/scale};
    const value=fit?Math.max(.0001,Math.min(2.5,next)):Math.max(.12,Math.min(2.5,next));
    if(value===zoom){
      element.scrollLeft=anchor.current.x*scale-element.clientWidth/2;
      element.scrollTop=anchor.current.y*scale-element.clientHeight/2;
      anchor.current=null;
    }else setZoom(value);
  }

  /** 鼠标可拖动画布；触摸设备使用原生滚动，节点点击不触发拖动。 */
  function startDrag(event) {
    if(event.pointerType!=='mouse'||event.button!==0||event.target.closest('.tree-node'))return;
    const element=scroll.current;
    drag.current={x:event.clientX,y:event.clientY,left:element.scrollLeft,top:element.scrollTop};
    element.setPointerCapture(event.pointerId);element.classList.add('dragging');
  }

  /** 拖动平移不会改变节点的实际父子关系。 */
  function moveDrag(event) {
    if(!drag.current)return;
    scroll.current.scrollLeft=drag.current.left+drag.current.x-event.clientX;
    scroll.current.scrollTop=drag.current.top+drag.current.y-event.clientY;
  }

  /** 释放鼠标或系统取消手势时恢复正常画布。 */
  function stopDrag(event) {
    drag.current=null;scroll.current.classList.remove('dragging');
    if(scroll.current.hasPointerCapture(event.pointerId))scroll.current.releasePointerCapture(event.pointerId);
  }

  return <section className="knowledge-map forest-map" aria-label="知识树">
    <div className="map-legend forest-legend"><span className="forest-legend-item"><i className="lit-dot"/>已探索</span><span className="forest-legend-item"><i className="dark-dot"/>等待探索</span>
      <div className="forest-zoom"><button aria-label="缩小知识树" onClick={()=>changeZoom(zoom-.15)}>−</button>
        <button aria-label="放大知识树" onClick={()=>changeZoom(zoom+.15)}>＋</button>
        <button onClick={()=>changeZoom(Math.min(size.width/layout.width,size.height/layout.height)/(scale/zoom),true)}>适合画布</button>
        <button onClick={()=>changeZoom(1)}>复位</button></div>
    </div>
    <div className="map-scroll forest-scroll" ref={scroll} tabIndex="0" aria-label="个人知识树画布，可滚动查看话题分枝"
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
      {layout.branches.length?<svg width={layout.width*scale} height={layout.height*scale} viewBox={`0 0 ${layout.width} ${layout.height}`} className="forest-svg">
        <ForestDrawing layout={layout} connections={connections} selected={selected} onSelect={onSelect}/>
      </svg>:<p className="empty">你的知识树等待长出第一枝。可以选择已发布的探索内容，或在无限模式下探索感兴趣的话题。</p>}
    </div>
    {!!nodes.length&&<div className="forest-hint"><span>所有话题，共同长成你的知识树</span><span>拖动或滑动查看分枝</span></div>}
  </section>;
}
