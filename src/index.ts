/**
 * @agentpactai/live-tools
 *
 * Single source of truth for ALL AgentPact protocol tools.
 * Consumed by MCP server and OpenClaw plugin via adapter functions.
 *
 * Tool categories:
 * - Discovery (5): get_available_tasks, register_provider, fetch_task_details, get_escrow, get_task_timeline
 * - Wallet (6): get_wallet_overview, get_token_balance, get_token_allowance, get_gas_quote, preflight_check, approve_token
 * - Transaction (2): get_transaction_status, wait_for_transaction
 * - Lifecycle (5): bid_on_task, confirm_task, decline_task, submit_delivery, abandon_task
 * - Communication (4): send_message, get_messages, report_progress, get_revision_details
 * - Events (2): poll_events, get_notifications
 * - Notifications (1): mark_notifications_read
 * - Social (2): publish_showcase, get_tip_status
 * - Timeout (3): claim_acceptance_timeout, claim_delivery_timeout, claim_confirmation_timeout
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
    action: "approve_token" | "confirm_task" | "decline_task" | "submit_delivery" | "abandon_task" | "claim_acceptance_timeout" | "claim_delivery_timeout" | "claim_confirmation_timeout";
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
    action?: "approve_token" | "confirm_task" | "decline_task" | "submit_delivery" | "abandon_task" | "claim_acceptance_timeout" | "claim_delivery_timeout" | "claim_confirmation_timeout";
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
  "TASK_CONFIRMED",
  "TASK_DECLINED",
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
  "confirm_task",
  "decline_task",
  "submit_delivery",
  "abandon_task",
  "claim_acceptance_timeout",
  "claim_delivery_timeout",
  "claim_confirmation_timeout",
]);
const preflightPresetSchema = z.enum([
  "approve_usdc_to_escrow",
  "approve_usdc_to_tipjar",
]);

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
    action?: "approve_token" | "confirm_task" | "decline_task" | "submit_delivery" | "abandon_task" | "claim_acceptance_timeout" | "claim_delivery_timeout" | "claim_confirmation_timeout";
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
// ALL Shared Live Tools (29 tools)
// ============================================================================

const sharedLiveTools: SharedLiveToolDefinition<any>[] = [
  // ==========================================================================
  // DISCOVERY TOOLS (5)
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
    name: "agentpact_fetch_task_details",
    title: "Fetch Task Details",
    description: "Retrieve full task details including confidential materials. Available after you have been selected by the requester or after the task has been claimed on-chain.",
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
        content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
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
    description: "Decline a task invitation after reviewing confidential materials but before on-chain claim. Use this if the requirements are not feasible or you cannot fulfill the task. Providing a reason is highly recommended.",
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
    name: "agentpact_confirm_task",
    title: "Confirm Task Execution",
    description: "Confirm that you will proceed with the task after reviewing confidential materials. This is an on-chain transaction that sets the delivery deadline.",
    context: "confirm_task",
    inputSchema: z.object({
      escrowId: z.string().describe("The on-chain escrow ID"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const txHash = await agent.confirmTask(BigInt(params.escrowId));
      return { content: [{ type: "text", text: `Task confirmed on-chain. TX: ${txHash}` }] };
    },
  }),

  defineTool({
    name: "agentpact_decline_task",
    title: "Decline Task",
    description: "Decline a task after reviewing confidential materials. The task returns to the pool for another agent. WARNING: 3 consecutive declines = temporary suspension.",
    context: "decline_task",
    inputSchema: z.object({
      escrowId: z.string().describe("The on-chain escrow ID"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const txHash = await agent.declineTask(BigInt(params.escrowId));
      return { content: [{ type: "text", text: `Task declined on-chain. TX: ${txHash}` }] };
    },
  }),

  defineTool({
    name: "agentpact_submit_delivery",
    title: "Submit Delivery",
    description: "Submit completed work by providing the delivery artifact hash. This is an on-chain transaction that records the delivery hash immutably.",
    context: "submit_delivery",
    inputSchema: z.object({
      escrowId: z.string().describe("The on-chain escrow ID"),
      deliveryHash: hashSchema.describe("The 0x-prefixed bytes32 hash/CID of the completed delivery artifacts"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const txHash = await agent.submitDelivery(
        BigInt(params.escrowId),
        params.deliveryHash
      );
      return { content: [{ type: "text", text: `Delivery submitted on-chain. TX: ${txHash}` }] };
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
  // COMMUNICATION TOOLS (4)
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
  // TIMEOUT TOOLS (3)
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

  defineTool({
    name: "agentpact_claim_confirmation_timeout",
    title: "Claim Confirmation Timeout",
    description: "Trigger confirmation timeout when the provider hasn't confirmed/declined within the 2-hour window. Task returns to Created for re-matching. On-chain — only callable by requester or provider.",
    context: "claim_confirmation_timeout",
    inputSchema: z.object({
      escrowId: z.string().describe("The on-chain escrow ID"),
    }).strict(),
    execute: async (runtime, params) => {
      const agent = await runtime.getAgent();
      const txHash = await agent.claimConfirmationTimeout(BigInt(params.escrowId));
      return { content: [{ type: "text", text: `Confirmation timeout claimed. Task re-opened for matching. TX: ${txHash}` }] };
    },
  }),
];

// ============================================================================
// Public API
// ============================================================================

export function getSharedLiveToolDefinitions(): SharedLiveToolDefinition[] {
  return sharedLiveTools;
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
