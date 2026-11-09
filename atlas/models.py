"""The shared contracts for forms, API requests, and model output."""
from datetime import date
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ResourceType = Literal["document", "dataset", "report"]
RelationType = Literal["describes", "derived from", "related to"]


class ResourceInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=180, description="Name of the resource only. Keep its supplied language; do not append owner or review instructions.")
    type: ResourceType = Field(description="Catalogue resource type: document, dataset or report; not an event row.")
    description: str = Field(default="", max_length=4000, description="What the resource is about. Event dates belong here if supplied; explicit review dates belong in reviewed_on.")
    owner: str = Field(default="", max_length=120, description="Responsible person (owner, vlastník, zodpovedná osoba). Preserve the supplied name.")
    url: str = Field(default="", max_length=1000, description="Explicit source link, or empty if unknown.")
    reviewed_on: date | None = Field(default=None, description="Reviewed / review date / dátum kontroly / posledná revízia. Date the RESOURCE was checked, in YYYY-MM-DD. Never the event/meeting date or document creation date. Null if unknown or ambiguous.")
    tags: list[str] = Field(default_factory=list, max_length=12, description="Short topic labels (tags, štítky).")

    @field_validator("url")
    @classmethod
    def http_url(cls, value):
        if value and (urlsplit(value).scheme not in {"http", "https"} or not urlsplit(value).netloc):
            raise ValueError("Use an absolute http:// or https:// URL, or leave it empty.")
        return value

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, values):
        cleaned = list(dict.fromkeys(tag.strip().lower() for tag in values if tag.strip()))
        if any(len(tag) > 40 for tag in cleaned):
            raise ValueError("Tags must be at most 40 characters.")
        return cleaned


class RelationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_id: int = Field(gt=0)
    kind: RelationType


class SuggestedRelation(RelationInput):
    reason: str = Field(min_length=1, max_length=500)


class Draft(ResourceInput):
    relations: list[SuggestedRelation] = Field(default_factory=list, max_length=8)


class AIResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["proposal", "answer", "refusal"]
    message: str = Field(min_length=1, max_length=4000)
    records: list[Draft] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def consistent_kind(self):
        if self.kind == "proposal" and not self.records:
            raise ValueError("A proposal must contain records.")
        if self.kind != "proposal" and self.records:
            raise ValueError("Answers and refusals cannot contain records.")
        return self


class AIRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12000)


class Confirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: str = Field(pattern=r"^[a-zA-Z0-9-]{8,80}$")
    records: list[Draft] = Field(min_length=1, max_length=8)
