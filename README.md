[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/gluneau-hive-mcp-server-badge.png)](https://mseep.ai/app/gluneau-hive-mcp-server)

# Hive MCP Server

[![Verified on MseeP](https://mseep.ai/badge.svg)](https://mseep.ai/app/b56d1a0d-8755-4019-9955-ee901ad896eb)
[![smithery badge](https://smithery.ai/badge/@gluneau/hive-mcp-server)](https://smithery.ai/server/@gluneau/hive-mcp-server)
[![glama badge](https://glama.ai/mcp/servers/pobodojvqv/badge)](https://glama.ai/mcp/servers/pobodojvqv)

An MCP server that enables AI assistants to interact with the Hive blockchain through the Model Context Protocol.

## Overview

This server provides a bridge between AI assistants (like Claude) and the Hive blockchain, allowing AI models to:

- Fetch account information and history
- Retrieve blog posts and discussions
- Get posts by tag or user
- Vote on content and create posts (when properly authenticated)
- Send HIVE or HBD tokens to other accounts
- Sign and verify messages with Hive keys
- Send and receive encrypted messages

## Features

### Prompts

- `create-post` - Creates a structured prompt to guide the AI through creating a new Hive post with the right format and tags
- `analyze-account` - Generates a prompt to analyze a Hive account's statistics, posting history, and activity patterns

### Tools

#### Reading Data

- `get_account_info` - Get detailed information about a Hive blockchain account
- `get_post_content` - Retrieve a specific post by author and permlink
- `get_posts_by_tag` - Retrieve posts by tag and category (trending, hot, etc.)
- `get_posts_by_user` - Fetch posts from a specific user or their feed
- `get_account_history` - Get transaction history for an account with optional operation filtering
- `get_chain_properties` - Fetch current Hive blockchain properties and statistics
- `get_vesting_delegations` - Get a list of vesting delegations made by a specific account

#### Blockchain Interactions (Require Authentication)

- `vote_on_post` - Vote on Hive content (requires posting key)
- `create_post` - Create new blog posts on the Hive blockchain (requires posting key)
- `create_comment` - Comment on existing posts or reply to comments (requires posting key)
- `send_token` - Send HIVE or HBD cryptocurrency to other accounts (requires active key)

#### Cryptography

- `sign_message` - Sign a message using a Hive private key
- `verify_signature` - Verify a message signature against a Hive public key

#### Encrypted Messaging

- `encrypt_message` - Encrypt a message for a specific Hive account
- `decrypt_message` - Decrypt an encrypted message from a specific Hive account
- `send_encrypted_message` - Send an encrypted message using a token transfer
- `get_encrypted_messages` - Retrieve and optionally decrypt messages from account history

## Debugging with MCP Inspector

The MCP Inspector provides an interactive interface for testing and debugging the server:

```bash
npx @modelcontextprotocol/inspector npx @gluneau/hive-mcp-server
```

### Authentication Configuration

To enable authenticated operations (voting, posting, sending tokens), you'll need to set environment variables:

```bash
export HIVE_USERNAME=your-hive-username
export HIVE_POSTING_KEY=your-hive-posting-private-key  # For content operations
export HIVE_ACTIVE_KEY=your-hive-active-private-key    # For token transfers
export HIVE_MEMO_KEY=your-hive-memo-private-key        # For encrypted messaging
```

**Security Note**: Never share your private keys or commit them to version control. Use environment variables or a secure configuration approach.

## Integration with AI Assistants

### Claude Desktop

To use this server with Claude Desktop:

1. Ensure you have [Claude Desktop](https://claude.ai/download) installed
2. Open or create the Claude configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

3. Add this server to your configuration:

```json
{
  "mcpServers": {
    "hive": {
      "command": "npx",
      "args": ["-y", "@gluneau/hive-mcp-server"],
      "env": {
        "HIVE_USERNAME": "your-hive-username",
        "HIVE_POSTING_KEY": "your-hive-posting-private-key",
        "HIVE_ACTIVE_KEY": "your-hive-active-private-key",
        "HIVE_MEMO_KEY": "your-hive-memo-private-key"
      }
    }
  }
}
```

### Windsurf and Cursor

The same JSON configuration works for Windsurf (in `windsurf_config.json`) and for Cursor (in `~/.cursor/mcp.json` for version >= 0.47).

In previous versions, you'll have to use the 1 line command format in the MCP section of the Settings :
`env HIVE_USERNAME=your-hive-username env HIVE_POSTING_KEY=your-hive-posting-private-key env HIVE_ACTIVE_KEY=your-hive-active-private-key env HIVE_MEMO_KEY=your-hive-memo-private-key npx -y @gluneau/hive-mcp-server`

## Examples

Once connected to an MCP client, you can ask questions like:

- "What are the trending posts in the #photography tag on Hive?"
- "Show me the recent posts from username 'alice'"
- "What's the account balance and details for 'bob'?"
- "Get the transaction history for 'charlie'"
- "Can you upvote the post by 'dave' with permlink 'my-awesome-post'?"
- "Create a new post on Hive about AI technology"
- "Send 1 HIVE to user 'frank' with the memo 'Thanks for your help!'"
- "Sign this message with my Hive posting key: 'Verifying my identity'"
- "What are the current Hive blockchain properties?"
- "Show me the vesting delegations made by user 'grace'"
- "Encrypt this message for user 'alice': 'This is a secret message'"
- "Decrypt this message from 'bob': '#4f3a5b...'"
- "Send an encrypted message to 'charlie' saying 'Let's meet tomorrow'"
- "Show me my encrypted messages and decrypt them"
- "Get the last 10 encrypted messages I've exchanged with 'dave'"

## Tool Documentation

### `get_account_info`

Fetches detailed information about a Hive blockchain account including balance, authority, voting power, and other metrics.

- Parameters:
  - `username`: Hive username to fetch information for

### `get_post_content`

Retrieves a specific Hive blog post identified by author and permlink.

- Parameters:
  - `author`: Author of the post
  - `permlink`: Permlink of the post

### `get_posts_by_tag`

Retrieves Hive posts filtered by a specific tag and sorted by a category.

- Parameters:
  - `category`: Sorting category (trending, hot, created, etc.)
  - `tag`: The tag to filter posts by
  - `limit`: Number of posts to return (1-20)

### `get_posts_by_user`

Retrieves posts authored by or in the feed of a specific Hive user.

- Parameters:
  - `category`: Type of user posts to fetch (blog or feed)
  - `username`: Hive username to fetch posts for
  - `limit`: Number of posts to return (1-20)

### `get_account_history`

Retrieves transaction history for a Hive account with optional operation type filtering.

- Parameters:
  - `username`: Hive username
  - `limit`: Number of operations to return
  - `operation_filter`: Optional list of operation types to filter for

### `get_chain_properties`

Fetch current Hive blockchain properties and statistics.

- Parameters: None

### `get_vesting_delegations`

Get a list of vesting delegations made by a specific Hive account.

- Parameters:
  - `username`: Hive account to get delegations for
  - `limit`: Maximum number of delegations to retrieve
  - `from`: Optional starting account for pagination

### `vote_on_post`

Vote on a Hive post (upvote or downvote) using the configured Hive account.

- Parameters:
  - `author`: Author of the post to vote on
  - `permlink`: Permlink of the post to vote on
  - `weight`: Vote weight from -10000 (100% downvote) to 10000 (100% upvote)

### `create_post`

Create a new blog post on the Hive blockchain using the configured account.

- Parameters:
  - `title`: Title of the blog post
  - `body`: Content of the blog post (Markdown supported)
  - `tags`: Tags for the post
  - Various optional parameters for rewards, beneficiaries, etc.

### `create_comment`

Create a comment on an existing Hive post or reply to another comment.

- Parameters:
  - `parent_author`: Username of the post author or comment you're replying to
  - `parent_permlink`: Permlink of the post or comment you're replying to
  - `body`: Content of the comment (Markdown supported)
  - Various optional parameters for rewards, beneficiaries, etc.

### `send_token`

Send HIVE or HBD tokens to another Hive account using the configured account.

- Parameters:
  - `to`: Recipient Hive username
  - `amount`: Amount of tokens to send
  - `currency`: Currency to send (HIVE or HBD)
  - `memo`: Optional memo to include with the transaction

### `sign_message`

Sign a message using a Hive private key from environment variables.

- Parameters:
  - `message`: Message to sign
  - `key_type`: Type of key to use (posting, active, or memo)

### `verify_signature`

Verify a digital signature against a Hive public key.

- Parameters:
  - `message_hash`: The SHA-256 hash of the message in hex format
  - `signature`: Signature string to verify
  - `public_key`: Public key to verify against

### `encrypt_message`

Encrypt a message for a specific Hive account using memo encryption.

- Parameters:
  - `message`: Message to encrypt
  - `recipient`: Hive username of the recipient

### `decrypt_message`

Decrypt an encrypted message received from a specific Hive account.

- Parameters:
  - `encrypted_message`: Encrypted message (starts with #)
  - `sender`: Hive username of the sender

### `send_encrypted_message`

Send an encrypted message to a Hive account using a small token transfer.

- Parameters:
  - `message`: Message to encrypt and send
  - `recipient`: Hive username of the recipient
  - `amount`: Amount of HIVE to send (minimum 0.001, default: 0.001)

### `get_encrypted_messages`

Retrieve encrypted messages from account history with optional decryption.

- Parameters:
  - `username`: Hive username to fetch encrypted messages for
  - `limit`: Maximum number of messages to retrieve (default: 20)
  - `decrypt`: Whether to attempt decryption of messages (default: false)

## Development

### Project Structure

- `src/index.ts` - Main server implementation
- `src/tools/` - Implementation of all tools
- `src/schemas/` - Zod schemas for tool parameters
- `src/utils/` - Utility functions for interacting with the Hive blockchain
- `src/config/` - Client Configuration and log level handling

### Dependencies

- [@hiveio/dhive](https://www.npmjs.com/package/@hiveio/dhive) - Hive blockchain client
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - MCP SDK
- [zod](https://www.npmjs.com/package/zod) - Schema validation

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

See the [CONTRIBUTING.md](CONTRIBUTING.md) file for more detailed contribution guidelines.
