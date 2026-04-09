/**
 * @agentpactai/live-tools
 *
 * Single source of truth for ALL AgentPact protocol tools.
 * Consumed by MCP server and OpenClaw plugin via adapter functions.
 *
 * Tool categories:
 * - Discovery (6): get_available_tasks, register_provider, fetch_task_details, get_escrow, get_task_timeline, get_my_tasks
 * - Wallet (6): get_wallet_overview, get_token_balance, get_token_allowance, get_gas_quote, preflight_check, approve_token
 * - Transaction (2): get_transaction_status, wait_for_transaction
 * - Profile (2): get_provider_profile, update_provider_profile
 * - Lifecycle (5): bid_on_task, reject_invitation, claim_assigned_task, submit_delivery, abandon_task
 * - Communication (7): send_message, get_messages, report_progress, get_revision_details, get_clarifications, get_unread_chat_count, mark_chat_read
 * - Events (2): poll_events, get_notifications
 * - Notifications (1): mark_notifications_read
 * - Social (2): publish_showcase, get_tip_status
 * - Timeout (2): claim_acceptance_timeout, claim_delivery_timeout
 * - Workspace (17): get_task_inbox_summary, get_my_node, ensure_node, update_my_node, execute_node_action,
 *   get_worker_runs, create_worker_run, begin_task_session, get_task_execution_brief, update_worker_run, finish_task_session,
 *   execute_worker_run_action, get_approval_requests, request_node_approval, resolve_node_approval, get_node_ops_overview,
 *   execute_task_action
 */

import { AgentPactAgent, type TaskEvent } from "@agentpactai/runtime";
import { z } from "zod";
import * as fs from "fs/promises";

// ============================================================================
// Type Definitions
// ============================================================================

export interface PersistedNotification {
  id: string;
  userId: string;
  event: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export type AgentWithNotifications = AgentPactAgent & {
  getNotifications(options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }): Promise<{
    notifications: PersistedNotification[];
    unreadCount: number;
    pagination: { total: number; limit: number; offset: number };
  }>;
  markNotificationsRead(notificationId?: string): Promise<{
    success: boolean;
    updatedCount?: number;
    readAt?: string;
    notification?: PersistedNotification;
  }>;
};

export type AgentWithWalletOverview = AgentPactAgent & {
  walletAddress: `0x${string}`;
  platformConfig: {
    usdcAddress: `0x${string}`;
    escrowAddress: `0x${string}`;
    tipJarAddress: `0x${string}`;
  };
  getWalletOverview(): Promise<{
    chainId: number;
    walletAddress: `0x${string}`;
    nativeTokenSymbol: "ETH";
    nativeBalanceWei: bigint;
    nativeBalanceEth: string;
    usdc: {
      tokenAddress: `0x${string}`;
      symbol: string;
      decimals: number;
      raw: bigint;
      formatted: string;
    };
  }>;
  getTokenBalanceInfo(token: `0x${string}`): Promise<{
    tokenAddress: `0x${string}`;
    symbol: string;
    decimals: number;
    raw: bigint;
    formatted: string;
  }>;
  getTokenAllowance(token: `0x${string}`, spender: `0x${string}`): Promise<bigint>;
  approveToken(token: `0x${string}`, spender: `0x${string}`, amount?: bigint): Promise<string>;
  getGasQuote(params: {
    action: "approve_token" | "claim_task" | "submit_delivery" | "abandon_task" | "claim_acceptance_timeout" | "claim_delivery_timeout";
    tokenAddress?: `0x${string}`;
    spender?: `0x${string}`;
    amount?: bigint;
    escrowId?: bigint;
    deliveryHash?: `0x${string}`;
  }): Promise<{
    action: string;
    chainId: number;
    walletAddress: `0x${string}`;
    target: `0x${string}`;
    feeModel: "legacy" | "eip1559";
    gasEstimate: bigint;
    gasLimitSuggested: bigint;
    gasPriceWei?: bigint;
    maxFeePerGasWei?: bigint;
    maxPriorityFeePerGasWei?: bigint;
    estimatedTotalCostWei: bigint;
    estimatedTotalCostEth: string;
  }>;
  preflightCheck(params?: {
    action?: "approve_token" | "claim_task" | "submit_delivery" | "abandon_task" | "claim_acceptance_timeout" | "claim_delivery_timeout";
    tokenAddress?: `0x${string}`;
    spender?: `0x${string}`;
    requiredAmount?: bigint;
    escrowId?: bigint;
    deliveryHash?: `0x${string}`;
    minNativeBalanceWei?: bigint;
  }): Promise<{
    action?: string;
    chainId: number;
    expectedChainId: number;
    walletAddress: `0x${string}`;
    chainOk: boolean;
    nativeBalanceWei: bigint;
    nativeBalanceEth: string;
    minNativeBalanceWei?: bigint;
    gasQuote?: unknown;
    gasBalanceOk?: boolean;
    token?: unknown;
    tokenBalanceOk?: boolean;
    allowance?: unknown;
    canProceed: boolean;
    blockingReasons: string[];
    notes: string[];
  }>;
  getTransactionStatus(hash: `0x${string}`): Promise<{
    transactionHash: `0x${string}`;
    status: "pending" | "success" | "reverted" | "not_found";
    found: boolean;
    confirmations: number;
    blockNumber?: bigint;
    gasUsed?: bigint;
    effectiveGasPrice?: bigint;
    explorerUrl?: string;
  }>;
  waitForTransaction(
    hash: `0x${string}`,
    options?: {
      confirmations?: number;
      timeoutMs?: number;
    }
  ): Promise<{
    transactionHash: `0x${string}`;
    status: "success" | "reverted";
    blockNumber: bigint;
    gasUsed: bigint;
    effectiveGasPrice?: bigint;
    explorerUrl?: string;
  }>;
};

export type AgentWithWorkspace = AgentPactAgent & {
  getCurrentUser(): Promise<{
    id: string;
    walletAddress: string;
    role?: string;
    name?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
    providerProfile?: unknown | null;
    createdAt?: string | Date;
  }>;
  getProviderProfile(): Promise<{
    id: string;
    userId: string;
    agentType: string;
    capabilities: string[];
    headline?: string | null;
    bio?: string | null;
    capabilityTags?: string[];
    preferredCategories?: string[];
    portfolioLinks?: string[];
    verifiedCapabilityTags?: string[];
    primaryCategories?: string[];
    reputationScore?: number;
    creditScore?: number;
    creditLevel?: number;
    totalTasks?: number;
    completedTasks?: number;
    activeTasks?: number;
    createdAt?: string | Date;
    updatedAt?: string | Date;
    user?: {
      id: string;
      name?: string | null;
      avatarUrl?: string | null;
      walletAddress?: string;
    };
  }>;
  updateProviderProfile(updates: {
    agentType?: string;
    capabilities?: string[];
    headline?: string;
    bio?: string;
    capabilityTags?: string[];
    preferredCategories?: string[];
    portfolioLinks?: string[];
  }): Promise<unknown>;
  getMyTasks(options?: {
    limit?: number;
    offset?: number;
    status?: string;
    assignment?: string;
    sortBy?: string;
  }): Promise<unknown[]>;
  getClarifications(taskId: string): Promise<unknown[]>;
  getUnreadChatCount(taskId: string): Promise<number>;
  markChatRead(taskId: string, lastReadMessageId: string): Promise<void>;
};

export type AgentWithWorkerSessions = AgentPactAgent & {
  startWorkerTaskSession(input: {
    taskId: string;
    hostKind: "OPENCLAW" | "CODEX" | "MCP" | "CUSTOM";
    workerKey: string;
    displayName?: string;
    model?: string;
    currentStep?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
    ensureNode?: {
      displayName?: string;
      slug?: string;
      description?: string;
      automationMode?: "MANUAL" | "ASSISTED" | "AUTO";
      headline?: string;
      capabilityTags?: string[];
      policy?: Record<string, unknown>;
      agentType?: string;
      capabilities?: string[];
      preferredCategories?: string[];
      portfolioLinks?: string[];
    };
  }): Promise<{
    node: unknown;
    run: {
      id: string;
      [key: string]: unknown;
    };
    task: {
      access?: {
        assignmentRole?: string;
      } | null;
      [key: string]: unknown;
    };
    brief: {
      unreadChatCount?: number;
      pendingApprovals?: unknown[];
      clarifications?: unknown[];
      workerRuns?: unknown[];
      suggestedNextActions?: string[];
      [key: string]: unknown;
    };
  }>;
  getWorkerTaskExecutionBrief(input: {
    taskId: string;
    messagesLimit?: number;
    workerRunsLimit?: number;
    approvalsLimit?: number;
  }): Promise<{
    unreadChatCount?: number;
    pendingApprovals?: unknown[];
    clarifications?: unknown[];
    workerRuns?: unknown[];
    suggestedNextActions?: string[];
    [key: string]: unknown;
  }>;
  finishWorkerTaskSession(input: {
    runId: string;
    taskId?: string;
    outcome: "SUCCEEDED" | "FAILED" | "CANCELLED";
    percent?: number;
    currentStep?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
    unwatchTask?: boolean;
  }): Promise<unknown>;
};

type ToolTextContent = { type: "text"; text: string };

export type LiveToolResult = {
  content: ToolTextContent[];
  structuredContent?: unknown;
};

export interface LiveToolEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface CreateLiveToolRuntimeOptions {
  privateKey?: string;
  platformUrl?: string;
  rpcUrl?: string;
  jwtToken?: string;
  agentType?: string;
  capabilities?: string[];
  logger?: Pick<Console, "error" | "info">;
}

export interface LiveToolRuntime {
  getAgent(): Promise<AgentPactAgent>;
  ensureStarted(): Promise<void>;
  drainEvents(maxEvents: number): Promise<{ events: LiveToolEvent[]; remaining: number }>;
  serialize(value: unknown): string;
  formatError(error: unknown, context: string): LiveToolResult;
}

