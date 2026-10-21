import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from backend.app.config import settings

logger = logging.getLogger(__name__)

class AzureDevOpsClient:
    """
    Azure DevOps REST API integration for creating/updating Work Items
    flagged as 'Blocked' with citation metadata.
    Operates in Mock Mode by default when PAT is unset.
    """

    def __init__(self):
        self.org = settings.AZURE_DEVOPS_ORG
        self.project = settings.AZURE_DEVOPS_PROJECT
        self.pat = settings.AZURE_DEVOPS_PAT
        self.is_mock = not bool(self.pat)

    def build_patch_document(
        self,
        title: str,
        description: str,
        owner: str,
        citations: List[Dict[str, Any]],
        area_path: Optional[str] = None,
        iteration_path: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Construct standard JSON Patch operations for Azure DevOps Work Item tracking."""
        citations_html = ""
        if citations:
            citations_html = "<h4>Verified Chat Evidence (SyncBrief AI):</h4><ul>"
            for c in citations:
                status_color = "#107c41" if c.get("status") == "VERIFIED" else "#d83b01"
                citations_html += (
                    f"<li><span style='color:{status_color}; font-weight:bold;'>[{c.get('status')}]</span> "
                    f"<b>{c.get('channel')}</b> by {c.get('author')}: "
                    f"<i>&ldquo;{c.get('quote')}&rdquo;</i> (ID: <code>{c.get('message_id')}</code>)</li>"
                )
            citations_html += "</ul>"

        full_description = f"<div><p>{description}</p>{citations_html}</div>"

        patch_doc = [
            {
                "op": "add",
                "path": "/fields/System.Title",
                "value": f"[SyncBrief Blocker] {title}"
            },
            {
                "op": "add",
                "path": "/fields/System.Description",
                "value": full_description
            },
            {
                "op": "add",
                "path": "/fields/Microsoft.VSTS.CMMI.Blocked",
                "value": "Yes"
            },
            {
                "op": "add",
                "path": "/fields/System.Tags",
                "value": "SyncBrief; AI-Blocker; WorkIntelligence"
            },
            {
                "op": "add",
                "path": "/fields/System.AssignedTo",
                "value": owner
            }
        ]

        if area_path:
            patch_doc.append({
                "op": "add",
                "path": "/fields/System.AreaPath",
                "value": area_path
            })

        if iteration_path:
            patch_doc.append({
                "op": "add",
                "path": "/fields/System.IterationPath",
                "value": iteration_path
            })

        return patch_doc

    async def create_blocked_work_item(
        self,
        blocker_id: int,
        title: str,
        description: str,
        owner: str,
        citations: List[Dict[str, Any]],
        area_path: Optional[str] = None,
        iteration_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a Work Item in Azure DevOps or return a deterministic mock payload."""
        patch_doc = self.build_patch_document(
            title=title,
            description=description,
            owner=owner,
            citations=citations,
            area_path=area_path or f"{self.project}\\Engineering",
            iteration_path=iteration_path or f"{self.project}\\CurrentSprint"
        )

        mock_work_item_id = f"ADO-{4800 + blocker_id}"

        if self.is_mock:
            logger.info(f"Azure DevOps PAT not provided, creating Mock Work Item {mock_work_item_id}")
            return {
                "id": mock_work_item_id,
                "url": f"https://dev.azure.com/{self.org}/{self.project}/_workitems/edit/{mock_work_item_id}",
                "status": "Created (Mock Mode)",
                "fields": {
                    "System.Title": f"[SyncBrief Blocker] {title}",
                    "System.State": "To Do",
                    "Microsoft.VSTS.CMMI.Blocked": "Yes",
                    "System.AssignedTo": owner,
                    "System.AreaPath": area_path or f"{self.project}\\Engineering"
                },
                "request_payload": patch_doc,
                "is_mock": True
            }

        # Real Azure DevOps REST call
        url = f"https://dev.azure.com/{self.org}/{self.project}/_apis/wit/workitems/$Task?api-version=7.1-preview.3"
        headers = {
            "Content-Type": "application/json-patch+json"
        }
        auth = ("", self.pat)

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(url, json=patch_doc, headers=headers, auth=auth, timeout=10.0)
                resp.raise_for_status()
                data = resp.json()
                return {
                    "id": f"ADO-{data.get('id')}",
                    "url": data.get("_links", {}).get("html", {}).get("href", ""),
                    "status": "Created (Live Azure DevOps)",
                    "fields": data.get("fields", {}),
                    "request_payload": patch_doc,
                    "is_mock": False
                }
            except Exception as e:
                logger.error(f"Failed to post to real Azure DevOps: {e}. Falling back to mock response.")
                return {
                    "id": mock_work_item_id,
                    "url": f"https://dev.azure.com/{self.org}/{self.project}/_workitems/edit/{mock_work_item_id}",
                    "status": f"Fallback Mock (Error: {str(e)[:60]})",
                    "fields": {
                        "System.Title": f"[SyncBrief Blocker] {title}",
                        "Microsoft.VSTS.CMMI.Blocked": "Yes"
                    },
                    "request_payload": patch_doc,
                    "is_mock": True
                }

devops_client = AzureDevOpsClient()
