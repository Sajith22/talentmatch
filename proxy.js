import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

const digest = (value) => createHash('sha256').update(value).digest();

export function proxy(request) {
  const password = process.env.REVIEW_PASSWORD;
  if (!password && !process.env.VERCEL && !process.env.DATABASE_URL) return NextResponse.next();
  if (!password) return new NextResponse('Reviewer access is not configured.', { status: 503 });
  const token = request.headers.get('authorization')?.match(/^Basic (.+)$/i)?.[1];
  const decoded = token && Buffer.from(token, 'base64').toString('utf8');
  if (decoded && timingSafeEqual(digest(decoded), digest(`reviewer:${password}`))) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  return new NextResponse('Reviewer credentials required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="TalentMatch", charset="UTF-8"', 'Cache-Control': 'no-store' }
  });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
