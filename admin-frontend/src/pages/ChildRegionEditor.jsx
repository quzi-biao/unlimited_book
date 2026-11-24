import { useRef, useState } from 'react';
import { App, Button, Input, Modal, Select, Space, Tooltip } from 'antd';
import { DeleteOutlined, RobotOutlined } from '@ant-design/icons';
import styles from './KnowledgePage.module.css';

/** 为已保存区域和当前编辑中新建的区域提供稳定键。 */
function regionKey(region) {
  return region.localId || region.childNodeId;
}

/** 将框在原图比例坐标内移动或从右下角调整大小。 */
function transformRegion(region, mode, start, end) {
  const manualRegion = { ...region, source: 'manual' };
  delete manualRegion.confidence;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (mode === 'move') return {
    ...manualRegion,
    x: Math.max(0, Math.min(1 - region.w, region.x + dx)),
    y: Math.max(0, Math.min(1 - region.h, region.y + dy)),
  };
  return {
    ...manualRegion,
    w: Math.max(0.01, Math.min(1 - region.x, region.w + dx)),
    h: Math.max(0.01, Math.min(1 - region.y, region.h + dy)),
  };
}

/** AI 识别手绘区域；管理员可修改目标与名称，并调整区域后保存。 */
export default function ChildRegionEditor({ node, children, busy, onSave, onIdentify, onCancel }) {
  const { message } = App.useApp();
  const [regions, setRegions] = useState(() => Array.isArray(node.childRegions)
    ? node.childRegions.map(region => ({ ...region, localId: `saved:${region.childNodeId}` }))
    : []);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [selectedRegionKey, setSelectedRegionKey] = useState(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const byId = new Map(children.map(child => [child.id, child]));
  const selectedRegion = regions.find(region => regionKey(region) === selectedRegionKey);
  const unresolved = regions.some(region => !region.childNodeId);

  /** 将鼠标或触控坐标换算为原图的归一化位置。 */
  function point(event) {
    const rect = imageRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  /** 开始画新框，或抓取已有框进行移动和缩放。 */
  function beginPointer(event) {
    if (!imageRef.current?.naturalWidth || event.button !== 0 || identifying || saving || busy) return;
    const target = event.target;
    const regionTarget = target.closest('[data-region-key]');
    const key = regionTarget?.dataset.regionKey;
    const region = key && regions.find(item => regionKey(item) === key);
    if (regionTarget && !region) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = point(event);
    if (region) {
      setSelectedRegionKey(key);
      dragRef.current = { mode: target.closest('[data-region-resize]') ? 'resize' : 'move', key, start, region };
      return;
    }
    dragRef.current = { mode: 'draw', start };
    setDraft({ x: start.x, y: start.y, w: 0, h: 0 });
  }

  /** 更新临时框，或实时变换已选区域。 */
  function updateDraft(event) {
    if (!dragRef.current) return;
    const drag = dragRef.current;
    const end = point(event);
    if (drag.mode === 'draw') {
      setDraft({ x: Math.min(drag.start.x, end.x), y: Math.min(drag.start.y, end.y), w: Math.abs(drag.start.x - end.x), h: Math.abs(drag.start.y - end.y) });
      return;
    }
    const next = transformRegion(drag.region, drag.mode, drag.start, end);
    setRegions(current => current.map(region => regionKey(region) === drag.key ? next : region));
  }

  /** 对新画的区域执行一次视觉识别；无法确认时保留人工指定入口。 */
  async function identify(region) {
    const key = regionKey(region);
    setIdentifying(true);
    setRegions(current => current.map(item => regionKey(item) === key ? { ...item, status: 'identifying' } : item));
    try {
      const result = await onIdentify({ x: region.x, y: region.y, w: region.w, h: region.h });
      const child = byId.get(result.childNodeId);
      const duplicate = child && regions.some(item => regionKey(item) !== key && item.childNodeId === child.id);
      const defaultLabel = byId.get(region.childNodeId)?.label;
      setRegions(current => current.map(item => regionKey(item) !== key ? item : {
        ...item,
        ...(child && !duplicate
          ? { childNodeId: child.id, label: !item.label || item.label === defaultLabel ? child.label : item.label, status: 'identified', suggestedChildNodeId: undefined }
          : { childNodeId: null, status: 'unrecognized', suggestedChildNodeId: child?.id || region.childNodeId }),
        confidence: result.confidence,
      }));
      message.info(child && !duplicate ? `已识别为“${child.label}”` : 'AI 未能确定对应节点，请手动选择');
    } catch (error) {
      setRegions(current => current.map(item => regionKey(item) === key ? { ...item, status: 'unrecognized' } : item));
      message.error(error.message || 'AI 区域识别失败');
    } finally {
      setIdentifying(false);
    }
  }

  /** 完成手绘框或手工调整。 */
  function finishDraw(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const end = point(event);
    dragRef.current = null;
    setDraft(null);
    if (drag.mode === 'draw') {
      const region = { localId: globalThis.crypto?.randomUUID?.() || `region-${Date.now()}`, x: Math.min(drag.start.x, end.x), y: Math.min(drag.start.y, end.y), w: Math.abs(drag.start.x - end.x), h: Math.abs(drag.start.y - end.y), status: 'pending' };
      if (region.w < 0.01 || region.h < 0.01) {
        message.info('框选范围太小');
        return;
      }
      setRegions(current => [...current, region]);
      setSelectedRegionKey(region.localId);
      return;
    }
    setRegions(current => current.map(region => regionKey(region) === drag.key ? transformRegion(drag.region, drag.mode, drag.start, end) : region));
  }

  /** 手工指定识别目标；同一子节点只能有一个跳转框。 */
  function assignTarget(region, childNodeId) {
    if (regions.some(item => item !== region && item.childNodeId === childNodeId)) {
      message.warning('这个子节点已经有标注框');
      return;
    }
    const child = byId.get(childNodeId);
    setRegions(current => current.map(item => item === region ? { ...item, childNodeId, label: child.label, status: 'manual', confidence: undefined } : item));
  }

  /** 保存所有子节点热点及可选的自定义显示名称。 */
  async function save() {
    if (unresolved) {
      message.warning('请先为未识别的框指定子节点，或移除该框');
      return;
    }
    setSaving(true);
    try { await onSave(regions.map(({ childNodeId, label, x, y, w, h }) => ({ childNodeId, label, x, y, w, h }))); }
    finally { setSaving(false); }
  }

  return <Modal title={`标注子节点：${node.label}`} open width={900}
    onCancel={() => { if (!saving && !busy && !identifying) onCancel(); }} onOk={save}
    okText="保存标注" confirmLoading={saving || busy} okButtonProps={{ disabled: busy || identifying || unresolved }} cancelButtonProps={{ disabled: saving || busy || identifying }}
    style={{ top: 24 }} styles={{ body: { maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' } }}>
    <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
      <span>{identifying ? 'AI 正在识别当前区域' : selectedRegion?.status === 'pending' ? '区域已框选，确认后开始识别' : '框选区域后由 AI 识别对应子节点'}</span>
      <span>{regions.filter(region => region.childNodeId).length}/{children.length} 个子节点已有区域</span>
    </Space>
    <Tooltip title="在空白处拖动可新增区域；点击已有框后可拖动或调整右下角大小">
      <div className={styles.regionStage} onPointerDown={beginPointer} onPointerMove={updateDraft} onPointerUp={finishDraw} onPointerCancel={() => { dragRef.current = null; setDraft(null); }}>
        <img ref={imageRef} src={node.asset.imageUrl} alt={node.label} draggable="false"/>
        {regions.map(region => {
          const key = regionKey(region);
          const pending = !region.childNodeId;
          const label = region.label || byId.get(region.childNodeId)?.label || (region.status === 'identifying' ? '识别中…' : region.status === 'pending' ? '待确认识别' : '待指定节点');
          return <div key={key} data-region-key={key} className={`${styles.regionBox} ${pending ? styles.regionPending : ''} ${key === selectedRegionKey ? styles.regionSelected : ''}`} style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` }}>
            <span className={styles.regionBoxLabel}>{label}</span>
            {region.confidence !== undefined && region.childNodeId && <span className={styles.regionAiBadge}>AI</span>}
            <span data-region-resize className={styles.regionResizeHandle}/>
          </div>;
        })}
        {draft && <div className={`${styles.regionBox} ${styles.regionDraft}`} style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }} />}
      </div>
    </Tooltip>
    {selectedRegion && <Space wrap className={styles.regionInspector}>
      <Select aria-label="标注框跳转节点" value={selectedRegion.childNodeId || undefined} placeholder={selectedRegion.suggestedChildNodeId ? `AI 候选：${byId.get(selectedRegion.suggestedChildNodeId)?.label}` : '选择跳转子节点'} style={{ width: 260 }} disabled={identifying} onChange={value => assignTarget(selectedRegion, value)} options={children.map(child => ({ value: child.id, label: child.label, disabled: regions.some(item => regionKey(item) !== selectedRegionKey && item.childNodeId === child.id) }))}/>
      <Input aria-label="标注框名称" value={selectedRegion.label || ''} onChange={event => setRegions(current => current.map(region => regionKey(region) === selectedRegionKey ? { ...region, label: event.target.value } : region))} placeholder="显示名称（默认使用节点名称）" maxLength={100} disabled={identifying} style={{ width: 260 }}/>
      <Button type="primary" icon={<RobotOutlined />} loading={identifying} disabled={saving || busy} onClick={() => identify(selectedRegion)}>{selectedRegion.status === 'pending' ? '确认并识别' : '重新识别'}</Button>
      <Button danger icon={<DeleteOutlined />} aria-label="删除此标注框" onClick={() => setRegions(current => current.filter(region => regionKey(region) !== selectedRegionKey))}>移除框</Button>
    </Space>}
    <Space wrap className={styles.regionList}>
      {children.map(child => {
        const region = regions.find(item => item.childNodeId === child.id);
        const status = region ? region.confidence !== undefined ? `AI 建议 ${Math.round(region.confidence * 100)}%` : '已标注' : '未标注';
        return <Button key={child.id} type="text" size="small" onClick={() => region && setSelectedRegionKey(regionKey(region))}>{child.label} · {status}</Button>;
      })}
    </Space>
  </Modal>;
}
