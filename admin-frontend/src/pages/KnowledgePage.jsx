import { useCallback, useEffect, useRef, useState } from 'react';
import { App, Button, Card, Dropdown, Empty, Form, Input, Select, Switch, Space, Tabs, Tag, Modal, InputNumber, Progress, Tree, Tooltip } from 'antd';
import { BorderOutlined, CheckOutlined, DeleteOutlined, EditOutlined, MoreOutlined, PictureOutlined, PlusOutlined, ReloadOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons';
import styles from './KnowledgePage.module.css';
import KnowledgeContentEditor from './KnowledgeContentEditor.jsx';
import ChildRegionEditor from './ChildRegionEditor.jsx';
import NodeActivationControl from './NodeActivationControl.jsx';

/** 公共树编辑与用户扩展审核使用独立权限接口。 */
async function request(path = '', body, method = body === undefined ? 'GET' : 'POST') {
  const multipart = body instanceof FormData;
  const response = await fetch(`/api/admin/knowledge${path}`, { method, headers: { ...(!multipart ? { 'Content-Type': 'application/json' } : {}), Authorization:`Bearer ${localStorage.getItem('admin_token')}` }, ...(body === undefined ? {} : {body:multipart ? body : JSON.stringify(body)}) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || '操作失败'); return data;
}

function nodeStatus(node) {
  if (node.active === false) return '已停用';
  if (node.asset?.state !== 'ready') return '待生成';
  if (node.asset.reviewStatus === 'approved') return '已通过';
  if (node.asset.reviewStatus === 'rejected') return '未通过';
  return '待审核';
}

function outlineData(nodes, actions) {
  const byId = new Map(nodes.map(node => [node.id, {
    key: node.id,
    label: node.label,
    title: <span className={styles.outlineTitle}>
      <span className={styles.outlineLabel}>{node.label}</span>
      <span className={styles.outlineStatus}>{nodeStatus(node)}</span>
      {actions && <span className={styles.outlineActions}>
        <Tooltip title="添加子节点">
          <Button type="text" size="small" icon={<PlusOutlined />} aria-label={`在${node.label}下添加子节点`} disabled={actions.disabled} onClick={event => {event.stopPropagation();actions.add(node.id);}}/>
        </Tooltip>
        <Dropdown trigger={['click']} menu={{items:[
          {key:'edit',label:'修改节点',icon:<EditOutlined/>},
          {key:'content',label:'编辑图文',icon:<PictureOutlined/>},
          {key:'delete',label:'删除此节点及其下级节点',icon:<DeleteOutlined/>,danger:true},
        ],onClick:({key,domEvent})=>{domEvent.stopPropagation();if(key==='edit')actions.edit(node.id);if(key==='content')actions.content(node.id);if(key==='delete')actions.remove(node.id);}}}>
          <Button type="text" size="small" icon={<MoreOutlined />} aria-label={`${node.label}的更多操作`} disabled={actions.disabled} onClick={event=>event.stopPropagation()}/>
        </Dropdown>
      </span>}
    </span>,
    children: [],
  }]));
  const roots = [];
  nodes.forEach(node => {
    const entry = byId.get(node.id);
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(entry);
    else roots.push(entry);
  });
  return roots;
}

function filterOutline(nodes, query) {
  if (!query) return { nodes, expandedKeys: [] };
  const expandedKeys = [];
  function visit(node) {
    const children = node.children.map(visit).filter(Boolean);
    const matches = node.label.toLocaleLowerCase().includes(query);
    if (!matches && !children.length) return null;
    if (children.length) expandedKeys.push(node.key);
    return { ...node, children };
  }
  return { nodes: nodes.map(visit).filter(Boolean), expandedKeys };
}

function subtreeIds(nodes, nodeId) {
  const childrenByParent = new Map();
  nodes.forEach(node => {
    if (!node.parentId) return;
    const children = childrenByParent.get(node.parentId) || [];
    children.push(node.id);
    childrenByParent.set(node.parentId, children);
  });
  const ids = new Set([nodeId]);
  const pending = [nodeId];
  while (pending.length) {
    for (const childId of childrenByParent.get(pending.pop()) || []) {
      if (ids.has(childId)) continue;
      ids.add(childId);
      pending.push(childId);
    }
  }
  return ids;
}

/** 草稿、图文审核、发布三步明确分开；修改已发布树须先撤回。 */
export default function KnowledgePage() {
  const { message } = App.useApp();
  const [data,setData] = useState({trees:[],reviews:[],corrections:[],releases:[]});
  const [treeId,setTreeId] = useState(''); const [busy,setBusy] = useState(false);
  const [newTree,setNewTree] = useState(false); const [nodeForm] = Form.useForm(); const [treeForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [review,setReview] = useState(null); const [reviewNote,setReviewNote] = useState('');
  const [logs,setLogs] = useState(null);
  const [generating,setGenerating] = useState(false); const [generationProgress,setGenerationProgress] = useState(null);
  const [generationQueue,setGenerationQueue] = useState([]);
  const generationQueueRef = useRef([]); const generationWorkerRef = useRef(false); const activeGenerationRef = useRef(null);
  const generationBatchesRef = useRef(new Map());
  const [planTarget,setPlanTarget] = useState(null); const [planForm] = Form.useForm();
  const [selectedNodeId,setSelectedNodeId] = useState(''); const [nodeModal,setNodeModal] = useState(false);
  const [nodeParentId,setNodeParentId] = useState(''); const [editingNode,setEditingNode] = useState(null); const [deleteTarget,setDeleteTarget] = useState(null);
  const [deleteTreeTarget,setDeleteTreeTarget] = useState(null);
  const [contentTarget,setContentTarget] = useState(null);
  const [childRegionTarget,setChildRegionTarget] = useState(null);
  const [resetTarget,setResetTarget] = useState(null);
  const [nodeQuery,setNodeQuery] = useState(''); const [expandedByTree,setExpandedByTree] = useState({});
  const [compactTree,setCompactTree] = useState(() => window.matchMedia('(max-width: 820px)').matches);
  const tree = data.trees.find(t => t.id === treeId);
  const selectedNode = tree?.nodes.find(node => node.id === selectedNodeId) || tree?.nodes[0];
  const queuedForTree = tree ? generationQueue.filter(task => task.treeId === tree.id) : [];
  const nodeActions = tree?.status === 'draft' ? {
    disabled: busy || generating,
    add: openAddNode,
    edit: openEditNode,
    content: openContentEditor,
    remove: openDeleteNode,
  } : null;
  const deletedTargetIds = deleteTarget && tree ? subtreeIds(tree.nodes, deleteTarget.id) : new Set();
  const treeData = tree ? outlineData(tree.nodes, nodeActions) : [];
  const filteredOutline = filterOutline(treeData, nodeQuery.trim().toLocaleLowerCase());

  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)');
    const update = event => setCompactTree(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  /** 错误均展示；后台不根据过期本地状态静默发布。 */
  const load = useCallback(async () => {
    try { const next = await request(); setData(next); setTreeId(id => next.trees.some(item => item.id === id) ? id : next.trees[0]?.id || ''); }
    catch(error) {message.error(error.message);}
  }, [message]);
  useEffect(() => {
    let active = true;
    request().then(next => {
      if (!active) return;
      setData(next);
      setTreeId(id => next.trees.some(item => item.id === id) ? id : next.trees[0]?.id || '');
    }).catch(error => { if (active) message.error(error.message); });
    return () => { active = false; };
  }, [message]);
  /** 串行处理单节点队列，排在父节点后的子节点读取父节点最新内容。 */
  const drainGenerationQueue = useCallback(async () => {
    if (generationWorkerRef.current) return;
    generationWorkerRef.current = true;
    setGenerating(true);
    try {
      while (generationQueueRef.current.length) {
        const task = generationQueueRef.current.shift();
        activeGenerationRef.current = task;
        setGenerationQueue([...generationQueueRef.current]);
        const batch = generationBatchesRef.current.get(task.treeId) || { done: 0, total: 1 };
        generationBatchesRef.current.set(task.treeId, batch);
        setGenerationProgress({ treeId: task.treeId, nodeId: task.nodeId, done: batch.done, total: batch.total, current: task.label });
        try {
          await request(`/trees/${task.treeId}/nodes/${task.nodeId}/generate`, {}, 'POST');
          await load();
          message.success(`${task.label}图文已生成，请审核后发布`);
        } catch (error) {
          message.error(`${task.label}：${error.message}`);
          await load();
        } finally {
          batch.done += 1;
          setGenerationProgress({ treeId: task.treeId, nodeId: task.nodeId, done: batch.done, total: batch.total, current: task.label });
        }
        activeGenerationRef.current = null;
      }
    } finally {
      activeGenerationRef.current = null;
      generationWorkerRef.current = false;
      setGenerationProgress(null);
      setGenerating(false);
      generationBatchesRef.current.clear();
    }
  }, [load, message]);
  /** 成功操作后重新获取后端版本号。 */
  async function act(path,body,method,successText='已保存') {
    setBusy(true);
    try { const result = await request(path,body,method); await load(); message.success(successText); return result; }
    catch(error) {message.error(error.message); return null;} finally {setBusy(false);}
  }
  async function generateTreeContent(target) {
    const pending = target.nodes.filter(node => node.asset?.state !== 'ready');
    if (!pending.length) return;
    generationWorkerRef.current = true;
    setGenerating(true);
    let currentLabel = '节点';
    try {
      for (let index = 0; index < pending.length; index += 1) {
        const node = pending[index];
        currentLabel = node.label;
        activeGenerationRef.current = { treeId: target.id, nodeId: node.id, label: node.label };
        setGenerationProgress({ treeId: target.id, nodeId: node.id, done: index, total: pending.length, current: node.label });
        await request(`/trees/${target.id}/nodes/${node.id}/generate`, {}, 'POST');
        setGenerationProgress({ treeId: target.id, nodeId: node.id, done: index + 1, total: pending.length, current: node.label });
        await load();
      }
      message.success('图文已生成，请到待审核逐项审核后再发布');
    } catch (error) {
      message.error(`${currentLabel}：${error.message}`);
      await load();
    } finally {
      activeGenerationRef.current = null;
      generationWorkerRef.current = false;
      setGenerationProgress(null);
      setGenerating(false);
      if (generationQueueRef.current.length) void drainGenerationQueue();
    }
  }
  function generateOneNode(node) {
    const task = { treeId: tree.id, nodeId: node.id, label: node.label };
    const active = activeGenerationRef.current?.treeId === task.treeId && activeGenerationRef.current?.nodeId === task.nodeId;
    const queued = generationQueueRef.current.some(item => item.treeId === task.treeId && item.nodeId === task.nodeId);
    if (active || queued) return;
    generationQueueRef.current = [...generationQueueRef.current, task];
    const batch = generationBatchesRef.current.get(task.treeId) || { done: 0, total: 0 };
    batch.total += 1;
    generationBatchesRef.current.set(task.treeId, batch);
    setGenerationQueue([...generationQueueRef.current]);
    if (activeGenerationRef.current?.treeId === task.treeId) {
      setGenerationProgress(progress => progress?.treeId === task.treeId ? { ...progress, total: batch.total } : progress);
    }
    if (generationWorkerRef.current) message.info(`${node.label}已排入生成队列`);
    else void drainGenerationQueue();
  }
  function openAddNode(parentId = '') {
    nodeForm.resetFields();
    setNodeParentId(parentId);
    setNodeModal(true);
  }
  function openEditNode(nodeId) {
    const target = tree?.nodes.find(node => node.id === nodeId);
    if (!target) return;
    setEditingNode(target);
    editForm.setFieldsValue({ label: target.label, domain: target.domain, relation: target.relation });
  }
  /** 记录打开时的内容和版本，避免旧表单覆盖其他编辑者的修改。 */
  function openContentEditor(nodeId) {
    const target = tree?.nodes.find(node => node.id === nodeId);
    if (target) setContentTarget({ node: target, treeId: tree.id, revision: tree.revision });
  }
  function openChildRegionEditor(nodeId) {
    const target = tree?.nodes.find(node => node.id === nodeId);
    const children = tree?.nodes.filter(node => node.parentId === nodeId).sort((left, right) => left.order - right.order) || [];
    if (target && children.length) setChildRegionTarget({ node: target, children, treeId: tree.id, revision: tree.revision });
  }
  /** 保存打开时的树与内容版本，防止切换树后误重置另一个节点。 */
  function openResetNode(nodeId) {
    const target = tree?.nodes.find(node => node.id === nodeId);
    if (target) setResetTarget({ node: target, treeId: tree.id, revision: tree.revision });
  }
  /** 图文以独立版本保存，当前节点及其父子关系保持不变。 */
  async function saveNodeContent({ imageUrl, explanation, anchors }) {
    const target = contentTarget;
    const result = await act(`/trees/${target.treeId}/nodes/${target.node.id}`, {
      imageUrl, explanation, anchors, expectedAssetKey: target.node.assetKey, revision: target.revision,
    }, 'PATCH', '图文已保存，请审核后发布');
    if (result) {
      setSelectedNodeId(target.node.id);
      setContentTarget(null);
    }
  }
  async function saveChildRegions(childRegions) {
    const target = childRegionTarget;
    if (!target) return;
    const result = await act(`/trees/${target.treeId}/nodes/${target.node.id}/child-regions`, {
      childRegions, expectedAssetKey: target.node.assetKey, revision: target.revision,
    }, 'PATCH', '节点跳转框已保存');
    if (result) {
      setSelectedNodeId(target.node.id);
      setChildRegionTarget(null);
    }
  }
  /** AI 识别仅返回候选目标；确认保存后才成为阅读器跳转区域。 */
  async function identifyChildRegion(region) {
    const target = childRegionTarget;
    if (!target) throw new Error('当前标注目标已失效');
    return request(`/trees/${target.treeId}/nodes/${target.node.id}/child-regions/identify`, {
      region,
      expectedAssetKey: target.node.assetKey,
      revision: target.revision,
    });
  }
  /** 确认后创建待生成版本，保留旧资源供其他引用继续使用。 */
  async function confirmResetNode() {
    if (!resetTarget) return;
    const { node: target } = resetTarget;
    const result = await act(`/trees/${resetTarget.treeId}/nodes/${target.id}/reset`, {
      expectedAssetKey: target.assetKey, revision: resetTarget.revision,
    }, 'POST', '节点图文已重置，可重新生成');
    if (result) {
      setSelectedNodeId(target.id);
      setResetTarget(null);
    }
  }
  function openDeleteNode(nodeId) {
    const target = tree?.nodes.find(node => node.id === nodeId);
    if (target) setDeleteTarget(target);
  }
  async function createManualNode(values) {
    const parentId = nodeParentId || values.parentId || undefined;
    const result = await act(`/trees/${tree.id}/nodes`, { ...values, parentId }, 'POST', '节点已添加');
    if (result) {
      setSelectedNodeId(result.node.id);
      setNodeModal(false);
      if (parentId) {
        const ancestors = [];
        let parent = tree.nodes.find(node => node.id === parentId);
        while (parent) {
          ancestors.push(parent.id);
          parent = tree.nodes.find(node => node.id === parent.parentId);
        }
        setExpandedByTree(current => ({ ...current, [tree.id]: [...new Set([...(current[tree.id] || []), ...ancestors])] }));
      }
      setNodeParentId('');
      nodeForm.resetFields();
    }
  }
  async function updateNode(values) {
    const result = await act(`/trees/${tree.id}/nodes/${editingNode.id}`, values, 'PATCH', '节点已更新');
    if (result) {
      setSelectedNodeId(editingNode.id);
      setEditingNode(null);
      editForm.resetFields();
    }
  }
  async function confirmDeleteNode() {
    if (!deleteTarget) return;
    const removedId = deleteTarget.id;
    const removedIds = subtreeIds(tree.nodes, removedId);
    const parentId = deleteTarget.parentId;
    const fallback = tree.nodes.find(node => node.id === parentId && !removedIds.has(node.id)) || tree.nodes.find(node => !removedIds.has(node.id));
    const result = await act(`/trees/${tree.id}/nodes/${removedId}`, undefined, 'DELETE', '节点已删除');
    if (result) {
      if (removedIds.has(selectedNodeId)) setSelectedNodeId(fallback?.id || '');
      setDeleteTarget(null);
    }
  }
  async function confirmDeleteTree() {
    if (!deleteTreeTarget) return;
    const result = await act(`/trees/${deleteTreeTarget.id}`, { revision: deleteTreeTarget.revision }, 'DELETE', '整棵知识树已删除');
    if (result) {
      setSelectedNodeId('');
      setNodeQuery('');
      setDeleteTreeTarget(null);
    }
  }
  /** 切换节点公开状态；服务器会校验整棵树版本并隐藏其不可见后代。 */
  async function toggleNodeActive(node, active) {
    return act(`/trees/${tree.id}/nodes/${node.id}/active`, { active, revision: tree.revision }, 'PATCH', active ? '节点已启用' : '节点及其分支已停用');
  }
  async function createGeneratedTree() {
    try {
      const values = await treeForm.validateFields();
      const result = await act('/trees/generate', values, 'POST', '树结构已生成');
      if (result) { setTreeId(result.tree.id); setNewTree(false); treeForm.resetFields(); }
    } catch (error) {
      if (!error?.errorFields) message.error(error.message);
    }
  }
  async function planExistingTree() {
    try {
      const values = await planForm.validateFields();
      const result = await act(`/trees/${planTarget.id}/plan`, values, 'POST', '树结构已生成');
      if (result) { setTreeId(result.tree.id); setPlanTarget(null); planForm.resetFields(); }
    } catch (error) {
      if (!error?.errorFields) message.error(error.message);
    }
  }
  const trees = <div className={styles.treePage}>
    {data.trees.length > 0 && <div className={styles.treeToolbar}>
      <Select className={styles.treeSelect} value={treeId || undefined} onChange={value => {setTreeId(value);setSelectedNodeId('');setNodeQuery('');}} placeholder="选择公共知识树" options={data.trees.map(t => ({value:t.id,label:`${t.title} · ${t.status === 'published' ? '已发布' : '草稿'}`}))}/>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => {treeForm.resetFields();setNewTree(true);}}>新建知识树</Button>
    </div>}
    {tree ? <>
      <section className={styles.treeSummary}>
        <div className={styles.treeHeading}>
          <h3>{tree.title}</h3>
          <Space size={8}><Tag color={tree.status === 'published' ? 'green' : 'gold'}>{tree.status === 'published' ? '已发布' : '草稿'}</Tag><span className={styles.muted}>版本 {tree.revision}</span></Space>
          <div className={styles.treeMetadata}>{[tree.grade, tree.curriculum].filter(Boolean).join(' · ') || '未设置年级与教材范围'}<span>{tree.nodes.length} 个节点</span></div>
        </div>
        <Space wrap className={styles.treeActions}>
          {tree.status === 'draft' && !tree.nodes.length && <Button icon={<RobotOutlined />} disabled={busy || generating} onClick={() => {planForm.resetFields();setPlanTarget(tree);}}>AI规划树结构</Button>}
          {tree.status === 'draft' && tree.nodes.some(node => node.asset?.state !== 'ready') && <Button type="primary" icon={<PictureOutlined />} loading={generating} disabled={busy || generating} onClick={() => generateTreeContent(tree)}>生成缺失图文</Button>}
          <Button icon={tree.status === 'published' ? <PictureOutlined /> : <CheckOutlined />} loading={busy} disabled={generating || (tree.status === 'draft' && !tree.nodes.length)} onClick={() => act(`/trees/${tree.id}`,{status:tree.status === 'published' ? 'draft':'published',revision:tree.revision},'PATCH',tree.status === 'published' ? '已撤回为草稿' : '已发布，安全模式可使用')}>{tree.status === 'published' ? '撤回为草稿' : '校验并发布'}</Button>
          <Tooltip title={tree.status === 'published' ? '已发布的知识树请先撤回为草稿再删除' : ''}>
            <span><Button danger icon={<DeleteOutlined />} disabled={busy || generating || tree.status !== 'draft'} onClick={() => setDeleteTreeTarget({ id: tree.id, title: tree.title, revision: tree.revision, nodeCount: tree.nodes.length })}>删除整棵树</Button></span>
          </Tooltip>
        </Space>
      </section>
      {generationProgress?.treeId === tree.id && <Tooltip title={queuedForTree.length ? `等待生成：${queuedForTree.map(task => task.label).join('、')}` : null}><div className={styles.progressRow}><Progress percent={Math.round(generationProgress.done / generationProgress.total * 100)} format={() => `${generationProgress.done}/${generationProgress.total} · ${generationProgress.current}${queuedForTree.length ? ` · 下一项：${queuedForTree[0].label}${queuedForTree.length > 1 ? ` +${queuedForTree.length - 1}` : ''}` : ''}`}/></div></Tooltip>}
      {tree.nodes.length ? <div className={styles.treeWorkbench}>
        <section className={styles.outlinePanel}>
          <div className={styles.panelHeading}><div><strong>树结构</strong><span>{tree.nodes.length} 个节点</span></div></div>
          <Input className={styles.nodeSearch} allowClear prefix={<SearchOutlined />} value={nodeQuery} onChange={event => setNodeQuery(event.target.value)} placeholder="搜索节点" />
          {filteredOutline.nodes.length ? <Tree key={tree.id} className={styles.outlineTree} treeData={filteredOutline.nodes} selectedKeys={selectedNode ? [selectedNode.id] : []} expandedKeys={nodeQuery.trim() ? filteredOutline.expandedKeys : expandedByTree[tree.id] || []} onExpand={keys => setExpandedByTree(current => ({ ...current, [tree.id]: keys }))} onSelect={keys => {if(keys[0])setSelectedNodeId(keys[0]);}} showLine blockNode virtual height={compactTree ? 300 : 540}/> : <Empty className={styles.noMatches} description="没有匹配的节点"/>}
        </section>
        <section className={styles.detailPanel}>
          {selectedNode ? <>
            <div className={styles.detailHeading}>
              <div><h3>{selectedNode.label}</h3><Space size={8}><Tag>{selectedNode.domain}</Tag><Tag color={selectedNode.active === false ? 'default' : nodeStatus(selectedNode) === '已通过' ? 'green' : nodeStatus(selectedNode) === '未通过' ? 'red' : 'gold'}>{nodeStatus(selectedNode)}</Tag></Space></div>
              <Space wrap>
                <NodeActivationControl node={selectedNode} descendantCount={subtreeIds(tree.nodes, selectedNode.id).size - 1} disabled={busy || generating} busy={busy} onToggle={toggleNodeActive}/>
                {tree.status === 'draft' && <>
                  {selectedNode.asset?.state !== 'ready' && <Button icon={<PictureOutlined />} loading={generationProgress?.treeId === tree.id && generationProgress?.nodeId === selectedNode.id} disabled={busy || generationQueue.some(task => task.treeId === tree.id && task.nodeId === selectedNode.id) || (generationProgress?.treeId === tree.id && generationProgress?.nodeId === selectedNode.id)} onClick={() => generateOneNode(selectedNode)}>生成此节点图文</Button>}
                  {selectedNode.asset?.state === 'ready' && <Button icon={<ReloadOutlined />} disabled={busy || generating} onClick={() => openResetNode(selectedNode.id)}>重置图文</Button>}
                  {selectedNode.asset?.state === 'ready' && tree.nodes.some(node => node.parentId === selectedNode.id) && <Button icon={<BorderOutlined />} disabled={busy || generating} onClick={() => openChildRegionEditor(selectedNode.id)}>标注子节点</Button>}
                  <Button icon={<EditOutlined />} disabled={busy || generating} onClick={() => openContentEditor(selectedNode.id)}>编辑图文</Button>
                  <Button danger icon={<DeleteOutlined />} onClick={() => setDeleteTarget(selectedNode)} title={tree.nodes.some(node => node.parentId === selectedNode.id) ? '将同时删除所有下级节点' : undefined} disabled={busy || generating}>删除节点</Button>
                </>}
              </Space>
            </div>
            <div className={styles.nodeContext}>
              父节点：{tree.nodes.find(node => node.id === selectedNode.parentId)?.label || '根节点'}
              {selectedNode.parentId && tree.nodes.find(node => node.id === selectedNode.parentId)?.asset?.state !== 'ready' && <span> · 父节点图文尚未生成，本次会按当前节点单独生成</span>}
            </div>
            {selectedNode.asset?.imageUrl ? <img className={styles.nodeImage} src={selectedNode.asset.imageUrl} alt={selectedNode.label}/> : <div className={styles.imagePlaceholder}>图文生成后会显示在这里</div>}
            {selectedNode.asset?.explanations?.zh && <div className={styles.explanation}>{selectedNode.asset.explanations.zh}</div>}
            {Array.isArray(selectedNode.asset?.anchors) && selectedNode.asset.anchors.length > 0 && <div className={styles.anchors}><strong>可继续探索</strong>{selectedNode.asset.anchors.map(anchor => <span key={anchor}>{anchor}</span>)}</div>}
          </> : <Empty description="选择一个节点查看内容"/>}
        </section>
      </div> : <Empty className={styles.emptyTree} description="这棵树还没有节点"/>}
    </> : <Empty className={styles.emptyTree} description={data.trees.length ? '选择一棵知识树查看结构' : '还没有公共知识树'}>
      {!data.trees.length && <Button type="primary" icon={<PlusOutlined />} onClick={() => {treeForm.resetFields();setNewTree(true);}}>新建知识树</Button>}
    </Empty>}
  </div>;
  const reviews = <Space orientation="vertical" style={{width:'100%'}}>{data.reviews.map(asset => <Card key={asset.key} title={asset.title} extra={<Button onClick={async () => {try {setLogs((await request(`/assembly/${asset.key}`)).logs);} catch(e) {message.error(e.message);} }}>查看装配日志</Button>}>
    <img src={asset.imageUrl} alt={asset.title} style={{width:'min(100%,650px)'}}/><p style={{whiteSpace:'pre-wrap'}}>{asset.explanations?.[asset.language]}</p><p>资源标识：<code>{asset.key}</code></p>
    <Space><Button type="primary" onClick={() => {setReview({key:asset.key,status:'approved'});setReviewNote('');}}>审核通过</Button><Button danger onClick={() => {setReview({key:asset.key,status:'rejected'});setReviewNote('');}}>拒绝收录</Button></Space><p>通过后可将资源标识添加到任意草稿树，并单独发布。</p>
  </Card>)}</Space>;
  const corrections = <Space orientation="vertical" style={{width:'100%'}}>{data.corrections.map(c => <Card key={c.id} title="用户主动核查"><p>待核查：{c.claim}</p><p>理由／来源：{c.evidence}</p><Form onFinish={values => act(`/corrections/${c.id}`,values)}><Form.Item name="resolution" rules={[{required:true}]}><Input.TextArea rows={4} placeholder="给出核查结果、证据与不确定性；回复对用户可见"/></Form.Item><Button htmlType="submit">发布核查回复</Button></Form></Card>)}</Space>;
  const settings = <Space orientation="vertical" style={{width:'100%'}}><Card title="月度生成权益"><Form layout="vertical" onFinish={values => act('/entitlements',values)}><Form.Item name="username" label="读者账号" rules={[{required:true}]}><Input/></Form.Item><Form.Item name="allowance" label="本月总额度" rules={[{required:true}]}><InputNumber min={0} max={100000}/></Form.Item><Button htmlType="submit">设置本月权益</Button></Form><p>缓存命中与公共树探索不扣减；生成失败自动返还。</p></Card>
    <Card title="提示词版本"><Form layout="vertical" onFinish={values => act('/prompts',values)}><Form.Item name="version" label="版本" rules={[{required:true}]}><Input/></Form.Item><Form.Item name="base" label="L0 基座" rules={[{required:true}]}><Input.TextArea rows={4}/></Form.Item><Form.Item name="safety" label="S 安全补充" rules={[{required:true}]}><Input.TextArea rows={3}/></Form.Item><Button htmlType="submit">保存草稿</Button></Form>
      {data.releases.map(r => <p key={r.id}>{r.version} · {r.status} · 灰度 {r.rollout}% · {r.evals?.passed ? '评测通过':'待评测'} <Button loading={busy} onClick={() => act(`/prompts/${r.id}/evaluate`,{})}>运行黄金话题评测</Button> <Button disabled={!r.evals?.passed} onClick={() => act(`/prompts/${r.id}/activate`,{rollout:10})}>10% 灰度</Button> <Button disabled={!r.evals?.passed} onClick={() => act(`/prompts/${r.id}/activate`,{rollout:100})}>全量启用</Button> <Button onClick={() => act(`/prompts/${r.id}/activate`,{rollout:0})}>停用</Button></p>)}</Card></Space>;
  return <><h2>公共知识树与探索审核</h2><Tabs items={[{key:'trees',label:'知识树',children:trees},{key:'reviews',label:`待审核 (${data.reviews.length})`,children:reviews},{key:'corrections',label:'可见纠错',children:corrections},{key:'settings',label:'权益与提示词',children:settings}]}/>
    <Modal title="新建公共知识树" open={newTree} footer={null} onCancel={() => setNewTree(false)}><Form form={treeForm} layout="vertical" onFinish={async values => {const result = await act('/trees',values);if(result){setTreeId(result.tree.id);setNewTree(false);treeForm.resetFields();}}}><Form.Item name="title" label="名称" rules={[{required:true}]}><Input placeholder="例如：人教版高中物理·高三"/></Form.Item><Form.Item name="grade" label="年级"><Input placeholder="例如：高三"/></Form.Item><Form.Item name="curriculum" label="教材或范围"><Input placeholder="例如：人教版普通高中物理"/></Form.Item><Form.Item name="generationPrompt" label="生成要求"><Input.TextArea rows={3} placeholder="选填：指定主题和范围"/></Form.Item><Space><Button loading={busy} disabled={busy} onClick={createGeneratedTree}>AI 规划树结构</Button><Button htmlType="submit" disabled={busy}>只创建空草稿</Button></Space></Form></Modal>
    <Modal title={`AI规划树结构${planTarget ? `：${planTarget.title}` : ''}`} open={!!planTarget} footer={null} onCancel={() => setPlanTarget(null)}><Form form={planForm} layout="vertical"><Form.Item name="generationPrompt" label="生成要求"><Input.TextArea rows={4} placeholder="选填：指定主题、重点和范围"/></Form.Item><Button type="primary" loading={busy} disabled={busy} onClick={planExistingTree}>规划并填入当前空草稿</Button></Form></Modal>
    <Modal title={nodeParentId ? '添加子节点' : '添加节点'} open={nodeModal} footer={null} onCancel={() => {setNodeModal(false);setNodeParentId('');}}><Form form={nodeForm} layout="vertical" onFinish={createManualNode}>
      {nodeParentId ? <Form.Item label="父节点">{tree?.nodes.find(node => node.id === nodeParentId)?.label}</Form.Item> : <Form.Item name="parentId" label="父节点"><Select allowClear showSearch optionFilterProp="label" placeholder="留空表示根节点" options={tree?.nodes.map(node => ({value:node.id,label:node.label})) || []}/></Form.Item>}
      <Form.Item name="assetKey" label="复用已审核资源标识"><Input placeholder="不填则手工录入图文"/></Form.Item>
      <Form.Item name="title" label="节点标题"><Input maxLength={100}/></Form.Item>
      <Form.Item name="domain" label="领域"><Input placeholder="自然科学、数学、人文等"/></Form.Item>
      <Form.Item name="imageUrl" label="图片地址"><Input/></Form.Item>
      <Form.Item name="explanation" label="中文解读"><Input.TextArea rows={4}/></Form.Item>
      <Form.Item name="relation" label="连接关系" initialValue="related"><Select options={[{value:'related',label:'相关'},{value:'cause',label:'因果'},{value:'temporary',label:'暂定连接'}]}/></Form.Item>
      <Form.Item name="reviewed" label="已审核图文事实性与适龄性" valuePropName="checked"><Switch/></Form.Item>
      <Button type="primary" htmlType="submit" loading={busy}>添加到草稿</Button>
    </Form></Modal>
    <Modal title="修改节点" open={!!editingNode} footer={null} onCancel={() => {setEditingNode(null);editForm.resetFields();}}>
      <Form form={editForm} layout="vertical" onFinish={updateNode}>
        <Form.Item name="label" label="节点名称" rules={[{required:true}]}><Input maxLength={100}/></Form.Item>
        <Form.Item name="domain" label="领域" rules={[{required:true}]}><Input maxLength={80}/></Form.Item>
        <Form.Item name="relation" label="与父节点的关系"><Select options={[{value:'related',label:'相关'},{value:'cause',label:'因果'},{value:'temporary',label:'暂定连接'}]}/></Form.Item>
        <p className={styles.formHint}>只修改当前树中的节点信息，图片和解读内容保持不变。</p>
        <Button type="primary" htmlType="submit" loading={busy}>保存修改</Button>
      </Form>
    </Modal>
    {contentTarget && <KnowledgeContentEditor key={`${contentTarget.node.id}:${contentTarget.node.assetKey}`} node={contentTarget.node} treeId={contentTarget.treeId} revision={contentTarget.revision} busy={busy} request={request} onSave={saveNodeContent} onCancel={() => setContentTarget(null)}/>}
    <Modal title="删除节点" open={!!deleteTarget} confirmLoading={busy} onCancel={() => setDeleteTarget(null)} onOk={confirmDeleteNode} okText="确认删除" okButtonProps={{danger:true}}>
      <p>{deletedTargetIds.size > 1
        ? `删除“${deleteTarget?.label}”时，会同时删除其下全部 ${deletedTargetIds.size - 1} 个子节点。`
        : `确定删除“${deleteTarget?.label}”吗？`}</p>
      <p>此操作不可撤销；关联的共享图文资源会保留。</p>
    </Modal>
    <Modal title="删除整棵知识树" open={!!deleteTreeTarget} confirmLoading={busy} onCancel={() => setDeleteTreeTarget(null)} onOk={confirmDeleteTree} okText="确认删除整棵树" okButtonProps={{danger:true}}>
      <p>确定删除“{deleteTreeTarget?.title}”吗？</p>
      <p>这会永久删除整棵树及其 {deleteTreeTarget?.nodeCount || 0} 个节点，无法撤销。</p>
      <p>关联的共享图文资源会保留，其他知识树不受影响。</p>
    </Modal>
    <Modal title="重置节点图文" open={!!resetTarget} confirmLoading={busy} onCancel={() => setResetTarget(null)} onOk={confirmResetNode} okText="确认重置" okButtonProps={{danger:true}}>
      <p>重置后“{resetTarget?.node.label}”的当前图片和解读会清空，并恢复为待生成状态。</p>
      <p>节点关系和子节点会保留；旧图文资源不会删除，也不会影响其他节点。</p>
    </Modal>
    <Modal title="审核意见" open={!!review} onCancel={() => setReview(null)} onOk={async () => {if(!reviewNote.trim()){message.error('请填写意见');return;}if(await act(`/reviews/${review.key}`,{status:review.status,note:reviewNote}))setReview(null);}}><Input.TextArea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={4}/></Modal>
    <Modal title="装配日志" open={!!logs} footer={null} onCancel={() => setLogs(null)} width={900}><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(logs,null,2)}</pre></Modal>
    {childRegionTarget && <ChildRegionEditor key={`${childRegionTarget.node.id}:${childRegionTarget.revision}`} node={childRegionTarget.node} children={childRegionTarget.children} busy={busy} onSave={saveChildRegions} onIdentify={identifyChildRegion} onCancel={() => setChildRegionTarget(null)}/>}
  </>;
}
