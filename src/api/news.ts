export interface NewsItem {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

export async function fetchNews(): Promise<NewsItem[]> {
  const res = await fetch('/api/news');
  if (!res.ok) throw new Error('Failed to fetch news');
  return res.json();
} 