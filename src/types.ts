// ─── Core domain types for Screenshot Brain ───────────────────────────────

export const CATEGORIES = [
  'work', 'study', 'code', 'development', 'shopping', 'travel', 'finance', 'social',
  'recipes', 'ideas', 'documents', 'important', 'memes', 'temporary',
  'jobs', 'university', 'receipts', 'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  work: 'Work', study: 'Study', code: 'Code', development: 'Development',
  shopping: 'Shopping', travel: 'Travel', finance: 'Finance', social: 'Social',
  recipes: 'Recipes', ideas: 'Ideas', documents: 'Documents', important: 'Important',
  memes: 'Memes', temporary: 'Temporary', jobs: 'Jobs', university: 'University',
  receipts: 'Receipts', other: 'Other',
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  work: '💼', study: '🎓', code: '👨‍💻', development: '🛠️', shopping: '🛒',
  travel: '✈️', finance: '💰', social: '💬', recipes: '🍳', ideas: '💡',
  documents: '📄', important: '⭐', memes: '😂', temporary: '⏳',
  jobs: '💼', university: '🎓', receipts: '🧾', other: '📎',
};

export type ValueLevel = 'important' | 'useful' | 'temporary' | 'duplicate' | 'low';

export type OcrStatus = 'none' | 'pending' | 'done' | 'failed' | 'unavailable';
export type AiStatus = 'none' | 'pending' | 'done' | 'failed' | 'skipped';
export type ImportSource = 'pick' | 'scan' | 'share' | 'demo';

export type ContentType =
  | 'chat' | 'receipt' | 'webpage' | 'code' | 'document' | 'form'
  | 'ticket' | 'payment' | 'email' | 'note' | 'meme' | 'photo' | 'other';

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  chat: 'Chat', receipt: 'Receipt', webpage: 'Web page', code: 'Code',
  document: 'Document', form: 'Form', ticket: 'Ticket', payment: 'Payment',
  email: 'Email', note: 'Note', meme: 'Meme', photo: 'Photo', other: 'Other',
};

export interface AiMeta {
  title: string;
  summary: string;
  category: Category;
  tags: string[];
  dates: string[];
  phones: string[];
  emails: string[];
  urls: string[];
  places: string[];
  products: string[];
  tasks: string[];
  orgs: string[];          // detected organizations (companies, universities, gov)
  names: string[];         // detected people
  prices: string[];        // detected prices, verbatim ("Rs 4,500", "$12.99")
  deadlines: string[];     // deadlines / due dates phrasing
  contentType: ContentType;
  usefulness: number;      // 0–100
  outdated?: string;       // reason why info is stale/expired, if so
}

export interface Shot {
  id: string;
  createdAt: number;       // when the screenshot was taken (ms epoch)
  addedAt: number;         // when imported into the app
  fileName: string;
  width: number;
  height: number;
  bytes: number;
  ocr?: string;            // extracted text
  ocrStatus: OcrStatus;
  ai?: AiMeta | null;
  aiStatus: AiStatus;
  hash?: string;           // 64-bit perceptual hash (hex)
  dupOf?: string;          // id of the shot this duplicates
  fav?: boolean;
  value: ValueLevel;
  valueReason?: string;    // human-readable WHY
  source: ImportSource;
  sensitive?: boolean;     // hidden behind blur until tapped
  aiExcluded?: boolean;    // never sent to cloud AI
  deletedAt?: number;      // soft delete (trash) timestamp — live if unset
  quality?: 'ok' | 'blurry';  // computed blur analysis
}

export interface Collection {
  id: string;
  name: string;
  emoji: string;
  auto: boolean;
  createdAt: number;
  shotIds: string[];
}

export interface ChatMsg {
  id: string;
  role: 'user' | 'ai';
  text: string;
  cites: string[];         // shot ids referenced
  ts: number;
  error?: boolean;
  streaming?: boolean;     // currently receiving tokens
  suggestions?: string[];  // follow-up questions for AI replies
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMsg[];
}

export interface AppSettings {
  onboarded: boolean;
  geminiKey: string;
  model: string;
  theme: 'system' | 'light' | 'dark';
  appLock: boolean;        // require unlock on launch
  lockPin: string;         // hashed locally; empty = PIN disabled
  biometric: boolean;      // offer fingerprint/face when available
}

export interface BlobRec {
  id: string;
  thumb: Blob;             // ≤512px jpeg
  full: Blob;              // ≤2048px jpeg
}

export type Route =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'brain' }
  | { name: 'cleanup' }
  | { name: 'library' }
  | { name: 'detail'; id: string }
  | { name: 'collections' }
  | { name: 'collection'; id: string }
  | { name: 'timeline' }
  | { name: 'settings' };

export type TabName = 'home' | 'search' | 'brain' | 'cleanup' | 'library';

export interface MatchReason {
  field: 'ocr' | 'title' | 'summary' | 'tag' | 'category' | 'file' | 'date' | 'filter' | 'semantic' | 'entity' | 'price';
  detail: string;
}

export interface CitedSource {
  id: string;
  title: string;
  date: string;
}

export interface SearchHit {
  shot: Shot;
  score: number;
  reasons: MatchReason[];
}
