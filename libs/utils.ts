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

// HTMLに変換されたマークダウンを元のマークダウンに戻す
const htmlToMarkdown = (html: string): string => {
  const $ = load(html, null, false);
  
  // 見出しを変換 (# 見出し)
  $('h1').each((_, elm) => {
    $(elm).replaceWith(`# ${$(elm).text()}\n\n`);
  });
  $('h2').each((_, elm) => {
    $(elm).replaceWith(`## ${$(elm).text()}\n\n`);
  });
  $('h3').each((_, elm) => {
    $(elm).replaceWith(`### ${$(elm).text()}\n\n`);
  });
  $('h4').each((_, elm) => {
    $(elm).replaceWith(`#### ${$(elm).text()}\n\n`);
  });
  $('h5').each((_, elm) => {
    $(elm).replaceWith(`##### ${$(elm).text()}\n\n`);
  });
  $('h6').each((_, elm) => {
    $(elm).replaceWith(`###### ${$(elm).text()}\n\n`);
  });
  
  // リストを変換
  $('ul li').each((_, elm) => {
    $(elm).replaceWith(`- ${$(elm).text()}\n`);
  });
  $('ol li').each((_, elm) => {
    const index = $(elm).parent().children().index(elm) + 1;
    $(elm).replaceWith(`${index}. ${$(elm).text()}\n`);
  });
  
  // 太字を変換
  $('strong, b').each((_, elm) => {
    $(elm).replaceWith(`**${$(elm).text()}**`);
  });
  
  // 斜体を変換
  $('em, i').each((_, elm) => {
    $(elm).replaceWith(`*${$(elm).text()}*`);
  });
  
  // リンクを変換
  $('a').each((_, elm) => {
    const href = $(elm).attr('href') || '';
    const text = $(elm).text();
    $(elm).replaceWith(`[${text}](${href})`);
  });
  
  // 段落を変換（改行に変換）
  $('p').each((_, elm) => {
    const html = $(elm).html() || '';
    const text = $(elm).text();
    
    // 段落内にマークダウン記号が含まれている場合（例: <p># 見出し</p>）
    if (/^#{1,6}\s/.test(text.trim())) {
      // 見出し記号を抽出して変換
      const headingMatch = text.trim().match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const content = headingMatch[2];
        $(elm).replaceWith(`${'#'.repeat(level)} ${content}\n\n`);
        return;
      }
    }
    
    // リストのパターンが含まれている場合
    if (/^[-*+]\s/.test(text.trim()) || /^\d+\.\s/.test(text.trim())) {
      $(elm).replaceWith(`${text.trim()}\n\n`);
      return;
    }
    
    // 通常の段落
    $(elm).replaceWith(`${text}\n\n`);
  });
  
  // コードブロックを変換
  $('pre code').each((_, elm) => {
    const code = $(elm).text();
    const lang = $(elm).attr('class')?.replace(/^language-/, '') || '';
    $(elm).parent().replaceWith(`\`\`\`${lang}\n${code}\n\`\`\`\n\n`);
  });
  
  // インラインコードを変換
  $('code').not('pre code').each((_, elm) => {
    $(elm).replaceWith(`\`${$(elm).text()}\``);
  });
  
  return $.text().trim();
};

export const formatContent = async (
  content: string,
  contentType?: 'html' | 'markdown' | string | string[]
) => {
  // content_typeが配列の場合、最初の要素を使用
  const normalizedContentType = Array.isArray(contentType) 
    ? contentType[0] 
    : contentType;
  
  // content_typeが明示的に'markdown'と指定されている場合
  if (normalizedContentType === 'markdown') {
    // HTMLに変換されている可能性があるので、マークダウンに戻してから処理
    const htmlTagPattern = /<[a-z][\s\S]*>/i;
    if (htmlTagPattern.test(content)) {
      // HTMLに変換されている場合は、マークダウンに戻してから処理
      const markdown = htmlToMarkdown(content);
      return await formatMarkdownWithHighlight(markdown);
    }
    // 既にマークダウン形式の場合はそのまま処理
    return await formatMarkdownWithHighlight(content);
  }
  
  if (normalizedContentType === 'html') {
    return formatRichText(content);
  }

  // content_typeが未指定の場合は自動検出
  const detectedAsMarkdown = isMarkdown(content);
  
  // 開発環境でデバッグログを出力（本番環境では無効化）
  if (process.env.NODE_ENV === 'development') {
    console.log('[formatContent] Content type detection:', {
      contentType,
      normalizedContentType,
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