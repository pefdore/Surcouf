"""Exécute des instructions SQL sur la base Neon du projet Rennes-sur-Couffes,
via le connecteur Neon de l'utilisateur (exécution en son nom, on_behalf_of)."""

from typing import Any

import pydantic
import mistralai.workflows as workflows
from mistralai.workflows import Depends
from mistralai.workflows.plugins.mistralai.connectors import (
    ToolCallClient,
    connector,
    uses_connectors,
)

neon = connector("neon_a06a", run_as="auto")


class SqlInput(pydantic.BaseModel):
    statements: list[str]


class SqlOutput(pydantic.BaseModel):
    results: Any


@workflows.activity(name="run-neon-sql")
async def run_neon_sql(
    statements: list[str],
    neon_client: ToolCallClient = Depends(neon),
) -> Any:
    return await neon_client.call_tool("run_sql_transaction", {"sql_statements": statements})


@workflows.workflow.define(
    name="surcouf-neon-sql",
    workflow_display_name="Surcouf — SQL Neon",
    workflow_description="Exécute une liste d'instructions SQL sur la base Neon de la rue Surcouf (au nom de l'utilisateur).",
    on_behalf_of=True,
)
@uses_connectors(neon)
class SurcoufNeonSqlWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, input: SqlInput) -> SqlOutput:
        results = await run_neon_sql(input.statements)
        return SqlOutput(results=results)
