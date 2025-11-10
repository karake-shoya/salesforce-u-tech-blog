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
  if (!content || content.trim().length === 0) {
    return false;
  }

  // HTMLタグの有無を確認
  const htmlTagPattern = /<[a-z][\s\S]*>/i;
  const hasHtmlTags = htmlTagPattern.test(content);

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
    /^\s*\|.+\|/m, // テーブル (| で始まる)
    /^\s*\[x\]/m, // チェックボックス [x]
    /^\s*\[ \]/m, // チェックボックス [ ]
  ];

  // マークダウンのパターンが検出されたか
  const hasMarkdownPatterns = markdownPatterns.some((pattern) => pattern.test(content));

  // HTMLタグが含まれていても、マークダウンのパターンが強く検出された場合はマークダウンとして判定
  // ただし、完全にHTML構造になっている場合はHTMLとして処理
  if (hasHtmlTags) {
    // HTMLタグがある場合、マークダウンのパターンが多く検出される場合のみマークダウンとして判定
    // または、HTMLタグが少なく、マークダウンのパターンが検出される場合
    const htmlTagCount = (content.match(/<[a-z][\s\S]*?>/gi) || []).length;
    const markdownPatternCount = markdownPatterns.filter((pattern) => pattern.test(content)).length;
    
    // HTMLタグが少なく、マークダウンのパターンが多く検出される場合はマークダウンとして判定
    if (htmlTagCount < 5 && markdownPatternCount >= 2) {
      return true;
    }
    
    // 通常のHTMLとして処理
    return false;
  }

  // HTMLタグがない場合、マークダウンのパターンが1つ以上見つかった場合はマークダウンとして判定
  return hasMarkdownPatterns;
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
  const detectedAsMarkdown = isMarkdown(content);
  
  // 開発環境でデバッグログを出力（本番環境では無効化）
  if (process.env.NODE_ENV === 'development') {
    console.log('[formatContent] Content type detection:', {
      contentType,
      detectedAsMarkdown,
      contentPreview: content.substring(0, 200),
      hasHtmlTags: /<[a-z][\s\S]*>/i.test(content),
    });
  }

  if (detectedAsMarkdown) {
    return await formatMarkdownWithHighlight(content);
  }

  // デフォルトはHTMLとして処理
  return formatRichText(content);
};