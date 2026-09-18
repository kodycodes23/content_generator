import fs from "node:fs";
import path from "node:path";
import { buildSeedRequests } from "./seed";
import type { ContentRequest, CreateContentRequestInput } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "content-requests.json");

declare global {
  var __koyaContentStore: ContentRequest[] | undefined;
}

function loadFromDisk(): ContentRequest[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw) as ContentRequest[];
  } catch {
    return buildSeedRequests();
  }
}

function persist(requests: ContentRequest[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(requests, null, 2), "utf-8");
}

function getStore(): ContentRequest[] {
  if (!globalThis.__koyaContentStore) {
    globalThis.__koyaContentStore = loadFromDisk();
    persist(globalThis.__koyaContentStore);
  }
  return globalThis.__koyaContentStore;
}

export function listRequests(): ContentRequest[] {
  return [...getStore()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function getRequest(id: string): ContentRequest | undefined {
  return getStore().find((r) => r.id === id);
}

export function createRequest(input: CreateContentRequestInput): ContentRequest {
  const now = new Date().toISOString();
  const id = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const request: ContentRequest = {
    id,
    topic: input.topic,
    audience: input.audience,
    sourceType: input.sourceType,
    sourceInput: input.sourceInput,
    channels: input.channels,
    keywords: input.keywords,
    status: "drafting",
    activePipeline: "research",
    pendingFeedback: null,
    pipelineStage: { label: "Queued for research...", progress: 4 },
    article: null,
    sources: [],
    evaluation: null,
    channelVariants: null,
    revisionHistory: [],
    rejectionReason: null,
    lastError: null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  const store = getStore();
  store.push(request);
  persist(store);
  return request;
}

export function updateRequest(
  id: string,
  updater: (current: ContentRequest) => Partial<ContentRequest>,
): ContentRequest | undefined {
  const store = getStore();
  const index = store.findIndex((r) => r.id === id);
  if (index === -1) return undefined;
  const patch = updater(store[index]);
  const updated: ContentRequest = { ...store[index], ...patch, updatedAt: new Date().toISOString() };
  store[index] = updated;
  persist(store);
  return updated;
}

export function deleteRequest(id: string): boolean {
  const store = getStore();
  const index = store.findIndex((r) => r.id === id);
  if (index === -1) return false;
  store.splice(index, 1);
  persist(store);
  return true;
}
