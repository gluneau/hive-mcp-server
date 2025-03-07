#!/usr/bin/env node

import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client, PrivateKey, PublicKey, Signature, cryptoUtils } from "@hiveio/dhive";
import { z } from "zod";

const client = new Client([
  "https://api.hive.blog",
  "https://api.hivekings.com",
  "https://anyx.io",
  "https://api.openhive.network",
]);

const server = new McpServer({ name: "HiveServer", version: "1.0.1" });

// Tool: Get account information (converted from resource)
server.tool(
  "get_account_info",
  "Fetches detailed information about a Hive blockchain account including balance, authority, voting power, and other account metrics.",
  {
    username: z.string().describe("Hive username to fetch information for"),
  },
  async ({ username }) => {
    try {
      const accounts = await client.database.getAccounts([username]);
      if (accounts.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Account ${username} not found`,
            },
          ],
          isError: true,
        };
      }
      
      const accountData = accounts[0];
      
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(accountData, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error in create_comment: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Sign a message with a private key
server.tool(
  "sign_message",
  "Sign a message using a Hive private key from environment variables.",
  {
    message: z.string().min(1).describe("Message to sign (must not be empty)"),
    key_type: z
      .enum(["posting", "active", "memo"])
      .optional()
      .default("posting")
      .describe(
        "Type of key to use: 'posting', 'active', or 'memo'. Defaults to 'posting' if not specified."
      ),
  },
  async ({ message, key_type = "posting" }) => {
    try {
      // Get the private key from environment variables
      let keyEnvVar: string | undefined;

      switch (key_type) {
        case "posting":
          keyEnvVar = process.env.HIVE_POSTING_KEY;
          break;
        case "active":
          keyEnvVar = process.env.HIVE_ACTIVE_KEY;
          break;
        case "memo":
          keyEnvVar = process.env.HIVE_MEMO_KEY;
          break;
        default:
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: Invalid key_type: ${key_type}`,
              },
            ],
            isError: true,
          };
      }

      // Check if the key is available
      if (!keyEnvVar) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: HIVE_${key_type.toUpperCase()}_KEY environment variable is not set`,
            },
          ],
          isError: true,
        };
      }

      // Create PrivateKey object
      let privateKey: PrivateKey;
      try {
        privateKey = PrivateKey.fromString(keyEnvVar);
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Invalid ${key_type} key format`,
            },
          ],
          isError: true,
        };
      }

      // Hash the message with sha256 before signing
      const messageHash = cryptoUtils.sha256(message);

      // Sign the message hash
      let signature: string;
      try {
        signature = privateKey.sign(messageHash).toString();
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error signing message: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }

      // Get the public key
      const publicKey = privateKey.createPublic().toString();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                message_hash: messageHash.toString("hex"),
                signature,
                public_key: publicKey,
              },
              null,
              2
            ),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error in sign_message: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Verify a message signature
server.tool(
  "verify_signature",
  "Verify a digital signature against a Hive public key",
  {
    message_hash: z
      .string()
      .describe(
        "The SHA-256 hash of the message in hex format (64 characters)"
      ),
    signature: z.string().describe("Signature string to verify"),
    public_key: z
      .string()
      .describe(
        "Public key to verify against (with or without the STM prefix)"
      ),
  },
  async ({ message_hash, signature, public_key }) => {
    try {
      // Parse the public key (handling keys with or without the STM prefix)
      let publicKey;
      try {
        publicKey = public_key.startsWith("STM")
          ? public_key
          : `STM${public_key}`;

        publicKey = PublicKey.fromString(publicKey);
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Invalid public key format",
            },
          ],
          isError: true,
        };
      }

      // Parse the signature
      let signatureObj;
      try {
        signatureObj = Signature.fromString(signature);
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Invalid signature format",
            },
          ],
          isError: true,
        };
      }

      // Validate and parse the message hash
      let messageHashBuffer;
      try {
        if (!/^[0-9a-fA-F]{64}$/.test(message_hash)) {
          throw new Error("Message hash must be a 64-character hex string");
        }
        messageHashBuffer = Buffer.from(message_hash, "hex");
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Invalid message hash format - must be a 64-character hex string",
            },
          ],
          isError: true,
        };
      }

      // Verify the signature against the hash
      const isValid = publicKey.verify(messageHashBuffer, signatureObj);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                is_valid: isValid,
                message_hash,
                public_key: publicKey.toString(),
              },
              null,
              2
            ),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error in verify_signature: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get blockchain information