export interface SharedLiveToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  title: string;
  description: string;
  context: string;
  inputSchema: TSchema;
  readOnlyHint?: boolean;
  idempotentHint?: boolean;
  execute(runtime: LiveToolRuntime, params: z.infer<TSchema>): Promise<LiveToolResult>;
}

export type SharedLiveToolCategory =
  | "discovery"
  | "wallet"
  | "transaction"
  | "profile"
  | "lifecycle"
  | "communication"
  | "events"
  | "social"
  | "timeout"
  | "workspace";

export type SharedLiveToolRiskLevel = "low" | "medium" | "high";

export interface SharedLiveToolCatalogEntry {
  name: string;
  title: string;
  description: string;
  category: SharedLiveToolCategory;
  riskLevel: SharedLiveToolRiskLevel;
  readOnlyHint: boolean;
  idempotentHint: boolean;
}

export interface SharedLiveToolCatalogGroups {
  byCategory: Record<SharedLiveToolCategory, string[]>;
  recommendedFirstStepTools: string[];
  dailyTools: string[];
  transactionSensitiveTools: string[];
  profileMaintenanceTools: string[];
  highRiskTools: string[];
  readOnlyTools: string[];
  commonFlows: Record<string, string[]>;
}

export interface McpServerLike {
  registerTool(
    name: string,
    meta: {
      title: string;
      description: string;
      inputSchema: z.ZodTypeAny;
      annotations?: {
        readOnlyHint?: boolean;
        destructiveHint?: boolean;
        idempotentHint?: boolean;
        openWorldHint?: boolean;
      };
    },
    handler: (params: Record<string, unknown>) => Promise<LiveToolResult>
  ): void;
}

export interface OpenClawToolApiLike {
  registerTool(tool: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    optional?: boolean;
    execute: (params?: Record<string, unknown>) => Promise<LiveToolResult>;
  }): void;
}

// ============================================================================
// Internal Constants
// ============================================================================

const MAX_QUEUE_SIZE = 200;
const FORWARDED_EVENTS = [
  "TASK_CREATED",
  "ASSIGNMENT_SIGNATURE",
  "TASK_DETAILS",
  "REVISION_REQUESTED",
  "TASK_ACCEPTED",
  "TASK_DELIVERED",
  "TASK_SETTLED",
  "TASK_ABANDONED",
  "TASK_SUSPENDED",
  "CHAT_MESSAGE",
  "TASK_CLAIMED",
  "CLAIM_FAILED",
] as const;

// ============================================================================
// Shared Schemas
// ============================================================================

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Expected a 20-byte hex address");
const hashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Expected a 32-byte transaction hash");
const gasQuoteActionSchema = z.enum([
  "approve_token",
  "claim_task",
  "submit_delivery",
  "abandon_task",
  "claim_acceptance_timeout",
  "claim_delivery_timeout",
]);
const preflightPresetSchema = z.enum([
  "approve_usdc_to_escrow",
  "approve_usdc_to_tipjar",
]);
const nodeAutomationModeSchema = z.enum(["MANUAL", "ASSISTED", "AUTO"]);
const nodeStatusSchema = z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]);
const workerHostKindSchema = z.enum(["OPENCLAW", "CODEX", "MCP", "CUSTOM"]);
const workerRunStatusSchema = z.enum([
  "QUEUED",
  "STARTING",
  "RUNNING",
  "WAITING_APPROVAL",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);
const approvalRequestKindSchema = z.enum([
  "TASK_RESPONSE",
  "DELIVERY_SUBMISSION",
  "SIGNING_ACTION",
  "PAYMENT_ACTION",
  "TOOL_PERMISSION",
  "STRATEGY_DECISION",
  "CUSTOM",
]);
const approvalRequestStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
]);
const nodeActionSchema = z.enum(["PAUSE_NODE", "RESUME_NODE", "SET_AUTOMATION_MODE"]);
const workerRunActionSchema = z.enum(["CANCEL", "MARK_FAILED", "RETRY"]);
const workerSessionOutcomeSchema = z.enum(["SUCCEEDED", "FAILED", "CANCELLED"]);
const taskActionSchema = z.enum(["NUDGE_REQUESTER", "MARK_MANUAL_REVIEW", "ADD_NOTE"]);
const jsonRecordSchema = z.record(z.string(), z.unknown());

// ============================================================================
// Utility Functions
// ============================================================================

function formatUnitsString(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;

  if (decimals === 0) {
    return `${negative ? "-" : ""}${absolute.toString()}`;
  }

  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  const fraction = absolute % base;
  const fractionString = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  const formatted = fractionString.length > 0
    ? `${whole.toString()}.${fractionString}`
    : whole.toString();

  return negative ? `-${formatted}` : formatted;
}

function serializeForText(value: unknown): string {
  return JSON.stringify(
    value,
    (_, current) => (typeof current === "bigint" ? `${current.toString()}n` : current),
    2
  );
}

function formatTaskDetailSnapshot(details: {
  taskId?: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  difficulty?: string | null;
  urgency?: string | null;
  rewardAmount?: string | null;
  tokenAddress?: string | null;
  deliveryDurationSeconds?: number | null;
  acceptanceWindowHrs?: number | null;
  maxRevisions?: number | null;
  criteriaCount?: number | null;
  status?: string | null;
  access?: {
    assignmentRole?: string;
    canViewConfidential?: boolean;
  } | null;
}) {
  const lines = [
    `taskId: ${details.taskId ?? "unknown"}`,
    `title: ${details.title ?? "not returned"}`,
    `description: ${details.description ?? "not returned"}`,
    `category: ${details.category ?? "not returned"}`,
    `difficulty: ${details.difficulty ?? "not returned"}`,
    `urgency: ${details.urgency ?? "not returned"}`,
    `rewardAmount: ${details.rewardAmount ?? "not returned"}`,
    `tokenAddress: ${details.tokenAddress ?? "not returned"}`,
    `deliveryDurationSeconds: ${details.deliveryDurationSeconds ?? "not returned"}`,
    `acceptanceWindowHrs: ${details.acceptanceWindowHrs ?? "not returned"}`,
    `maxRevisions: ${details.maxRevisions ?? "not returned"}`,
    `criteriaCount: ${details.criteriaCount ?? "not returned"}`,
    `status: ${details.status ?? "not returned"}`,
    `assignmentRole: ${details.access?.assignmentRole ?? "not returned"}`,
    `canViewConfidential: ${details.access?.canViewConfidential ?? "not returned"}`,
  ];

  return lines.join("\n");
}

function formatError(error: unknown, context: string): LiveToolResult {
  const msg = error instanceof Error ? error.message : String(error);
  let hint = "";

  if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("JWT")) {
    hint = "Hint: Authentication failed. Check AGENTPACT_JWT_TOKEN or let the runtime re-authenticate via SIWE.";
  } else if (msg.includes("403") || msg.includes("Forbidden")) {
    hint = "Hint: Access denied. The wallet may not have permission for this action or the task is in the wrong state.";
  } else if (msg.includes("404") || msg.includes("Not Found")) {
    hint = "Hint: Resource not found. Check that the taskId or escrowId is correct.";
  } else if (msg.includes("insufficient funds") || msg.includes("gas")) {
    hint = "Hint: Insufficient funds for gas. Ensure the wallet has enough ETH for transaction fees.";
  } else if (msg.includes("revert") || msg.includes("execution reverted")) {
    hint = "Hint: Contract call reverted. Use agentpact_get_escrow to inspect the current on-chain state.";
  } else if (msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("ECONNREFUSED")) {
    hint = "Hint: Network error. Check connectivity to the hosted AgentPact API or verify your AGENTPACT_PLATFORM override.";
  } else if (msg.includes("429") || msg.includes("rate limit")) {
    hint = "Hint: Rate limited. Wait briefly before retrying.";
  } else if (msg.includes("private key") || msg.includes("AGENTPACT_AGENT_PK")) {
    hint = "Hint: Private key issue. Ensure AGENTPACT_AGENT_PK is set correctly in the host environment.";
  }

  const text = hint
    ? `Error in ${context}: ${msg}\n\n${hint}`
    : `Error in ${context}: ${msg}`;

  return {
    content: [{ type: "text", text }],
  };
}



function resolveActionPreset(
  agent: AgentWithWalletOverview,
  params: {
    action?: "approve_token" | "claim_task" | "submit_delivery" | "abandon_task" | "claim_acceptance_timeout" | "claim_delivery_timeout";
    tokenAddress?: `0x${string}`;
    spender?: `0x${string}`;
  },
  preset?: "approve_usdc_to_escrow" | "approve_usdc_to_tipjar"
) {
  if (!preset) {
    return params;
  }

  const resolved = { ...params };
  if (preset === "approve_usdc_to_escrow") {
    resolved.action ??= "approve_token";
    resolved.tokenAddress ??= agent.platformConfig.usdcAddress;
    resolved.spender ??= agent.platformConfig.escrowAddress;
  } else if (preset === "approve_usdc_to_tipjar") {
    resolved.action ??= "approve_token";
    resolved.tokenAddress ??= agent.platformConfig.usdcAddress;
    resolved.spender ??= agent.platformConfig.tipJarAddress;
  }

  return resolved;
}

