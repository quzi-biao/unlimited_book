import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import styles from './MarkdownRenderer.module.css';

/**
 * MarkdownRenderer — Markdown + KaTeX 公式渲染组件
 * 对应 Android 的 MarkdownText + LaTeX 渲染
 *
 * @param {string} content - Markdown 内容（支持 $...$ 行内公式、$$...$$ 块公式）
 * @param {string} [className] - 额外 CSS 类名
 */
export function MarkdownRenderer({ content, className = '' }) {
  if (!content) return null;
  return (
    <div className={`${styles.root} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // 标题收紧间距
          h1: ({ children }) => <h3 className={styles.h1}>{children}</h3>,
          h2: ({ children }) => <h4 className={styles.h2}>{children}</h4>,
          h3: ({ children }) => <h5 className={styles.h3}>{children}</h5>,
          // 段落
          p: ({ children }) => <p className={styles.p}>{children}</p>,
          // 加粗
          strong: ({ children }) => <strong className={styles.strong}>{children}</strong>,
          // 斜体
          em: ({ children }) => <em className={styles.em}>{children}</em>,
          // 行内代码
          code: ({ inline, children }) =>
            inline
              ? <code className={styles.inlineCode}>{children}</code>
              : <pre className={styles.pre}><code>{children}</code></pre>,
          // 无序列表
          ul: ({ children }) => <ul className={styles.ul}>{children}</ul>,
          // 有序列表
          ol: ({ children }) => <ol className={styles.ol}>{children}</ol>,
          li: ({ children }) => <li className={styles.li}>{children}</li>,
          // 引用块
          blockquote: ({ children }) => <blockquote className={styles.blockquote}>{children}</blockquote>,
          // 分割线
          hr: () => <hr className={styles.hr} />,
          // 链接（只显示文字，不跳转）
          a: ({ children }) => <span className={styles.link}>{children}</span>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