server.tool(
  "get_chain_properties",
  "Fetch current Hive blockchain properties and statistics",
  {},
  async () => {
    try {
      // Fetch global properties
      const dynamicProps = await client.database.getDynamicGlobalProperties();
      const chainProps = await client.database.getChainProperties();
      const currentMedianHistoryPrice = await client.database.getCurrentMedianHistoryPrice();
      
      // Format the response
      const response = {
        dynamic_properties: dynamicProps,
        chain_properties: chainProps,
        current_median_history_price: {
          base: currentMedianHistoryPrice.base,
          quote: currentMedianHistoryPrice.quote,
        },
        timestamp: new Date().toISOString(),
      };
      
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching chain properties: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get delegations for an account
server.tool(
  "get_vesting_delegations",
  "Get a list of vesting delegations made by a specific Hive account",
  {
    username: z.string().describe("Hive account to get delegations for"),
    limit: z.number().min(1).max(1000).default(100).describe("Maximum number of delegations to retrieve"),
    from: z.string().optional().describe("Optional starting account for pagination"),
  },
  async ({ username, limit, from = "" }) => {
    try {
      const delegations = await client.database.getVestingDelegations(username, from, limit);
      
      // Format the data for better readability
      const formattedDelegations = delegations.map(delegation => ({
        delegator: delegation.delegator,
        delegatee: delegation.delegatee,
        vesting_shares: delegation.vesting_shares,
        min_delegation_time: delegation.min_delegation_time,
      }));
      
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              account: username,
              delegations_count: formattedDelegations.length,
              delegations: formattedDelegations
            }, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching vesting delegations: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get post content (converted from resource)
server.tool(
  "get_post_content",
  "Retrieves a specific Hive blog post identified by author and permlink, including the post title, content, and metadata.",
  {
    author: z.string().describe("Author of the post"),
    permlink: z.string().describe("Permlink of the post"),
  },
  async ({ author, permlink }) => {
    try {
      const content = await client.database.call("get_content", [
        author,
        permlink,
      ]);
      
      if (!content.author) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Post not found: ${author}/${permlink}`,
            },
          ],
          isError: true,
        };
      }
      
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                title: content.title,
                author: content.author,
                body: content.body,
                created: content.created,
                last_update: content.last_update,
                category: content.category,
                tags: content.json_metadata ? JSON.parse(content.json_metadata).tags || [] : [],
                url: `https://hive.blog/@${author}/${permlink}`,
              },
              null,
              2
            ),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching post: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Valid discussion query categories for tag-based queries
const tagQueryCategories = z.enum([
  "active",
  "cashout",
  "children",
  "comments",
  "created",
  "hot",
  "promoted",
  "trending",
  "votes",
]);

// Valid discussion query categories for user-based queries
const userQueryCategories = z.enum(["blog", "feed"]);

// Tool: Fetch posts by tag
server.tool(
  "get_posts_by_tag",
  "Retrieves Hive posts filtered by a specific tag and sorted by a category like trending, hot, or created.",
  {
    category: tagQueryCategories.describe(
      "Sorting category for posts (e.g. trending, hot, created)"
    ),
    tag: z.string().describe("The tag to filter posts by"),
    limit: z
      .number()
      .min(1)
      .max(20)
      .default(10)
      .describe("Number of posts to return (1-20)"),
  },
  async ({ category, tag, limit }) => {
    try {
      const posts = await client.database.getDiscussions(category, {
        tag,
        limit,
      });

      const formattedPosts = posts.map((post) => ({
        title: post.title,
        author: post.author,
        permlink: post.permlink,
        created: post.created,
        votes: post.net_votes,
        payout: post.pending_payout_value,
        url: `https://hive.blog/@${post.author}/${post.permlink}`,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(formattedPosts, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error in get_posts_by_tag: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Fetch posts by user ID
server.tool(
  "get_posts_by_user",
  "Retrieves posts authored by or in the feed of a specific Hive user.",
  {
    category: userQueryCategories.describe(
      "Type of user posts to fetch (blog = posts by user, feed = posts from users they follow)"
    ),
    username: z.string().describe("Hive username to fetch posts for"),
    limit: z
      .number()
      .min(1)
      .max(20)
      .default(10)
      .describe("Number of posts to return (1-20)"),
  },
  async ({ category, username, limit }) => {
    try {
      // For blog and feed queries, the username is provided as the tag parameter
      const posts = await client.database.getDiscussions(category, {
        tag: username,
        limit,
      });

      const formattedPosts = posts.map((post) => ({
        title: post.title,
        author: post.author,
        permlink: post.permlink,
        created: post.created,
        votes: post.net_votes,
        payout: post.pending_payout_value,
        url: `https://hive.blog/@${post.author}/${post.permlink}`,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(formattedPosts, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error in get_posts_by_user: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Fetch account history
server.tool(
  "get_account_history",
  "Retrieves transaction history for a Hive account with optional operation type filtering.",
  {
    username: z.string().describe("Hive username"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .default(10)
      .describe("Number of operations to return"),
    operation_filter: z
      .union([
        z.array(z.string()),
        z.string().transform((val, ctx) => {
          // Handle empty string
          if (!val.trim()) return [];

          try {
            // Try to parse it as JSON first in case it's a properly formatted JSON array
            if (val.startsWith("[") && val.endsWith("]")) {
              try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) {
                  return parsed;
                }
              } catch (e) {
                // Failed to parse as JSON, continue to other methods
              }
            }

            // Handle comma-separated list (possibly with quotes)
            return val
              .replace(/^\[|\]$/g, "") // Remove outer brackets if present
              .split(",")
              .map(
                (item) => item.trim().replace(/^['"]|['"]$/g, "") // Remove surrounding quotes
              )
              .filter(Boolean); // Remove empty entries
          } catch (error) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Could not parse operation_filter: ${val}. Please provide a comma-separated list or array of operation types.`,
            });
            return z.NEVER;
          }
        }),
      ])
      .optional()
      .describe(
        "Operation types to filter for. Can be provided as an array ['transfer', 'vote'] or a comma-separated string 'transfer,vote'"
      ),
  },
  async ({ username, limit, operation_filter }) => {
    try {
      // The getAccountHistory method needs a starting point (from) parameter
      // We'll use -1 to get the most recent transactions
      const from = -1;

      // Convert string operation types to their numerical bitmask if provided
      let operation_bitmask = undefined;
      if (operation_filter && operation_filter.length > 0) {
        // This would require mapping operation names to their numeric codes
        // For simplicity, we're skipping the bitmask transformation
      }

      const history = await client.database.getAccountHistory(
        username,
        from,
        limit,
        operation_bitmask
      );

      if (!history || !Array.isArray(history)) {
        return {
          content: [
            {
              type: "text",
              text: `No history found for account: ${username}`,
              mimeType: "text/plain",
            },
          ],
        };
      }

      // Format the history into a structured object
      const formattedHistory = history
        .map(([index, operation]) => {
          const { timestamp, op, trx_id } = operation;
          const opType = op[0];
          const opData = op[1];

          // Filter operations if needed
          if (
            operation_filter &&
            operation_filter.length > 0 &&
            !operation_filter.includes(opType)
          ) {
            return null;
          }

          return {
            index,
            type: opType,
            timestamp,
            transaction_id: trx_id,
            details: opData,
          };
        })
        .filter(Boolean); // Remove null entries (filtered out operations)

      const response = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                account: username,
                operations_count: formattedHistory.length,
                operations: formattedHistory,
              },
              null,
              2
            ),
            mimeType: "application/json",
          },
        ],
      };

      return response;
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving account history: ${
              error instanceof Error ? error.message : String(error)
            }`,
            mimeType: "text/plain",
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Vote on a post
server.tool(
  "vote_on_post",
  "Vote on a Hive post (upvote or downvote) using the configured Hive account.",
  {
    author: z.string().describe("Author of the post to vote on"),
    permlink: z.string().describe("Permlink of the post to vote on"),
    weight: z
      .number()
      .min(-10000)
      .max(10000)
      .describe(
        "Vote weight from -10000 (100% downvote) to 10000 (100% upvote)"
      ),
  },
  async ({ author, permlink, weight }) => {
    try {
      // Get credentials from environment variables
      const username = process.env.HIVE_USERNAME;
      const privateKey = process.env.HIVE_POSTING_KEY;

      if (!username || !privateKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: HIVE_USERNAME or HIVE_POSTING_KEY environment variables are not set",
            },
          ],
          isError: true,
        };
      }

      // Create the vote operation
      const vote = {
        voter: username,
        author,
        permlink,
        weight,
      };

      // Create the broadcast instance and broadcast the vote
      const result = await client.broadcast.vote(
        vote,
        PrivateKey.fromString(privateKey)
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                transaction_id: result.id,
                transaction_url: `https://www.hiveblockexplorer.com/tx/${result.id}`,
                block_num: result.block_num,
                voter: username,
                author,
                permlink,
                weight,
              },
              null,
              2
            ),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error in vote_on_post: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Send HIVE or HBD tokens to another account
server.tool(
  "send_token",
  "Send HIVE or HBD tokens to another Hive account using the configured account credentials.",
  {
    to: z.string().describe("Recipient Hive username"),
    amount: z.number().positive().describe("Amount of tokens to send"),
    currency: z.enum(["HIVE", "HBD"]).describe("Currency to send: HIVE or HBD"),
    memo: z
      .string()
      .optional()
      .describe("Optional memo to include with the transaction"),
  },
  async ({ to, amount, currency, memo = "" }) => {
    try {
      // Get credentials from environment variables
      const username = process.env.HIVE_USERNAME;
      const activeKey = process.env.HIVE_ACTIVE_KEY;

      if (!username || !activeKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: HIVE_USERNAME or HIVE_ACTIVE_KEY environment variables are not set. Note that transfers require an active key, not a posting key.",
            },
          ],
          isError: true,
        };
      }

      // Format the amount with 3 decimal places and append the currency
      const formattedAmount = `${amount.toFixed(3)} ${currency}`;

      // Create the transfer operation
      const transfer = {
        from: username,
        to,
        amount: formattedAmount,
        memo,
      };

      // Broadcast the transfer using active key (required for transfers)
      const result = await client.broadcast.transfer(
        transfer,
        PrivateKey.fromString(activeKey)
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                transaction_id: result.id,
                transaction_url: `https://www.hiveblockexplorer.com/tx/${result.id}`,
                block_num: result.block_num,
                from: username,
                to,
                amount: formattedAmount,
                memo: memo || "(no memo)",
              },
              null,
              2
            ),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error in send_token: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Create a new blog post
server.tool(
  "create_post",
  "Create a new blog post on the Hive blockchain using the configured account credentials.",
  {
    title: z.string().min(1).max(256).describe("Title of the blog post"),
    body: z
      .string()
      .min(1)
      .describe("Content of the blog post, can include Markdown formatting"),
    tags: z
      .union([
        z.array(z.string()),
        z.string().transform((val, ctx) => {
          // Handle empty string
          if (!val.trim()) return ["blog"];

          try {
            // Try to parse it as JSON first in case it's a properly formatted JSON array
            if (val.startsWith("[") && val.endsWith("]")) {
              try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) {
                  return parsed;
                }
              } catch (e) {
                // Failed to parse as JSON, continue to other methods
              }
            }

            // Handle comma-separated list (possibly with quotes)
            return val
              .replace(/^\[|\]$/g, "") // Remove outer brackets if present
              .split(",")
              .map(
                (item) =>
                  item
                    .trim()
                    .replace(/^['"]|['"]$/g, "") // Remove surrounding quotes
                    .toLowerCase() // Hive tags are lowercase
              )
              .filter(Boolean); // Remove empty entries
          } catch (error) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Could not parse tags: ${val}. Please provide a comma-separated list or array of tags.`,
            });
            return z.NEVER;
          }
        }),
      ])
      .default(["blog"])
      .describe(
        "Tags for the post. Can be provided as comma-separated string 'blog,life,writing' or array"
      ),
    beneficiaries: z
      .union([
        z.array(
          z.object({
            account: z.string(),
            weight: z.number().min(1).max(10000),
          })
        ),
        z.null(),
      ])
      .optional()
      .nullable()
      .describe(
        "Optional list of beneficiaries to receive a portion of the rewards"
      ),
    permalink: z
      .string()
      .optional()
      .describe(
        "Optional custom permalink. If not provided, one will be generated from the title"
      ),
    max_accepted_payout: z
      .string()
      .optional()
      .describe("Optional maximum accepted payout (e.g. '1000.000 HBD')"),
    percent_hbd: z
      .number()
      .min(0)
      .max(10000)
      .optional()
      .describe(
        "Optional percent of HBD in rewards (0-10000, where 10000 = 100%)"
      ),
    allow_votes: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to allow votes on the post"),
    allow_curation_rewards: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to allow curation rewards"),
  },
  async ({
    title,
    body,
    tags,
    beneficiaries,
    permalink,
    max_accepted_payout,
    percent_hbd,
    allow_votes,
    allow_curation_rewards,
  }) => {
    try {
      // Get credentials from environment variables
      const username = process.env.HIVE_USERNAME;
      const postingKey = process.env.HIVE_POSTING_KEY;

      if (!username || !postingKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: HIVE_USERNAME or HIVE_POSTING_KEY environment variables are not set.",
            },
          ],
          isError: true,
        };
      }

      // Generate permalink if not provided
      const finalPermalink =
        permalink ||
        title
          .toLowerCase()
          .replace(/[^\w\s-]/g, "") // Remove non-word chars except spaces and hyphens
          .replace(/\s+/g, "-") // Replace spaces with hyphens
          .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
          .slice(0, 255); // Restrict to 255 chars

      // Ensure first tag is used as the main category
      const finalTags = [...new Set(tags)]; // Remove duplicates

      // Prepare the post operation
      const postOperation = {
        parent_author: "", // Empty for main posts (non-comments)
        parent_permlink: finalTags[0], // First tag is the main category
        author: username,
        permlink: finalPermalink,
        title,
        body,
        json_metadata: JSON.stringify({
          tags: finalTags,
          app: "hive-mcp-server/1.0",
        }),
      };

      // Prepare post options if needed
      let hasOptions = false;
      const options: {
        author: string;
        permlink: string;
        max_accepted_payout: string;
        percent_hbd: number;
        allow_votes: boolean;
        allow_curation_rewards: boolean;
        extensions: [
          0,
          { beneficiaries: { account: string; weight: number }[] }
        ][];
      } = {
        author: username,
        permlink: finalPermalink,
        max_accepted_payout: max_accepted_payout || "1000000.000 HBD",
        percent_hbd: percent_hbd ?? 10000,
        allow_votes: allow_votes,
        allow_curation_rewards: allow_curation_rewards,
        extensions: beneficiaries?.length
          ? [
              [
                0,
                {
                  beneficiaries: beneficiaries.map((b) => ({
                    account: b.account,
                    weight: b.weight,
                  })),
                },
              ],
            ]
          : [],
      };

      // Add optional parameters if provided
      if (max_accepted_payout) {
        options.max_accepted_payout = max_accepted_payout;
        hasOptions = true;
      }

      if (percent_hbd !== undefined) {
        options.percent_hbd = percent_hbd;
        hasOptions = true;
      }

      // Add beneficiaries if provided
      if (beneficiaries && beneficiaries.length > 0) {
        options.extensions = [
          [
            0,
            {
              beneficiaries: beneficiaries.map((b) => ({
                account: b.account,
                weight: b.weight,
              })),
            },
          ],
        ];
        hasOptions = true;
      }

      let result;
      if (hasOptions) {
        // Use commentWithOptions when we have options
        result = await client.broadcast.commentWithOptions(
          postOperation,
          options,
          PrivateKey.fromString(postingKey)
        );
      } else {
        // Use standard comment for basic posts
        result = await client.broadcast.comment(
          postOperation,
          PrivateKey.fromString(postingKey)
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                transaction_id: result.id,
                transaction_url: `https://www.hiveblockexplorer.com/tx/${result.id}`,
                block_num: result.block_num,
                author: username,
                permlink: finalPermalink,
                title,
                tags: finalTags,
                url: `https://hive.blog/@${username}/${finalPermalink}`,
              },
              null,
              2
            ),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error in create_post: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Create a comment on an existing post
server.tool(
  "create_comment",
  "Create a comment on an existing Hive post or reply to another comment.",
  {
    parent_author: z
      .string()
      .describe("Username of the post author or comment you're replying to"),
    parent_permlink: z
      .string()
      .describe("Permlink of the post or comment you're replying to"),
    body: z
      .string()
      .min(1)
      .describe("Content of the comment, can include Markdown formatting"),
    permalink: z
      .string()
      .optional()
      .describe(
        "Optional custom permalink for your comment. If not provided, one will be generated"
      ),
    beneficiaries: z
      .union([
        z.array(
          z.object({
            account: z.string(),
            weight: z.number().min(1).max(10000),
          })
        ),
        z.null(),
      ])
      .optional()
      .nullable()
      .describe(
        "Optional list of beneficiaries to receive a portion of the rewards"
      ),
    max_accepted_payout: z
      .string()
      .optional()
      .describe("Optional maximum accepted payout (e.g. '1000.000 HBD')"),
    percent_hbd: z
      .number()
      .min(0)
      .max(10000)
      .optional()
      .describe(
        "Optional percent of HBD in rewards (0-10000, where 10000 = 100%)"
      ),
    allow_votes: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to allow votes on the comment"),
    allow_curation_rewards: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to allow curation rewards"),
  },
  async ({
    parent_author,
    parent_permlink,
    body,
    permalink,
    beneficiaries,
    max_accepted_payout,
    percent_hbd,
    allow_votes,
    allow_curation_rewards,
  }) => {
    try {
      // Get credentials from environment variables
      const username = process.env.HIVE_USERNAME;
      const postingKey = process.env.HIVE_POSTING_KEY;

      if (!username || !postingKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: HIVE_USERNAME or HIVE_POSTING_KEY environment variables are not set.",
            },
          ],
          isError: true,
        };
      }

      // Generate a random permalink if not provided
      const finalPermalink =
        permalink ||
        `re-${parent_permlink.slice(0, 20)}-${Date.now().toString(36)}`;

      // Prepare the comment operation
      const commentOperation = {
        parent_author,
        parent_permlink,
        author: username,
        permlink: finalPermalink,
        title: "", // Comments don't have titles
        body,
        json_metadata: JSON.stringify({
          app: "hive-mcp-server/1.0",
        }),
      };

      // Prepare comment options if needed
      let hasOptions = false;
      const options: {
        author: string;
        permlink: string;
        max_accepted_payout: string;
        percent_hbd: number;
        allow_votes: boolean;
        allow_curation_rewards: boolean;
        extensions: [
          0,
          { beneficiaries: { account: string; weight: number }[] }
        ][];
      } = {
        author: username,
        permlink: finalPermalink,
        max_accepted_payout: max_accepted_payout || "1000000.000 HBD",
        percent_hbd: percent_hbd ?? 10000,
        allow_votes: allow_votes,
        allow_curation_rewards: allow_curation_rewards,
        extensions: beneficiaries?.length
          ? [
              [
                0,
                {
                  beneficiaries: beneficiaries.map((b) => ({
                    account: b.account,
                    weight: b.weight,
                  })),
                },
              ],
            ]
          : [],
      };

      // Add optional parameters if provided
      if (max_accepted_payout) {
        options.max_accepted_payout = max_accepted_payout;
        hasOptions = true;
      }

      if (percent_hbd !== undefined) {
        options.percent_hbd = percent_hbd;
        hasOptions = true;
      }

      // Add beneficiaries if provided
      if (beneficiaries && beneficiaries.length > 0) {
        options.extensions = [
          [
            0,
            {
              beneficiaries: beneficiaries.map((b) => ({
                account: b.account,
                weight: b.weight,
              })),
            },
          ],
        ];
        hasOptions = true;
      }

      let result;
      if (hasOptions) {
        // Use commentWithOptions when we have options
        result = await client.broadcast.commentWithOptions(
          commentOperation,
          options,
          PrivateKey.fromString(postingKey)
        );
      } else {
        // Use standard comment for basic comments
        result = await client.broadcast.comment(
          commentOperation,
          PrivateKey.fromString(postingKey)
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                transaction_id: result.id,
                transaction_url: `https://www.hiveblockexplorer.com/tx/${result.id}`,
                block_num: result.block_num,
                parent_author,
                parent_permlink,
                author: username,
                permlink: finalPermalink,
                url: `https://hive.blog/@${parent_author}/${parent_permlink}#@${username}/${finalPermalink}`,
              },
              null,
              2
            ),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error in create_comment: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

const startServer = async () => {
  // Log environment variable status to stderr (not using console.error per requirement)
  const logger = (msg: string) => process.stderr.write(`${msg}\n`);

  if (!process.env.HIVE_USERNAME) {
    logger("Warning: HIVE_USERNAME environment variable is not set");
  } else {
    logger(`Info: Using Hive account: ${process.env.HIVE_USERNAME}`);
  }

  if (!process.env.HIVE_POSTING_KEY) {
    logger("Warning: HIVE_POSTING_KEY environment variable is not set");
  } else {
    logger("Info: HIVE_POSTING_KEY is set");

    // Validate private key format (without logging the actual key)
    try {
      PrivateKey.fromString(process.env.HIVE_POSTING_KEY);
      logger("Info: HIVE_POSTING_KEY is valid");
    } catch (error) {
      logger("Warning: HIVE_POSTING_KEY is not a valid private key");
    }
  }

  // Add validation for active key which is needed for transfers
  if (!process.env.HIVE_ACTIVE_KEY) {
    logger(
      "Warning: HIVE_ACTIVE_KEY environment variable is not set (required for token transfers)"
    );
  } else {
    logger("Info: HIVE_ACTIVE_KEY is set");

    // Validate active key format
    try {
      PrivateKey.fromString(process.env.HIVE_ACTIVE_KEY);
      logger("Info: HIVE_ACTIVE_KEY is valid");
    } catch (error) {
      logger("Warning: HIVE_ACTIVE_KEY is not a valid private key");
    }
  }

  // Add validation for memo key
  if (!process.env.HIVE_MEMO_KEY) {
    logger("Warning: HIVE_MEMO_KEY environment variable is not set");
  } else {
    logger("Info: HIVE_MEMO_KEY is set");

    // Validate memo key format
    try {
      PrivateKey.fromString(process.env.HIVE_MEMO_KEY);
      logger("Info: HIVE_MEMO_KEY is valid");
    } catch (error) {
      logger("Warning: HIVE_MEMO_KEY is not a valid private key");
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
};

startServer().catch((err) => console.error("Server failed to start:", err));
