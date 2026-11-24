import { useState } from 'react';
import { App, Button, Form, Image, Input, Modal, Space, Upload } from 'antd';
import { ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import styles from './KnowledgePage.module.css';

/** 编辑当前节点的图文；上传先预览，提交保存后才替换节点引用。 */
export default function KnowledgeContentEditor({ node, treeId, revision, busy, request, onSave, onCancel }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const locked = busy || uploading || generating;
  const imageUrl = Form.useWatch('imageUrl', form) ?? node.asset?.imageUrl ?? '';
  const previewUrl = /^(https?:\/\/|\/(api\/local-(assets|uploads)\/|knowledge\/))/.test(imageUrl) ? imageUrl : '';

  /** 限制图片类型及大小，错误时保留原图。 */
  function beforeUpload(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      message.error('请选择 JPG、PNG 或 WebP 图片');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('图片不能超过 10 MB');
      return Upload.LIST_IGNORE;
    }
    return true;
  }

  /** 使用管理员接口上传图片，不提交节点的其他改动。 */
  async function uploadImage({ file, onSuccess, onError }) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await request('/images', body);
      form.setFieldValue('imageUrl', result.imageUrl);
      onSuccess(result);
      message.success('图片已上传，保存修改后生效');
    } catch (error) {
      onError(error);
      message.error(error.message);
    } finally {
      setUploading(false);
    }
  }

  /** 沿用节点原有生图方式，先预览新图，保留表单中已编辑的文字。 */
  async function regenerateImage() {
    if (locked) return;
    setGenerating(true);
    try {
      const result = await request('/images/regenerate', {
        treeId, nodeId: node.id, expectedAssetKey: node.assetKey, revision,
      });
      form.setFieldValue('imageUrl', result.imageUrl);
      message.success('新图片已生成，保存修改后生效');
    } catch (error) {
      message.error(error.message);
    } finally {
      setGenerating(false);
    }
  }

  /** 按行转换探索问题，保留解读正文中的段落。 */
  async function save(values) {
    await onSave({ ...values, anchors: values.anchorsText.split(/\r?\n/).map(line => line.trim()).filter(Boolean) });
  }

  return <Modal title={`编辑图文：${node.label}`} open width={760} onCancel={onCancel} onOk={() => form.submit()}
    okText="保存修改" confirmLoading={busy} okButtonProps={{ disabled: uploading || generating }} cancelButtonProps={{ disabled: locked }}
    style={{ top: 24 }} styles={{ body: { maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto', paddingRight: 4 } }}
    closable={!locked} maskClosable={!locked} keyboard={!locked}>
    <Form form={form} layout="vertical" onFinish={save} disabled={locked} initialValues={{
      imageUrl: node.asset?.imageUrl || '',
      explanation: node.asset?.explanations?.zh || '',
      anchorsText: Array.isArray(node.asset?.anchors) ? node.asset.anchors.join('\n') : '',
    }}>
      <div className={styles.contentImagePreview}>
        {previewUrl ? <Image src={previewUrl} alt={node.label} style={{ maxHeight: 280, objectFit: 'contain' }}/> : <span>上传或填写图片地址后预览</span>}
      </div>
      <Form.Item label="替换图片">
        <Space wrap>
          <Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={beforeUpload} customRequest={uploadImage} disabled={locked}>
            <Button icon={<UploadOutlined />} loading={uploading} disabled={locked}>上传新图片</Button>
          </Upload>
          <Button icon={<ReloadOutlined />} loading={generating} disabled={locked} onClick={regenerateImage}>重新生图</Button>
          <span className={styles.uploadHint}>JPG、PNG、WebP，最大 10 MB</span>
        </Space>
        {generating && <p className={styles.formHint} role="status">正在生成新图片，请稍候…</p>}
      </Form.Item>
      <Form.Item name="imageUrl" label="图片地址" rules={[{ required: true, whitespace: true, message: '请上传图片或填写图片地址' }]}>
        <Input placeholder="也可以直接粘贴图片地址" maxLength={2000}/>
      </Form.Item>
      <Form.Item name="explanation" label="解读文字" rules={[{ required: true, whitespace: true, message: '请填写解读文字' }]}>
        <Input.TextArea rows={8} maxLength={16000} showCount/>
      </Form.Item>
      <Form.Item name="anchorsText" label="可继续探索的问题" extra="选填，每行一个问题，最多 20 条" rules={[{
        validator: (_, value = '') => {
          const questions = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
          return questions.length <= 20 && questions.every(line => line.length <= 120)
            ? Promise.resolve() : Promise.reject(new Error('最多 20 条问题，每条不超过 120 个字符'));
        },
      }]}><Input.TextArea rows={3}/></Form.Item>
      <p className={styles.formHint}>保存后需重新审核图文，再发布给用户。</p>
    </Form>
  </Modal>;
}