function getEnvArray(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Read content from either a direct string or a local file path.
 * Used by bid_on_task, send_message, and publish_showcase.
 */
async function resolveContentOrFile(content?: string, filePath?: string): Promise<string> {
  if (filePath) {
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch (e: any) {
      throw new Error(`Failed to read file from ${filePath}: ${e.message}`);
    }
  }
  if (!content || content.trim().length === 0) {
    throw new Error("You must provide either 'content' or 'filePath' containing the content.");
  }
  return content;
}

// ============================================================================
// Runtime Factory
// ============================================================================

export function createLiveToolRuntime(options: CreateLiveToolRuntimeOptions = {}): LiveToolRuntime {
  let agentPromise: Promise<AgentPactAgent> | null = null;
  const eventQueue: LiveToolEvent[] = [];
  const logger = options.logger ?? console;

  const getAgent = async () => {
    if (!agentPromise) {
      const privateKey = options.privateKey ?? process.env.AGENTPACT_AGENT_PK;
      if (!privateKey) {
        throw new Error("AGENTPACT_AGENT_PK environment variable is required");
      }

      agentPromise = (async () => {
        const agent = await AgentPactAgent.create({
          privateKey,
          platformUrl: options.platformUrl ?? process.env.AGENTPACT_PLATFORM,
          rpcUrl: options.rpcUrl ?? process.env.AGENTPACT_RPC_URL,
          jwtToken: options.jwtToken ?? process.env.AGENTPACT_JWT_TOKEN,
        });

        await agent.ensureProviderProfile(
          options.agentType ?? process.env.AGENTPACT_AGENT_TYPE ?? "openclaw-agent",
          options.capabilities ?? getEnvArray("AGENTPACT_CAPABILITIES", ["general"])
        );

        for (const eventType of FORWARDED_EVENTS) {
          agent.on(eventType, (event: TaskEvent) => {
            eventQueue.push({
              type: event.type,
              data: event.data,
              timestamp: Date.now(),
            });
            while (eventQueue.length > MAX_QUEUE_SIZE) {
              eventQueue.shift();
            }
          });
        }

        await agent.start();
        logger.error?.("[AgentPact] Shared live tool runtime started.");
        return agent;
      })();
    }

    return agentPromise;
  };

  return {
    getAgent,
    ensureStarted: async () => {
      await getAgent();
    },
    drainEvents: async (maxEvents: number) => {
      await getAgent();
      const events = eventQueue.splice(0, maxEvents);
      return {
        events,
        remaining: eventQueue.length,
      };
    },
    serialize: serializeForText,
    formatError,
  };
}

// ============================================================================
// OpenClaw JSON Schema Converter
// ============================================================================

function toOpenClawParameters(schema: z.ZodTypeAny) {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  const { $schema, definitions, ...rest } = jsonSchema;
  void $schema;
  void definitions;
  return rest;
}

// ============================================================================
// Tool Definition Helper
// ============================================================================

function defineTool<TSchema extends z.ZodTypeAny>(tool: SharedLiveToolDefinition<TSchema>) {
  return tool;
}

// ============================================================================
// ALL Shared Live Tools (36 tools)
// ============================================================================

const sharedLiveTools: SharedLiveToolDefinition<any>[] = [
  // ==========================================================================
  // DISCOVERY TOOLS (6)
  // ==========================================================================
  defineTool({
    name: "agentpact_get_available_tasks",
    title: "Get Available Tasks",
    description: "Browse open tasks on the AgentPact marketplace that are looking for AI proposals.",
    context: "get_available_tasks",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).default(10).describe("Maximum results to return"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const tasks = await agent.getAvailableTasks({ status: "OPEN", limit: params.limit });
      return {
        content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
        structuredContent: { tasks },
      };
    },
  }),

  defineTool({
    name: "agentpact_get_my_tasks",
    title: "Get My Tasks",
    description: "List tasks associated with the current provider wallet. Useful for building a personal task inbox instead of only browsing public marketplace work.",
    context: "get_my_tasks",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).default(20).describe("Maximum tasks to return"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      status: z.string().optional().describe("Optional task status filter such as CREATED, WORKING, DELIVERED, or IN_REVISION"),
      assignment: z.string().optional().describe("Optional assignment filter supported by the platform task list API"),
      sortBy: z.string().default("newest").describe("Sort mode such as newest or oldest"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWorkspace;
      const tasks = await agent.getMyTasks({
        limit: params.limit,
        offset: params.offset,
        status: params.status,
        assignment: params.assignment,
        sortBy: params.sortBy,
      });
      return {
        content: [{
          type: "text",
          text: `Fetched ${tasks.length} provider task(s).\n\n${serializeForText(tasks)}`,
        }],
        structuredContent: { tasks },
      };
    },
  }),

  defineTool({
    name: "agentpact_register_provider",
    title: "Register Provider Profile",
    description: "Register the current wallet as an AgentPact provider so it can bid on tasks.",
    context: "register_provider",
    inputSchema: z.object({
      agentType: z.string().default("openclaw-agent"),
      capabilities: z.array(z.string()).default(["general"]),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const profile = await agent.ensureProviderProfile(params.agentType, params.capabilities);
      return {
        content: [{ type: "text", text: `Provider profile ready: ${JSON.stringify(profile)}` }],
        structuredContent: { profile },
      };
    },
  }),

  defineTool({
    name: "agentpact_get_provider_profile",
    title: "Get Provider Profile",
    description: "Read the current wallet's provider profile including agent type, capabilities, headline, portfolio links, and credit-related fields.",
    context: "get_provider_profile",
    inputSchema: z.object({}).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime) => {
      const agent = await runtime.getAgent() as AgentWithWorkspace;
      const profile = await agent.getProviderProfile();
      return {
        content: [{
          type: "text",
          text: `Current provider profile:\n\n${serializeForText(profile)}`,
        }],
        structuredContent: { profile },
      };
    },
  }),

  defineTool({
    name: "agentpact_update_provider_profile",
    title: "Update Provider Profile",
    description: "Update the current provider profile's positioning fields such as capabilities, headline, bio, preferred categories, and portfolio links.",
    context: "update_provider_profile",
    inputSchema: z.object({
      agentType: z.string().optional().describe("Optional provider type label"),
      capabilities: z.array(z.string()).optional().describe("Capability list used for matching and profile display"),
      headline: z.string().optional().describe("Short provider headline"),
      bio: z.string().optional().describe("Longer provider bio"),
      capabilityTags: z.array(z.string()).optional().describe("Additional capability tags"),
      preferredCategories: z.array(z.string()).optional().describe("Preferred task categories"),
      portfolioLinks: z.array(z.string()).optional().describe("Portfolio or showcase links"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWorkspace;
      const profile = await agent.updateProviderProfile(params);
      return {
        content: [{
          type: "text",
          text: `Provider profile updated.\n\n${serializeForText(profile)}`,
        }],
        structuredContent: { profile },
      };
    },
  }),

  defineTool({
    name: "agentpact_fetch_task_details",
    title: "Fetch Task Details",
    description: "Retrieve a full task fact snapshot plus confidential materials when authorized. Use the returned taskId and exact fields as the source of truth; if a field is absent, report it as not returned instead of guessing.",
    context: "fetch_task_details",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID to fetch details for"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const details = await agent.fetchTaskDetails(params.taskId);
      return {
        content: [{
          type: "text",
          text: `Task fact snapshot:\n${formatTaskDetailSnapshot(details)}\n\nRaw details JSON:\n${JSON.stringify(details, null, 2)}`,
        }],
        structuredContent: { details },
      };
    },
  }),

  defineTool({
    name: "agentpact_get_escrow",
    title: "Get Escrow State",
    description: "Query the on-chain escrow state for a task. Returns state, deadlines, revision count, criteria, fund weights, and all relevant contract data.",
    context: "get_escrow",
    inputSchema: z.object({
      escrowId: z.string().describe("The on-chain escrow ID"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const escrow = await agent.client.getEscrow(BigInt(params.escrowId));
      const serialized = runtime.serialize(escrow);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { escrow: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_get_task_timeline",
    title: "Get Task Timeline",
    description: "Retrieve the task timeline. Platform will prefer Envio-backed timeline events and fall back to local task logs when needed.",
    context: "get_task_timeline",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const timeline = await agent.getTaskTimeline(params.taskId);
      return {
        content: [{ type: "text", text: JSON.stringify(timeline, null, 2) }],
        structuredContent: { timeline },
      };
    },
  }),

  // ==========================================================================
  // WALLET TOOLS (6)
  // ==========================================================================
  defineTool({
    name: "agentpact_get_wallet_overview",
    title: "Get Wallet Overview",
    description: "Return the current agent wallet address together with its ETH gas balance and configured USDC balance.",
    context: "get_wallet_overview",
    inputSchema: z.object({}).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime) => {
      const agent = await runtime.getAgent() as AgentWithWalletOverview;
      const overview = await agent.getWalletOverview();
      const serialized = runtime.serialize(overview);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { wallet: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_get_token_balance",
    title: "Get Token Balance",
    description: "Read the current agent wallet's balance for an arbitrary ERC20 token address.",
    context: "get_token_balance",
    inputSchema: z.object({
      tokenAddress: addressSchema.describe("ERC20 token contract address"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWalletOverview;
      const balance = await agent.getTokenBalanceInfo(params.tokenAddress as `0x${string}`);
      const serialized = runtime.serialize({
        walletAddress: agent.walletAddress,
        balance,
      });
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: JSON.parse(serialized),
      };
    },
  }),

  defineTool({
    name: "agentpact_get_token_allowance",
    title: "Get Token Allowance",
    description: "Read the current agent wallet's ERC20 allowance for a spender contract.",
    context: "get_token_allowance",
    inputSchema: z.object({
      tokenAddress: addressSchema.describe("ERC20 token contract address"),
      spender: addressSchema.describe("Contract or wallet allowed to spend the token"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWalletOverview;
      const [allowance, token] = await Promise.all([
        agent.getTokenAllowance(
          params.tokenAddress as `0x${string}`,
          params.spender as `0x${string}`
        ),
        agent.getTokenBalanceInfo(params.tokenAddress as `0x${string}`),
      ]);
      const serialized = runtime.serialize({
        owner: agent.walletAddress,
        spender: params.spender,
        token: {
          tokenAddress: token.tokenAddress,
          symbol: token.symbol,
          decimals: token.decimals,
        },
        allowanceRaw: allowance,
        allowanceFormatted: formatUnitsString(allowance, token.decimals),
      });
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: JSON.parse(serialized),
      };
    },
  }),

  defineTool({
    name: "agentpact_get_gas_quote",
    title: "Get Gas Quote",
    description: "Estimate gas and fee cost for a supported AgentPact write action before submitting a transaction.",
    context: "get_gas_quote",
    inputSchema: z.object({
      preset: preflightPresetSchema.optional().describe("Optional shortcut for common approve flows such as USDC -> escrow or USDC -> tipjar"),
      action: gasQuoteActionSchema.describe("Supported action to estimate"),
      tokenAddress: addressSchema.optional().describe("Required for approve_token"),
      spender: addressSchema.optional().describe("Required for approve_token"),
      amount: z.string().optional().describe("Base-unit integer amount used for approve_token exact approval"),
      escrowId: z.string().optional().describe("Required for task lifecycle and timeout actions"),
      deliveryHash: hashSchema.optional().describe("Required for submit_delivery"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWalletOverview;
      const resolved = resolveActionPreset(agent, {
        action: params.action,
        tokenAddress: params.tokenAddress as `0x${string}` | undefined,
        spender: params.spender as `0x${string}` | undefined,
      }, params.preset);
      const quote = await agent.getGasQuote({
        action: resolved.action!,
        tokenAddress: resolved.tokenAddress,
        spender: resolved.spender,
        amount: params.amount ? BigInt(params.amount) : undefined,
        escrowId: params.escrowId ? BigInt(params.escrowId) : undefined,
        deliveryHash: params.deliveryHash as `0x${string}` | undefined,
      });
      const serialized = runtime.serialize(quote);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { quote: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_preflight_check",
    title: "Preflight Check",
    description: "Run a lightweight safety check before a gas-spending or token-spending action. Returns wallet, chain, gas, balance, allowance, and proceed recommendation.",
    context: "preflight_check",
    inputSchema: z.object({
      preset: preflightPresetSchema.optional().describe("Optional shortcut for common approve flows such as USDC -> escrow or USDC -> tipjar"),
      action: gasQuoteActionSchema.optional().describe("Optional action to estimate and validate before sending"),
      tokenAddress: addressSchema.optional().describe("Optional ERC20 token address to check"),
      spender: addressSchema.optional().describe("Optional spender address for allowance checks"),
      requiredAmount: z.string().optional().describe("Optional base-unit integer amount to require for token balance / allowance"),
      escrowId: z.string().optional().describe("Escrow ID for action-aware checks"),
      deliveryHash: hashSchema.optional().describe("Delivery hash for submit_delivery checks"),
      minNativeBalanceWei: z.string().optional().describe("Optional explicit ETH threshold in wei"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWalletOverview;
      const resolved = resolveActionPreset(agent, {
        action: params.action,
        tokenAddress: params.tokenAddress as `0x${string}` | undefined,
        spender: params.spender as `0x${string}` | undefined,
      }, params.preset);
      const result = await agent.preflightCheck({
        action: resolved.action,
        tokenAddress: resolved.tokenAddress,
        spender: resolved.spender,
        requiredAmount: params.requiredAmount ? BigInt(params.requiredAmount) : undefined,
        escrowId: params.escrowId ? BigInt(params.escrowId) : undefined,
        deliveryHash: params.deliveryHash as `0x${string}` | undefined,
        minNativeBalanceWei: params.minNativeBalanceWei ? BigInt(params.minNativeBalanceWei) : undefined,
      });
      const serialized = runtime.serialize(result);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { preflight: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_approve_token",
    title: "Approve Token",
    description: "Submit an ERC20 approve transaction from the current agent wallet. Exact mode expects a base-unit integer string.",
    context: "approve_token",
    inputSchema: z.object({
      tokenAddress: addressSchema.describe("ERC20 token contract address"),
      spender: addressSchema.describe("Contract or wallet allowed to spend the token"),
      mode: z.enum(["max", "exact"]).default("max")
        .describe("Use 'max' for unlimited approval, or 'exact' to approve the provided base-unit amount"),
      amount: z.string().optional()
        .describe("Base-unit integer amount required when mode='exact' (for example 1000000 for 1.0 USDC)"),
    }).strict(),
    execute: async (runtime, params) => {
      let amount: bigint | undefined;
      if (params.mode === "exact") {
        if (!params.amount) {
          throw new Error("amount is required when mode='exact'");
        }
        amount = BigInt(params.amount);
      }

      const agent = await runtime.getAgent() as AgentWithWalletOverview;
      const txHash = await agent.approveToken(
        params.tokenAddress as `0x${string}`,
        params.spender as `0x${string}`,
        amount
      );
      return {
        content: [{
          type: "text",
          text: `Approval transaction submitted. TX: ${txHash}`,
        }],
        structuredContent: {
          txHash,
          mode: params.mode,
          amount: amount?.toString() ?? "max",
          tokenAddress: params.tokenAddress,
          spender: params.spender,
        },
      };
    },
  }),

  // ==========================================================================
  // TRANSACTION TOOLS (2)
  // ==========================================================================
  defineTool({
    name: "agentpact_get_transaction_status",
    title: "Get Transaction Status",
    description: "Read the latest observable status of a transaction without waiting. Returns pending, success, reverted, or not_found.",
    context: "get_transaction_status",
    inputSchema: z.object({
      txHash: hashSchema.describe("Transaction hash to inspect"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWalletOverview;
      const status = await agent.getTransactionStatus(params.txHash as `0x${string}`);
      const serialized = runtime.serialize(status);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { transaction: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_wait_for_transaction",
    title: "Wait For Transaction",
    description: "Wait for a transaction receipt and return status, gas usage, and explorer link.",
    context: "wait_for_transaction",
    inputSchema: z.object({
      txHash: hashSchema.describe("Transaction hash to wait for"),
      confirmations: z.number().int().min(1).max(25).default(1)
        .describe("How many confirmations to wait for"),
      timeoutMs: z.number().int().min(1000).max(600000).optional()
        .describe("Optional timeout in milliseconds"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWalletOverview;
      const receipt = await agent.waitForTransaction(
        params.txHash as `0x${string}`,
        {
          confirmations: params.confirmations,
          timeoutMs: params.timeoutMs,
        }
      );
      const serialized = runtime.serialize(receipt);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { receipt: JSON.parse(serialized) },
      };
    },
  }),

  // ==========================================================================
  // LIFECYCLE TOOLS (5)
  // ==========================================================================
  defineTool({
    name: "agentpact_bid_on_task",
    title: "Bid on Task",
    description: "Submit a proposal to bid on a specific AgentPact task. Requires a thoughtful proposal explaining how you will complete the work. You can optionally provide a filePath to read the proposal from a local file.",
    context: "bid_on_task",
    inputSchema: z.object({
      taskId: z.string().describe("The ID of the task to bid on"),
      proposal: z.string().optional().describe("Proposal content detailing your approach"),
      filePath: z.string().optional().describe("Absolute path to a local file containing the proposal content. Preferred for large proposals."),
    }).strict(),
    execute: async (runtime, params) => {
      const proposalContent = await resolveContentOrFile(params.proposal, params.filePath);
      const agent = await runtime.getAgent();
      const result = await agent.bidOnTask(params.taskId, proposalContent);
      return { content: [{ type: "text", text: `Bid submitted successfully. Result: ${JSON.stringify(result)}` }] };
    },
  }),

  defineTool({
    name: "agentpact_reject_invitation",
    title: "Reject Invitation",
    description: "Reject a task invitation after reviewing confidential materials but before on-chain claim. Use this if the hidden scope is not feasible or you cannot fulfill the task. Providing a reason is highly recommended.",
    context: "reject_invitation",
    inputSchema: z.object({
      taskId: z.string().describe("The ID of the task to reject"),
      reason: z.string().optional().describe("Detailed reason for rejection"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      await agent.rejectInvitation(params.taskId, params.reason);
      return { content: [{ type: "text", text: `Invitation rejected successfully for task ${params.taskId}.` }] };
    },
  }),

  defineTool({
    name: "agentpact_claim_assigned_task",
    title: "Claim Assigned Task",
    description: "Claim a selected task on-chain after reviewing confidential materials. This enters Working immediately and starts the delivery deadline.",
    context: "claim_task",
    inputSchema: z.object({
      taskId: z.string().describe("The platform task ID with an active assignment signature"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const txHash = await agent.claimAssignedTask(params.taskId);
      return { content: [{ type: "text", text: `Task claimed on-chain and now in Working. TX: ${txHash}` }] };
    },
  }),

  defineTool({
    name: "agentpact_submit_delivery",
    title: "Submit Delivery",
    description: "Submit completed work by providing the delivery artifact hash and optional content. This writes the delivery details to the platform database and triggers the on-chain submission.",
    context: "submit_delivery",
    inputSchema: z.object({
      taskId: z.string().describe("The ID of the task you are submitting delivery for"),
      escrowId: z.string().describe("The on-chain escrow ID"),
      deliveryHash: hashSchema.describe("The 0x-prefixed bytes32 hash/CID of the completed delivery artifacts"),
      content: z.string().optional().describe("Delivery notes or repository/commit references"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      
      const payload = {
          deliveryHash: params.deliveryHash,
          content: params.content || "Delivery submitted via AgentPact MCP.",
      };

      const result = await agent.createTaskDelivery(params.taskId, payload);
      
      const txHash = await agent.submitDelivery(
        BigInt(params.escrowId),
        params.deliveryHash
      );

      await agent.attachDeliveryTxHash(params.taskId, result.delivery.id, txHash);

      return { content: [{ type: "text", text: `Delivery submitted successfully. TX: ${txHash}, Delivery ID: ${result.delivery.id}` }] };
    },
  }),

  defineTool({
    name: "agentpact_abandon_task",
    title: "Abandon Task",
    description: "Voluntarily abandon a task during Working or InRevision state. Has a lighter credit penalty than delivery timeout. The task returns to Created for re-matching.",
    context: "abandon_task",
    inputSchema: z.object({
      escrowId: z.string().describe("The on-chain escrow ID"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const txHash = await agent.abandonTask(BigInt(params.escrowId));
      return { content: [{ type: "text", text: `Task abandoned on-chain. TX: ${txHash}` }] };
    },
  }),

  // ==========================================================================
  // COMMUNICATION TOOLS (7)
  // ==========================================================================
  defineTool({
    name: "agentpact_send_message",
    title: "Send Chat Message",
    description: "Send a message in the task chat channel. Use for clarifications, progress updates, or general communication with the task requester. You can optionally provide a filePath to read the message content from a local file.",
    context: "send_message",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID"),
      content: z.string().optional().describe("Message content"),
      filePath: z.string().optional().describe("Absolute path to a local file containing the message content. Preferred for long messages or code snippets."),
      messageType: z.enum(["CLARIFICATION", "PROGRESS", "GENERAL"])
        .default("GENERAL")
        .describe("Message type: CLARIFICATION (ask about requirements), PROGRESS (report status), GENERAL (other)"),
    }).strict(),
    execute: async (runtime, params) => {
      const messageContent = await resolveContentOrFile(params.content, params.filePath);
      const agent = await runtime.getAgent();
      const result = await agent.sendMessage(params.taskId, messageContent, params.messageType);
      return { content: [{ type: "text", text: `Message sent. ${JSON.stringify(result)}` }] };
    },
  }),

  defineTool({
    name: "agentpact_get_messages",
    title: "Get Chat Messages",
    description: "Retrieve chat messages for a specific task. Useful for reviewing conversation history and requester feedback.",
    context: "get_messages",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID"),
      limit: z.number().int().min(1).max(100).default(20).describe("Maximum messages to return"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const result = await agent.chat.getMessages(params.taskId, { limit: params.limit });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: { messages: result.messages, total: result.total },
      };
    },
  }),

  defineTool({
    name: "agentpact_get_clarifications",
    title: "Get Clarifications",
    description: "Read structured clarification requests for a task, including open protection windows, requester responses, and clarification status.",
    context: "get_clarifications",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWorkspace;
      const clarifications = await agent.getClarifications(params.taskId);
      return {
        content: [{
          type: "text",
          text: `Fetched ${clarifications.length} clarification item(s).\n\n${serializeForText(clarifications)}`,
        }],
        structuredContent: { clarifications },
      };
    },
  }),

  defineTool({
    name: "agentpact_get_unread_chat_count",
    title: "Get Unread Chat Count",
    description: "Get the unread message count for a task chat so the operator can quickly triage active conversations.",
    context: "get_unread_chat_count",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWorkspace;
      const unreadCount = await agent.getUnreadChatCount(params.taskId);
      return {
        content: [{
          type: "text",
          text: `Unread chat count for task ${params.taskId}: ${unreadCount}`,
        }],
        structuredContent: { taskId: params.taskId, unreadCount },
      };
    },
  }),

  defineTool({
    name: "agentpact_mark_chat_read",
    title: "Mark Chat Read",
    description: "Mark chat messages as read up to a specific message ID for a task conversation.",
    context: "mark_chat_read",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID"),
      lastReadMessageId: z.string().describe("The latest message ID you want to mark as read"),
    }).strict(),
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWorkspace;
      await agent.markChatRead(params.taskId, params.lastReadMessageId);
      return {
        content: [{
          type: "text",
          text: `Marked chat as read for task ${params.taskId} through message ${params.lastReadMessageId}.`,
        }],
        structuredContent: {
          taskId: params.taskId,
          lastReadMessageId: params.lastReadMessageId,
          success: true,
        },
      };
    },
  }),

  defineTool({
    name: "agentpact_report_progress",
    title: "Report Task Progress",
    description: "Report execution progress to the platform. The requester can see your progress percentage and description in real-time. Call this every ~30% completion.",
    context: "report_progress",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID"),
      percent: z.number().min(0).max(100).describe("Progress percentage (0-100)"),
      description: z.string().min(1).describe("Progress description, e.g. 'API development complete'"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      await agent.reportProgress(params.taskId, params.percent, params.description);
      return { content: [{ type: "text", text: `Progress reported: ${params.percent}% — ${params.description}` }] };
    },
  }),

  defineTool({
    name: "agentpact_get_revision_details",
    title: "Get Revision Details",
    description: "Fetch structured revision feedback including per-criterion pass/fail results, revision items, and requester comments. Use after receiving a REVISION_REQUESTED event to understand exactly what needs to be fixed.",
    context: "get_revision_details",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID"),
      revision: z.number().int().min(1).optional().describe("Specific revision number (1-based). Omit to get the latest."),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const details = await agent.getRevisionDetails(params.taskId, params.revision);
      return {
        content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
        structuredContent: { revision: details },
      };
    },
  }),

  // ==========================================================================
  // EVENT & NOTIFICATION TOOLS (3)
  // ==========================================================================
  defineTool({
    name: "agentpact_poll_events",
    title: "Poll Platform Events",
    description: "Poll for new platform events from the runtime WebSocket connection. Events are consumed on read.",
    context: "poll_events",
    inputSchema: z.object({
      maxEvents: z.number().int().min(1).max(50).default(10).describe("Maximum events to return in one poll"),
    }).strict(),
    readOnlyHint: true,
    execute: async (runtime, params) => {
      const result = await runtime.drainEvents(params.maxEvents);
      if (result.events.length === 0) {
        return {
          content: [{ type: "text", text: "No new events." }],
          structuredContent: { events: [], remaining: result.remaining },
        };
      }

      return {
        content: [{
          type: "text",
          text: `${result.events.length} event(s) received (${result.remaining} remaining):\n\n${result.events.map((event) =>
            `[${new Date(event.timestamp).toISOString()}] ${event.type}: ${JSON.stringify(event.data)}`
          ).join("\n")}`,
        }],
        structuredContent: result,
      };
    },
  }),

  defineTool({
    name: "agentpact_get_notifications",
    title: "Get Notification History",
    description: "Fetch persisted user notifications from the AgentPact notification center.",
    context: "get_notifications",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).default(20).describe("Maximum notifications to return"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      unreadOnly: z.boolean().default(false).describe("Return only unread notifications"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithNotifications;
      const result = await agent.getNotifications({
        limit: params.limit,
        offset: params.offset,
        unreadOnly: params.unreadOnly,
      });

      if (result.notifications.length === 0) {
        return {
          content: [{ type: "text", text: `No notifications found. unreadCount=${result.unreadCount}` }],
          structuredContent: result,
        };
      }

      return {
        content: [{
          type: "text",
          text:
            `Fetched ${result.notifications.length} notification(s), unread=${result.unreadCount}.\n\n` +
            result.notifications
              .map((item: PersistedNotification) => `[${item.createdAt}] ${item.event}${item.readAt ? " [read]" : " [unread]"}: ${JSON.stringify(item.data)}`)
              .join("\n"),
        }],
        structuredContent: result,
      };
    },
  }),

  defineTool({
    name: "agentpact_mark_notifications_read",
    title: "Mark Notifications Read",
    description: "Mark one notification or the whole notification inbox as read in the AgentPact notification center.",
    context: "mark_notifications_read",
    inputSchema: z.object({
      notificationId: z.string().optional().describe("Specific notification ID to mark as read. Omit to mark all notifications as read."),
    }).strict(),
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithNotifications;
      const result = await agent.markNotificationsRead(params.notificationId);
      return {
        content: [{
          type: "text",
          text: params.notificationId
            ? `Notification marked as read: ${params.notificationId}`
            : `All notifications marked as read. updated=${result.updatedCount ?? 0}`,
        }],
        structuredContent: result,
      };
    },
  }),

  // ==========================================================================
  // WORKSPACE TOOLS (1)
  // ==========================================================================
  defineTool({
    name: "agentpact_get_task_inbox_summary",
    title: "Get Task Inbox Summary",
    description: "Build a provider-side inbox summary by combining your task list, unread notification count, and unread chat counts across active tasks.",
    context: "get_task_inbox_summary",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).default(50).describe("Maximum provider tasks to inspect while building the summary"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWorkspace & AgentWithNotifications;
      const tasks = await agent.getMyTasks({
        limit: params.limit,
        offset: 0,
        sortBy: "newest",
      });
      const notifications = await agent.getNotifications({
        limit: 20,
        offset: 0,
        unreadOnly: true,
      });

      const activeTasks = tasks.filter((task: any) =>
        ["CREATED", "WORKING", "DELIVERED", "IN_REVISION"].includes(String(task?.status ?? ""))
      );
      const unreadChatResults = await Promise.all(
        activeTasks.map(async (task: any) => ({
          taskId: String(task.id),
          title: task?.title ?? "Untitled task",
          unreadCount: await agent.getUnreadChatCount(String(task.id)),
          status: String(task?.status ?? "UNKNOWN"),
        }))
      );

      const summary = {
        totalTasks: tasks.length,
        needsClaim: tasks.filter((task: any) => String(task?.status ?? "") === "CREATED").length,
        inRevision: tasks.filter((task: any) => String(task?.status ?? "") === "IN_REVISION").length,
        working: tasks.filter((task: any) => String(task?.status ?? "") === "WORKING").length,
        waitingRequesterReview: tasks.filter((task: any) => String(task?.status ?? "") === "DELIVERED").length,
        unreadNotifications: notifications.unreadCount,
        unreadChatsTotal: unreadChatResults.reduce((sum: number, item: { unreadCount: number }) => sum + item.unreadCount, 0),
        tasksWithUnreadChats: unreadChatResults.filter((item: { unreadCount: number }) => item.unreadCount > 0),
        topTasks: tasks.slice(0, 5).map((task: any) => ({
          id: task.id,
          title: task?.title ?? "Untitled task",
          status: task?.status ?? "UNKNOWN",
          rewardAmount: task?.rewardAmount ?? null,
        })),
      };

      return {
        content: [{
          type: "text",
          text:
            `Task inbox summary:\n` +
            `- totalTasks=${summary.totalTasks}\n` +
            `- needsClaim=${summary.needsClaim}\n` +
            `- inRevision=${summary.inRevision}\n` +
            `- working=${summary.working}\n` +
            `- waitingRequesterReview=${summary.waitingRequesterReview}\n` +
            `- unreadNotifications=${summary.unreadNotifications}\n` +
            `- unreadChatsTotal=${summary.unreadChatsTotal}\n\n` +
            serializeForText(summary),
        }],
        structuredContent: { summary },
      };
    },
  }),

  defineTool({
    name: "agentpact_get_my_node",
    title: "Get My Agent Node",
    description: "Read the current owner's Agent Node profile, automation mode, policy summary, and lightweight operating stats.",
    context: "get_my_node",
    inputSchema: z.object({}).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime) => {
      const agent = await runtime.getAgent();
      const node = await agent.getMyNode();
      const serialized = runtime.serialize(node);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { node: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_ensure_node",
    title: "Ensure Agent Node",
    description: "Ensure that the current owner has an Agent Node. Creates one when missing and returns the active node profile.",
    context: "ensure_node",
    inputSchema: z.object({
      displayName: z.string().min(1).optional().describe("Optional preferred public display name for the node"),
      slug: z.string().min(2).optional().describe("Optional public slug"),
      description: z.string().optional().describe("Optional node description"),
      automationMode: nodeAutomationModeSchema.optional().describe("Default automation mode for this node"),
      headline: z.string().optional().describe("Short public headline shown in candidate lists"),
      capabilityTags: z.array(z.string()).optional().describe("Capability tags used for matching"),
      policy: jsonRecordSchema.optional().describe("Structured node policy object such as maxConcurrentTasks or approval rules"),
      agentType: z.string().optional().describe("Optional legacy provider profile agent type"),
      capabilities: z.array(z.string()).optional().describe("Optional legacy provider capability list"),
      preferredCategories: z.array(z.string()).optional().describe("Optional preferred task categories"),
      portfolioLinks: z.array(z.string()).optional().describe("Optional portfolio links"),
    }).strict(),
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const node = await agent.ensureNode(params);
      const serialized = runtime.serialize(node);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { node: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_update_my_node",
    title: "Update Agent Node",
    description: "Update the current Agent Node's public metadata, automation mode, policy, or availability status.",
    context: "update_my_node",
    inputSchema: z.object({
      displayName: z.string().min(1).optional().describe("Updated public display name"),
      slug: z.string().min(2).optional().describe("Updated public slug"),
      description: z.string().optional().describe("Updated description"),
      status: nodeStatusSchema.optional().describe("ACTIVE, PAUSED, or ARCHIVED"),
      automationMode: nodeAutomationModeSchema.optional().describe("MANUAL, ASSISTED, or AUTO"),
      headline: z.string().optional().describe("Updated public headline"),
      capabilityTags: z.array(z.string()).optional().describe("Updated capability tags"),
      policy: jsonRecordSchema.optional().describe("Updated structured node policy"),
      agentType: z.string().optional().describe("Updated legacy provider profile agent type"),
      capabilities: z.array(z.string()).optional().describe("Updated legacy provider capability list"),
      preferredCategories: z.array(z.string()).optional().describe("Updated preferred task categories"),
      portfolioLinks: z.array(z.string()).optional().describe("Updated portfolio links"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const node = await agent.updateMyNode(params);
      const serialized = runtime.serialize(node);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { node: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_execute_node_action",
    title: "Execute Node Action",
    description: "Execute a control-plane action for the current Agent Node, such as pause, resume, or switching automation mode.",
    context: "execute_node_action",
    inputSchema: z.object({
      action: nodeActionSchema.describe("PAUSE_NODE, RESUME_NODE, or SET_AUTOMATION_MODE"),
      automationMode: nodeAutomationModeSchema.optional().describe("Required when action is SET_AUTOMATION_MODE"),
      note: z.string().optional().describe("Optional operator note for audit context"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const node = await agent.executeNodeAction({
        action: params.action,
        automationMode: params.automationMode,
        note: params.note,
      });
      const serialized = runtime.serialize(node);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { node: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_get_worker_runs",
    title: "Get Worker Runs",
    description: "List worker runs owned by the current Agent Node. Useful for checking queued work, progress, waiting approvals, or failures.",
    context: "get_worker_runs",
    inputSchema: z.object({
      status: workerRunStatusSchema.optional().describe("Optional worker run status filter"),
      taskId: z.string().optional().describe("Optional task filter"),
      limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of runs to return"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const runs = await agent.getNodeWorkerRuns(params);
      const serialized = runtime.serialize(runs);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { runs: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_create_worker_run",
    title: "Create Worker Run",
    description: "Create a worker run for the current Agent Node. Use this when dispatching a task to OpenClaw, Codex, MCP, or another custom host.",
    context: "create_worker_run",
    inputSchema: z.object({
      taskId: z.string().optional().describe("Optional task linked to this worker run"),
      hostKind: workerHostKindSchema.describe("Worker host kind such as OPENCLAW, CODEX, MCP, or CUSTOM"),
      workerKey: z.string().min(1).describe("Stable host-local worker identifier"),
      displayName: z.string().optional().describe("Human-readable worker label"),
      model: z.string().optional().describe("Optional model identifier"),
      status: workerRunStatusSchema.optional().describe("Initial status, defaults to platform-side default"),
      percent: z.number().min(0).max(100).optional().describe("Optional progress percentage"),
      currentStep: z.string().optional().describe("Current execution step"),
      summary: z.string().optional().describe("Short run summary"),
      metadata: jsonRecordSchema.optional().describe("Structured metadata such as repo, branch, or run URL"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const run = await agent.createWorkerRun(params);
      const serialized = runtime.serialize(run);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { run: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_begin_task_session",
    title: "Begin Task Session",
    description: "Bootstrap a real worker execution session by ensuring the node exists, loading task details, subscribing to task events, creating a RUNNING worker run, and returning a compact execution brief.",
    context: "begin_task_session",
    inputSchema: z.object({
      taskId: z.string().min(1).describe("Task ID to execute"),
      hostKind: workerHostKindSchema.describe("Worker host kind such as OPENCLAW, CODEX, MCP, or CUSTOM"),
      workerKey: z.string().min(1).describe("Stable host-local worker identifier"),
      displayName: z.string().optional().describe("Human-readable worker label"),
      model: z.string().optional().describe("Optional model identifier"),
      currentStep: z.string().optional().describe("Initial current step"),
      summary: z.string().optional().describe("Initial run summary"),
      metadata: jsonRecordSchema.optional().describe("Structured metadata such as repo, branch, or run URL"),
      ensureNode: z.object({
        displayName: z.string().min(1).optional(),
        slug: z.string().min(2).optional(),
        description: z.string().optional(),
        automationMode: nodeAutomationModeSchema.optional(),
        headline: z.string().optional(),
        capabilityTags: z.array(z.string()).optional(),
        policy: jsonRecordSchema.optional(),
        agentType: z.string().optional(),
        capabilities: z.array(z.string()).optional(),
        preferredCategories: z.array(z.string()).optional(),
        portfolioLinks: z.array(z.string()).optional(),
      }).strict().optional().describe("Optional node bootstrap data used only when the owner does not already have a node"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWorkerSessions;
      const session = await agent.startWorkerTaskSession(params);
      const serialized = runtime.serialize(session);
      return {
        content: [{
          type: "text",
          text:
            `Task session started for ${params.taskId}.\n` +
            `runId=${session.run.id}\n` +
            `nodeId=${session.node.id}\n` +
            `assignmentRole=${session.task.access?.assignmentRole ?? "unknown"}\n` +
            `unreadChat=${session.brief.unreadChatCount ?? 0}\n` +
            `pendingApprovals=${session.brief.pendingApprovals?.length ?? 0}\n` +
            `openClarifications=${session.brief.clarifications?.length ?? 0}\n\n` +
            serialized,
        }],
        structuredContent: { session: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_get_task_execution_brief",
    title: "Get Task Execution Brief",
    description: "Retrieve a compact worker-facing execution brief for a task, including task details, worker runs, pending approvals, clarifications, recent messages, and suggested next actions.",
    context: "get_task_execution_brief",
    inputSchema: z.object({
      taskId: z.string().min(1).describe("Task ID to inspect"),
      messagesLimit: z.number().int().min(1).max(100).default(20).describe("Recent chat messages to include"),
      workerRunsLimit: z.number().int().min(1).max(50).default(10).describe("Worker runs to include for this task"),
      approvalsLimit: z.number().int().min(1).max(50).default(20).describe("Pending approvals to include for this task"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWorkerSessions;
      const brief = await agent.getWorkerTaskExecutionBrief(params);
      const serialized = runtime.serialize(brief);
      return {
        content: [{
          type: "text",
          text:
            `Execution brief ready for ${params.taskId}.\n` +
            `unreadChat=${brief.unreadChatCount ?? 0}\n` +
            `pendingApprovals=${brief.pendingApprovals?.length ?? 0}\n` +
            `workerRuns=${brief.workerRuns?.length ?? 0}\n\n` +
            serialized,
        }],
        structuredContent: { brief: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_update_worker_run",
    title: "Update Worker Run",
    description: "Update worker progress, status, step, summary, or metadata for a previously created worker run.",
    context: "update_worker_run",
    inputSchema: z.object({
      runId: z.string().min(1).describe("Worker run ID"),
      status: workerRunStatusSchema.optional().describe("Updated worker run status"),
      percent: z.number().min(0).max(100).optional().describe("Updated progress percentage"),
      currentStep: z.string().optional().describe("Updated current step"),
      summary: z.string().optional().describe("Updated short run summary"),
      metadata: jsonRecordSchema.optional().describe("Updated structured metadata"),
    }).strict(),
    execute: async (runtime, params) => {
      const { runId, ...updates } = params;
      const agent = await runtime.getAgent();
      const run = await agent.updateWorkerRun(runId, updates);
      const serialized = runtime.serialize(run);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { run: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_finish_task_session",
    title: "Finish Task Session",
    description: "Complete a worker execution session by marking the worker run succeeded, failed, or cancelled, and optionally unwatching the task.",
    context: "finish_task_session",
    inputSchema: z.object({
      runId: z.string().min(1).describe("Worker run ID"),
      taskId: z.string().optional().describe("Optional task ID to stop watching after completion"),
      outcome: workerSessionOutcomeSchema.describe("SUCCEEDED, FAILED, or CANCELLED"),
      percent: z.number().min(0).max(100).optional().describe("Optional final progress percentage"),
      currentStep: z.string().optional().describe("Optional final current step"),
      summary: z.string().optional().describe("Optional final summary"),
      metadata: jsonRecordSchema.optional().describe("Optional final metadata payload"),
      unwatchTask: z.boolean().optional().describe("Defaults to true when taskId is provided"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent() as AgentWithWorkerSessions;
      const run = await agent.finishWorkerTaskSession(params);
      const serialized = runtime.serialize(run);
      return {
        content: [{
          type: "text",
          text: `Task session finished. runId=${run.id} outcome=${params.outcome}\n\n${serialized}`,
        }],
        structuredContent: { run: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_execute_worker_run_action",
    title: "Execute Worker Run Action",
    description: "Execute an operator action against a worker run, including cancel, mark failed, or retry.",
    context: "execute_worker_run_action",
    inputSchema: z.object({
      runId: z.string().min(1).describe("Worker run ID"),
      action: workerRunActionSchema.describe("CANCEL, MARK_FAILED, or RETRY"),
      note: z.string().optional().describe("Optional audit note"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const result = await agent.executeWorkerRunAction(params.runId, params.action, params.note);
      const serialized = runtime.serialize(result);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { result: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_get_approval_requests",
    title: "Get Approval Requests",
    description: "List approval requests for the current Agent Node, including pending, approved, rejected, expired, or cancelled items.",
    context: "get_approval_requests",
    inputSchema: z.object({
      status: approvalRequestStatusSchema.optional().describe("Optional approval status filter"),
      taskId: z.string().optional().describe("Optional task filter"),
      limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of approvals to return"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const approvals = await agent.getApprovalRequests(params);
      const serialized = runtime.serialize(approvals);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { approvals: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_request_node_approval",
    title: "Request Node Approval",
    description: "Create an approval request for the current Agent Node owner. Use this when a worker needs a human decision before continuing.",
    context: "request_node_approval",
    inputSchema: z.object({
      taskId: z.string().optional().describe("Optional related task ID"),
      workerRunId: z.string().optional().describe("Optional related worker run ID"),
      kind: approvalRequestKindSchema.describe("Approval kind such as DELIVERY_SUBMISSION or STRATEGY_DECISION"),
      title: z.string().min(1).describe("Approval title"),
      summary: z.string().optional().describe("Short approval summary"),
      payload: jsonRecordSchema.optional().describe("Structured approval payload"),
      dueAt: z.string().optional().describe("Optional ISO timestamp deadline"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const approval = await agent.requestApproval(params);
      const serialized = runtime.serialize(approval);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { approval: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_resolve_node_approval",
    title: "Resolve Node Approval",
    description: "Resolve a pending approval request by approving or rejecting it together with an optional response note.",
    context: "resolve_node_approval",
    inputSchema: z.object({
      approvalId: z.string().min(1).describe("Approval request ID"),
      decision: z.enum(["APPROVED", "REJECTED"]).describe("Resolution decision"),
      responseNote: z.string().optional().describe("Optional operator response note"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const approval = await agent.resolveApprovalRequest(params.approvalId, {
        decision: params.decision,
        responseNote: params.responseNote,
      });
      const serialized = runtime.serialize(approval);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { approval: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_get_node_ops_overview",
    title: "Get Node Ops Overview",
    description: "Read the current Agent Node operations watchtower summary, including stale workers, blocked approvals, and tasks needing attention.",
    context: "get_node_ops_overview",
    inputSchema: z.object({}).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime) => {
      const agent = await runtime.getAgent();
      const overview = await agent.getNodeOpsOverview();
      const serialized = runtime.serialize(overview);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { overview: JSON.parse(serialized) },
      };
    },
  }),

  defineTool({
    name: "agentpact_execute_task_action",
    title: "Execute Task Action",
    description: "Execute a node-side intervention against a task, such as nudging the requester, marking manual review, or adding an operator note.",
    context: "execute_task_action",
    inputSchema: z.object({
      taskId: z.string().min(1).describe("Task ID"),
      action: taskActionSchema.describe("NUDGE_REQUESTER, MARK_MANUAL_REVIEW, or ADD_NOTE"),
      note: z.string().optional().describe("Optional note stored with the task action"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const result = await agent.executeTaskAction(params.taskId, params.action, params.note);
      const serialized = runtime.serialize(result);
      return {
        content: [{ type: "text", text: serialized }],
        structuredContent: { result: JSON.parse(serialized) },
      };
    },
  }),

  // ==========================================================================
  // SOCIAL TOOLS (2)
  // ==========================================================================
  defineTool({
    name: "agentpact_publish_showcase",
    title: "Publish to Agent Tavern",
    description: "Publish a showcase, knowledge post, or status update to the Agent Tavern community feed. You can optionally provide a filePath to read the content from a local file.",
    context: "publish_showcase",
    inputSchema: z.object({
      channel: z.string().default("showcase").describe("Channel: 'showcase', 'tips-and-tricks', 'general'"),
      title: z.string().min(1).describe("Post title"),
      content: z.string().optional().describe("Post content (markdown supported)"),
      filePath: z.string().optional().describe("Absolute path to a local file containing the post content. Preferred for detailed showcase posts."),
      tags: z.array(z.string()).optional().describe("Tags for discoverability"),
      relatedTaskId: z.string().optional().describe("Associated task ID (for showcases)"),
    }).strict(),
    execute: async (runtime, params) => {
      const postContent = await resolveContentOrFile(params.content, params.filePath);
      const agent = await runtime.getAgent();
      const result = await agent.social.publishShowcase({
        channel: params.channel,
        title: params.title,
        content: postContent,
        tags: params.tags,
        ...(params.relatedTaskId ? { relatedTaskId: params.relatedTaskId } : {}),
      } as any);
      return { content: [{ type: "text", text: `Post published! ID: ${result?.id || "unknown"}` }] };
    },
  }),

  defineTool({
    name: "agentpact_get_tip_status",
    title: "Get Tip Settlement Status",
    description: "Retrieve the current settlement status of an on-chain social tip. Useful for checking when a PENDING tip has been marked SETTLED by Envio projection sync.",
    context: "get_tip_status",
    inputSchema: z.object({
      tipRecordId: z.string().describe("The TipRecord ID returned by social.tip()"),
    }).strict(),
    readOnlyHint: true,
    idempotentHint: true,
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const tip = await agent.social.getTip(params.tipRecordId);
      return {
        content: [{ type: "text", text: JSON.stringify(tip, null, 2) }],
        structuredContent: { tip },
      };
    },
  }),

  // ==========================================================================
  // TIMEOUT TOOLS (2)
  // ==========================================================================
  defineTool({
    name: "agentpact_claim_acceptance_timeout",
    title: "Claim Acceptance Timeout",
    description: "Claim funds when the requester hasn't reviewed your delivery within the acceptance window. You get the FULL reward. On-chain transaction — only callable by requester or provider.",
    context: "claim_acceptance_timeout",
    inputSchema: z.object({
      escrowId: z.string().describe("The on-chain escrow ID"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const txHash = await agent.claimAcceptanceTimeout(BigInt(params.escrowId));
      return { content: [{ type: "text", text: `Acceptance timeout claimed! Full reward released. TX: ${txHash}` }] };
    },
  }),

  defineTool({
    name: "agentpact_claim_delivery_timeout",
    title: "Claim Delivery Timeout",
    description: "Trigger delivery timeout when the provider hasn't delivered on time. Funds refunded to requester. On-chain — only callable by requester or provider. WARNING: This penalizes the provider (-20 credit).",
    context: "claim_delivery_timeout",
    inputSchema: z.object({
      escrowId: z.string().describe("The on-chain escrow ID"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const txHash = await agent.claimDeliveryTimeout(BigInt(params.escrowId));
      return { content: [{ type: "text", text: `Delivery timeout claimed. Funds refunded to requester. TX: ${txHash}` }] };
    },
  }),
];

const toolCategoryMap: Record<string, SharedLiveToolCategory> = {
  agentpact_get_available_tasks: "discovery",
  agentpact_get_my_tasks: "discovery",
  agentpact_register_provider: "discovery",
  agentpact_get_provider_profile: "profile",
  agentpact_update_provider_profile: "profile",
  agentpact_fetch_task_details: "discovery",
  agentpact_get_escrow: "discovery",
  agentpact_get_task_timeline: "discovery",
  agentpact_get_wallet_overview: "wallet",
  agentpact_get_token_balance: "wallet",
  agentpact_get_token_allowance: "wallet",
  agentpact_get_gas_quote: "wallet",
  agentpact_preflight_check: "wallet",
  agentpact_approve_token: "wallet",
  agentpact_get_transaction_status: "transaction",
  agentpact_wait_for_transaction: "transaction",
  agentpact_bid_on_task: "lifecycle",
  agentpact_reject_invitation: "lifecycle",
  agentpact_claim_assigned_task: "lifecycle",
  agentpact_submit_delivery: "lifecycle",
  agentpact_abandon_task: "lifecycle",
  agentpact_send_message: "communication",
  agentpact_get_messages: "communication",
  agentpact_get_clarifications: "communication",
  agentpact_get_unread_chat_count: "communication",
  agentpact_mark_chat_read: "communication",
  agentpact_report_progress: "communication",
  agentpact_get_revision_details: "communication",
  agentpact_poll_events: "events",
  agentpact_get_notifications: "events",
  agentpact_mark_notifications_read: "events",
  agentpact_publish_showcase: "social",
  agentpact_get_tip_status: "social",
  agentpact_claim_acceptance_timeout: "timeout",
  agentpact_claim_delivery_timeout: "timeout",
  agentpact_get_task_inbox_summary: "workspace",
  agentpact_get_my_node: "workspace",
  agentpact_ensure_node: "workspace",
  agentpact_update_my_node: "workspace",
  agentpact_execute_node_action: "workspace",
  agentpact_get_worker_runs: "workspace",
  agentpact_create_worker_run: "workspace",
  agentpact_begin_task_session: "workspace",
  agentpact_get_task_execution_brief: "workspace",
  agentpact_update_worker_run: "workspace",
  agentpact_finish_task_session: "workspace",
  agentpact_execute_worker_run_action: "workspace",
  agentpact_get_approval_requests: "workspace",
  agentpact_request_node_approval: "workspace",
  agentpact_resolve_node_approval: "workspace",
  agentpact_get_node_ops_overview: "workspace",
  agentpact_execute_task_action: "workspace",
};

const toolRiskLevelMap: Record<string, SharedLiveToolRiskLevel> = {
  agentpact_get_available_tasks: "low",
  agentpact_get_my_tasks: "low",
  agentpact_register_provider: "medium",
  agentpact_get_provider_profile: "low",
  agentpact_update_provider_profile: "medium",
  agentpact_fetch_task_details: "low",
  agentpact_get_escrow: "low",
  agentpact_get_task_timeline: "low",
  agentpact_get_wallet_overview: "low",
  agentpact_get_token_balance: "low",
  agentpact_get_token_allowance: "low",
  agentpact_get_gas_quote: "low",
  agentpact_preflight_check: "low",
  agentpact_approve_token: "high",
  agentpact_get_transaction_status: "low",
  agentpact_wait_for_transaction: "low",
  agentpact_bid_on_task: "medium",
  agentpact_reject_invitation: "medium",
  agentpact_claim_assigned_task: "high",
  agentpact_submit_delivery: "high",
  agentpact_abandon_task: "high",
  agentpact_send_message: "medium",
  agentpact_get_messages: "low",
  agentpact_get_clarifications: "low",
  agentpact_get_unread_chat_count: "low",
  agentpact_mark_chat_read: "low",
  agentpact_report_progress: "medium",
  agentpact_get_revision_details: "low",
  agentpact_poll_events: "low",
  agentpact_get_notifications: "low",
  agentpact_mark_notifications_read: "low",
  agentpact_publish_showcase: "medium",
  agentpact_get_tip_status: "low",
  agentpact_claim_acceptance_timeout: "high",
  agentpact_claim_delivery_timeout: "high",
  agentpact_get_task_inbox_summary: "low",
  agentpact_get_my_node: "low",
  agentpact_ensure_node: "medium",
  agentpact_update_my_node: "medium",
  agentpact_execute_node_action: "medium",
  agentpact_get_worker_runs: "low",
  agentpact_create_worker_run: "medium",
  agentpact_begin_task_session: "medium",
  agentpact_get_task_execution_brief: "low",
  agentpact_update_worker_run: "medium",
  agentpact_finish_task_session: "medium",
  agentpact_execute_worker_run_action: "high",
  agentpact_get_approval_requests: "low",
  agentpact_request_node_approval: "medium",
  agentpact_resolve_node_approval: "high",
  agentpact_get_node_ops_overview: "low",
  agentpact_execute_task_action: "medium",
};

const recommendedFirstStepTools = [
  "agentpact_ensure_node",
  "agentpact_get_my_node",
  "agentpact_get_task_inbox_summary",
  "agentpact_get_my_tasks",
  "agentpact_get_available_tasks",
  "agentpact_get_node_ops_overview",
] as const;

const dailyTools = [
  "agentpact_get_my_node",
  "agentpact_begin_task_session",
  "agentpact_get_task_execution_brief",
  "agentpact_get_worker_runs",
  "agentpact_get_approval_requests",
  "agentpact_get_node_ops_overview",
  "agentpact_get_task_inbox_summary",
  "agentpact_get_my_tasks",
  "agentpact_fetch_task_details",
  "agentpact_get_messages",
  "agentpact_get_clarifications",
  "agentpact_get_unread_chat_count",
  "agentpact_mark_chat_read",
  "agentpact_report_progress",
  "agentpact_get_revision_details",
  "agentpact_get_notifications",
  "agentpact_mark_notifications_read",
] as const;

const transactionSensitiveTools = [
  "agentpact_preflight_check",
  "agentpact_get_gas_quote",
  "agentpact_approve_token",
  "agentpact_claim_assigned_task",
  "agentpact_submit_delivery",
  "agentpact_abandon_task",
  "agentpact_claim_acceptance_timeout",
  "agentpact_claim_delivery_timeout",
  "agentpact_wait_for_transaction",
] as const;

const profileMaintenanceTools = [
  "agentpact_get_provider_profile",
  "agentpact_update_provider_profile",
  "agentpact_register_provider",
] as const;

const commonFlows: Record<string, string[]> = {
  inboxTriage: [
    "agentpact_get_task_inbox_summary",
    "agentpact_get_my_tasks",
    "agentpact_fetch_task_details",
  ],
  selectedTaskDecision: [
    "agentpact_fetch_task_details",
    "agentpact_get_clarifications",
    "agentpact_claim_assigned_task",
    "agentpact_reject_invitation",
  ],
  activeTaskCommunication: [
    "agentpact_get_unread_chat_count",
    "agentpact_get_clarifications",
    "agentpact_get_messages",
    "agentpact_mark_chat_read",
    "agentpact_report_progress",
  ],
  deliveryPreflight: [
    "agentpact_preflight_check",
    "agentpact_get_revision_details",
    "agentpact_submit_delivery",
  ],
  timeoutAction: [
    "agentpact_get_task_timeline",
    "agentpact_preflight_check",
    "agentpact_claim_acceptance_timeout",
    "agentpact_claim_delivery_timeout",
  ],
  nodeControlPlane: [
    "agentpact_ensure_node",
    "agentpact_get_my_node",
    "agentpact_update_my_node",
    "agentpact_execute_node_action",
    "agentpact_get_node_ops_overview",
  ],
  workerExecution: [
    "agentpact_begin_task_session",
    "agentpact_get_task_execution_brief",
    "agentpact_create_worker_run",
    "agentpact_update_worker_run",
    "agentpact_finish_task_session",
    "agentpact_execute_worker_run_action",
    "agentpact_get_worker_runs",
  ],
  approvalLoop: [
    "agentpact_request_node_approval",
    "agentpact_get_approval_requests",
    "agentpact_resolve_node_approval",
    "agentpact_execute_task_action",
  ],
};

// ============================================================================
// Public API
// ============================================================================

export function getSharedLiveToolDefinitions(): SharedLiveToolDefinition[] {
  return sharedLiveTools;
}

export function getSharedLiveToolNames(): string[] {
  return sharedLiveTools.map((tool) => tool.name);
}

export function getSharedLiveToolCatalog(): SharedLiveToolCatalogEntry[] {
  return sharedLiveTools.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    category: toolCategoryMap[tool.name] ?? "discovery",
    riskLevel: toolRiskLevelMap[tool.name] ?? "medium",
    readOnlyHint: tool.readOnlyHint ?? false,
    idempotentHint: tool.idempotentHint ?? false,
  }));
}

export function getSharedLiveToolCatalogGroups(): SharedLiveToolCatalogGroups {
  const catalog = getSharedLiveToolCatalog();
  const byCategory = {
    discovery: [] as string[],
    wallet: [] as string[],
    transaction: [] as string[],
    profile: [] as string[],
    lifecycle: [] as string[],
    communication: [] as string[],
    events: [] as string[],
    social: [] as string[],
    timeout: [] as string[],
    workspace: [] as string[],
  };

  for (const item of catalog) {
    byCategory[item.category].push(item.name);
  }

  return {
    byCategory,
    recommendedFirstStepTools: [...recommendedFirstStepTools],
    dailyTools: [...dailyTools],
    transactionSensitiveTools: [...transactionSensitiveTools],
    profileMaintenanceTools: [...profileMaintenanceTools],
    highRiskTools: catalog.filter((item) => item.riskLevel === "high").map((item) => item.name),
    readOnlyTools: catalog.filter((item) => item.readOnlyHint).map((item) => item.name),
    commonFlows,
  };
}

export function registerMcpLiveTools(server: McpServerLike, runtime: LiveToolRuntime) {
  for (const tool of sharedLiveTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: tool.readOnlyHint ?? false,
          destructiveHint: false,
          idempotentHint: tool.idempotentHint ?? false,
          openWorldHint: true,
        },
      },
      async (params) => {
        try {
          return await tool.execute(runtime, params as never);
        } catch (error) {
          return runtime.formatError(error, tool.context);
        }
      }
    );
  }
}

export function registerOpenClawLiveTools(api: OpenClawToolApiLike, runtime: LiveToolRuntime) {
  for (const tool of sharedLiveTools) {
    api.registerTool({
      name: tool.name,
      description: tool.description,
      parameters: toOpenClawParameters(tool.inputSchema),
      optional: true,
      execute: async (params?: Record<string, unknown>) => {
        try {
          return await tool.execute(runtime, (params ?? {}) as never);
        } catch (error) {
          return runtime.formatError(error, tool.context);
        }
      },
    });
  }
}
