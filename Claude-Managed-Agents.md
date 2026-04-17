Here's a complete guide to calling this agent from your own app, including auth, session management, and progress monitoring:

Calling the Agent from Your App
1. Install the SDK
bashCopynpm install @anthropic-ai/sdk
# or
pip install anthropic

2. One-Time Setup — Create the Agent
You only need to do this once. Store the returned agent_id.
pythonCopyimport anthropic

client = anthropic.Anthropic(api_key="YOUR_ANTHROPIC_API_KEY")

agent = client.beta.agents.create(
    name="GitHub Issue Branch Agent",
    model="claude-sonnet-4-6",
    # ... your system prompt, tools, mcp_servers
)

# Store this — don't recreate it every run
AGENT_ID = agent.id  # e.g. "agent_abc123"

3. Per-Run — Create a Session & Stream Progress
pythonCopyimport anthropic
import os

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

AGENT_ID = "agent_abc123"       # from setup above
ENV_ID   = "env_0111rbjg46g8juhTDBkBTTFe"   # your new environment
VAULT_ID = "vlt_011Ca9MNUjarRM4LaJT6g3js"   # your GitHub vault

# 1. Create the session
session = client.beta.sessions.create(
    agent=AGENT_ID,
    environment_id=ENV_ID,
    vault_ids=[VAULT_ID],
    title="Issue #32 - Lucas-Free-Games/github-story-map",
    betas=["managed-agents-2026-04-01"],
)
session_id = session.id

# 2. Open the event stream FIRST, then send the message
import threading

def stream_events():
    with client.beta.sessions.events.stream(
        session_id=session_id,
        betas=["managed-agents-2026-04-01"],
    ) as stream:
        for event in stream:
            if event.type == "agent.message":
                print(f"[Agent] {event.content}")
            elif event.type == "agent.mcp_tool_use":
                print(f"[Tool] {event.name}({event.input})")
            elif event.type == "agent.mcp_tool_result":
                print(f"[Result] {event.content[:200]}")  # truncate for readability
            elif event.type == "session.status_idle":
                print(f"[Done] Usage: {event.usage}")
                break
            elif event.type == "session.error":
                print(f"[Error] {event.error}")
                break

# Start streaming in a background thread
t = threading.Thread(target=stream_events)
t.start()

# 3. Send the task message
client.beta.sessions.events.send(
    session_id=session_id,
    events=[{
        "type": "user.message",
        "content": [{"type": "text", "text": "implement issue #32 for Lucas-Free-Games/github-story-map"}]
    }],
    betas=["managed-agents-2026-04-01"],
)

t.join()  # wait for the session to go idle

# 4. Archive when done
client.beta.sessions.archive(session_id, betas=["managed-agents-2026-04-01"])
print("Session archived.")

4. Key Events to Monitor
EventWhat it meanssession.status_runningAgent started workingagent.mcp_tool_useGitHub API call in progress (e.g. creating branch, committing)agent.messageAgent narrating its progresssession.status_idleDone — agent finished the full workflowsession.errorSomething went wrong — check event.error

5. Authentication Summary
SecretWhere it goesANTHROPIC_API_KEYx-api-key header — passed via the SDK automaticallyGitHub OAuth tokenStored in vault vlt_011Ca9MNUjarRM4LaJT6g3js — referenced via vault_ids at session create
The vault handles GitHub MCP auth automatically — you never pass the GitHub token directly in your app code.