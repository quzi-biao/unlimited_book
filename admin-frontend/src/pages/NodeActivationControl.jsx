import { useState } from 'react';
import { Button, Modal } from 'antd';
import { CheckOutlined, EyeInvisibleOutlined } from '@ant-design/icons';

/** 给当前树节点提供可恢复的停用确认操作。 */
export default function NodeActivationControl({ node, descendantCount, disabled, busy, onToggle }) {
  const [open, setOpen] = useState(false);
  const activating = node.active === false;

  /** 保存状态成功后关闭确认框。 */
  async function confirm() {
    if (await onToggle(node, activating)) setOpen(false);
  }

  return <>
    <Button icon={activating ? <CheckOutlined /> : <EyeInvisibleOutlined />} disabled={disabled} onClick={() => setOpen(true)}>
      {activating ? '启用节点' : '停用节点'}
    </Button>
    <Modal title={activating ? '启用节点' : '停用节点'} open={open} confirmLoading={busy}
      onCancel={() => { if (!busy) setOpen(false); }} onOk={confirm}
      okText={activating ? '确认启用' : '确认停用'} cancelButtonProps={{ disabled: busy }}>
      <p>确定{activating ? '启用' : '停用'}“{node.label}”吗？</p>
      {activating
        ? <p>启用后，该节点会重新出现在读者知识树中；如果它的祖先仍停用，它仍会保持隐藏。</p>
        : <p>停用后，读者将无法打开此节点及其下 {descendantCount} 个后代节点。节点内容和学习记录会保留，之后可以重新启用。</p>}
    </Modal>
  </>;
}
