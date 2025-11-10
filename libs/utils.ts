import { formatInTimeZone } from 'date-fns-tz';
import { load } from 'cheerio';
import hljs from 'highlight.js';
import 'highlight.js/styles/hybrid.css';

import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkGfm from 'remark-gfm';

// 型定義
type ContentType = 'html' | 'markdown' | string | string[] | undefined;

// 定数定義
const HTML_TAG_PATTERN = /<[a-z][\s\S]*>/i;
const HTML_TAG_COUNT_PATTERN = /<[a-z][\s\S]*?>/gi;
const HEADING_PATTERN = /^#{1,6}\s+/m;
const LIST_PATTERN = /^\s*[-*+]\s+/m;
const ORDERED_LIST_PATTERN = /^\s*\d+\.\s+/m;
const MARKDOWN_DETECTION_THRESHOLD = {
  MAX_HTML_TAGS: 5,
  MIN_MARKDOWN_PATTERNS: 2,
};

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

// マークダウンのパターン定義
const MARKDOWN_PATTERNS = [
  HEADING_PATTERN, // 見出し (# で始まる)
  LIST_PATTERN, // リスト (- や * で始まる)
  ORDERED_LIST_PATTERN, // 番号付きリスト
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
] as const;

// マークダウンのパターンが検出された数をカウント
const countMarkdownPatterns = (content: string): number => {
  return MARKDOWN_PATTERNS.filter((pattern) => pattern.test(content)).length;
};

// HTMLタグの数をカウント
const countHtmlTags = (content: string): number => {
  return (content.match(HTML_TAG_COUNT_PATTERN) || []).length;
};

// HTMLタグが含まれているかチェック
const hasHtmlTags = (content: string): boolean => {
  return HTML_TAG_PATTERN.test(content);
};

// マークダウン形式を自動検出
const isMarkdown = (content: string): boolean => {
  if (!content || content.trim().length === 0) {
    return false;
  }

  const htmlTagsExist = hasHtmlTags(content);
  const markdownPatternCount = countMarkdownPatterns(content);

  // HTMLタグが含まれている場合
  if (htmlTagsExist) {
    const htmlTagCount = countHtmlTags(content);
    // HTMLタグが少なく、マークダウンのパターンが多く検出される場合はマークダウンとして判定
    return (
      htmlTagCount < MARKDOWN_DETECTION_THRESHOLD.MAX_HTML_TAGS &&
      markdownPatternCount >= MARKDOWN_DETECTION_THRESHOLD.MIN_MARKDOWN_PATTERNS
    );
  }

  // HTMLタグがない場合、マークダウンのパターンが1つ以上見つかった場合はマークダウンとして判定
  return markdownPatternCount > 0;
};

// HTMLからマークダウンへの変換関数群
const convertHeadings = ($: ReturnType<typeof load>): void => {
  const headingLevels = [1, 2, 3, 4, 5, 6] as const;
  headingLevels.forEach((level) => {
    $(`h${level}`).each((_, elm) => {
      const text = $(elm).text();
      $(elm).replaceWith(`${'#'.repeat(level)} ${text}\n\n`);
    });
  });
};

const convertLists = ($: ReturnType<typeof load>): void => {
  // 順序なしリスト
  $('ul li').each((_, elm) => {
    $(elm).replaceWith(`- ${$(elm).text()}\n`);
  });
  
  // 順序付きリスト
  $('ol li').each((_, elm) => {
    const index = $(elm).parent().children().index(elm) + 1;
    $(elm).replaceWith(`${index}. ${$(elm).text()}\n`);
  });
};

const convertTextFormatting = ($: ReturnType<typeof load>): void => {
  // 太字
  $('strong, b').each((_, elm) => {
    $(elm).replaceWith(`**${$(elm).text()}**`);
  });
  
  // 斜体
  $('em, i').each((_, elm) => {
    $(elm).replaceWith(`*${$(elm).text()}*`);
  });
};

