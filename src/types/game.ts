export interface ArticleMeta {
  title: string;
  content: string;
  author: string;
  published_date: string;
  target_platform: string;
  polished_content: string | null;
  image_url: string | null;
  source: string | null;
  requirement: string | null;
  veracity: string | null;
}

export interface PlatformSetup {
  platform: string;
  audience: string;
}

export interface PlatformStatus {
  platform_name: string;
  spread_rate: number;
  player_trust?: number;
  ai_trust?: number;
}

export interface Tool {
  tool_name: string;
  description: string;
  trust_effect?: number;
  spread_effect?: number;
  applicable_to?: string;
  available_from_round?: number;
}

export interface GameStartResponse {
  session_id: string;
  round_number: number;
  actor: 'ai' | 'player';
  article: ArticleMeta;
  platform_setup: PlatformSetup[];
  player_trust: number;
  ai_trust: number;
  platform_status: PlatformStatus[];
  tool_list: Tool[];
  tool_used: string[];
  effectiveness: 'low' | 'medium' | 'high';
  simulated_comments: string[];
  dashboard_info?: any;
}

export type AiTurnResponse = GameStartResponse;
export type PlayerTurnResponse = GameStartResponse;
export type StartNextRoundResponse = GameStartResponse; 