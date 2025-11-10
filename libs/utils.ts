import { formatInTimeZone } from 'date-fns-tz';
import { load } from 'cheerio';
import hljs from 'highlight.js';
import 'highlight.js/styles/hybrid.css';

import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkGfm from 'remark-gfm';

export const formatDate = (date: string) => {
  return formatInTimeZone(new Date(date), 'Asia/Tokyo', 'd MMMM, yyyy');
};

export const formatRichText = (richText: string) => {
  const $ = load(richText, null, false);
  const highlight = (text: string, lang?: string) => {
    if (!lang) return hljs.highlightAuto(text);
    try {
      // language-xxx形式のクラス名から言語名を抽出
      const language = lang.replace(/^language-/, '').split(/\s+/)[0];
      return hljs.highlight(text, { language });
    } catch (e) {
      return hljs.highlightAuto(text);
    }
  };
  $('pre code').each((_, elm) => {
    const lang = $(elm).attr('class') || '';
    const res = highlight($(elm).text(), lang);
    $(elm).html(res.value);
    // highlight.js用のクラスを追加
    $(elm).addClass('hljs');
  });
  return $.html();
};

export const formatMarkdown = async (markdown: string) => {
  const processedContent = await remark()
    .use(remarkGfm)
    .use(remarkHtml)
    .process(markdown);
  return processedContent.toString();
};

export const formatMarkdownWithHighlight = async (markdown: string) => {
  const html = await formatMarkdown(markdown);
  return formatRichText(html);
};

// マークダウン形式を自動検出
const isMarkdown = (content: string): boolean => {
  // HTMLタグが含まれている場合はHTMLとして処理
  const htmlTagPattern = /<[a-z][\s\S]*>/i;
  if (htmlTagPattern.test(content)) {
    return false;
  }

  // マークダウンの特徴的な記号やパターンを検出
  const markdownPatterns = [
    /^#{1,6}\s+/m, // 見出し (# で始まる)
    /^\s*[-*+]\s+/m, // リスト (- や * で始まる)
    /^\s*\d+\.\s+/m, // 番号付きリスト
    /```[\s\S]*?```/, // コードブロック
    /`[^`]+`/, // インラインコード
    /\[([^\]]+)\]\(([^)]+)\)/, // リンク [text](url)
    /!\[([^\]]*)\]\(([^)]+)\)/, // 画像 ![alt](url)
    /\*\*[^*]+\*\*/, // 太字 **text**
    /\*[^*]+\*/, // 斜体 *text*
    /_{2}[^_]+_{2}/, // 太字 __text__
    /_[^_]+_/, // 斜体 _text_
    /^>\s+/m, // 引用 (> で始まる)
    /^---+\s*$/m, // 水平線 (---)
  ];

  // マークダウンのパターンが1つ以上見つかった場合はマークダウンとして判定
  return markdownPatterns.some((pattern) => pattern.test(content));
};

export const formatContent = async (content: string, contentType?: 'html' | 'markdown') => {
  // content_typeが明示的に指定されている場合はそれを使用
  if (contentType === 'markdown') {
    return await formatMarkdownWithHighlight(content);
  }
  if (contentType === 'html') {
    return formatRichText(content);
  }

  // content_typeが未指定の場合は自動検出
  if (isMarkdown(content)) {
    return await formatMarkdownWithHighlight(content);
  }

  // デフォルトはHTMLとして処理
  return formatRichText(content);
};