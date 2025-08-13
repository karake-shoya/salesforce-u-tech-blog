// app/api/revalidate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  try {
    // セキュリティチェック: シークレットキーを確認
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.REVALIDATE_SECRET) {
      return NextResponse.json(
        { message: 'Invalid secret' }, 
        { status: 401 }
      );
    }

    // microCMSからのWebhookペイロードを取得
    const body = await req.json();
    
    // 記事のIDを取得（microCMSのペイロード構造に合わせて調整）
    const contentId = body?.contents?.id || body?.id;
    
    console.log('Revalidation triggered for:', contentId, 'Event type:', body?.type);

    // 特定の記事ページをrevalidate
    if (contentId) {
      revalidatePath(`/articles/${contentId}`);
      console.log(`Revalidated: /articles/${contentId}`);
    }

    // 関連ページもrevalidate
    revalidatePath('/'); // トップページ（記事一覧）
    revalidatePath('/search'); // 検索ページ
    
    // タグページも含める場合
    if (body?.contents?.tags && Array.isArray(body.contents.tags)) {
      body.contents.tags.forEach((tag: any) => {
        if (tag.id) {
          revalidatePath(`/tags/${tag.id}`);
        }
      });
    }

    console.log('Revalidation completed successfully');

    return NextResponse.json({ 
      revalidated: true, 
      contentId,
      timestamp: new Date().toISOString() 
    });

  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json(
      { message: 'Revalidation failed', error: String(error) }, 
      { status: 500 }
    );
  }
}

// GETリクエストでヘルスチェック
export async function GET() {
  return NextResponse.json({ 
    message: 'Revalidation API is working', 
    timestamp: new Date().toISOString() 
  });
}