const convertLinks = ($: ReturnType<typeof load>): void => {
  $('a').each((_, elm) => {
    const href = $(elm).attr('href') || '';
    const text = $(elm).text();
    $(elm).replaceWith(`[${text}](${href})`);
  });
};

const convertParagraphs = ($: ReturnType<typeof load>): void => {
  $('p').each((_, elm) => {
    const text = $(elm).text().trim();
    
    // 段落内にマークダウン記号が含まれている場合（例: <p># 見出し</p>）
    if (HEADING_PATTERN.test(text)) {
      const headingMatch = text.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const content = headingMatch[2];
        $(elm).replaceWith(`${'#'.repeat(level)} ${content}\n\n`);
        return;
      }
    }
    
    // リストのパターンが含まれている場合
    if (LIST_PATTERN.test(text) || ORDERED_LIST_PATTERN.test(text)) {
      $(elm).replaceWith(`${text}\n\n`);
      return;
    }
    
    // 通常の段落
    $(elm).replaceWith(`${text}\n\n`);
  });
};

const convertCodeBlocks = ($: ReturnType<typeof load>): void => {
  // コードブロック
  $('pre code').each((_, elm) => {
    const code = $(elm).text();
    const lang = $(elm).attr('class')?.replace(/^language-/, '') || '';
    $(elm).parent().replaceWith(`\`\`\`${lang}\n${code}\n\`\`\`\n\n`);
  });
  
  // インラインコード
  $('code').not('pre code').each((_, elm) => {
    $(elm).replaceWith(`\`${$(elm).text()}\``);
  });
};

// HTMLに変換されたマークダウンを元のマークダウンに戻す
const htmlToMarkdown = (html: string): string => {
  try {
    const $ = load(html, null, false);
    
    // 変換処理を順番に実行
    convertCodeBlocks($); // コードブロックは先に処理（他の変換の影響を受けないように）
    convertHeadings($);
    convertLists($);
    convertTextFormatting($);
    convertLinks($);
    convertParagraphs($);
    
    return $.text().trim();
  } catch (error) {
    // エラーが発生した場合は元のHTMLを返す
    console.error('[htmlToMarkdown] Error converting HTML to Markdown:', error);
    return html;
  }
};

// content_typeを正規化（配列の場合は最初の要素を使用）
const normalizeContentType = (contentType: ContentType): string | undefined => {
  if (Array.isArray(contentType)) {
    return contentType[0];
  }
  return contentType;
};

// デバッグログを出力（開発環境のみ）
const logContentTypeDetection = (
  contentType: ContentType,
  normalizedContentType: string | undefined,
  detectedAsMarkdown: boolean,
  content: string
): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[formatContent] Content type detection:', {
      contentType,
      normalizedContentType,
      detectedAsMarkdown,
      contentPreview: content.substring(0, 200),
      hasHtmlTags: hasHtmlTags(content),
    });
  }
};

// マークダウンコンテンツを処理
const processMarkdownContent = async (content: string): Promise<string> => {
  // HTMLに変換されている可能性があるので、マークダウンに戻してから処理
  if (hasHtmlTags(content)) {
    const markdown = htmlToMarkdown(content);
    return await formatMarkdownWithHighlight(markdown);
  }
  // 既にマークダウン形式の場合はそのまま処理
  return await formatMarkdownWithHighlight(content);
};

export const formatContent = async (
  content: string,
  contentType?: ContentType
): Promise<string> => {
  const normalizedContentType = normalizeContentType(contentType);
  
  // content_typeが明示的に指定されている場合
  if (normalizedContentType === 'markdown') {
    return await processMarkdownContent(content);
  }
  
  if (normalizedContentType === 'html') {
    return formatRichText(content);
  }

  // content_typeが未指定の場合は自動検出
  const detectedAsMarkdown = isMarkdown(content);
  logContentTypeDetection(contentType, normalizedContentType, detectedAsMarkdown, content);

  if (detectedAsMarkdown) {
    return await formatMarkdownWithHighlight(content);
  }

  // デフォルトはHTMLとして処理
  return formatRichText(content);
};