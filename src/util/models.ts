export interface MessageModel {
  id: number;
  content: TextContent | MediaContent;
  author: Author;
}

export interface TextContent {
  chatId: number;
  type: string;
  date: number;
  text: string;
}

export interface MediaContent {
  chatId: number;
  type: string;
  date: number;
  fileId: string;
  mime_type: string;
  file_name: string;
}

export interface ReactionContent {
  title: string;
  keywords: string;
  slug: string;
  by: string;
}

export interface Author {
  id: number;
  firstName: string;
  username: string;
  isBot: boolean;
  currentBadge: Badge;
  color: string;
}

export type Badge = "mod" | "host" | "sub" | "normal";
