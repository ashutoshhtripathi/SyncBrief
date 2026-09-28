# Microsoft Teams Integration Setup Guide

This guide walks through configuring **SyncBrief AI** with Microsoft Teams using Azure Bot Service and the Bot Framework Activity protocol.

---

## 1. Overview
SyncBrief AI integrates with Microsoft Teams in two primary workflows:
1. **Interactive Standup Check-in Card**: An Adaptive Card sent directly to team members as a proactive personal chat message at their configured standup time (e.g., 09:30 local time).
2. **Executive Daily Standup Digest**: Broadcasted to a designated channel (such as `#standup-updates` or `#general`) summarizing team velocity, risks, and high-severity blockers with clickable verified citations.
3. **Channel Message Ingestion**: SyncBrief listens to opted-in team channels (`#backend`, `#frontend`, `#devops`) to establish verifiable evidence links for cited blockers.

---

## 2. Architecture & Webhook Endpoints
- **Bot Framework Activity Webhook**: `POST /api/teams/messages`
- **Outgoing Card Notification Trigger**: `POST /api/teams/broadcast-digest`
- **Channel Message Ingestion**: `POST /api/teams/ingest`

---

## 3. Azure Bot Registration (5 Minutes)
1. Navigate to the [Azure Portal](https://portal.azure.com).
2. Search for and create an **Azure Bot** resource:
   - **Bot Handle**: `syncbrief-ai-bot`
   - **Pricing Tier**: Free (`F0`)
   - **Microsoft App ID / Type**: Multi-Tenant or Single-Tenant App Registration.
3. In the Azure Bot settings under **Configuration**:
   - Set **Messaging endpoint** to:
     `https://<your-syncbrief-domain>/api/teams/messages`
4. Under **Channels**, add **Microsoft Teams** and grant permissions for personal and channel messaging.
5. In your `.env` or App Service configuration:
   ```env
   TEAMS_APP_ID="your-azure-ad-app-id"
   TEAMS_APP_PASSWORD="your-azure-ad-client-secret"
   TEAMS_WEBHOOK_URL="https://outlook.office.com/webhook/..." # or incoming webhook connector
   ```

---

## 4. Microsoft Teams App Manifest (`manifest.json`)
Create an app package in Teams Developer Portal or Teams Toolkit:

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "c8a4df7a-3f41-4e78-95d1-93c4e097dcb2",
  "packageName": "com.syncbrief.teamsapp",
  "developer": {
    "name": "SyncBrief AI Team",
    "websiteUrl": "https://syncbrief.ai",
    "privacyUrl": "https://syncbrief.ai/privacy",
    "termsOfUseUrl": "https://syncbrief.ai/terms"
  },
  "name": {
    "short": "SyncBrief AI",
    "full": "SyncBrief AI Standup & Blocker Verifier"
  },
  "description": {
    "short": "Async standups with verifiable citations",
    "full": "Automated 60-second async standup updates with AI blocker detection cited to exact Teams messages."
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#0078D4",
  "bots": [
    {
      "botId": "<YOUR_AZURE_BOT_APP_ID>",
      "scopes": ["personal", "team", "groupchat"],
      "supportsFiles": false,
      "isNotificationOnly": false
    }
  ],
  "permissions": [
    "identity",
    "message.read"
  ]
}
```

---

## 5. Testing with the Built-in Simulator
You do not need an active Microsoft 365 tenant to demo SyncBrief!
1. SyncBrief includes a **Channel Simulator** mimicking Teams channels (`#backend`, `#frontend`, `#devops`).
2. When testing cards in the UI:
   - Click **"Preview Adaptive Card"** on the Check-in page or Digest page.
   - Click **"Post to Teams (Mock/Webhook)"** to inspect the live JSON payload.
   - The `/api/teams/messages` endpoint accepts standard mock Bot Framework payloads for automated testing.
