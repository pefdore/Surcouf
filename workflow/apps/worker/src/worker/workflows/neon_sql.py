"""Exécute des appels d'outils sur la base Neon du projet Rennes-sur-Couffes,
via le connecteur Neon de l'utilisateur (exécution en son nom, on_behalf_of).

Le workflow accepte une liste d'appels {tool, arguments}, restreinte à une
liste d'outils autorisés, et renvoie la réponse de chaque appel (ou l'erreur
rencontrée, sans faire échouer l'exécution entière).
"""

from typing import Any

import pydantic
import mistralai.workflows as workflows
from mistralai.workflows import Depends
from mistralai.workflows.plugins.mistralai.connectors import (
    ConnectorToolCallError,
    ToolCallClient,
    connector,
    uses_connectors,
)

neon = connector("neon_a06a", run_as="auto")

ALLOWED_TOOLS = {"list_projects", "run_sql", "run_sql_transaction", "get_connection_string"}


class NeonCall(pydantic.BaseModel):
    tool: str
    arguments: dict[str, Any] = pydantic.Field(default_factory=dict)

    @pydantic.field_validator("tool")
    @classmethod
    def check_tool(cls, v: str) -> str:
        if v not in ALLOWED_TOOLS:
            raise ValueError(f"tool not allowed: {v}")
        return v


class NeonCallsInput(pydantic.BaseModel):
    calls: list[NeonCall]


class NeonCallsOutput(pydantic.BaseModel):
    results: list[Any]


@workflows.activity(name="run-neon-sql")
async def run_neon_sql(
    calls: list[dict[str, Any]],
    neon_client: ToolCallClient = Depends(neon),
) -> list[Any]:
    results: list[Any] = []
    for call in calls:
        tool = call["tool"]
        if tool not in ALLOWED_TOOLS:
            results.append({"error": f"tool not allowed: {tool}"})
            continue
        try:
            results.append(await neon_client.call_tool(tool, call.get("arguments") or {}))
        except ConnectorToolCallError as exc:
            results.append({"error": str(exc)})
    return results


@workflows.workflow.define(
    name="surcouf-neon-sql",
    workflow_display_name="Surcouf — SQL Neon",
    workflow_description="Exécute des appels d'outils Neon autorisés sur le projet de la rue Surcouf (au nom de l'utilisateur).",
    on_behalf_of=True,
)
@uses_connectors(neon)
class SurcoufNeonSqlWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, input: NeonCallsInput) -> NeonCallsOutput:
        results = await run_neon_sql([c.model_dump() for c in input.calls])
        return NeonCallsOutput(results=results)
